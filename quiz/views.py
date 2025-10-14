# quiz/views.py
import json
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpResponseRedirect
from django.views.decorators.http import require_POST, require_GET
from django.utils import timezone
from django.utils.safestring import mark_safe
from datetime import timedelta  # Mantido, pode ser útil
from typing import Optional
from django.db.models import (
    Q, Sum, Count, Case, When, Value, FloatField, ExpressionWrapper, Prefetch,
    Max,
)
from django.contrib import messages
from django.urls import reverse, reverse_lazy
from django.contrib.auth.models import User
from collections import defaultdict

from .models import (
    Pergunta, Categoria, CategoriaHierarquia, OpcaoResposta,
    SessoesQuizUsuario, RespostasUsuarioPorSessao, EstatisticasDiariasUsuario,
    QuestaoFavorita,
    QuizDefinicao,  # NOVO MODELO
    QuizDefinicaoPergunta,  # NOVO MODELO
    DesafioDinamico,
    ConfiguracoesGeraisQuiz,  # NOVO MODELO
    QuestionIssueReport,
    SupportRequest,
    UserPreferences,
    HomePageSettings,
    HomeContentAudience,
    ValueSourceType,
    ChallengeHubSettings,
    ChallengeHubValueSource,
    TrainingMode,
    default_difficulty_rewards,
    default_streak_bonus_rules,
    default_score_panel_config,
)
from .forms import (
    CustomUserCreationForm,
    UserUpdateForm,
    AccountDeleteForm,
    CustomPasswordChangeForm,
    UserPreferencesForm,
)

from .services.quiz_service import QuizDataService
from .services.statistics_service import StatisticsService
from .services.scoring_service import ScoringService
from .services.gamification_service import GamificationService
from .services.study_methods import StudyMethodRegistry
from .services.study_progress import StudyProgressService

# region Lógica de Negócio e Utilitários de Dados

# Cache simples em memória para configurações gerais
_quiz_config_cache = None


def invalidate_quiz_config_cache():
    """Limpa o cache em memória da configuração geral do quiz."""
    global _quiz_config_cache
    _quiz_config_cache = None


def _get_home_page_settings():
    settings = (
        HomePageSettings.objects.prefetch_related(
            "hero_ctas",
            "hero_stat_templates",
            "quick_links",
            "intro_highlights",
            "intro_steps",
        )
        .all()
        .first()
    )
    if not settings:
        base = HomePageSettings.load()
        settings = (
            HomePageSettings.objects.prefetch_related(
                "hero_ctas",
                "hero_stat_templates",
                "quick_links",
                "intro_highlights",
                "intro_steps",
            )
            .filter(pk=base.pk)
            .first()
        )
    return settings


def _get_challenge_hub_settings():
    settings = (
        ChallengeHubSettings.objects.prefetch_related(
            "hero_actions",
            "hero_stats",
            "action_cards",
            "resume_card",
            "predefined_section",
        )
        .all()
        .first()
    )
    if not settings:
        base = ChallengeHubSettings.load()
        settings = (
            ChallengeHubSettings.objects.prefetch_related(
                "hero_actions",
                "hero_stats",
                "action_cards",
                "resume_card",
                "predefined_section",
            )
            .filter(pk=base.pk)
            .first()
        )
    return settings


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
                'penalidade_por_erro': 5,         # Valor padrão
                'configuracao_pontuacao_dificuldade': default_difficulty_rewards(),
                'bonus_sequencia_acertos': default_streak_bonus_rules(),
                'multiplicador_bonus_maximo': 2.0,
                'score_panel_config': default_score_panel_config(),
            }
        )
        if created:
            # Idealmente, logar isso ou ter um passo de setup inicial para criar essa entrada.
            print(
                f"INFO: Instância de ConfiguracoesGeraisQuiz (pk=1) criada com valores padrão.")
        else:
            sanitized = config._sanitize_score_panel_config(config.score_panel_config)
            if sanitized != config.score_panel_config:
                config.score_panel_config = sanitized
                config.save(update_fields=['score_panel_config'])
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
    study_method_key=None,
):
    service = QuizDataService(
        quiz_config=get_quiz_config(),
        user=user,
        study_method_key=study_method_key,
    )
    return service.get_quiz_data_dict(
        category_ids_filter=category_ids_filter,
        difficulty_levels_filter=difficulty_levels_filter,
        quiz_mode=quiz_mode,
        question_count_str=question_count_str,
        num_questions_custom_str=num_questions_custom_str,
        quiz_definicao_id=quiz_definicao_id,
        search_query=search_query,
        study_method_key=study_method_key,
    )

def _serialize_question_for_frontend(pergunta, *, user=None, request=None):
    """
    Constrói o payload esperado pelo frontend para renderizar uma pergunta isolada.
    """
    categorias_relacionadas = list(pergunta.categorias.all())
    opcoes_queryset = pergunta.opcoes.all().order_by('ordem_exibicao', 'pk')

    is_favorited = False
    if user and getattr(user, 'is_authenticated', False):
        is_favorited = QuestaoFavorita.objects.filter(usuario=user, pergunta=pergunta).exists()

    question_payload = {
        'id_pergunta': pergunta.pk,
        'slug': pergunta.slug,
        'texto_pergunta': pergunta.texto_pergunta,
        'url_imagem': pergunta.url_imagem,
        'referencia_bibliografica': pergunta.referencia_bibliografica,
        'categoria_ids': [cat.pk for cat in categorias_relacionadas],
        'categorias': [
            {
                'id_categoria': cat.pk,
                'nome_categoria': cat.nome_categoria,
            }
            for cat in categorias_relacionadas
        ],
        'nivel_dificuldade': pergunta.nivel_dificuldade,
        'explicacao_resposta': pergunta.explicacao_resposta,
        'is_favorited': is_favorited,
        'esta_ativa': pergunta.ativa,
        'opcoes': [
            {
                'id_opcao_resposta': opcao.pk,
                'id_pergunta': opcao.pergunta_id,
                'texto_opcao': opcao.texto_opcao,
                'eh_correta': opcao.eh_correta,
                'ordem_exibicao': opcao.ordem_exibicao,
                'feedback_opcao': opcao.feedback_opcao,
            }
            for opcao in opcoes_queryset
        ],
    }

    if request is not None:
        detail_url = reverse('quiz:question-detail-page', kwargs={'pergunta_id': pergunta.pk})
        question_payload['share_url'] = request.build_absolute_uri(detail_url)

    return question_payload

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
    if StatisticsService.initialize_daily_streak(stats):
        stats.save(update_fields=['sequencia_dias_quiz'])
    return stats


def _get_theme_options_metadata():
    """Retorna os metadados utilizados para renderizar as opções de tema."""
    return [
        {
            'value': UserPreferences.ThemePreference.LIGHT,
            'label': 'Claro',
            'icon': 'light_mode',
            'description': 'Visual equilibrado e iluminado para longas sessões de estudo.',
        },
        {
            'value': UserPreferences.ThemePreference.DARK,
            'label': 'Escuro',
            'icon': 'dark_mode',
            'description': 'Tons escuros que reduzem o brilho em ambientes com pouca luz.',
        },
    ]


def _filter_queryset_by_period(queryset, period_str: str, date_field_name: str = "data_estatistica"):
    return StatisticsService.filter_queryset_by_period(queryset, period_str, date_field_name)

# endregion

# region Funções Auxiliares para Estatísticas do Usuário


def _get_key_metrics(user: User, daily_stats_period_qs):
    return StatisticsService.get_key_metrics(user, daily_stats_period_qs)


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

    gamification_service = GamificationService()
    gamification_snapshot = gamification_service.get_profile_snapshot(
        user,
        include_catalog=True,
    )

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
        'gamification': gamification_snapshot,
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





