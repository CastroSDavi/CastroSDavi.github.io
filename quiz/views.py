# quiz/views.py
import json
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_GET
from django.utils import timezone
from datetime import timedelta  # Mantido, pode ser útil
from django.db.models import (
    Q, Sum, Count, Case, When, Value, FloatField, ExpressionWrapper, Prefetch,
    Max,
)
from django.contrib import messages
from django.urls import reverse_lazy
from django.contrib.auth.models import User
from collections import defaultdict

from .models import (
    Pergunta, Categoria, CategoriaHierarquia, OpcaoResposta,
    SessoesQuizUsuario, RespostasUsuarioPorSessao, EstatisticasDiariasUsuario,
    QuestaoFavorita,
    QuizDefinicao,  # NOVO MODELO
    QuizDefinicaoPergunta,  # NOVO MODELO
    ConfiguracoesGeraisQuiz  # NOVO MODELO
)
from .forms import (
    CustomUserCreationForm,
    UserUpdateForm,
    AccountDeleteForm,
    CustomPasswordChangeForm
)

from .services.quiz_service import QuizDataService
from .services.statistics_service import StatisticsService

# region Lógica de Negócio e Utilitários de Dados

# Cache simples em memória para configurações gerais
_quiz_config_cache = None


def invalidate_quiz_config_cache():
    """Limpa o cache em memória da configuração geral do quiz."""
    global _quiz_config_cache
    _quiz_config_cache = None


def get_quiz_config():
    """
    Retorna a instância (singleton) de Configuracoes GeraisQuiz.
    Cria uma instância com valores padrão se não existir, pressupondo que o ID/PK 1 é usado para o singleton.
    Cacheia a instância em memória para evitar queries repetidas durante o mesmo request/processo.
    """
    global _quiz_config_cache
    if _quiz_config_cache is None:
        config, created = ConfiguracoesGeraisQuiz.objects.get_or_create(
            pk=1,  # Garante que sempre tentamos obter/criar a mesma linha.
            defaults={
                'numero_perguntas_quiz_rapido': 10,  # Valor padrão
                'pontuacao_por_acerto': 15,       # Valor padrão
                'penalidade_por_erro': 5          # Valor padrão
            }
        )
        if created:
            # Idealmente, logar isso ou ter um passo de setup inicial para criar essa entrada.
            print(
                f"INFO: Instância de ConfiguracoesGeraisQuiz (pk=1) criada com valores padrão.")
        _quiz_config_cache = config
    return _quiz_config_cache


def get_descendant_category_ids(category_ids_str_list):
    """Wrapper que delega a lógica para o serviço de dados do quiz."""
    return QuizDataService.get_descendant_category_ids(category_ids_str_list)


def get_quiz_data_dict(
    category_ids_filter=None,
    difficulty_levels_filter=None,
    quiz_mode=None,
    question_count_str=None,
    num_questions_custom_str=None,
    user: User = None,
    quiz_definicao_id=None,
    search_query=None,
):
    service = QuizDataService(quiz_config=get_quiz_config(), user=user)
    return service.get_quiz_data_dict(
        category_ids_filter=category_ids_filter,
        difficulty_levels_filter=difficulty_levels_filter,
        quiz_mode=quiz_mode,
        question_count_str=question_count_str,
        num_questions_custom_str=num_questions_custom_str,
        quiz_definicao_id=quiz_definicao_id,
        search_query=search_query,
    )

# **** FUNÇÃO ADICIONADA AQUI ****


def get_or_create_daily_stats(user: User):
    """
    Obtém ou cria as estatísticas diárias para um dado usuário.
    """
    today = timezone.now().date()
    stats, created = EstatisticasDiariasUsuario.objects.get_or_create(
        id_usuario=user,
        data_estatistica=today,
        # Se o modelo EstatisticasDiariasUsuario tiver outros campos obrigatórios
        # que não têm um default no modelo, eles precisariam ser fornecidos aqui
        # no dicionário 'defaults'. Ex:
        # defaults={'algum_campo_obrigatorio': 0}
    )
    # Se precisar fazer algo específico quando um novo registro de stats é criado:
    # if created:
    #     # Lógica para quando um novo dia de estatísticas começa para o usuário
    #     pass
    return stats


def _filter_queryset_by_period(queryset, period_str: str, date_field_name: str = "data_estatistica"):
    return StatisticsService.filter_queryset_by_period(queryset, period_str, date_field_name)

# endregion

# region Funções Auxiliares para Estatísticas do Usuário


def _get_key_metrics(user: User, daily_stats_period_qs):
    return StatisticsService.get_key_metrics(user, daily_stats_period_qs)


def _resolve_period_day_count(period_str: str | None) -> int | None:
    """Converte o parâmetro de período (ex.: '30d', '7') para a quantidade de dias."""
    normalized = str(period_str).strip().lower() if period_str is not None else "30d"

    if normalized == "all":
        return None

    if normalized.endswith("d"):
        normalized = normalized[:-1]

    try:
        days = int(normalized)
    except (TypeError, ValueError):
        return None

    return days if days > 0 else None


def _get_overall_accuracy_data(daily_stats_period_qs):
    total_questions_answered = daily_stats_period_qs.aggregate(
        total=Sum('perguntas_respondidas_dia'))['total'] or 0
    total_correct_answers = daily_stats_period_qs.aggregate(
        total=Sum('acertos_dia'))['total'] or 0
    return {
        'correct': total_correct_answers,
        'incorrect': total_questions_answered - total_correct_answers,
    }


def _get_category_performance_data(user_sessions_period_qs):
    category_performance = {}
    main_categories = list(
        Categoria.objects.filter(id_categoria_pai__isnull=True)
    )

    responses_in_period = RespostasUsuarioPorSessao.objects.filter(
        id_sessao_quiz__in=user_sessions_period_qs,
        id_opcao_resposta_selecionada__isnull=False
    ).select_related('id_pergunta').prefetch_related('id_pergunta__categorias')

    descendant_map = defaultdict(set)
    if main_categories:
        main_category_ids = [cat.pk for cat in main_categories]
        for ancestor_id, descendant_id in CategoriaHierarquia.objects.filter(
            ancestor_id__in=main_category_ids
        ).values_list('ancestor_id', 'descendant_id'):
            descendant_map[ancestor_id].add(descendant_id)

    for resp in responses_in_period:
        pergunta_obj = resp.id_pergunta
        for main_cat_obj in main_categories:
            descendants = descendant_map.get(main_cat_obj.pk, {main_cat_obj.pk})
            if any(cat.pk in descendants for cat in pergunta_obj.categorias.all()):
                cat_name = main_cat_obj.nome_categoria
                if cat_name not in category_performance:
                    category_performance[cat_name] = {
                        'correct': 0, 'total': 0, 'id': main_cat_obj.pk}

                category_performance[cat_name]['total'] += 1
                if resp.foi_correta:
                    category_performance[cat_name]['correct'] += 1

    category_performance_list = []
    if category_performance:
        category_performance_list = [
            {'name': name, **data,
                'accuracy': (data['correct'] / data['total'] * 100) if data['total'] > 0 else 0}
            for name, data in category_performance.items() if data['total'] > 0
        ]
        category_performance_list.sort(
            key=lambda x: x['accuracy'], reverse=True)
    return category_performance_list


