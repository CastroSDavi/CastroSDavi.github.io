# quiz/views.py
import json
import math
import re
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_GET
from django.utils import timezone
from datetime import timedelta  # Mantido, pode ser Ãºtil
from django.db import models, transaction  # Para isinstance em _filter_queryset_by_period
from django.db.models import (
    Q, Sum, Count, Case, When, Value, FloatField, ExpressionWrapper, Prefetch
)
# TruncDate e ExtractWeekDay nÃ£o sÃ£o usados diretamente nas funÃ§Ãµes modificadas,
# mas podem ser Ãºteis em outras partes ou nas funÃ§Ãµes de estatÃ­sticas nÃ£o alteradas.
from django.db.models.functions import TruncDate, Random
from django.contrib import messages
from django.urls import reverse_lazy
from django.contrib.auth.models import User
from collections import Counter, defaultdict

from .models import (
    Pergunta, Categoria, OpcaoResposta,
    SessoesQuizUsuario, SessaoQuizPergunta, RespostasUsuarioPorSessao, EstatisticasDiariasUsuario,
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

# region LÃ³gica de NegÃ³cio e UtilitÃ¡rios de Dados

# Cache simples em memÃ³ria para configuraÃ§Ãµes gerais
_quiz_config_cache = None


def invalidate_quiz_config_cache():
    """Limpa o cache em memÃ³ria da configuraÃ§Ã£o geral do quiz."""
    global _quiz_config_cache
    _quiz_config_cache = None


def get_quiz_config():
    """
    Retorna a instÃ¢ncia (singleton) de ConfiguracoesGeraisQuiz.
    Cria uma instÃ¢ncia com valores padrÃ£o se nÃ£o existir, pressupondo que o ID/PK 1 Ã© usado para o singleton.
    Cacheia a instÃ¢ncia em memÃ³ria para evitar queries repetidas durante o mesmo request/processo.
    """
    global _quiz_config_cache
    if _quiz_config_cache is None:
        config, created = ConfiguracoesGeraisQuiz.objects.get_or_create(
            pk=1,  # Garante que sempre tentamos obter/criar a mesma linha.
            defaults={
                'numero_perguntas_quiz_rapido': 10,  # Valor padrÃ£o
                'pontuacao_por_acerto': 15,       # Valor padrÃ£o
                'penalidade_por_erro': 5          # Valor padrÃ£o
            }
        )
        if created:
            # Idealmente, logar isso ou ter um passo de setup inicial para criar essa entrada.
            print(
                f"INFO: InstÃ¢ncia de ConfiguracoesGeraisQuiz (pk=1) criada com valores padrÃ£o.")
        _quiz_config_cache = config
    return _quiz_config_cache


def get_descendant_category_ids(category_ids_str_list):
    """
    ObtÃ©m todos os IDs de categorias descendentes a partir de uma lista inicial de IDs de categoria.
    Isso inclui os IDs iniciais na lista retornada.
    """
    if not category_ids_str_list:
        return set()
    try:
        # Garante que apenas IDs numÃ©ricos vÃ¡lidos sejam processados
        initial_ids = set(int(cat_id) for cat_id in category_ids_str_list if str(
            cat_id).strip().isdigit())
    except ValueError:
        # Se houver algum valor nÃ£o numÃ©rico que nÃ£o foi filtrado, retorna conjunto vazio
        return set()

    if not initial_ids:
        return set()

    all_descendant_ids = set()
    # Fila para processamento BFS (Breadth-First Search)
    queue = list(initial_ids)
    processed_ids = set()     # Para evitar reprocessar e ciclos infinitos

    while queue:
        current_id = queue.pop(0)
        if current_id in processed_ids:
            continue
        processed_ids.add(current_id)
        all_descendant_ids.add(current_id)

        subcategorias = Categoria.objects.filter(
            id_categoria_pai_id=current_id).values_list('pk', flat=True)
        for sub_cat_id in subcategorias:
            if sub_cat_id not in processed_ids:
                queue.append(sub_cat_id)
    return all_descendant_ids


def build_filtered_question_queryset(category_ids_filter=None, difficulty_levels_filter=None, quiz_mode=None, quiz_definicao_id=None):
    perguntas_qs = Pergunta.objects.filter(ativa=True)
    quiz_definition_name = None

    if quiz_definicao_id:
        try:
            quiz_def = QuizDefinicao.objects.get(pk=quiz_definicao_id, ativo=True)
            perguntas_ids = list(
                quiz_def.quizdefinicaopergunta_set.order_by('ordem').values_list('pergunta_id', flat=True)
            )
            if perguntas_ids:
                preserved_order = Case(
                    *[When(pk=pk, then=pos) for pos, pk in enumerate(perguntas_ids)]
                )
                perguntas_qs = Pergunta.objects.filter(
                    pk__in=perguntas_ids, ativa=True
                ).order_by(preserved_order)
            else:
                perguntas_qs = Pergunta.objects.none()
            quiz_definition_name = quiz_def.nome_quiz
        except QuizDefinicao.DoesNotExist:
            perguntas_qs = Pergunta.objects.none()
    else:
        if difficulty_levels_filter:
            normalized = [
                level.casefold()
                for level in difficulty_levels_filter
                if isinstance(level, str)
            ]
            if 'all' not in normalized:
                valid_levels = []
                for model_value, _ in Pergunta.NivelDificuldade.choices:
                    if model_value.casefold() in normalized:
                        valid_levels.append(model_value)
                if valid_levels:
                    perguntas_qs = perguntas_qs.filter(nivel_dificuldade__in=valid_levels)
                else:
                    return Pergunta.objects.none(), None

        if category_ids_filter:
            valid_category_ids = [
                cid for cid in category_ids_filter if str(cid).strip().isdigit()
            ]
            if valid_category_ids:
                descendant_ids = get_descendant_category_ids(valid_category_ids)
                if descendant_ids:
                    perguntas_qs = perguntas_qs.filter(
                        categorias__pk__in=descendant_ids
                    ).distinct()
                else:
                    return Pergunta.objects.none(), None
            else:
                return Pergunta.objects.none(), None

        perguntas_qs = perguntas_qs.order_by('-data_criacao')

    return perguntas_qs, quiz_definition_name


def serialize_questions(perguntas, user=None):
    perguntas_list = list(perguntas)
    if not perguntas_list:
        return []

    pergunta_ids = [pergunta.pk for pergunta in perguntas_list]

    opcoes_por_pergunta = defaultdict(list)
    for opcao in OpcaoResposta.objects.filter(
        pergunta_id__in=pergunta_ids
    ).order_by('ordem_exibicao', 'pk'):
        opcoes_por_pergunta[opcao.pergunta_id].append({
            'id_opcao_resposta': opcao.pk,
            'id_pergunta': opcao.pergunta_id,
            'texto_opcao': opcao.texto_opcao,
            'eh_correta': opcao.eh_correta,
            'ordem_exibicao': opcao.ordem_exibicao,
            'feedback_opcao': opcao.feedback_opcao,
        })

    favoritos_ids = set()
    if user and getattr(user, 'is_authenticated', False):
        favoritos_ids = set(
            QuestaoFavorita.objects.filter(
                usuario=user,
                pergunta_id__in=pergunta_ids
            ).values_list('pergunta_id', flat=True)
        )

    serialized = []
    for pergunta in perguntas_list:
        serialized.append({
            'id_pergunta': pergunta.pk,
            'texto_pergunta': pergunta.texto_pergunta,
            'url_imagem': pergunta.url_imagem,
            'referencia_bibliografica': pergunta.referencia_bibliografica,
            'categoria_ids': [cat.pk for cat in pergunta.categorias.all()],
            'nivel_dificuldade': pergunta.nivel_dificuldade,
            'explicacao_resposta': pergunta.explicacao_resposta,
            'is_favorited': pergunta.pk in favoritos_ids,
            'opcoes': opcoes_por_pergunta.get(pergunta.pk, []),
        })
    return serialized


def select_questions_for_session(quiz_mode, question_count, category_ids_filter=None, difficulty_levels_filter=None, quiz_definicao_id=None):
    perguntas_qs, quiz_definition_name = build_filtered_question_queryset(
        category_ids_filter=category_ids_filter,
        difficulty_levels_filter=difficulty_levels_filter,
        quiz_mode=quiz_mode,
        quiz_definicao_id=quiz_definicao_id
    )

    if perguntas_qs is None:
        return [], quiz_definition_name

    if quiz_mode == SessoesQuizUsuario.ModoQuiz.DEFINIDO:
        perguntas_qs = perguntas_qs.prefetch_related('categorias')
        perguntas = list(perguntas_qs)
    else:
        randomized_qs = perguntas_qs.order_by(Random())
        if question_count:
            randomized_qs = randomized_qs[:question_count]
        perguntas = list(randomized_qs.prefetch_related('categorias'))

    return perguntas, quiz_definition_name


def get_quiz_data_dict(
    category_ids_filter=None,
    difficulty_levels_filter=None,
    quiz_mode=None,
    question_count_str=None,
    num_questions_custom_str=None,
    user=None,
    quiz_definicao_id=None,
    page=1,
    page_size=None,
    include_categories=True
):
    perguntas_qs, quiz_definition_name = build_filtered_question_queryset(
        category_ids_filter=category_ids_filter,
        difficulty_levels_filter=difficulty_levels_filter,
        quiz_mode=quiz_mode,
        quiz_definicao_id=quiz_definicao_id
    )

    total_questions = perguntas_qs.count()

    limit = None
    current_page = 1
    if page_size is not None:
        try:
            limit = max(int(page_size), 1)
        except (TypeError, ValueError):
            limit = 20
        try:
            current_page = max(int(page or 1), 1)
        except (TypeError, ValueError):
            current_page = 1
        offset = (current_page - 1) * limit
        perguntas_qs = perguntas_qs[offset:offset + limit]

    perguntas_qs = perguntas_qs.prefetch_related('categorias')
    perguntas_payload = serialize_questions(perguntas_qs, user=user)

    response = {
        'perguntas': perguntas_payload,
        'quiz_definition_name': quiz_definition_name,
        'total_questions': total_questions,
    }

    if include_categories:
        categorias_data_list = [
            {
                'id_categoria': categoria.pk,
                'nome_categoria': categoria.nome_categoria,
                'id_categoria_pai': categoria.id_categoria_pai_id,
                'descricao_categoria': categoria.descricao_categoria,
            }
            for categoria in Categoria.objects.all().order_by('nome_categoria')
        ]
        response['categorias'] = categorias_data_list

    if limit is not None:
        total_pages = max(math.ceil(total_questions / limit), 1) if total_questions else 1
        response['pagination'] = {
            'page': current_page,
            'page_size': limit,
            'total_pages': total_pages,
            'total_questions': total_questions,
        }

    return response


def get_or_create_daily_stats(user: User):
    """
    ObtÃ©m ou cria as estatÃ­sticas diÃ¡rias para um dado usuÃ¡rio.
    """
    today = timezone.now().date()
    stats, created = EstatisticasDiariasUsuario.objects.get_or_create(
        id_usuario=user,
        data_estatistica=today,
        # Se o modelo EstatisticasDiariasUsuario tiver outros campos obrigatÃ³rios
        # que nÃ£o tÃªm um default no modelo, eles precisariam ser fornecidos aqui
        # no dicionÃ¡rio 'defaults'. Ex:
        # defaults={'algum_campo_obrigatorio': 0}
    )
    # Se precisar fazer algo especÃ­fico quando um novo registro de stats Ã© criado:
    # if created:
    #     # LÃ³gica para quando um novo dia de estatÃ­sticas comeÃ§a para o usuÃ¡rio
    #     pass
    return stats


def _filter_queryset_by_period(queryset, period_str: str, date_field_name: str = "data_estatistica"):
    normalized_period = (
        str(period_str).strip().lower() if period_str is not None else "30d"
    )

    if normalized_period == "all":
        return queryset

    days = None

    if isinstance(period_str, (int, float)):
        try:
            days = int(period_str)
        except (TypeError, ValueError):
            days = None
    else:
        match = re.match(r"^(\d+)(d)?$", normalized_period)
        if match:
            days = int(match.group(1))

    if not days or days <= 0:
        days = 30

    current_ts = timezone.now()

    try:
        model_field = queryset.model._meta.get_field(date_field_name)
    except models.FieldDoesNotExist:
        print(
            f"Warning: Campo '{date_field_name}' nÃ£o encontrado no modelo {queryset.model.__name__} em _filter_queryset_by_period.")
        return queryset.none()

    if isinstance(model_field, models.DateTimeField):
        end_range = current_ts.replace(
            hour=23, minute=59, second=59, microsecond=999999)
        start_range_dt = current_ts - timedelta(days=days - 1)
        start_range = start_range_dt.replace(
            hour=0, minute=0, second=0, microsecond=0)

        filter_kwargs = {
            f"{date_field_name}__gte": start_range,
            f"{date_field_name}__lte": end_range,
        }
    elif isinstance(model_field, models.DateField):
        today_date_obj = current_ts.date()
        start_date_obj = today_date_obj - timedelta(days=days - 1)
        filter_kwargs = {
            f"{date_field_name}__gte": start_date_obj,
            f"{date_field_name}__lte": today_date_obj,
        }
    else:
        print(
            f"Warning: _filter_queryset_by_period recebeu um tipo de campo inesperado: {type(model_field)} para o campo {date_field_name}")
        return queryset.none()

    return queryset.filter(**filter_kwargs)

# endregion

# region FunÃ§Ãµes Auxiliares para EstatÃ­sticas do UsuÃ¡rio


def _get_key_metrics(user: User, daily_stats_period_qs):
    total_questions_answered_period = daily_stats_period_qs.aggregate(
        total=Sum('perguntas_respondidas_dia'))['total'] or 0
    total_study_time_seconds_period = daily_stats_period_qs.aggregate(
        total=Sum('tempo_estudo_segundos_dia'))['total'] or 0

    latest_daily_stat = EstatisticasDiariasUsuario.objects.filter(
        id_usuario=user).order_by('-data_estatistica').first()
    max_streak = latest_daily_stat.sequencia_dias_quiz if latest_daily_stat else 0

    total_score_all_time = SessoesQuizUsuario.objects.filter(
        id_usuario=user, status_sessao=SessoesQuizUsuario.StatusSessao.COMPLETA
    ).aggregate(total_score=Sum('pontuacao_final'))['total_score'] or 0

    return {
        'total_questions_answered': total_questions_answered_period,
        'max_streak': max_streak,
        'total_score_all_time': total_score_all_time,
        'total_study_time_seconds': total_study_time_seconds_period,
    }


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
    main_categories = Categoria.objects.filter(
        id_categoria_pai__isnull=True).prefetch_related('subcategorias')

    responses_in_period = RespostasUsuarioPorSessao.objects.filter(
        id_sessao_quiz__in=user_sessions_period_qs,
        id_opcao_resposta_selecionada__isnull=False
    ).select_related('id_pergunta').prefetch_related('id_pergunta__categorias')

    all_descendant_map = {cat.pk: get_descendant_category_ids(
        [str(cat.pk)]) for cat in main_categories}

    for resp in responses_in_period:
        pergunta_obj = resp.id_pergunta
        for main_cat_obj in main_categories:
            if any(cat.pk in all_descendant_map[main_cat_obj.pk] for cat in pergunta_obj.categorias.all()):
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
        "Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "SÃ¡b"]

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

# region Views Principais (PÃ¡ginas HTML)


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
        'page_title': 'MedQuiz - InÃ­cio',
        'daily_stats': daily_stats,
        'accuracy_percentage': accuracy_percentage_str,
    }
    return render(request, 'quiz/home.html', context)