def home_view(request):
    def safe_int(value, default=0):
        try:
            return int(round(float(value)))
        except (TypeError, ValueError):
            return default

    def format_number(value):
        return f"{safe_int(value):,}".replace(',', '.')

    def format_duration(seconds):
        total_seconds = safe_int(seconds, default=0)
        if total_seconds <= 0:
            return '0 min'
        minutes, sec = divmod(total_seconds, 60)
        hours, minutes = divmod(minutes, 60)
        days, hours = divmod(hours, 24)
        parts = []
        if days:
            parts.append(f"{days}d")
        if hours and len(parts) < 2:
            parts.append(f"{hours}h")
        if minutes and len(parts) < 2:
            parts.append(f"{minutes}min")
        if not parts:
            parts.append(f"{sec}s")
        return ' '.join(parts[:2])

    def format_percent(value, digits=0):
        try:
            number = float(value)
        except (TypeError, ValueError):
            number = 0.0
        return f"{number:.{digits}f}%"

    def clamp_percent(value):
        try:
            number = float(value)
        except (TypeError, ValueError):
            number = 0.0
        return max(0.0, min(number, 100.0))

    def humanize_time_remaining(seconds):
        if seconds is None:
            return None
        total_seconds = safe_int(seconds, default=0)
        if total_seconds <= 0:
            return 'encerra hoje'
        minutes, sec = divmod(total_seconds, 60)
        hours, minutes = divmod(minutes, 60)
        days, hours = divmod(hours, 24)
        if days:
            return f"{days}d {hours}h"
        if hours:
            return f"{hours}h {minutes}min"
        if minutes:
            return f"{minutes}min"
        return f"{sec}s"

    daily_stats = None
    accuracy_percentage_str = '0%'
    home_hero_stats = []
    level_summary = None
    next_achievement = None
    active_challenge = None
    recent_session = None

    show_progress = request.user.is_authenticated

    platform_summary = QuizDataService.build_quiz_summary()
    predefined_quizzes = QuizDataService.get_active_predefined_quizzes_summary()[:3]
    study_methods_metadata = StudyMethodRegistry.list_metadata()[:3]
    home_settings = _get_home_page_settings()

    home_quick_links = []
    home_intro_highlights = []
    home_intro_steps = []
    home_hero_ctas = []
    home_hero = {}
    home_quick_section = {}
    home_intro_section = {}
    home_intro_ctas = {}
    home_progress_section = {
        'title': 'Resumo rápido do seu estudo',
        'subtitle': 'Entre direto nos modos que mantêm sua evolução em alta.',
        'show_when_empty': False,
        'empty_state_title': 'Comece um treino para ver estatísticas aqui',
        'empty_state_description': 'Assim que você concluir uma sessão ou desafio, os destaques aparecem automaticamente.',
    }
    home_progress_cards = []

    responded_today = 0
    streak_days_value = 0

    if show_progress:
        daily_stats = get_or_create_daily_stats(request.user)
        responded_today = safe_int(getattr(daily_stats, 'perguntas_respondidas_dia', 0))
        streak_days_value = safe_int(getattr(daily_stats, 'sequencia_dias_quiz', 0))
        if responded_today:
            accuracy = (getattr(daily_stats, 'acertos_dia', 0) / responded_today) * 100 if responded_today else 0
            accuracy_percentage_str = f"{accuracy:.0f}%"
        elif daily_stats:
            accuracy_percentage_str = '0%'

        gamification_snapshot = GamificationService().get_profile_snapshot(request.user, include_catalog=False)
        xp_total_value = format_number(gamification_snapshot.get('xp_total')) if gamification_snapshot else '0'

        progress_payload = (gamification_snapshot or {}).get('progress') or {}
        level_payload = (gamification_snapshot or {}).get('level') or {}
        next_level_payload = (gamification_snapshot or {}).get('next_level') or {}
        progress_percent = clamp_percent(progress_payload.get('percent'))
        level_summary = {
            'name': level_payload.get('nome') or 'Nível inicial',
            'identifier': level_payload.get('identificador'),
            'progress_percent': progress_percent,
            'progress_display': format_percent(progress_percent),
            'xp_total': xp_total_value,
            'xp_into_level': format_number(progress_payload.get('xp_into_level')),
            'xp_to_next': format_number(progress_payload.get('xp_to_next_level')) if progress_payload.get('xp_to_next_level') is not None else None,
            'next_level_name': next_level_payload.get('nome'),
        }

        achievements_payload = (gamification_snapshot or {}).get('achievements') or {}
        upcoming = achievements_payload.get('upcoming') or []
        if upcoming:
            first = upcoming[0]
            progress = first.get('progress') or {}
            next_achievement = {
                'name': first.get('nome'),
                'description': first.get('descricao'),
                'icon': first.get('icone') or 'emoji_events',
                'progress_percent': clamp_percent(progress.get('percent')),
                'progress_label': progress.get('label'),
            }

        challenges_payload = (gamification_snapshot or {}).get('challenges') or {}
        active_list = challenges_payload.get('active') or []
        if active_list:
            primary = active_list[0]
            progress = primary.get('progress') or {}
            reward_payload = primary.get('reward') or {}
            active_challenge = {
                'name': primary.get('nome'),
                'description': primary.get('descricao'),
                'progress_percent': clamp_percent(progress.get('percent')),
                'progress_label': progress.get('label'),
                'reward': reward_payload.get('nome') or reward_payload.get('descricao'),
                'time_remaining': humanize_time_remaining(primary.get('time_remaining_seconds')),
            }

        last_session = (
            SessoesQuizUsuario.objects.filter(id_usuario=request.user)
            .select_related('id_quiz_definicao')
            .order_by('-data_inicio')
            .first()
        )
        if last_session:
            session_title = last_session.get_modo_quiz_display()
            if last_session.modo_quiz == SessoesQuizUsuario.ModoQuiz.DEFINIDO and last_session.id_quiz_definicao:
                session_title = last_session.id_quiz_definicao.nome_quiz

            accuracy_value = None
            if last_session.total_perguntas_sessao:
                accuracy_value = round((last_session.total_acertos / last_session.total_perguntas_sessao) * 100)

            try:
                session_date = timezone.localtime(last_session.data_inicio)
            except (TypeError, ValueError):
                session_date = last_session.data_inicio

            study_method_name = None
            if last_session.metodo_estudo:
                try:
                    study_method_name = StudyMethodRegistry.get_strategy(last_session.metodo_estudo).display_name
                except KeyError:
                    study_method_name = last_session.metodo_estudo

            recent_session = {
                'title': session_title,
                'mode': last_session.get_modo_quiz_display(),
                'study_method': study_method_name,
                'questions': format_number(last_session.total_perguntas_sessao),
                'accuracy': f"{accuracy_value}%" if accuracy_value is not None else None,
                'xp': format_number(last_session.xp_total_sessao),
                'score': format_number(last_session.pontuacao_final),
                'duration': format_duration(last_session.tempo_total_segundos),
                'date_display': session_date.strftime('%d/%m/%Y %H:%M') if session_date else None,
            }
    else:
        responded_today = 0
        streak_days_value = 0

    predefined_count = len(predefined_quizzes)

    curated_quizzes = [
        {
            'id': item.get('id'),
            'slug': item.get('slug'),
            'name': item.get('nome'),
            'description': item.get('descricao'),
            'questions': format_number(item.get('total_perguntas')),
        }
        for item in predefined_quizzes
    ]

    study_methods = [
        {
            'key': method.get('key'),
            'name': method.get('display_name'),
            'description': method.get('description'),
        }
        for method in study_methods_metadata
    ]

    total_questions_value = platform_summary.get('total_questions')
    total_categories_value = platform_summary.get('total_categories')
    quick_quiz_default_value = platform_summary.get('quick_quiz_default_count')

    home_value_map = {
        ValueSourceType.DAILY_RESPONDED: format_number(responded_today),
        ValueSourceType.DAILY_ACCURACY: accuracy_percentage_str,
        ValueSourceType.STREAK_DAYS: format_number(streak_days_value),
        ValueSourceType.PLATFORM_TOTAL_QUESTIONS: format_number(total_questions_value),
        ValueSourceType.PLATFORM_TOTAL_CATEGORIES: format_number(total_categories_value),
        ValueSourceType.PLATFORM_CURATED_COUNT: format_number(predefined_count),
        ValueSourceType.QUICK_QUIZ_DEFAULT: format_number(quick_quiz_default_value),
        ValueSourceType.PREDEFINED_COLLECTIONS: format_number(predefined_count),
    }

    def safe_template_format(template: Optional[str], **kwargs):
        if not template:
            return ''
        try:
            return template.format(**kwargs)
        except (KeyError, ValueError):
            return template

    def compose_recent_session_card(config, payload):
        show_when_empty = getattr(config, 'show_when_empty', False)
        is_empty = not bool(payload)
        if is_empty and not show_when_empty:
            return None

        icon = getattr(config, 'icon', 'history')
        eyebrow = getattr(config, 'eyebrow', 'Última sessão')
        fallback_title = getattr(config, 'fallback_title', 'Sessão mais recente')
        fallback_description = getattr(config, 'fallback_description', '')
        badge_template = getattr(config, 'badge_label_template', '{date_display}') or ''

        title = payload.get('title') if payload else fallback_title
        description = payload.get('description') if payload else fallback_description

        badge = None
        if payload and badge_template:
            badge = safe_template_format(badge_template, **payload)
        if badge == '':
            badge = None

        stats = []
        stat_fields = [
            ('stat_mode_label', 'stat_mode_placeholder', 'mode'),
            ('stat_method_label', 'stat_method_placeholder', 'study_method'),
            ('stat_questions_label', 'stat_questions_placeholder', 'questions'),
            ('stat_accuracy_label', 'stat_accuracy_placeholder', 'accuracy'),
            ('stat_duration_label', 'stat_duration_placeholder', 'duration'),
        ]
        for label_attr, placeholder_attr, key in stat_fields:
            label = getattr(config, label_attr, '')
            placeholder = getattr(config, placeholder_attr, '')
            value = payload.get(key) if payload else None
            display_value = value if value not in (None, '') else None
            if display_value is None and show_when_empty and placeholder:
                display_value = placeholder
            is_visible = display_value not in (None, '')
            if is_visible:
                stats.append({'label': label, 'value': display_value})

        cta_label = getattr(config, 'cta_label', '')
        cta = None
        if cta_label:
            cta = {
                'label': cta_label,
                'url': getattr(config, 'cta_url', '/questions/'),
                'icon': getattr(config, 'cta_icon', ''),
                'css_class': getattr(config, 'cta_css_class', 'button button--text'),
            }

        return {
            'key': 'recent_session',
            'icon': icon,
            'eyebrow': eyebrow,
            'title': title,
            'description': description,
            'badge': badge,
            'stats': stats,
            'cta': cta,
            'is_empty': is_empty,
        }

    def compose_active_challenge_card(config, payload):
        show_when_empty = getattr(config, 'show_when_empty', False)
        is_empty = not bool(payload)
        if is_empty and not show_when_empty:
            return None

        icon = getattr(config, 'icon', 'flag')
        eyebrow = getattr(config, 'eyebrow', 'Desafio em andamento')
        fallback_title = getattr(config, 'fallback_title', 'Nenhum desafio ativo')
        fallback_description = getattr(config, 'fallback_description', '')
        badge_template = getattr(config, 'badge_label_template', 'Termina em {time_remaining}') or ''
        progress_label = getattr(config, 'progress_label', 'Progresso')
        progress_placeholder = getattr(config, 'progress_placeholder', '0%')
        reward_template = getattr(config, 'reward_label_template', 'Recompensa: {reward}') or ''
        reward_placeholder = getattr(config, 'reward_placeholder', '')

        title = payload.get('name') if payload else fallback_title
        description = payload.get('description') if payload else fallback_description

        badge = None
        if payload and badge_template:
            badge = safe_template_format(badge_template, time_remaining=payload.get('time_remaining'))
        if badge == '':
            badge = None

        progress_value = None
        if payload and payload.get('progress_label'):
            progress_value = payload.get('progress_label')
        elif show_when_empty and progress_placeholder:
            progress_value = progress_placeholder

        reward_value = None
        if payload and payload.get('reward'):
            reward_value = safe_template_format(reward_template, reward=payload.get('reward')) if reward_template else payload.get('reward')
        elif show_when_empty and reward_placeholder:
            reward_value = reward_placeholder

        progress_percent = payload.get('progress_percent') if payload else 0

        return {
            'key': 'active_challenge',
            'icon': icon,
            'eyebrow': eyebrow,
            'title': title,
            'description': description,
            'badge': badge,
            'progress': {
                'label': progress_label,
                'value': progress_value,
                'percent': progress_percent or 0,
            },
            'reward': reward_value,
            'is_empty': is_empty,
        }

    def compose_achievement_card(config, payload):
        show_when_empty = getattr(config, 'show_when_empty', False)
        is_empty = not bool(payload)
        if is_empty and not show_when_empty:
            return None

        icon = getattr(config, 'icon', 'emoji_events')
        eyebrow = getattr(config, 'eyebrow', 'Próxima conquista')
        fallback_title = getattr(config, 'fallback_title', 'Acompanhe suas conquistas')
        fallback_description = getattr(config, 'fallback_description', '')
        progress_label = getattr(config, 'progress_label', 'Status')
        progress_placeholder = getattr(config, 'progress_placeholder', '0%')

        title = payload.get('name') if payload else fallback_title
        description = payload.get('description') if payload else fallback_description

        progress_value = None
        if payload and payload.get('progress_label'):
            progress_value = payload.get('progress_label')
        elif show_when_empty and progress_placeholder:
            progress_value = progress_placeholder

        progress_percent = payload.get('progress_percent') if payload else 0

        return {
            'key': 'next_achievement',
            'icon': icon,
            'eyebrow': eyebrow,
            'title': title,
            'description': description,
            'progress': {
                'label': progress_label,
                'value': progress_value,
                'percent': progress_percent or 0,
            },
            'is_empty': is_empty,
        }

    home_collections_section = {
        'title': 'Coleções em destaque',
        'subtitle': 'Seleções diretas para revisar rapidamente os temas mais cobrados.',
    }
    home_methods_section = {
        'title': 'Métodos de estudo disponíveis',
        'subtitle': 'Ajuste a abordagem conforme o objetivo da semana.',
    }

    if home_settings:
        home_collections_section = {
            'title': home_settings.collections_section_title,
            'subtitle': home_settings.collections_section_subtitle,
        }
        home_methods_section = {
            'title': home_settings.methods_section_title,
            'subtitle': home_settings.methods_section_subtitle,
        }

        current_audience = HomeContentAudience.AUTHENTICATED if show_progress else HomeContentAudience.ANONYMOUS
        if show_progress:
            display_name = (request.user.first_name or '').strip() or request.user.get_username()
            home_hero = {
                'eyebrow': home_settings.hero_authenticated_eyebrow,
                'title': safe_template_format(home_settings.hero_authenticated_title, first_name=display_name),
                'subtitle': home_settings.hero_authenticated_subtitle,
            }
        else:
            home_hero = {
                'eyebrow': home_settings.hero_anonymous_eyebrow,
                'title': home_settings.hero_anonymous_title,
                'subtitle': home_settings.hero_anonymous_subtitle,
            }

        quick_section = {
            'title': home_settings.quick_section_title,
            'subtitle': home_settings.quick_section_subtitle,
        }
        home_quick_section = quick_section

        intro_section = {
            'title': home_settings.intro_section_title,
            'subtitle': home_settings.intro_section_subtitle,
            'highlight_eyebrow': home_settings.intro_highlight_eyebrow,
            'highlight_title': home_settings.intro_highlight_title,
            'steps_eyebrow': home_settings.intro_steps_eyebrow,
            'steps_title': home_settings.intro_steps_title,
        }
        home_intro_section = intro_section

        home_intro_ctas = {
            'primary': {
                'label': home_settings.intro_primary_cta_label,
                'url': home_settings.intro_primary_cta_url,
            },
            'secondary': {
                'label': home_settings.intro_secondary_cta_label,
                'url': home_settings.intro_secondary_cta_url,
            },
        }

        hero_ctas_queryset = [
            cta
            for cta in home_settings.hero_ctas.all()
            if cta.audience == current_audience and cta.is_enabled
        ]
        home_hero_ctas = [
            {
                'label': cta.label,
                'url': cta.url or '#',
                'icon': cta.icon,
                'css_class': cta.css_class or 'button',
                'anchor_id': cta.anchor_id,
                'open_in_new_tab': cta.open_in_new_tab,
            }
            for cta in sorted(hero_ctas_queryset, key=lambda item: (item.position, item.pk))
        ]

        hero_stat_templates = [
            stat
            for stat in home_settings.hero_stat_templates.all()
            if stat.audience == current_audience and stat.is_enabled
        ]
        home_hero_stats = []
        for template in sorted(hero_stat_templates, key=lambda item: (item.order, item.pk)):
            value = home_value_map.get(template.data_source)
            if template.data_source == ValueSourceType.STATIC:
                value = template.static_value or ''
            elif value is None or value == '':
                value = template.static_value or ''

            value_str = str(value) if value is not None else ''
            if template.prefix:
                value_str = f"{template.prefix}{value_str}"
            if template.suffix:
                value_str = f"{value_str}{template.suffix}"

            home_hero_stats.append(
                {
                    'icon': template.icon,
                    'label': template.label,
                    'value': value_str,
                    'dom_id': template.dom_id,
                }
            )

        quick_links_queryset = [
            link for link in home_settings.quick_links.all() if link.is_enabled
        ]
        home_quick_links = [
            {
                'title': link.title,
                'description': link.description,
                'icon': link.icon,
                'url': link.url,
                'extra_css_class': link.extra_css_class,
                'anchor_id': link.anchor_id,
                'open_in_new_tab': link.open_in_new_tab,
            }
            for link in sorted(quick_links_queryset, key=lambda item: (item.order, item.pk))
        ]

        intro_highlights_queryset = [
            highlight
            for highlight in home_settings.intro_highlights.all()
            if highlight.is_enabled
        ]
        home_intro_highlights = []
        for highlight in sorted(intro_highlights_queryset, key=lambda item: (item.order, item.pk)):
            value = home_value_map.get(highlight.data_source)
            if highlight.data_source == ValueSourceType.STATIC:
                value = highlight.static_value or ''
            elif value is None or value == '':
                value = highlight.static_value or ''

            value_str = str(value) if value is not None else ''
            if highlight.prefix:
                value_str = f"{highlight.prefix}{value_str}"
            if highlight.suffix:
                value_str = f"{value_str}{highlight.suffix}"

            home_intro_highlights.append(
                {
                    'icon': highlight.icon,
                    'label': highlight.label,
                    'value': value_str,
                    'dom_id': highlight.dom_id,
                }
            )

        home_intro_steps = [
            {
                'index': idx + 1,
                'text': step.text,
            }
            for idx, step in enumerate(
                sorted(home_settings.intro_steps.all(), key=lambda item: (item.order, item.pk))
            )
        ]

        progress_config = getattr(home_settings, 'progress_section', None)
        home_progress_section = {
            'title': getattr(progress_config, 'title', home_progress_section['title']),
            'subtitle': getattr(progress_config, 'subtitle', home_progress_section['subtitle']),
            'show_when_empty': getattr(progress_config, 'show_when_empty', home_progress_section['show_when_empty']),
            'empty_state_title': getattr(progress_config, 'empty_state_title', home_progress_section['empty_state_title']),
            'empty_state_description': getattr(
                progress_config,
                'empty_state_description',
                home_progress_section['empty_state_description'],
            ),
        }

        recent_card_config = getattr(home_settings, 'recent_session_card', None)
        active_card_config = getattr(home_settings, 'active_challenge_card', None)
        achievement_card_config = getattr(home_settings, 'achievement_card', None)

        recent_session_card = compose_recent_session_card(recent_card_config, recent_session or {})
        active_challenge_card = compose_active_challenge_card(active_card_config, active_challenge or {})
        achievement_card = compose_achievement_card(achievement_card_config, next_achievement or {})

        home_progress_cards = [
            card
            for card in (
                recent_session_card,
                active_challenge_card,
                achievement_card,
            )
            if card
        ]
    else:
        default_name = (request.user.first_name or '').strip() or request.user.get_username()
        home_hero = {
            'eyebrow': 'Hub de estudos MedQuiz',
            'title': safe_template_format('Bem-vindo de volta, {first_name}.', first_name=default_name) if show_progress else 'Domine medicina com treinos guiados e métricas em tempo real.',
            'subtitle': (
                'Veja seu progresso em uma linha, foque no que rende agora e retome a prática com atalhos pensados para o seu ritmo.'
                if show_progress
                else 'Estude em blocos inteligentes, acompanhe evolução e mantenha constância com feedback imediato.'
            ),
        }
        questions_url = reverse('quiz:questions')
        challenge_hub_url = f"{questions_url}#challenge-hub-container"
        if show_progress:
            home_hero_ctas = [
                {
                    'label': 'Iniciar novo quiz',
                    'url': challenge_hub_url,
                    'icon': 'rocket_launch',
                    'css_class': 'button button--fancy button--fancy-primary',
                    'anchor_id': 'go-to-challenges-hub-link',
                    'open_in_new_tab': False,
                },
                {
                    'label': 'Abrir painel completo',
                    'url': '/account/',
                    'icon': 'insights',
                    'css_class': 'button button--outline',
                    'anchor_id': '',
                    'open_in_new_tab': False,
                },
            ]
        else:
            home_hero_ctas = [
                {
                    'label': 'Criar conta gratuita',
                    'url': '/register/',
                    'icon': 'person_add',
                    'css_class': 'button button--fancy button--fancy-primary',
                    'anchor_id': '',
                    'open_in_new_tab': False,
                },
                {
                    'label': 'Explorar banco de questões',
                    'url': questions_url,
                    'icon': 'quiz',
                    'css_class': 'button button--fancy button--fancy-secondary',
                    'anchor_id': '',
                    'open_in_new_tab': False,
                },
            ]
        home_hero_stats = [
            {
                'icon': 'quiz' if not show_progress else 'checklist',
                'label': 'Questões disponíveis' if not show_progress else 'Respondidas hoje',
                'value': format_number(total_questions_value if not show_progress else responded_today),
                'dom_id': 'challenge-stat-total' if not show_progress else None,
            },
            {
                'icon': 'category' if not show_progress else 'target',
                'label': 'Categorias de estudo' if not show_progress else 'Precisão diária',
                'value': format_number(total_categories_value) if not show_progress else accuracy_percentage_str,
                'dom_id': None,
            },
            {
                'icon': 'hub' if not show_progress else 'local_fire_department',
                'label': 'Curadorias ativas' if not show_progress else 'Sequência ativa',
                'value': format_number(predefined_count) if not show_progress else f"{format_number(streak_days_value)} dias",
                'dom_id': None,
            },
        ]
        home_quick_section = {
            'title': 'Continue de onde parou',
            'subtitle': 'Entre direto nos modos que mantêm sua evolução em alta.',
        }
        home_intro_section = {
            'title': 'Por que começar pelo MedQuiz?',
            'subtitle': 'Um ecossistema completo para criar constância nos estudos.',
            'highlight_eyebrow': 'Resultados comprovados',
            'highlight_title': 'Métricas e conteúdos sempre atualizados',
            'steps_eyebrow': 'Comece agora',
            'steps_title': 'Três passos para entrar no ritmo',
        }
        home_intro_ctas = {
            'primary': {'label': 'Criar conta', 'url': '/register/'},
            'secondary': {'label': 'Experimentar um quiz', 'url': '/questions/'},
        }
        home_quick_links = [
            {
                'title': 'Iniciar desafio rápido',
                'description': 'Abra o hub de desafios configurado para você.',
                'icon': 'rocket_launch',
                'url': challenge_hub_url,
                'extra_css_class': '',
                'anchor_id': 'quick-link-start',
                'open_in_new_tab': False,
            },
            {
                'title': 'Revisar favoritos',
                'description': 'Volte às questões salvas e organize seus estudos.',
                'icon': 'star',
                'url': '/account/#painel-favoritos',
                'extra_css_class': '',
                'anchor_id': '',
                'open_in_new_tab': False,
            },
            {
                'title': 'Explorar coleções prontas',
                'description': 'Seleções temáticas com tempo estimado e foco claro.',
                'icon': 'playlist_add_check',
                'url': f'{questions_url}#hub-predefined-section',
                'extra_css_class': '',
                'anchor_id': '',
                'open_in_new_tab': False,
            },
        ]
        home_intro_highlights = [
            {
                'icon': 'quiz',
                'label': 'Questões disponíveis',
                'value': format_number(total_questions_value),
                'dom_id': 'challenge-stat-total',
            },
            {
                'icon': 'category',
                'label': 'Categorias',
                'value': format_number(total_categories_value),
                'dom_id': None,
            },
            {
                'icon': 'play_arrow',
                'label': 'Padrão do quiz rápido',
                'value': format_number(quick_quiz_default_value),
                'dom_id': None,
            },
        ]
        home_intro_steps = [
            {'index': 1, 'text': 'Crie uma conta gratuita'},
            {'index': 2, 'text': 'Escolha um modo ou coleção'},
            {'index': 3, 'text': 'Acompanhe desempenho em tempo real'},
        ]
        home_collections_section = {
            'title': 'Coleções em destaque',
            'subtitle': 'Seleções diretas para revisar rapidamente os temas mais cobrados.',
        }
        home_methods_section = {
            'title': 'Métodos de estudo disponíveis',
            'subtitle': 'Ajuste a abordagem conforme o objetivo da semana.',
        }

        recent_session_card = compose_recent_session_card(None, recent_session or {})
        active_challenge_card = compose_active_challenge_card(None, active_challenge or {})
        achievement_card = compose_achievement_card(None, next_achievement or {})

        home_progress_cards = [
            card
            for card in (
                recent_session_card,
                active_challenge_card,
                achievement_card,
            )
            if card
        ]

    context = {
        'page_title': 'MedQuiz - Início',
        'daily_stats': daily_stats,
        'accuracy_percentage': accuracy_percentage_str,
        'show_progress': show_progress,
        'home_hero': home_hero,
        'home_hero_ctas': home_hero_ctas,
        'home_hero_stats': home_hero_stats,
        'hero_stats': home_hero_stats,
        'level_summary': level_summary,
        'home_progress_section': home_progress_section,
        'home_progress_cards': home_progress_cards,
        'curated_quizzes': curated_quizzes,
        'study_methods': study_methods,
        'home_quick_links': home_quick_links,
        'home_quick_section': home_quick_section,
        'home_intro_section': home_intro_section,
        'home_intro_highlights': home_intro_highlights,
        'home_intro_steps': home_intro_steps,
        'home_intro_ctas': home_intro_ctas,
        'home_collections_section': home_collections_section,
        'home_methods_section': home_methods_section,
    }

    return render(request, 'quiz/home.html', context)