def _format_duration_compact(total_seconds):
    """Gera uma representação resumida para uma duração em segundos."""
    if total_seconds is None:
        return None

    try:
        total_seconds_int = int(total_seconds)
    except (TypeError, ValueError):
        return None

    total_seconds_int = max(total_seconds_int, 0)

    if total_seconds_int == 0:
        return "0 min"

    hours, remainder = divmod(total_seconds_int, 3600)
    minutes, seconds = divmod(remainder, 60)

    parts = []
    if hours:
        parts.append(f"{hours}h")
    if minutes:
        parts.append(f"{minutes}min")
    if not parts and seconds:
        parts.append(f"{seconds}s")

    return ' '.join(parts) if parts else "0 min"


def _build_account_profile_summary(user: User):
    """Monta dados ricos para o bloco de informações do usuário na conta."""
    full_name = (user.get_full_name() or '').strip()
    display_name = full_name if full_name else user.username

    initials_source = []
    for value in (user.first_name, user.last_name):
        cleaned = (value or '').strip()
        if cleaned:
            initials_source.append(cleaned[0])

    username_clean = (user.username or '').strip()
    if not initials_source and username_clean:
        initials_source.append(username_clean[0])
        if len(username_clean) > 1:
            initials_source.append(username_clean[1])

    initials = ''.join(initials_source[:2]).upper() or (username_clean[:2].upper() if username_clean else 'U')

    completed_sessions_qs = SessoesQuizUsuario.objects.filter(
        id_usuario=user,
        status_sessao=SessoesQuizUsuario.StatusSessao.COMPLETA,
    )

    aggregate_totals = completed_sessions_qs.aggregate(
        total_questions=Sum('total_perguntas_sessao'),
        total_correct=Sum('total_acertos'),
        total_score=Sum('pontuacao_final'),
        best_score=Max('pontuacao_final'),
    )

    total_sessions_completed = completed_sessions_qs.count()
    total_questions_answered = aggregate_totals.get('total_questions') or 0
    total_correct_answers = aggregate_totals.get('total_correct') or 0
    total_score_all_time = aggregate_totals.get('total_score') or 0
    best_score = aggregate_totals.get('best_score') or 0

    accuracy = None
    if total_questions_answered:
        accuracy = round((total_correct_answers / total_questions_answered) * 100, 1)

    favorite_mode = None
    if total_sessions_completed:
        mode_counts = (
            completed_sessions_qs.values('modo_quiz')
            .annotate(total=Count('id'))
            .order_by('-total', 'modo_quiz')
        )
        if mode_counts:
            favorite_mode = mode_counts[0]['modo_quiz']

    daily_stats_qs = EstatisticasDiariasUsuario.objects.filter(id_usuario=user)
    last_thirty_days_stats = _filter_queryset_by_period(daily_stats_qs, '30d', 'data_estatistica')

    study_time_last_30_seconds = last_thirty_days_stats.aggregate(
        total=Sum('tempo_estudo_segundos_dia')
    ).get('total') or 0
    questions_last_30_days = last_thirty_days_stats.aggregate(
        total=Sum('perguntas_respondidas_dia')
    ).get('total') or 0

    current_streak = daily_stats_qs.order_by('-data_estatistica').values_list(
        'sequencia_dias_quiz', flat=True
    ).first() or 0

    favorite_questions_count = user.questoes_favoritas.count()

    last_session = completed_sessions_qs.select_related('id_quiz_definicao').order_by('-data_inicio').first()
    last_session_info = None
    if last_session:
        session_accuracy = None
        if last_session.total_perguntas_sessao:
            session_accuracy = round(
                (last_session.total_acertos / last_session.total_perguntas_sessao) * 100,
                1,
            )

        duration_seconds = last_session.tempo_total_segundos
        if duration_seconds is None and last_session.data_fim:
            duration_seconds = int(
                max((last_session.data_fim - last_session.data_inicio).total_seconds(), 0)
            )

        last_session_info = {
            'id': last_session.pk,
            'mode': last_session.modo_quiz,
            'quiz_name': last_session.id_quiz_definicao.nome_quiz if last_session.id_quiz_definicao else None,
            'date': last_session.data_inicio,
            'score': last_session.pontuacao_final,
            'question_count': last_session.total_perguntas_sessao,
            'accuracy': session_accuracy,
            'duration_seconds': duration_seconds,
            'duration_display': _format_duration_compact(duration_seconds),
        }

    profile_fields_status = {
        'Nome': bool((user.first_name or '').strip()),
        'Sobrenome': bool((user.last_name or '').strip()),
        'Email': bool((user.email or '').strip()),
    }

    total_profile_fields = len(profile_fields_status)
    completed_fields = sum(1 for value in profile_fields_status.values() if value)
    completion_percentage = round((completed_fields / total_profile_fields) * 100) if total_profile_fields else 100
    missing_fields = [label for label, filled in profile_fields_status.items() if not filled]

    return {
        'display_name': display_name,
        'initials': initials,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'date_joined': user.date_joined,
        'last_login': user.last_login,
        'metrics': {
            'total_sessions': total_sessions_completed,
            'total_questions_answered': total_questions_answered,
            'accuracy': accuracy,
            'favorite_questions_count': favorite_questions_count,
            'total_score': total_score_all_time,
            'best_score': best_score,
            'favorite_mode': favorite_mode,
            'favorite_mode_display': favorite_mode or 'Ainda não definido',
            'study_time_last_30_seconds': study_time_last_30_seconds,
            'study_time_last_30_display': _format_duration_compact(study_time_last_30_seconds) or '0 min',
            'questions_last_30_days': questions_last_30_days,
            'current_streak': current_streak,
        },
        'completion': {
            'percentage': completion_percentage,
            'missing_fields': missing_fields,
        },
        'last_session': last_session_info,
    }