@login_required
def questions_view(request):
    context = {
        'page_title': 'MedQuiz - QuestÃµes',
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
                        request, f"{field_label if field_label else 'FormulÃ¡rio'}: {error}".strip(': '))
            if not form.errors:
                messages.error(
                    request, 'NÃ£o foi possÃ­vel atualizar seu perfil. Verifique os dados.')
            context = {
                'page_title': 'MedQuiz - Minha Conta', 'user_sessions': user_sessions,
                'update_form': form, 'delete_form': delete_form,
                'active_tab_on_error': 'security-content'
            }
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
        messages.success(request, 'Sua conta foi excluÃ­da com sucesso.')
        return redirect(reverse_lazy('quiz:home'))
    else:
        user_sessions = SessoesQuizUsuario.objects.filter(
            id_usuario=request.user).order_by('-data_inicio')[:10]
        update_form = UserUpdateForm(instance=request.user)
        for field, errors_list in form.errors.items():
            field_label = form.fields[field].label if field in form.fields and field != '__all__' else ''
            for error in errors_list:
                messages.error(
                    request, f"{field_label if field_label else 'FormulÃ¡rio de DeleÃ§Ã£o'}: {error}".strip(': '))
        if not form.errors:
            messages.error(
                request, 'NÃ£o foi possÃ­vel excluir sua conta. Verifique sua senha.')

        context = {
            'page_title': 'MedQuiz - Minha Conta',
            'user_sessions': user_sessions,
            'update_form': update_form,
            'delete_form': form,
            'active_tab_on_error': 'security-content',
            'show_delete_account_modal_on_error': True
        }
        return render(request, 'quiz/account_page.html', context)
    return redirect('quiz:account')