@login_required
def _build_challenge_hub_context(request):
    def format_count(value):
        try:
            return f"{int(value):,}".replace(',', '.')
        except (TypeError, ValueError):
            return '0'

    def safe_template_format(template: Optional[str], **kwargs):
        if not template:
            return ''
        try:
            return template.format(**kwargs)
        except (KeyError, ValueError):
            return template

    hub_summary = {}
    hub_summary_json = '{}'
    try:
        hub_summary = QuizDataService.build_quiz_summary()
        hub_summary_json = json.dumps(hub_summary, ensure_ascii=False)
    except Exception:
        hub_summary = {}
        hub_summary_json = '{}'

    challenge_settings = _get_challenge_hub_settings()

    total_questions = hub_summary.get('total_questions')
    quick_quiz_default = hub_summary.get('quick_quiz_default_count')
    predefined_items = hub_summary.get('predefined_quizzes') or []

    challenge_value_map = {
        ChallengeHubValueSource.TOTAL_QUESTIONS: format_count(total_questions),
        ChallengeHubValueSource.QUICK_QUIZ_DEFAULT: format_count(quick_quiz_default),
        ChallengeHubValueSource.PREDEFINED_TOTAL: format_count(len(predefined_items)),
    }

    challenge_hero = {
        'eyebrow': 'Hub de desafios MedQuiz',
        'title': 'Escolha seu próximo desafio',
        'subtitle': mark_safe(
            safe_template_format(
                'Combine modos inteligentes de estudo e aproveite as {total_questions} questões disponíveis.',
                total_questions="<span id='hub-total-questions-count'>0</span>",
            )
        ),
    }
    challenge_hero_actions = []
    challenge_hero_stats = []
    challenge_cards = []
    challenge_resume_card = {
        'title': 'Retomar sessão',
        'description': mark_safe('Você tem uma sessão em andamento.'),
        'icon': 'autorenew',
        'discard_label': 'Descartar',
        'continue_label': 'Continuar',
    }
    challenge_predefined_section = {
        'title': 'Listas especiais',
        'subtitle': 'Explore quizzes prontos com curadoria da equipe MedQuiz.',
    }
    challenge_placeholders = {
        'filters_title': 'Ajuste seus Filtros',
        'filters_body': 'O painel de filtros está aberto. Selecione as categorias e a dificuldade das questões que deseja praticar.',
        'filters_supporting': 'Após ajustar suas preferências, clique em "Aplicar Filtros" no painel lateral para começar!',
        'filters_cta_label': 'Voltar para Modos de Jogo',
        'filters_cta_icon': 'arrow_back',
        'filters_cta_css_class': 'button button--secondary button--small',
        'filters_cta_dom_id': 'close-filters-and-show-hub-btn',
    }

    training_modes = []

    if challenge_settings:
        hero_subtitle_html = safe_template_format(
            challenge_settings.hero_subtitle_template,
            total_questions=f"<span id='hub-total-questions-count'>{challenge_value_map.get(ChallengeHubValueSource.TOTAL_QUESTIONS, '0')}</span>",
        )
        challenge_hero = {
            'eyebrow': challenge_settings.hero_eyebrow,
            'title': challenge_settings.hero_title,
            'subtitle': mark_safe(hero_subtitle_html),
        }

        challenge_hero_actions = [
            {
                'key': action.key,
                'label': action.label,
                'icon': action.icon,
                'css_class': action.css_class,
                'dom_id': action.dom_id,
            }
            for action in sorted(
                [a for a in challenge_settings.hero_actions.all() if a.is_enabled],
                key=lambda item: item.key,
            )
        ]

        stats_queryset = [s for s in challenge_settings.hero_stats.all() if s.is_enabled]
        challenge_hero_stats = []
        for stat in sorted(stats_queryset, key=lambda item: (item.order, item.pk)):
            value = challenge_value_map.get(stat.data_source, '')
            value_str = str(value) if value is not None else ''
            if stat.prefix:
                value_str = f"{stat.prefix}{value_str}"
            if stat.suffix:
                value_str = f"{value_str}{stat.suffix}"
            challenge_hero_stats.append(
                {
                    'label': stat.label,
                    'value': value_str,
                    'dom_id': stat.dom_id,
                }
            )

        cards_queryset = [
            card
            for card in challenge_settings.action_cards.select_related("quiz_definition").all()
            if card.is_enabled
        ]
        challenge_cards = [
            {
                'key': card.key,
                'title': card.title,
                'description': card.description,
                'meta': card.meta,
                'icon': card.icon,
                'dom_id': card.dom_id,
                'extra_css_class': card.extra_css_class,
                'quiz_definition_id': card.quiz_definition_id,
                'quiz_definition_generation_type': (
                    card.quiz_definition.generation_type
                    if card.quiz_definition
                    else None
                ),
                'quiz_definition_generation_label': (
                    card.quiz_definition.get_generation_type_display()
                    if card.quiz_definition
                    else None
                ),
                'quiz_definition_name': (
                    card.quiz_definition.nome_quiz if card.quiz_definition else ''
                ),
                'quiz_definition_slug': (
                    card.quiz_definition.slug if card.quiz_definition else ''
                ),
                'quiz_definition_study_method_label': (
                    StudyMethodRegistry.get_display_name(card.quiz_definition.study_method_override)
                    if card.quiz_definition and card.quiz_definition.study_method_override
                    else None
                ),
            }
            for card in sorted(cards_queryset, key=lambda item: item.key)
        ]

        training_modes_queryset = (
            TrainingMode.objects.filter(is_active=True)
            .select_related("quiz_definition")
            .order_by("order", "name")
        )
        training_modes = []
        for mode in training_modes_queryset:
            quiz_def = mode.quiz_definition
            if not quiz_def:
                continue

            study_label = StudyMethodRegistry.get_display_name(quiz_def.study_method_override)
            estimated_count = (
                quiz_def.get_estimated_question_count()
                if hasattr(quiz_def, "get_estimated_question_count")
                else None
            )

            meta_text = (mode.meta or "").strip()
            if not meta_text:
                meta_parts = []
                if isinstance(estimated_count, int) and estimated_count > 0:
                    meta_parts.append(f"{estimated_count} questões")
                generation_label = quiz_def.get_generation_type_display()
                if generation_label:
                    meta_parts.append(generation_label)
                if study_label:
                    meta_parts.append(study_label)
                meta_text = " • ".join(part for part in meta_parts if part)

            training_modes.append(
                {
                    'id': mode.pk,
                    'slug': mode.slug,
                    'title': mode.name,
                    'description': mode.description,
                    'meta': meta_text,
                    'icon': mode.icon,
                    'accent_color': mode.accent_color,
                    'quiz_definition_id': quiz_def.pk,
                    'quiz_definition_name': quiz_def.nome_quiz,
                    'quiz_definition_generation_type': quiz_def.generation_type,
                    'quiz_definition_generation_label': quiz_def.get_generation_type_display(),
                    'quiz_definition_study_method_label': study_label,
                }
            )

        if challenge_settings.resume_card:
            resume = challenge_settings.resume_card
            challenge_resume_card = {
                'title': resume.title,
                'description': mark_safe(
                    safe_template_format(
                        resume.description_template,
                        question_count="<span class='resume-question-count'>0</span>",
                    )
                ),
                'icon': resume.icon,
                'discard_label': resume.discard_label,
                'continue_label': resume.continue_label,
            }

        if challenge_settings.predefined_section:
            challenge_predefined_section = {
                'title': challenge_settings.predefined_section.title,
                'subtitle': challenge_settings.predefined_section.subtitle,
            }

        if challenge_settings.placeholders:
            placeholder = challenge_settings.placeholders
            challenge_placeholders = {
                'filters_title': placeholder.filters_title,
                'filters_body': placeholder.filters_body,
                'filters_supporting': placeholder.filters_supporting,
                'filters_cta_label': placeholder.filters_cta_label,
                'filters_cta_icon': placeholder.filters_cta_icon,
                'filters_cta_css_class': placeholder.filters_cta_css_class,
                'filters_cta_dom_id': placeholder.filters_cta_dom_id,
            }

    return {
        'hub_summary': hub_summary,
        'hub_summary_json': hub_summary_json,
        'challenge_hero': challenge_hero,
        'challenge_hero_actions': challenge_hero_actions,
        'challenge_hero_stats': challenge_hero_stats,
        'challenge_cards': challenge_cards,
        'challenge_resume_card': challenge_resume_card,
        'challenge_predefined_section': challenge_predefined_section,
        'challenge_placeholders': challenge_placeholders,
        'training_modes': training_modes,
    }