def _get_learning_progress_data(daily_stats_period_qs):
    raw_stats = daily_stats_period_qs.order_by('data_estatistica').values(
        'data_estatistica',
        'acertos_dia',
        'perguntas_respondidas_dia'
    )
    grouped_by_date = defaultdict(
        lambda: {'total_acertos_agg': 0, 'total_respondidas_agg': 0})
    for stat in raw_stats:
        date_key = stat['data_estatistica']
        grouped_by_date[date_key]['total_acertos_agg'] += stat.get(
            'acertos_dia', 0) or 0
        grouped_by_date[date_key]['total_respondidas_agg'] += stat.get(
            'perguntas_respondidas_dia', 0) or 0

    processed_data = []
    sorted_dates = sorted(grouped_by_date.keys())
    for date_key in sorted_dates:
        item = grouped_by_date[date_key]
        accuracy = 0
        if item['total_respondidas_agg'] > 0:
            accuracy = round(
                (item['total_acertos_agg'] / item['total_respondidas_agg']) * 100, 1)

        processed_data.append({
            'date_str': date_key.isoformat() if date_key else None,
            'daily_accuracy': accuracy
        })
    return processed_data


def _get_study_heatmap_data(daily_stats_period_qs):
    raw_stats = daily_stats_period_qs.order_by('data_estatistica').values(
        'data_estatistica',
        'perguntas_respondidas_dia'
    )
    grouped_by_date = defaultdict(lambda: {'questions_done': 0})
    for stat in raw_stats:
        date_key = stat['data_estatistica']
        grouped_by_date[date_key]['questions_done'] += stat.get(
            'perguntas_respondidas_dia', 0) or 0

    processed_data = []
    sorted_dates = sorted(grouped_by_date.keys())
    for date_key in sorted_dates:
        item = grouped_by_date[date_key]
        processed_data.append({
            'date_str': date_key.isoformat() if date_key else None,
            'questions_done': item['questions_done']
        })
    return processed_data