# endregion

# region API Views para Quiz e Dados do UsuÃ¡rio


@require_GET
def api_get_quiz_summary_view(request):
    """Retorna estatÃ­sticas agregadas leves para inicializaÃ§Ã£o da interface."""
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
def api_get_predefined_quizzes_view(request):
    try:
        limit_param = request.GET.get('limit')
        limit = None
        if limit_param and str(limit_param).isdigit():
            limit = max(1, min(int(limit_param), 20))

        quizzes_qs = (
            QuizDefinicao.objects.filter(ativo=True)
            .order_by('-data_atualizacao')
            .prefetch_related(
                Prefetch(
                    'quizdefinicaopergunta_set',
                    queryset=QuizDefinicaoPergunta.objects.select_related('pergunta')
                    .prefetch_related('pergunta__categorias')
                    .order_by('ordem')
                )
            )
        )
        if limit:
            quizzes_qs = quizzes_qs[:limit]

        quizzes_payload = []
        for quiz in quizzes_qs:
            relacoes = list(quiz.quizdefinicaopergunta_set.all())
            question_count = len(relacoes)

            category_counter = Counter()
            for relacao in relacoes:
                for categoria in relacao.pergunta.categorias.all():
                    nome = (categoria.nome_categoria or '').strip()
                    if not nome:
                        continue
                    category_counter[nome] += 1

            top_categories = [name for name, _ in category_counter.most_common(3)]
            total_categories = len(category_counter)

            quizzes_payload.append({
                'id': quiz.pk,
                'nome': quiz.nome_quiz,
                'descricao': (quiz.descricao or '').strip(),
                'question_count': question_count,
                'top_categories': top_categories,
                'total_categories': total_categories,
                'updated_at': quiz.data_atualizacao.isoformat() if quiz.data_atualizacao else None,
            })

        return JsonResponse({'status': 'success', 'quizzes': quizzes_payload})
    except Exception as exc:
        print(f"Erro em api_get_predefined_quizzes_view: {type(exc).__name__} - {exc}")
        return JsonResponse({'status': 'error', 'message': 'Erro ao buscar quizzes definidos.'}, status=500)