def questions_view(request, pergunta_id=None):
    context = _build_challenge_hub_context(request)

    page_title = 'MedQuiz - Questões'
    initial_question_payload = None
    initial_question_id = None

    if pergunta_id is not None:
        pergunta = get_object_or_404(
            Pergunta.objects.prefetch_related(
                Prefetch('categorias', queryset=Categoria.objects.only('pk', 'nome_categoria')),
                Prefetch('opcoes', queryset=OpcaoResposta.objects.all().order_by('ordem_exibicao', 'pk')),
            ),
            pk=pergunta_id,
            ativa=True,
        )

        quiz_config = get_quiz_config()
        question_payload = _serialize_question_for_frontend(pergunta, user=request.user, request=request)

        quiz_title = 'Questão Avulsa'
        if pergunta.texto_pergunta:
            truncated_text = pergunta.texto_pergunta.strip()
            if len(truncated_text) > 70:
                truncated_text = truncated_text[:67].rstrip() + '...'
            if truncated_text:
                quiz_title = truncated_text
                page_title = f'{truncated_text} • MedQuiz'

        default_score_panel = quiz_config.get_score_panel_settings_for_mode()

        initial_question_id = pergunta.pk
        initial_question_payload = json.dumps(
            {
                'question_id': pergunta.pk,
                'question': question_payload,
                'mode': 'Standalone',
                'quiz_title': quiz_title,
                'score_panel_settings': default_score_panel,
                'auto_resume_if_session': True,
            },
            ensure_ascii=False,
        )

    context.update({
        'page_title': page_title,
        'show_challenge_hub': True,
        'show_question_interface': True,
        'initial_question_id': initial_question_id,
        'initial_question_payload': initial_question_payload,
    })
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
    user_preferences, _ = UserPreferences.objects.get_or_create(user=request.user)
    update_form = UserUpdateForm(instance=request.user)
    delete_form = AccountDeleteForm(user=request.user)
    preferences_form = UserPreferencesForm(instance=user_preferences)
    selected_theme = preferences_form['theme_preference'].value() or user_preferences.theme_preference
    context = {
        'page_title': 'MedQuiz - Minha Conta',
        'user_sessions': user_sessions,
        'update_form': update_form,
        'delete_form': delete_form,
        'preferences_form': preferences_form,
        'user_preferences': user_preferences,
        'theme_options': _get_theme_options_metadata(),
        'selected_theme': selected_theme,
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
            user_preferences, _ = UserPreferences.objects.get_or_create(user=request.user)
            preferences_form = UserPreferencesForm(instance=user_preferences)
            selected_theme = preferences_form['theme_preference'].value() or user_preferences.theme_preference
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
                'preferences_form': preferences_form,
                'user_preferences': user_preferences,
                'theme_options': _get_theme_options_metadata(),
                'selected_theme': selected_theme,
                'active_tab_on_error': 'security-content'
            }
            context['profile_summary'] = _build_account_profile_summary(request.user)
            return render(request, 'quiz/account_page.html', context)
    return redirect('quiz:account')