def _get_study_time_detail_data(user: User):
    seven_days_ago = timezone.now().date() - timedelta(days=6)
    today = timezone.now().date()
    daily_study_seconds = {i: 0 for i in range(7)}

    user_daily_stats = EstatisticasDiariasUsuario.objects.filter(
        id_usuario=user,
        data_estatistica__gte=seven_days_ago,
        data_estatistica__lte=today
    ).values('data_estatistica', 'tempo_estudo_segundos_dia')

    for stat in user_daily_stats:
        py_weekday = stat['data_estatistica'].weekday()
        daily_study_seconds[py_weekday] += stat.get(
            'tempo_estudo_segundos_dia', 0) or 0

    day_labels_pt_ordered_sun_first = [
        "Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

    ordered_minutes_data = [
        round((daily_study_seconds.get(6, 0) or 0) / 60),
        round((daily_study_seconds.get(0, 0) or 0) / 60),
        round((daily_study_seconds.get(1, 0) or 0) / 60),
        round((daily_study_seconds.get(2, 0) or 0) / 60),
        round((daily_study_seconds.get(3, 0) or 0) / 60),
        round((daily_study_seconds.get(4, 0) or 0) / 60),
        round((daily_study_seconds.get(5, 0) or 0) / 60)
    ]
    return {
        'labels': day_labels_pt_ordered_sun_first,
        'data': ordered_minutes_data
    }


def _get_period_activity_summary(daily_stats_period_qs, user_sessions_period_qs, requested_days: int | None):
    aggregates = daily_stats_period_qs.aggregate(
        total_questions=Sum('perguntas_respondidas_dia'),
        total_study_time=Sum('tempo_estudo_segundos_dia'),
    )
    total_questions = aggregates.get('total_questions') or 0
    total_study_time = aggregates.get('total_study_time') or 0

    active_days = daily_stats_period_qs.filter(
        perguntas_respondidas_dia__gt=0
    ).values('data_estatistica').distinct().count()
    tracked_days = daily_stats_period_qs.values('data_estatistica').distinct().count()

    average_questions_per_active_day = (
        total_questions / active_days if active_days else 0
    )

    denominator_days = requested_days or tracked_days or active_days
    average_questions_per_day = (
        total_questions / denominator_days if denominator_days else 0
    )

    average_study_time_per_active_day_seconds = (
        total_study_time / active_days if active_days else 0
    )

    session_durations = []
    for session in user_sessions_period_qs.values(
        'tempo_total_segundos', 'data_inicio', 'data_fim'
    ):
        duration_seconds = session.get('tempo_total_segundos')
        start_dt = session.get('data_inicio')
        end_dt = session.get('data_fim')
        if duration_seconds is None and start_dt and end_dt:
            duration_seconds = int(max((end_dt - start_dt).total_seconds(), 0))
        if duration_seconds is not None and duration_seconds >= 0:
            session_durations.append(duration_seconds)

    average_session_duration_seconds = 0
    if session_durations:
        average_session_duration_seconds = sum(session_durations) / len(session_durations)

    last_activity_date = daily_stats_period_qs.order_by('-data_estatistica').values_list(
        'data_estatistica', flat=True
    ).first()

    denominator_for_ratio = (denominator_days or 0)
    active_day_ratio = (
        (active_days / denominator_for_ratio) if denominator_for_ratio else 0
    )

    return {
        'active_days': active_days,
        'tracked_days': tracked_days,
        'requested_days': requested_days,
        'total_questions_answered': total_questions,
        'average_questions_per_active_day': round(average_questions_per_active_day, 2) if average_questions_per_active_day else 0,
        'average_questions_per_day': round(average_questions_per_day, 2) if average_questions_per_day else 0,
        'total_study_time_seconds': total_study_time,
        'average_study_time_per_active_day_seconds': round(average_study_time_per_active_day_seconds, 2) if average_study_time_per_active_day_seconds else 0,
        'sessions_completed': user_sessions_period_qs.count(),
        'sessions_with_duration': len(session_durations),
        'average_session_duration_seconds': round(average_session_duration_seconds, 2) if average_session_duration_seconds else 0,
        'active_day_ratio': round(active_day_ratio, 4) if active_day_ratio else 0,
        'last_activity_date': last_activity_date.isoformat() if last_activity_date else None,
        'has_activity': bool(total_questions or total_study_time or session_durations),
    }


def _get_accuracy_trend_summary(learning_progress_data):
    valid_points = [
        point for point in learning_progress_data
        if point and point.get('daily_accuracy') is not None and point.get('date_str')
    ]

    if not valid_points:
        return {
            'has_data': False,
            'data_point_count': 0,
        }

    first_point = valid_points[0]
    last_point = valid_points[-1]

    start_accuracy = float(first_point.get('daily_accuracy') or 0)
    end_accuracy = float(last_point.get('daily_accuracy') or 0)
    delta = round(end_accuracy - start_accuracy, 1)

    direction_threshold = 0.1
    if delta > direction_threshold:
        direction = 'up'
    elif delta < -direction_threshold:
        direction = 'down'
    else:
        direction = 'flat'

    return {
        'has_data': True,
        'data_point_count': len(valid_points),
        'has_multiple_points': len(valid_points) > 1,
        'start_accuracy': round(start_accuracy, 1),
        'end_accuracy': round(end_accuracy, 1),
        'delta': delta,
        'direction': direction,
        'first_date': first_point.get('date_str'),
        'last_date': last_point.get('date_str'),
    }


def _get_difficulty_performance_data(user_sessions_period_qs):
    difficulty_performance = {choice[0]: {
        'correct': 0, 'total': 0} for choice in Pergunta.NivelDificuldade.choices}

    responses_in_period = RespostasUsuarioPorSessao.objects.filter(
        id_sessao_quiz__in=user_sessions_period_qs,
        id_opcao_resposta_selecionada__isnull=False
    ).select_related('id_pergunta')

    for resp in responses_in_period:
        pergunta_obj = resp.id_pergunta
        diff_level = pergunta_obj.nivel_dificuldade
        if diff_level in difficulty_performance:
            difficulty_performance[diff_level]['total'] += 1
            if resp.foi_correta:
                difficulty_performance[diff_level]['correct'] += 1

    return [
        {'name': name, **data,
            'accuracy': (data['correct'] / data['total'] * 100) if data['total'] > 0 else 0}
        for name, data in difficulty_performance.items() if data['total'] > 0
    ]
# endregion

# region Views Principais (Páginas HTML)


@login_required
def home_view(request):
    daily_stats = None
    accuracy_percentage_str = "0%"
    if request.user.is_authenticated:
        # **** CHAMADA CORRIGIDA ****
        daily_stats = get_or_create_daily_stats(request.user)
        if daily_stats and daily_stats.perguntas_respondidas_dia > 0:
            accuracy = (daily_stats.acertos_dia /
                        daily_stats.perguntas_respondidas_dia) * 100
            accuracy_percentage_str = f"{accuracy:.0f}%"
        elif daily_stats:
            accuracy_percentage_str = "0%"

    context = {
        'page_title': 'MedQuiz - Início',
        'daily_stats': daily_stats,
        'accuracy_percentage': accuracy_percentage_str,
    }
    return render(request, 'quiz/home.html', context)


@login_required
def questions_view(request):
    context = {
        'page_title': 'MedQuiz - Questões',
    }
    return render(request, 'quiz/questions_page.html', context)


def register_view(request):
    if request.user.is_authenticated:
        return redirect('quiz:home')
    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            messages.success(
                request, 'Cadastro realizado com sucesso! Bem-vindo(a).')
            return redirect('quiz:home')
        else:
            for field, errors in form.errors.items():
                field_label = form.fields[field].label if field in form.fields and field != '__all__' else ''
                for error in errors:
                    messages.error(
                        request, f"{field_label if field_label else 'Erro Geral'}: {error}".strip(': '))
            if not form.errors:
                messages.error(
                    request, 'Por favor, corrija os erros abaixo para prosseguir.')
    else:
        form = CustomUserCreationForm()
    context = {'form': form, 'page_title': 'Cadastro - MedQuiz'}
    return render(request, 'quiz/register.html', context)


@login_required
def account_view(request):
    user_sessions = SessoesQuizUsuario.objects.filter(
        id_usuario=request.user).order_by('-data_inicio')[:10]
    update_form = UserUpdateForm(instance=request.user)
    delete_form = AccountDeleteForm(user=request.user)
    context = {
        'page_title': 'MedQuiz - Minha Conta',
        'user_sessions': user_sessions,
        'update_form': update_form,
        'delete_form': delete_form,
        'profile_summary': _build_account_profile_summary(request.user),
    }
    return render(request, 'quiz/account_page.html', context)


@login_required
def update_profile_view(request):
    if request.method == 'POST':
        form = UserUpdateForm(request.POST, instance=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, 'Seu perfil foi atualizado com sucesso!')
            return redirect('quiz:account')
        else:
            user_sessions = SessoesQuizUsuario.objects.filter(
                id_usuario=request.user).order_by('-data_inicio')[:10]
            delete_form = AccountDeleteForm(user=request.user)
            for field, errors_list in form.errors.items():
                field_label = form.fields[field].label if field in form.fields and field != '__all__' else ''
                for error in errors_list:
                    messages.error(
                        request, f"{field_label if field_label else 'Formulário'}: {error}".strip(': '))
            if not form.errors:
                messages.error(
                    request, 'Não foi possível atualizar seu perfil. Verifique os dados.')
            context = {
                'page_title': 'MedQuiz - Minha Conta', 'user_sessions': user_sessions,
                'update_form': form, 'delete_form': delete_form,
                'active_tab_on_error': 'security-content'
            }
            context['profile_summary'] = _build_account_profile_summary(request.user)
            return render(request, 'quiz/account_page.html', context)
    return redirect('quiz:account')


@login_required
@require_POST
def delete_account_view(request):
    form = AccountDeleteForm(request.user, request.POST)
    if form.is_valid():
        user_to_delete = request.user
        logout(request)
        user_to_delete.delete()
        messages.success(request, 'Sua conta foi excluída com sucesso.')
        return redirect(reverse_lazy('quiz:home'))
    else:
        user_sessions = SessoesQuizUsuario.objects.filter(
            id_usuario=request.user).order_by('-data_inicio')[:10]
        update_form = UserUpdateForm(instance=request.user)
        for field, errors_list in form.errors.items():
            field_label = form.fields[field].label if field in form.fields and field != '__all__' else ''
            for error in errors_list:
                messages.error(
                    request, f"{field_label if field_label else 'Formulário de Deleção'}: {error}".strip(': '))
        if not form.errors:
            messages.error(
                request, 'Não foi possível excluir sua conta. Verifique sua senha.')

        context = {
            'page_title': 'MedQuiz - Minha Conta',
            'user_sessions': user_sessions,
            'update_form': update_form,
            'delete_form': form,
            'active_tab_on_error': 'security-content',
            'show_delete_account_modal_on_error': True
        }
        context['profile_summary'] = _build_account_profile_summary(request.user)
        return render(request, 'quiz/account_page.html', context)
    return redirect('quiz:account')

# endregion

# region API Views para Quiz e Dados do Usuário


@require_GET
def api_get_quiz_summary_view(request):
    """Retorna estatísticas agregadas leves para inicialização da interface."""
    try:
        perguntas_ativas = Pergunta.objects.filter(ativa=True)
        total_questions = perguntas_ativas.count()

        categorias_qs = Categoria.objects.annotate(
            total_perguntas=Count(
                'perguntas_associadas',
                filter=Q(perguntas_associadas__ativa=True)
            )
        ).order_by('nome_categoria')

        quiz_config = get_quiz_config()
        quick_quiz_default = None
        if quiz_config:
            quick_quiz_default = getattr(quiz_config, 'numero_perguntas_quiz_rapido', None)

        categorias_data = [
            {
                'id_categoria': categoria.pk,
                'nome_categoria': categoria.nome_categoria,
                'id_categoria_pai': categoria.id_categoria_pai_id,
                'total_perguntas': categoria.total_perguntas or 0,
            }
            for categoria in categorias_qs
        ]

        return JsonResponse({
            'status': 'success',
            'total_questions': total_questions,
            'total_categories': len(categorias_data),
            'quick_quiz_default_count': quick_quiz_default,
            'categories': categorias_data,
        })
    except Exception:
        return JsonResponse(
            {'status': 'error', 'message': 'Erro ao buscar resumo inicial.'},
            status=500
        )


@require_GET
def api_get_quiz_data_view(request):
    category_ids_str = request.GET.get('category_ids')
    difficulty_levels_str = request.GET.get('difficulty_levels')
    quiz_mode_str = request.GET.get('mode')
    question_count_str = request.GET.get('count')
    num_questions_custom_str = request.GET.get('num_questions')
    quiz_definicao_id_str = request.GET.get('quiz_definicao_id')
    search_query = request.GET.get('search_query')

    category_ids_filter = [cid.strip() for cid in category_ids_str.split(
        ',') if cid.strip()] if category_ids_str else None
    difficulty_levels_filter = [diff.strip() for diff in difficulty_levels_str.split(
        ',') if diff.strip()] if difficulty_levels_str else None

    quiz_definicao_id = None
    if quiz_definicao_id_str and quiz_definicao_id_str.isdigit():
        quiz_definicao_id = int(quiz_definicao_id_str)
        quiz_mode_str = SessoesQuizUsuario.ModoQuiz.DEFINIDO

    user_for_favorites = request.user if request.user.is_authenticated else None

    try:
        quiz_data = get_quiz_data_dict(
            category_ids_filter=category_ids_filter,
            difficulty_levels_filter=difficulty_levels_filter,
            quiz_mode=quiz_mode_str,
            question_count_str=question_count_str,
            num_questions_custom_str=num_questions_custom_str,
            user=user_for_favorites,
            quiz_definicao_id=quiz_definicao_id,
            search_query=search_query,
        )
        return JsonResponse(quiz_data)
    except Exception as e:
        print(f"Erro em api_get_quiz_data_view: {type(e).__name__} - {e}")
        return JsonResponse({'status': 'error', 'message': 'Erro ao buscar dados do quiz.'}, status=500)


@require_GET
def api_get_filtered_question_count_view(request):
    """
    Uma view otimizada que retorna apenas a CONTAGEM de questões 
    com base nos filtros fornecidos, usando o padrão Django puro.
    """
    try:
        perguntas_qs = Pergunta.objects.filter(ativa=True)

        # Filtro por Categorias
        category_ids_str = request.GET.get('category_ids')
        if category_ids_str:
            # Usando a lógica de descendentes que já existe no seu código
            category_ids_list = [
                cid.strip() for cid in category_ids_str.split(',') if cid.strip()]
            descendant_ids = get_descendant_category_ids(category_ids_list)
            if descendant_ids:
                perguntas_qs = perguntas_qs.filter(
                    categorias__pk__in=descendant_ids).distinct()

        # Filtro por Nível de Dificuldade
        difficulty_levels_str = request.GET.get('difficulty_levels')
        if difficulty_levels_str and 'all' not in difficulty_levels_str:
            difficulty_levels = [
                level.strip() for level in difficulty_levels_str.split(',') if level.strip()]
            if difficulty_levels:
                # Normalizando para corresponder aos valores do modelo
                q_difficulty_objects = Q()
                valid_model_difficulties = [
                    choice[0] for choice in Pergunta.NivelDificuldade.choices]
                for level_from_filter in difficulty_levels:
                    for model_level in valid_model_difficulties:
                        if level_from_filter.lower() == model_level.lower():
                            q_difficulty_objects |= Q(
                                nivel_dificuldade=model_level)
                            break
                if q_difficulty_objects:
                    perguntas_qs = perguntas_qs.filter(q_difficulty_objects)

        # Retorna apenas a contagem. Esta é uma operação de banco de dados muito rápida.
        count = perguntas_qs.count()
        return JsonResponse({'count': count})

    except Exception as e:
        print(
            f"Erro em api_get_filtered_question_count_view: {type(e).__name__} - {e}")
        return JsonResponse({'status': 'error', 'message': 'Erro ao buscar contagem de questões.'}, status=500)


@login_required
@require_POST
def start_quiz_session_view(request):
    try:
        data = json.loads(request.body.decode('utf-8'))
        modo_quiz_frontend = data.get('modo_quiz')
        categoria_ids_str_list = data.get('categoria_ids', [])
        question_ids_in_session = data.get('question_ids_in_session', [])
        quiz_definicao_id = data.get('quiz_definicao_id')

        if not isinstance(question_ids_in_session, list) or not all(isinstance(qid, int) for qid in question_ids_in_session):
            return JsonResponse({'status': 'error', 'message': 'IDs de perguntas da sessão inválidos.'}, status=400)

        total_perguntas_sessao = len(question_ids_in_session)
        if not modo_quiz_frontend or total_perguntas_sessao <= 0:
            return JsonResponse({'status': 'error', 'message': 'Dados inválidos para iniciar sessão (modo ou nº de perguntas).'}, status=400)

        if modo_quiz_frontend not in SessoesQuizUsuario.ModoQuiz.values:
            return JsonResponse({'status': 'error', 'message': f"Modo de quiz '{modo_quiz_frontend}' inválido."}, status=400)

        quiz_definicao_obj = None
        if modo_quiz_frontend == SessoesQuizUsuario.ModoQuiz.DEFINIDO:
            if not quiz_definicao_id:
                return JsonResponse({'status': 'error', 'message': 'ID da definição do quiz ausente para modo "Definido".'}, status=400)
            try:
                quiz_definicao_obj = QuizDefinicao.objects.get(
                    pk=int(quiz_definicao_id), ativo=True)
            except (QuizDefinicao.DoesNotExist, ValueError):
                return JsonResponse({'status': 'error', 'message': 'Definição de quiz inválida ou inativa.'}, status=400)

        nova_sessao = SessoesQuizUsuario.objects.create(
            id_usuario=request.user,
            modo_quiz=modo_quiz_frontend,
            id_quiz_definicao=quiz_definicao_obj,
            total_perguntas_sessao=total_perguntas_sessao,
            status_sessao=SessoesQuizUsuario.StatusSessao.EM_ANDAMENTO,
            data_inicio=timezone.now(),
            ids_perguntas_json=question_ids_in_session,
            indice_ultima_pergunta_vista=0 if total_perguntas_sessao > 0 else None,
            dificuldades_selecionadas_json=data.get(
                'dificuldades_selecionadas'),
            num_questoes_solicitadas=data.get('num_questoes_solicitadas')
        )

        if modo_quiz_frontend == SessoesQuizUsuario.ModoQuiz.POR_CATEGORIA and categoria_ids_str_list:
            try:
                categoria_ids_int = [int(cat_id) for cat_id in categoria_ids_str_list if str(
                    cat_id).strip().isdigit()]
                if categoria_ids_int:
                    categorias_objs = Categoria.objects.filter(
                        pk__in=categoria_ids_int)
                    nova_sessao.categorias_selecionadas.set(categorias_objs)
            except ValueError:
                print(
                    f"Warning: Erro ao converter IDs de categoria para inteiros na sessão {nova_sessao.pk}.")
                pass

        return JsonResponse({'status': 'success', 'session_id': nova_sessao.pk})

    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Corpo da requisição JSON inválido.'}, status=400)
    except Exception as e:
        print(f"Erro em start_quiz_session_view: {type(e).__name__} - {e}")
        return JsonResponse({'status': 'error', 'message': 'Erro interno ao iniciar sessão de quiz.'}, status=500)


@login_required
@require_POST
def register_answer_view(request):
    quiz_config = get_quiz_config()

    try:
        data = json.loads(request.body.decode('utf-8'))
        session_id = data.get('session_id')
        pergunta_id = data.get('pergunta_id')
        opcao_id_str = data.get('opcao_id')
        current_question_index = data.get('current_question_index')

        if not all([session_id, pergunta_id]):
            return JsonResponse({'status': 'error', 'message': 'Dados incompletos (session_id, pergunta_id).'}, status=400)

        sessao_quiz = get_object_or_404(
            SessoesQuizUsuario, pk=session_id, id_usuario=request.user)
        if sessao_quiz.status_sessao != SessoesQuizUsuario.StatusSessao.EM_ANDAMENTO:
            return JsonResponse({'status': 'error', 'message': 'Sessão de quiz não está em andamento.'}, status=400)

        pergunta = get_object_or_404(Pergunta, pk=pergunta_id)
        opcao_selecionada = None
        foi_correta_calculada = None

        if opcao_id_str is not None:
            try:
                opcao_selecionada = get_object_or_404(
                    OpcaoResposta, pk=int(opcao_id_str), pergunta=pergunta)
                foi_correta_calculada = opcao_selecionada.eh_correta
            except (ValueError, OpcaoResposta.DoesNotExist):
                return JsonResponse({'status': 'error', 'message': 'Opção de resposta inválida.'}, status=400)

        RespostasUsuarioPorSessao.objects.update_or_create(
            id_sessao_quiz=sessao_quiz,
            id_pergunta=pergunta,
            defaults={
                'id_opcao_resposta_selecionada': opcao_selecionada,
                'foi_correta': foi_correta_calculada,
                'data_resposta': timezone.now()
            }
        )

        respostas_da_sessao = RespostasUsuarioPorSessao.objects.filter(
            id_sessao_quiz=sessao_quiz)
        sessao_quiz.total_acertos = respostas_da_sessao.filter(
            foi_correta=True).count()
        sessao_quiz.total_erros = respostas_da_sessao.filter(
            foi_correta=False, id_opcao_resposta_selecionada__isnull=False).count()

        sessao_quiz.pontuacao_final = max(0, (sessao_quiz.total_acertos * quiz_config.pontuacao_por_acerto) -
                                             (sessao_quiz.total_erros * quiz_config.penalidade_por_erro))

        if current_question_index is not None:
            try:
                idx = int(current_question_index)
                if sessao_quiz.ids_perguntas_json and 0 <= idx < len(sessao_quiz.ids_perguntas_json):
                    sessao_quiz.indice_ultima_pergunta_vista = idx
                else:
                    print(
                        f"Warning: Índice de pergunta inválido ({idx}) recebido para sessão {sessao_quiz.pk}.")
            except ValueError:
                print(
                    f"Warning: Valor de current_question_index não numérico ({current_question_index}) para sessão {sessao_quiz.pk}.")

        sessao_quiz.save()

        return JsonResponse({
            'status': 'success', 'message': 'Resposta registrada.',
            'foi_correta': foi_correta_calculada,
            'pontuacao_sessao': sessao_quiz.pontuacao_final,
            'total_acertos_sessao': sessao_quiz.total_acertos,
            'total_erros_sessao': sessao_quiz.total_erros
        })

    except SessoesQuizUsuario.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Sessão de quiz inválida ou não pertence ao usuário.'}, status=403)
    except Pergunta.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Pergunta inválida.'}, status=400)
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Corpo da requisição JSON inválido.'}, status=400)
    except Exception as e:
        print(f"Erro em register_answer_view: {type(e).__name__} - {e}")
        return JsonResponse({'status': 'error', 'message': 'Erro interno ao registrar resposta.'}, status=500)


@login_required
@require_POST
def end_quiz_session_view(request):
    quiz_config = get_quiz_config()
    try:
        data = json.loads(request.body.decode('utf-8'))
        session_id = data.get('session_id')
        tempo_total_segundos_frontend = int(
            data.get('tempo_total_segundos', 0))

        sessao_quiz = get_object_or_404(
            SessoesQuizUsuario, pk=session_id, id_usuario=request.user)

        if sessao_quiz.status_sessao == SessoesQuizUsuario.StatusSessao.COMPLETA:
            return JsonResponse({
                'status': 'info', 'message': 'Sessão já finalizada.',
                'pontuacao_final': sessao_quiz.pontuacao_final,
                'total_acertos': sessao_quiz.total_acertos,
                'total_erros': sessao_quiz.total_erros
            }, status=200)

        sessao_quiz.data_fim = timezone.now()
        sessao_quiz.tempo_total_segundos = tempo_total_segundos_frontend
        sessao_quiz.status_sessao = SessoesQuizUsuario.StatusSessao.COMPLETA
        sessao_quiz.save()

        stats = get_or_create_daily_stats(request.user)
        perguntas_respondidas_na_sessao = RespostasUsuarioPorSessao.objects.filter(
            id_sessao_quiz=sessao_quiz, id_opcao_resposta_selecionada__isnull=False
        ).count()

        stats.perguntas_respondidas_dia += perguntas_respondidas_na_sessao
        stats.acertos_dia += sessao_quiz.total_acertos
        stats.pontos_dia += sessao_quiz.pontuacao_final
        stats.tempo_estudo_segundos_dia += tempo_total_segundos_frontend
        stats.save()

        return JsonResponse({
            'status': 'success', 'message': 'Sessão finalizada com sucesso.',
            'pontuacao_final': sessao_quiz.pontuacao_final,
            'total_acertos': sessao_quiz.total_acertos,
            'total_erros': sessao_quiz.total_erros
        })
    except SessoesQuizUsuario.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Sessão de quiz inválida ou não pertence ao usuário.'}, status=403)
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Corpo da requisição JSON inválido.'}, status=400)
    except Exception as e:
        print(f"Erro em end_quiz_session_view: {type(e).__name__} - {e}")
        return JsonResponse({'status': 'error', 'message': 'Erro interno ao finalizar sessão.'}, status=500)


@login_required
@require_GET
def api_resume_quiz_session_view(request):
    try:
        sessao_ativa = SessoesQuizUsuario.objects.filter(
            id_usuario=request.user,
            status_sessao=SessoesQuizUsuario.StatusSessao.EM_ANDAMENTO
        ).order_by('-data_inicio').select_related('id_quiz_definicao').first()  # ADICIONADO select_related

        if not sessao_ativa:
            return JsonResponse({'status': 'not_found', 'message': 'Nenhuma sessão de quiz em andamento encontrada.'}, status=404)

        if not sessao_ativa.ids_perguntas_json:
            sessao_ativa.status_sessao = SessoesQuizUsuario.StatusSessao.ABANDONADA
            sessao_ativa.save()
            return JsonResponse({'status': 'error', 'message': 'Sessão corrompida, não foi possível retomar.'}, status=500)

        ids_perguntas_ordenadas = sessao_ativa.ids_perguntas_json

        preserved_order = Case(*[When(pk=pk, then=pos)
                               for pos, pk in enumerate(ids_perguntas_ordenadas)])
        perguntas_qs = Pergunta.objects.filter(
            pk__in=ids_perguntas_ordenadas, ativa=True
        ).order_by(preserved_order).prefetch_related('categorias', 'opcoes')

        if perguntas_qs.count() != len(ids_perguntas_ordenadas):
            sessao_ativa.status_sessao = SessoesQuizUsuario.StatusSessao.ABANDONADA
            sessao_ativa.save()
            return JsonResponse({'status': 'error', 'message': 'Algumas perguntas da sessão não estão mais disponíveis. Sessão encerrada.'}, status=409)

        user_favorite_ids = set(QuestaoFavorita.objects.filter(
            usuario=request.user, pergunta_id__in=ids_perguntas_ordenadas
        ).values_list('pergunta_id', flat=True))

        perguntas_data_list = []
        opcoes_dict_por_pergunta = defaultdict(list)

        opcoes_para_perguntas_da_sessao = OpcaoResposta.objects.filter(
            pergunta_id__in=ids_perguntas_ordenadas)
        for o in opcoes_para_perguntas_da_sessao:
            opcoes_dict_por_pergunta[o.pergunta_id].append({
                'id_opcao_resposta': o.pk, 'id_pergunta': o.pergunta_id,
                'texto_opcao': o.texto_opcao, 'eh_correta': o.eh_correta,
                'ordem_exibicao': o.ordem_exibicao, 'feedback_opcao': o.feedback_opcao
            })

        for p in perguntas_qs:
            perguntas_data_list.append({
                'id_pergunta': p.pk, 'texto_pergunta': p.texto_pergunta,
                'url_imagem': p.url_imagem, 'referencia_bibliografica': p.referencia_bibliografica,
                'categoria_ids': [cat.pk for cat in p.categorias.all()],
                'nivel_dificuldade': p.nivel_dificuldade,
                'explicacao_resposta': p.explicacao_resposta,
                'is_favorited': p.pk in user_favorite_ids,
                'opcoes': sorted(opcoes_dict_por_pergunta.get(p.pk, []), key=lambda x: x.get('ordem_exibicao', 0))
            })

        respostas_dadas_qs = RespostasUsuarioPorSessao.objects.filter(
            id_sessao_quiz=sessao_ativa)
        respostas_dadas_map = {
            resp.id_pergunta_id: {
                'opcao_selecionada_id': resp.id_opcao_resposta_selecionada_id,
                'foi_correta': resp.foi_correta
            } for resp in respostas_dadas_qs
        }

        todas_categorias_qs = Categoria.objects.all().order_by('nome_categoria')
        categorias_data_list = [
            {'id_categoria': c.pk, 'nome_categoria': c.nome_categoria,
             'id_categoria_pai': c.id_categoria_pai_id, 'descricao_categoria': c.descricao_categoria}
            for c in todas_categorias_qs
        ]

        # ADICIONADO: Obter nome da definição do quiz
        quiz_definition_name = None
        if sessao_ativa.id_quiz_definicao:
            quiz_definition_name = sessao_ativa.id_quiz_definicao.nome_quiz

        return JsonResponse({
            'status': 'success',
            'session_id': sessao_ativa.pk,
            'modo_quiz': sessao_ativa.modo_quiz,
            'id_quiz_definicao': sessao_ativa.id_quiz_definicao_id,
            'quiz_definition_name': quiz_definition_name,  # ADICIONADO AO JSON
            'perguntas': perguntas_data_list,
            'categorias': categorias_data_list,
            'respostas_dadas': respostas_dadas_map,
            'indice_ultima_pergunta_vista': sessao_ativa.indice_ultima_pergunta_vista,
            'pontuacao_atual': sessao_ativa.pontuacao_final,
            'total_acertos_atual': sessao_ativa.total_acertos,
            'total_erros_atual': sessao_ativa.total_erros,
            'data_inicio_sessao_iso': sessao_ativa.data_inicio.isoformat(),
        })

    except Exception as e:
        print(
            f"Erro em api_resume_quiz_session_view: {type(e).__name__} - {e}")
        return JsonResponse({'status': 'error', 'message': 'Erro interno ao tentar retomar sessão.'}, status=500)


@login_required
@require_POST
def toggle_favorite_status_view(request, pergunta_id):
    pergunta = get_object_or_404(Pergunta, pk=pergunta_id)
    favorito, created = QuestaoFavorita.objects.get_or_create(
        usuario=request.user, pergunta=pergunta)

    if not created:
        favorito.delete()
        is_favorited_now = False
        message = "Questão removida dos favoritos."
    else:
        is_favorited_now = True
        message = "Questão adicionada aos favoritos."
    return JsonResponse({'status': 'success', 'is_favorited': is_favorited_now, 'message': message})


@login_required
@require_GET
def get_favorite_questions_view(request):
    favoritos_qs = QuestaoFavorita.objects.filter(usuario=request.user) \
        .select_related('pergunta') \
        .prefetch_related(
            Prefetch('pergunta__categorias', queryset=Categoria.objects.all().only(
                'pk', 'nome_categoria')),
            Prefetch('pergunta__opcoes', queryset=OpcaoResposta.objects.all().order_by(
                'ordem_exibicao'))
    ) \
        .order_by('-data_favoritada')

    perguntas_favoritas_data = []
    for fav in favoritos_qs:
        p = fav.pergunta
        opcoes_data = [
            {
                'id_opcao_resposta': o.pk,
                'id_pergunta': o.pergunta_id,
                'texto_opcao': o.texto_opcao,
                'eh_correta': o.eh_correta,
                'ordem_exibicao': o.ordem_exibicao,
                'feedback_opcao': o.feedback_opcao
            }
            for o in p.opcoes.all()
        ]

        categorias_relacionadas = list(p.categorias.all())

        perguntas_favoritas_data.append({
            'id_pergunta': p.pk,
            'texto_pergunta': p.texto_pergunta,
            'url_imagem': p.url_imagem,
            'referencia_bibliografica': p.referencia_bibliografica,
            'categoria_ids': [cat.pk for cat in categorias_relacionadas],
            'categorias': [
                {
                    'id_categoria': cat.pk,
                    'nome_categoria': cat.nome_categoria,
                }
                for cat in categorias_relacionadas
            ],
            'nivel_dificuldade': p.nivel_dificuldade,
            'explicacao_resposta': p.explicacao_resposta,
            'opcoes': opcoes_data,
            'data_favoritada': fav.data_favoritada.isoformat()
        })

    all_categories_list_for_mapping = [
        {
            'id_categoria': c.pk,
            'nome_categoria': c.nome_categoria,
            'id_categoria_pai': c.id_categoria_pai_id,
            'descricao_categoria': c.descricao_categoria
        }
        for c in Categoria.objects.all().order_by('nome_categoria')
    ]

    return JsonResponse({
        'status': 'success',
        'favorite_questions': perguntas_favoritas_data,
        'all_categories_for_mapping': all_categories_list_for_mapping
    })


@login_required
@require_GET
def api_get_user_statistics_view(request):
    user = request.user
    period = request.GET.get('period', '30d')

    try:
        daily_stats_period_qs = _filter_queryset_by_period(
            EstatisticasDiariasUsuario.objects.filter(id_usuario=user),
            period,
            "data_estatistica"
        )

        user_sessions_period_qs = _filter_queryset_by_period(
            SessoesQuizUsuario.objects.filter(
                id_usuario=user, status_sessao=SessoesQuizUsuario.StatusSessao.COMPLETA),
            period,
            "data_inicio"
        )

        key_metrics = _get_key_metrics(user, daily_stats_period_qs)
        requested_days = _resolve_period_day_count(period)
        period_summary = _get_period_activity_summary(
            daily_stats_period_qs,
            user_sessions_period_qs,
            requested_days,
        )
        overall_accuracy_data = _get_overall_accuracy_data(
            daily_stats_period_qs)
        category_performance_list = _get_category_performance_data(
            user_sessions_period_qs)
        learning_progress_data = _get_learning_progress_data(
            daily_stats_period_qs)
        accuracy_trend_summary = _get_accuracy_trend_summary(
            learning_progress_data
        )
        study_heatmap_data = _get_study_heatmap_data(daily_stats_period_qs)
        study_time_chart_data = _get_study_time_detail_data(user)
        difficulty_performance_list = _get_difficulty_performance_data(
            user_sessions_period_qs)

        return JsonResponse({
            'status': 'success',
            'period_applied': period,
            'key_metrics': key_metrics,
            'period_summary': period_summary,
            'overall_accuracy': overall_accuracy_data,
            'category_performance': category_performance_list,
            'learning_progress': learning_progress_data,
            'accuracy_trend': accuracy_trend_summary,
            'study_heatmap': study_heatmap_data,
            'study_time_detail': study_time_chart_data,
            'difficulty_performance': difficulty_performance_list,
        })
    except Exception as e:
        print(
            f"Erro em api_get_user_statistics_view para user {user.id} com período {period}: {type(e).__name__} - {e}")
        return JsonResponse({'status': 'error', 'message': 'Ocorreu um erro ao processar suas estatísticas.'}, status=500)

# endregion