@require_GET
def api_get_quiz_data_view(request):
    category_ids_str = request.GET.get('category_ids')
    difficulty_levels_str = request.GET.get('difficulty_levels')
    quiz_mode_str = request.GET.get('mode')
    quiz_definicao_id_str = request.GET.get('quiz_definicao_id')
    page_param = request.GET.get('page', 1)
    page_size_param = request.GET.get('page_size') or request.GET.get('limit')
    include_categories_param = request.GET.get('include_categories')

    category_ids_filter = [
        cid.strip() for cid in category_ids_str.split(',') if cid.strip()
    ] if category_ids_str else []

    difficulty_levels_filter = [
        diff.strip() for diff in difficulty_levels_str.split(',') if diff.strip()
    ] if difficulty_levels_str else []

    quiz_definicao_id = None
    if quiz_definicao_id_str and quiz_definicao_id_str.isdigit():
        quiz_definicao_id = int(quiz_definicao_id_str)
        quiz_mode_str = SessoesQuizUsuario.ModoQuiz.DEFINIDO

    include_categories = True
    if include_categories_param is not None:
        include_categories = include_categories_param.lower() == 'true'

    try:
        page_value = max(int(page_param), 1)
    except (TypeError, ValueError):
        page_value = 1

    page_size_value = None
    if page_size_param is not None:
        try:
            page_size_value = max(int(page_size_param), 1)
        except (TypeError, ValueError):
            page_size_value = 20
        if include_categories_param is None:
            include_categories = page_value == 1

    user_for_favorites = request.user if request.user.is_authenticated else None

    try:
        quiz_data = get_quiz_data_dict(
            category_ids_filter=category_ids_filter,
            difficulty_levels_filter=difficulty_levels_filter,
            quiz_mode=quiz_mode_str,
            user=user_for_favorites,
            quiz_definicao_id=quiz_definicao_id,
            page=page_value,
            page_size=page_size_value,
            include_categories=include_categories
        )
        quiz_data['status'] = 'success'
        return JsonResponse(quiz_data)
    except Exception as exc:
        print(f"Erro em api_get_quiz_data_view: {type(exc).__name__} - {exc}")
        return JsonResponse({'status': 'error', 'message': 'Erro ao buscar dados do quiz.'}, status=500)