@login_required
@require_POST
def update_preferences_view(request):
    preferences, _ = UserPreferences.objects.get_or_create(user=request.user)
    form = UserPreferencesForm(request.POST, instance=preferences)

    if form.is_valid():
        form.save()
        messages.success(request, 'Suas preferências foram atualizadas com sucesso!')
        redirect_url = f"{reverse('quiz:account')}#preferences"
        return HttpResponseRedirect(redirect_url)

    user_sessions = SessoesQuizUsuario.objects.filter(
        id_usuario=request.user).order_by('-data_inicio')[:10]
    update_form = UserUpdateForm(instance=request.user)
    delete_form = AccountDeleteForm(user=request.user)
    selected_theme = form['theme_preference'].value() or preferences.theme_preference

    for field, errors_list in form.errors.items():
        field_label = form.fields[field].label if field in form.fields and field != '__all__' else ''
        for error in errors_list:
            messages.error(
                request, f"{field_label if field_label else 'Preferências'}: {error}".strip(': '))

    if not form.errors:
        messages.error(
            request, 'Não foi possível atualizar suas preferências. Verifique os dados e tente novamente.')

    context = {
        'page_title': 'MedQuiz - Minha Conta',
        'user_sessions': user_sessions,
        'update_form': update_form,
        'delete_form': delete_form,
        'preferences_form': form,
        'user_preferences': preferences,
        'theme_options': _get_theme_options_metadata(),
        'selected_theme': selected_theme,
        'active_tab_on_error': 'preferences-content'
    }
    context['profile_summary'] = _build_account_profile_summary(request.user)
    return render(request, 'quiz/account_page.html', context)


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
        user_preferences, _ = UserPreferences.objects.get_or_create(user=request.user)
        preferences_form = UserPreferencesForm(instance=user_preferences)
        selected_theme = preferences_form['theme_preference'].value() or user_preferences.theme_preference
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
            'preferences_form': preferences_form,
            'user_preferences': user_preferences,
            'theme_options': _get_theme_options_metadata(),
            'selected_theme': selected_theme,
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
        summary_payload = QuizDataService.build_quiz_summary()
        summary_payload['status'] = 'success'
        return JsonResponse(summary_payload)
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
    study_method = request.GET.get('study_method')

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
            study_method_key=study_method,
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
        study_method_raw = data.get('study_method')
        study_method = (
            StudyMethodRegistry.resolve_key(study_method_raw)
            if study_method_raw
            else StudyMethodRegistry.get_default_key()
        )

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
            num_questoes_solicitadas=data.get('num_questoes_solicitadas'),
            metodo_estudo=study_method,
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
    scoring_service = ScoringService(quiz_config)

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

        StudyProgressService.register_answer(
            user=request.user,
            pergunta=pergunta,
            was_correct=foi_correta_calculada,
            session=sessao_quiz,
        )

        respostas_da_sessao = list(
            RespostasUsuarioPorSessao.objects.filter(id_sessao_quiz=sessao_quiz)
            .select_related('id_pergunta')
            .order_by('data_resposta', 'pk')
        )
        score_result = scoring_service.compute_session_result(respostas_da_sessao, session=sessao_quiz)
        if respostas_da_sessao:
            for resp_obj, resp_score in zip(respostas_da_sessao, score_result.response_scores):
                resp_obj.pontos_obtidos = resp_score.pontos
                resp_obj.xp_obtido = resp_score.xp
                resp_obj.multiplicador_aplicado = resp_score.multiplicador
            RespostasUsuarioPorSessao.objects.bulk_update(
                respostas_da_sessao,
                ['pontos_obtidos', 'xp_obtido', 'multiplicador_aplicado']
            )

        sessao_quiz.total_acertos = score_result.total_correct
        sessao_quiz.total_erros = score_result.total_incorrect
        sessao_quiz.pontuacao_final = score_result.total_points
        sessao_quiz.xp_total_sessao = score_result.total_xp
        sessao_quiz.sequencia_acertos_atual = score_result.current_streak
        sessao_quiz.melhor_sequencia_acertos = score_result.best_streak
        if score_result.total_answered > sessao_quiz.total_perguntas_sessao:
            sessao_quiz.total_perguntas_sessao = score_result.total_answered

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

        sessao_quiz.save(update_fields=[
            'total_acertos', 'total_erros', 'pontuacao_final', 'xp_total_sessao',
            'sequencia_acertos_atual', 'melhor_sequencia_acertos', 'total_perguntas_sessao'
        ])

        return JsonResponse({
            'status': 'success', 'message': 'Resposta registrada.',
            'foi_correta': foi_correta_calculada,
            'pontuacao_sessao': sessao_quiz.pontuacao_final,
            'xp_sessao': sessao_quiz.xp_total_sessao,
            'total_acertos_sessao': sessao_quiz.total_acertos,
            'total_erros_sessao': sessao_quiz.total_erros,
            'sequencia_atual': sessao_quiz.sequencia_acertos_atual,
            'melhor_sequencia_sessao': sessao_quiz.melhor_sequencia_acertos,
            'multiplicador_atual': score_result.last_multiplier,
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
    gamification_service = GamificationService()
    scoring_service = ScoringService(quiz_config)
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
                'total_erros': sessao_quiz.total_erros,
                'xp_final': sessao_quiz.xp_total_sessao,
            }, status=200)

        respostas_da_sessao = list(
            RespostasUsuarioPorSessao.objects.filter(id_sessao_quiz=sessao_quiz)
            .select_related('id_pergunta')
            .order_by('data_resposta', 'pk')
        )
        score_result = scoring_service.compute_session_result(respostas_da_sessao, session=sessao_quiz)
        if respostas_da_sessao:
            for resp_obj, resp_score in zip(respostas_da_sessao, score_result.response_scores):
                resp_obj.pontos_obtidos = resp_score.pontos
                resp_obj.xp_obtido = resp_score.xp
                resp_obj.multiplicador_aplicado = resp_score.multiplicador
            RespostasUsuarioPorSessao.objects.bulk_update(
                respostas_da_sessao,
                ['pontos_obtidos', 'xp_obtido', 'multiplicador_aplicado']
            )

        sessao_quiz.total_acertos = score_result.total_correct
        sessao_quiz.total_erros = score_result.total_incorrect
        sessao_quiz.pontuacao_final = score_result.total_points
        sessao_quiz.xp_total_sessao = score_result.total_xp
        sessao_quiz.sequencia_acertos_atual = score_result.current_streak
        sessao_quiz.melhor_sequencia_acertos = score_result.best_streak
        if score_result.total_answered > sessao_quiz.total_perguntas_sessao:
            sessao_quiz.total_perguntas_sessao = score_result.total_answered

        sessao_quiz.data_fim = timezone.now()
        sessao_quiz.tempo_total_segundos = tempo_total_segundos_frontend
        sessao_quiz.status_sessao = SessoesQuizUsuario.StatusSessao.COMPLETA
        sessao_quiz.save(update_fields=[
            'data_fim', 'tempo_total_segundos', 'status_sessao', 'total_acertos',
            'total_erros', 'pontuacao_final', 'xp_total_sessao',
            'sequencia_acertos_atual', 'melhor_sequencia_acertos', 'total_perguntas_sessao'
        ])

        stats = get_or_create_daily_stats(request.user)
        perguntas_respondidas_na_sessao = RespostasUsuarioPorSessao.objects.filter(
            id_sessao_quiz=sessao_quiz, id_opcao_resposta_selecionada__isnull=False
        ).count()

        stats.perguntas_respondidas_dia += perguntas_respondidas_na_sessao
        stats.acertos_dia += sessao_quiz.total_acertos
        stats.pontos_dia += sessao_quiz.pontuacao_final
        stats.xp_ganho_dia += sessao_quiz.xp_total_sessao
        stats.tempo_estudo_segundos_dia += tempo_total_segundos_frontend
        stats.save()

        gamification_result = gamification_service.apply_session_result(
            request.user,
            sessao_quiz,
            score_result,
        )

        return JsonResponse({
            'status': 'success', 'message': 'Sessão finalizada com sucesso.',
            'pontuacao_final': sessao_quiz.pontuacao_final,
            'total_acertos': sessao_quiz.total_acertos,
            'total_erros': sessao_quiz.total_erros,
            'xp_final': sessao_quiz.xp_total_sessao,
            'sequencia_final': sessao_quiz.sequencia_acertos_atual,
            'melhor_sequencia': sessao_quiz.melhor_sequencia_acertos,
            'conquistas_desbloqueadas': gamification_result.conquistas_desbloqueadas,
            'gamificacao': gamification_result.snapshot,
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
            'xp_atual': sessao_ativa.xp_total_sessao,
            'total_acertos_atual': sessao_ativa.total_acertos,
            'total_erros_atual': sessao_ativa.total_erros,
            'sequencia_atual': sessao_ativa.sequencia_acertos_atual,
            'melhor_sequencia': sessao_ativa.melhor_sequencia_acertos,
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


@require_POST
def report_question_issue_view(request, pergunta_id):
    pergunta = get_object_or_404(Pergunta, pk=pergunta_id, ativa=True)

    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse(
            {'status': 'error', 'message': 'Formato de dados inválido.'},
            status=400,
        )

    descricao = (payload.get('descricao') or '').strip()
    if len(descricao) < 10:
        return JsonResponse(
            {
                'status': 'error',
                'message': 'Descreva o problema com pelo menos 10 caracteres.',
            },
            status=400,
        )

    origem = payload.get('origem') or QuestionIssueReport.ORIGEM_SESSAO
    origem_values = {choice[0] for choice in QuestionIssueReport.ORIGEM_CHOICES}
    if origem not in origem_values:
        origem = QuestionIssueReport.ORIGEM_SESSAO

    categoria_input = (
        payload.get('categoria')
        or payload.get('issue_category')
        or QuestionIssueReport.Categoria.GABARITO
    )
    categoria_values = {choice[0] for choice in QuestionIssueReport.Categoria.choices}
    if categoria_input not in categoria_values:
        categoria_input = QuestionIssueReport.Categoria.GABARITO

    usuario = request.user if request.user.is_authenticated else None

    issue_report = QuestionIssueReport.objects.create(
        pergunta=pergunta,
        usuario=usuario,
        descricao=descricao,
        origem=origem,
        categoria=categoria_input,
    )

    support_request_context = {
        'question_issue_report_id': issue_report.pk,
        'question_id': pergunta.pk,
        'question_slug': pergunta.slug or None,
        'question_code': pergunta.codigo_importacao or None,
        'question_title': (pergunta.texto_pergunta or '')[:180] or None,
        'question_difficulty': pergunta.nivel_dificuldade,
        'report_origin': origem,
        'report_origin_display': dict(QuestionIssueReport.ORIGEM_CHOICES).get(origem, origem),
        'source_endpoint': request.path,
        'user_agent': request.META.get('HTTP_USER_AGENT', ''),
    }
    if request.META.get('HTTP_REFERER'):
        support_request_context['page_url'] = request.META['HTTP_REFERER']
    support_request_context['issue_category'] = categoria_input
    support_request_context['issue_category_display'] = dict(
        QuestionIssueReport.Categoria.choices
    ).get(categoria_input, categoria_input)
    categorias_relato = list(pergunta.categorias.values_list('nome_categoria', flat=True))
    if categorias_relato:
        support_request_context['question_categories'] = categorias_relato

    nome_contato = ''
    email_contato = ''
    if usuario:
        nome_contato = usuario.get_full_name() or usuario.username or ''
        email_contato = usuario.email or ''

    SupportRequest.objects.create(
        usuario=usuario,
        nome=nome_contato,
        email=email_contato,
        mensagem=descricao,
        origem=SupportRequest.ORIGEM_MENSAGEM,
        tipo_contato=SupportRequest.TipoContato.CONTEUDO,
        contexto={key: value for key, value in support_request_context.items() if value not in (None, '')},
    )

    return JsonResponse(
        {
            'status': 'success',
            'message': 'Relato registrado. Obrigado por contribuir!',
        },
        status=201,
    )


@require_POST
def submit_support_request_view(request):
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse(
            {'status': 'error', 'message': 'Formato de dados inválido.'},
            status=400,
        )

    mensagem = (payload.get('mensagem') or payload.get('descricao') or '').strip()
    if len(mensagem) < 10:
        return JsonResponse(
            {
                'status': 'error',
                'message': 'Descreva sua reclamação com pelo menos 10 caracteres.',
            },
            status=400,
        )

    origem = (payload.get('origem') or SupportRequest.ORIGEM_GERAL)
    origem_values = {choice[0] for choice in SupportRequest.ORIGEM_CHOICES}
    if origem not in origem_values:
        origem = SupportRequest.ORIGEM_GERAL

    tipo_input = (
        payload.get('tipo')
        or payload.get('categoria')
        or payload.get('tipo_contato')
        or SupportRequest.TipoContato.SUPORTE_GERAL
    )
    tipo_values = {choice[0] for choice in SupportRequest.TipoContato.choices}
    if tipo_input not in tipo_values:
        tipo_input = SupportRequest.TipoContato.SUPORTE_GERAL

    nome = (payload.get('nome') or '').strip()
    email = (payload.get('email') or '').strip()
    usuario = request.user if request.user.is_authenticated else None

    if usuario:
        if not nome:
            nome = usuario.get_full_name() or usuario.username
        if not email:
            email = usuario.email or ''

    contexto_payload = payload.get('contexto')
    contexto = None
    if isinstance(contexto_payload, dict):
        contexto = {}
        for key, value in contexto_payload.items():
            if not isinstance(key, str):
                continue
            if isinstance(value, (str, int, float, bool)) or value is None:
                contexto[key] = value
            elif isinstance(value, (list, dict)):
                contexto[key] = value
            else:
                contexto[key] = str(value)
    elif isinstance(contexto_payload, list):
        contexto = contexto_payload

    if contexto is None:
        contexto = {}

    if isinstance(contexto, dict):
        contexto.setdefault('current_path', request.path)
        contexto.setdefault('user_agent', request.META.get('HTTP_USER_AGENT', ''))
        if 'page_url' not in contexto and request.META.get('HTTP_REFERER'):
            contexto['page_url'] = request.META['HTTP_REFERER']

    SupportRequest.objects.create(
        usuario=usuario,
        nome=nome,
        email=email,
        mensagem=mensagem,
        origem=origem,
        tipo_contato=tipo_input,
        contexto=contexto or None,
    )

    return JsonResponse(
        {
            'status': 'success',
            'message': 'Recebemos sua mensagem. Obrigado por compartilhar!',
        },
        status=201,
    )


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
            f"Erro em api_get_user_statistics_view para user {user.id} com período {period}: {type(e).__name__} - {e}")
        return JsonResponse({'status': 'error', 'message': 'Ocorreu um erro ao processar suas estatísticas.'}, status=500)

# endregion