def api_get_filtered_question_count_view(request):
    '''Retorna a contagem de perguntas para os filtros informados.'''
    try:
        category_ids_str = request.GET.get('category_ids')
        difficulty_levels_str = request.GET.get('difficulty_levels')
        quiz_definicao_id_str = request.GET.get('quiz_definicao_id')

        category_ids_filter = [
            cid.strip() for cid in category_ids_str.split(',') if cid.strip()
        ] if category_ids_str else []

        difficulty_levels_filter = [
            diff.strip() for diff in difficulty_levels_str.split(',') if diff.strip()
        ] if difficulty_levels_str else []

        quiz_definicao_id = None
        if quiz_definicao_id_str and quiz_definicao_id_str.isdigit():
            quiz_definicao_id = int(quiz_definicao_id_str)

        perguntas_qs, _ = build_filtered_question_queryset(
            category_ids_filter=category_ids_filter,
            difficulty_levels_filter=difficulty_levels_filter,
            quiz_definicao_id=quiz_definicao_id
        )

        count = perguntas_qs.count()
        return JsonResponse({'count': count})

    except Exception as exc:
        print(
            f"Erro em api_get_filtered_question_count_view: {type(exc).__name__} - {exc}"
        )
        return JsonResponse({'status': 'error', 'message': 'Erro ao buscar contagem de questoes.'}, status=500)

@login_required
@require_POST
def start_quiz_session_view(request):
    quiz_config = get_quiz_config()

    try:
        data = json.loads(request.body.decode('utf-8'))
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Corpo da requisicao JSON invalido.'}, status=400)

    quiz_mode = data.get('modo_quiz') or SessoesQuizUsuario.ModoQuiz.POR_CATEGORIA
    if quiz_mode not in SessoesQuizUsuario.ModoQuiz.values:
        return JsonResponse({'status': 'error', 'message': f"Modo de quiz '{quiz_mode}' invalido."}, status=400)

    categoria_ids = data.get('categoria_ids') or []
    difficulty_levels = data.get('dificuldades_selecionadas') or data.get('difficulty_levels') or []

    quiz_definicao_id = data.get('quiz_definicao_id')
    if quiz_mode == SessoesQuizUsuario.ModoQuiz.DEFINIDO:
        if not quiz_definicao_id:
            return JsonResponse({'status': 'error', 'message': 'ID da definicao do quiz ausente para modo "Definido".'}, status=400)
    else:
        quiz_definicao_id = None

    question_count = None
    requested_count = data.get('num_questoes_solicitadas') or data.get('num_questions') or data.get('count')

    if quiz_mode == SessoesQuizUsuario.ModoQuiz.RAPIDO:
        question_count = quiz_config.numero_perguntas_quiz_rapido
        if requested_count is not None:
            try:
                requested_count = int(requested_count)
                if requested_count > 0:
                    question_count = requested_count
            except (TypeError, ValueError):
                pass
    elif requested_count is not None:
        try:
            requested_count = int(requested_count)
            if requested_count > 0:
                question_count = requested_count
        except (TypeError, ValueError):
            pass

    perguntas, quiz_definition_name = select_questions_for_session(
        quiz_mode,
        question_count,
        category_ids_filter=categoria_ids,
        difficulty_levels_filter=difficulty_levels,
        quiz_definicao_id=quiz_definicao_id
    )

    if not perguntas:
        return JsonResponse({'status': 'error', 'message': 'Nenhuma pergunta disponivel para os filtros selecionados.'}, status=404)

    with transaction.atomic():
        nova_sessao = SessoesQuizUsuario.objects.create(
            id_usuario=request.user,
            modo_quiz=quiz_mode,
            id_quiz_definicao_id=quiz_definicao_id,
            total_perguntas_sessao=len(perguntas),
            status_sessao=SessoesQuizUsuario.StatusSessao.EM_ANDAMENTO,
            data_inicio=timezone.now(),
            dificuldades_selecionadas_json=difficulty_levels or None,
            num_questoes_solicitadas=question_count
        )

        if quiz_mode != SessoesQuizUsuario.ModoQuiz.DEFINIDO and categoria_ids:
            categoria_ids_int = [int(cid) for cid in categoria_ids if str(cid).strip().isdigit()]
            if categoria_ids_int:
                categorias_objs = Categoria.objects.filter(pk__in=categoria_ids_int)
                if categorias_objs:
                    nova_sessao.categorias_selecionadas.set(categorias_objs)

        SessaoQuizPergunta.objects.bulk_create([
            SessaoQuizPergunta(sessao=nova_sessao, pergunta=pergunta, ordem=index)
            for index, pergunta in enumerate(perguntas)
        ])

    perguntas_payload = serialize_questions(
        perguntas,
        user=request.user if request.user.is_authenticated else None
    )

    return JsonResponse({
        'status': 'success',
        'session_id': nova_sessao.pk,
        'modo_quiz': nova_sessao.modo_quiz,
        'quiz_definicao_id': quiz_definicao_id,
        'id_quiz_definicao': quiz_definicao_id,
        'quiz_definition_name': quiz_definition_name,
        'perguntas': perguntas_payload,
        'total_perguntas': len(perguntas)
    })

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
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Corpo da requisicao JSON invalido.'}, status=400)

    if not session_id or not pergunta_id:
        return JsonResponse({'status': 'error', 'message': 'Dados incompletos (session_id, pergunta_id).'}, status=400)

    sessao_quiz = get_object_or_404(
        SessoesQuizUsuario, pk=session_id, id_usuario=request.user
    )
    if sessao_quiz.status_sessao != SessoesQuizUsuario.StatusSessao.EM_ANDAMENTO:
        return JsonResponse({'status': 'error', 'message': 'Sessao de quiz nao esta em andamento.'}, status=400)

    pergunta = get_object_or_404(Pergunta, pk=pergunta_id)
    opcao_selecionada = None
    foi_correta_calculada = None

    if opcao_id_str is not None:
        try:
            opcao_selecionada = OpcaoResposta.objects.get(
                pk=int(opcao_id_str), pergunta=pergunta
            )
            foi_correta_calculada = opcao_selecionada.eh_correta
        except (ValueError, OpcaoResposta.DoesNotExist):
            return JsonResponse({'status': 'error', 'message': 'Opcao de resposta invalida.'}, status=400)

    sessao_pergunta = SessaoQuizPergunta.objects.filter(
        sessao=sessao_quiz, pergunta=pergunta
    ).order_by('ordem').first()
    if not sessao_pergunta:
        return JsonResponse({'status': 'error', 'message': 'Pergunta nao pertence a sessao informada.'}, status=400)

    RespostasUsuarioPorSessao.objects.update_or_create(
        id_sessao_quiz=sessao_quiz,
        id_pergunta=pergunta,
        defaults={
            'sessao_pergunta': sessao_pergunta,
            'id_opcao_resposta_selecionada': opcao_selecionada,
            'foi_correta': foi_correta_calculada,
            'data_resposta': timezone.now()
        }
    )

    respostas_da_sessao = RespostasUsuarioPorSessao.objects.filter(
        id_sessao_quiz=sessao_quiz
    )
    sessao_quiz.total_acertos = respostas_da_sessao.filter(
        foi_correta=True
    ).count()
    sessao_quiz.total_erros = respostas_da_sessao.filter(
        foi_correta=False, id_opcao_resposta_selecionada__isnull=False
    ).count()

    sessao_quiz.pontuacao_final = max(
        0,
        (sessao_quiz.total_acertos * quiz_config.pontuacao_por_acerto)
        - (sessao_quiz.total_erros * quiz_config.penalidade_por_erro)
    )

    if current_question_index is not None:
        try:
            idx = int(current_question_index)
            if SessaoQuizPergunta.objects.filter(
                sessao=sessao_quiz, ordem=idx
            ).exists():
                sessao_quiz.indice_ultima_pergunta_vista = idx
        except (TypeError, ValueError):
            pass

    sessao_quiz.save()

    return JsonResponse({
        'status': 'success', 'message': 'Resposta registrada.',
        'foi_correta': foi_correta_calculada,
        'pontuacao_sessao': sessao_quiz.pontuacao_final,
        'total_acertos_sessao': sessao_quiz.total_acertos,
        'total_erros_sessao': sessao_quiz.total_erros
    })

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
                'status': 'info', 'message': 'SessÃ£o jÃ¡ finalizada.',
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
            'status': 'success', 'message': 'SessÃ£o finalizada com sucesso.',
            'pontuacao_final': sessao_quiz.pontuacao_final,
            'total_acertos': sessao_quiz.total_acertos,
            'total_erros': sessao_quiz.total_erros
        })
    except SessoesQuizUsuario.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'SessÃ£o de quiz invÃ¡lida ou nÃ£o pertence ao usuÃ¡rio.'}, status=403)
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Corpo da requisiÃ§Ã£o JSON invÃ¡lido.'}, status=400)
    except Exception as e:
        print(f"Erro em end_quiz_session_view: {type(e).__name__} - {e}")
        return JsonResponse({'status': 'error', 'message': 'Erro interno ao finalizar sessÃ£o.'}, status=500)



@login_required
@require_POST
def toggle_favorite_status_view(request, pergunta_id):
    pergunta = Pergunta.objects.filter(pk=pergunta_id, ativa=True).first()
    if not pergunta:
        return JsonResponse({'status': 'error', 'message': 'Pergunta nao encontrada ou inativa.'}, status=404)

    try:
        with transaction.atomic():
            favorite, created = QuestaoFavorita.objects.get_or_create(
                usuario=request.user,
                pergunta=pergunta
            )
            if created:
                is_favorited = True
            else:
                favorite.delete()
                is_favorited = False
    except Exception as exc:
        print(f"Erro em toggle_favorite_status_view: {type(exc).__name__} - {exc}")
        return JsonResponse({'status': 'error', 'message': 'Erro ao atualizar favorito.'}, status=500)

    return JsonResponse({'status': 'success', 'is_favorited': is_favorited})


@login_required
@require_GET
def get_favorite_questions_view(request):
    favorites_qs = (
        QuestaoFavorita.objects
        .filter(usuario=request.user)
        .select_related('pergunta')
        .prefetch_related('pergunta__categorias')
        .order_by('-data_favoritada')
    )

    perguntas = [
        fav.pergunta
        for fav in favorites_qs
        if fav.pergunta and fav.pergunta.ativa
    ]

    if not perguntas:
        return JsonResponse({'status': 'success', 'favorite_questions': []})

    serialized_questions = serialize_questions(perguntas, user=request.user)
    question_map = {item['id_pergunta']: item for item in serialized_questions}

    favorite_payload = []
    for fav in favorites_qs:
        pergunta = fav.pergunta
        if not pergunta or not pergunta.ativa:
            continue
        question_data = question_map.get(pergunta.pk)
        if not question_data:
            continue
        favorite_payload.append({
            **question_data,
            'data_favoritada': fav.data_favoritada.isoformat()
        })

    return JsonResponse({'status': 'success', 'favorite_questions': favorite_payload})


@login_required
@require_GET
def api_resume_quiz_session_view(request):
    try:
        sessao_ativa = SessoesQuizUsuario.objects.filter(
            id_usuario=request.user,
            status_sessao=SessoesQuizUsuario.StatusSessao.EM_ANDAMENTO
        ).order_by('-data_inicio').select_related('id_quiz_definicao').first()

        if not sessao_ativa:
            return JsonResponse({'status': 'not_found', 'message': 'Nenhuma sessao de quiz em andamento encontrada.'}, status=404)

        perguntas_da_sessao = SessaoQuizPergunta.objects.filter(
            sessao=sessao_ativa
        ).select_related('pergunta').order_by('ordem')

        if not perguntas_da_sessao.exists():
            sessao_ativa.status_sessao = SessoesQuizUsuario.StatusSessao.ABANDONADA
            sessao_ativa.save(update_fields=['status_sessao'])
            return JsonResponse({'status': 'error', 'message': 'Sessao corrompida, nao foi possivel retomar.'}, status=500)

        perguntas = [item.pergunta for item in perguntas_da_sessao]
        perguntas_payload = serialize_questions(perguntas, user=request.user)

        respostas_dadas_qs = RespostasUsuarioPorSessao.objects.filter(
            id_sessao_quiz=sessao_ativa
        )
        respostas_dadas_map = {
            resposta.id_pergunta_id: {
                'opcao_selecionada_id': resposta.id_opcao_resposta_selecionada_id,
                'foi_correta': resposta.foi_correta
            }
            for resposta in respostas_dadas_qs
        }

        quiz_definition_name = None
        if sessao_ativa.modo_quiz == SessoesQuizUsuario.ModoQuiz.DEFINIDO and sessao_ativa.id_quiz_definicao:
            quiz_definition_name = sessao_ativa.id_quiz_definicao.nome_quiz

        return JsonResponse({
            'status': 'success',
            'session_id': sessao_ativa.pk,
            'modo_quiz': sessao_ativa.modo_quiz,
            'quiz_definicao_id': sessao_ativa.id_quiz_definicao_id,
            'id_quiz_definicao': sessao_ativa.id_quiz_definicao_id,
            'quiz_definition_name': quiz_definition_name,
            'indice_ultima_pergunta_vista': sessao_ativa.indice_ultima_pergunta_vista or 0,
            'perguntas': perguntas_payload,
            'respostas_dadas': respostas_dadas_map,
            'pontuacao_atual': sessao_ativa.pontuacao_final,
            'total_acertos_atual': sessao_ativa.total_acertos,
            'total_erros_atual': sessao_ativa.total_erros,
        })
    except Exception as exc:
        print(f"Erro em api_resume_quiz_session_view: {type(exc).__name__} - {exc}")
        return JsonResponse({'status': 'error', 'message': 'Erro interno ao tentar retomar sessao.'}, status=500)



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
        overall_accuracy_data = _get_overall_accuracy_data(
            daily_stats_period_qs)
        category_performance_list = _get_category_performance_data(
            user_sessions_period_qs)
        learning_progress_data = _get_learning_progress_data(
            daily_stats_period_qs)
        study_heatmap_data = _get_study_heatmap_data(daily_stats_period_qs)
        study_time_chart_data = _get_study_time_detail_data(user)
        difficulty_performance_list = _get_difficulty_performance_data(
            user_sessions_period_qs)

        return JsonResponse({
            'status': 'success',
            'period_applied': period,
            'key_metrics': key_metrics,
            'overall_accuracy': overall_accuracy_data,
            'category_performance': category_performance_list,
            'learning_progress': learning_progress_data,
            'study_heatmap': study_heatmap_data,
            'study_time_detail': study_time_chart_data,
            'difficulty_performance': difficulty_performance_list,
        })
    except Exception as e:
        print(
            f"Erro em api_get_user_statistics_view para user {user.id} com perÃ­odo {period}: {type(e).__name__} - {e}")
        return JsonResponse({'status': 'error', 'message': 'Ocorreu um erro ao processar suas estatÃ­sticas.'}, status=500)

# endregion

