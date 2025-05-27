# quiz/views.py
import json
import random
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_GET
from django.utils import timezone
from datetime import date, timedelta
from django.db.models import (
    Q, Sum, Avg, Count, F,
    Case, When, Value, FloatField, ExpressionWrapper
)
from django.db.models.functions import TruncDate, ExtractWeekDay
from django.contrib import messages
from django.urls import reverse_lazy
from django.contrib.auth.models import User

from .models import (
    Pergunta, Categoria, OpcaoResposta,
    SessoesQuizUsuario, RespostasUsuarioPorSessao, EstatisticasDiariasUsuario,
    QuestaoFavorita
)
from .forms import (
    CustomUserCreationForm,
    UserUpdateForm,
    AccountDeleteForm,
    CustomPasswordChangeForm
)

#region Lógica de Negócio e Utilitários de Dados

def get_descendant_category_ids(category_ids_str_list):
    if not category_ids_str_list:
        return set()
    try:
        initial_ids = set(int(cat_id) for cat_id in category_ids_str_list if cat_id.isdigit())
    except ValueError:
        return set()

    all_descendant_ids = set()
    if not initial_ids:
        return set()

    queue = list(initial_ids)
    processed_ids = set()

    while queue:
        current_id = queue.pop(0)
        if current_id in processed_ids:
            continue
        processed_ids.add(current_id)
        all_descendant_ids.add(current_id)

        subcategorias = Categoria.objects.filter(id_categoria_pai_id=current_id)
        for sub_cat in subcategorias:
            if sub_cat.pk not in processed_ids:
                queue.append(sub_cat.pk)
    return all_descendant_ids

def get_quiz_data_dict(
    category_ids_filter=None, 
    difficulty_levels_filter=None,quiz_mode=None, 
    question_count=None, num_questions_custom=None, 
    user: User = None
    ):
    todas_categorias_qs = Categoria.objects.all().order_by('nome_categoria')
    perguntas_qs = Pergunta.objects.filter(ativa=True)

    if difficulty_levels_filter and 'all' not in (level.lower() for level in difficulty_levels_filter):
        normalized_difficulty_filter = [level.lower() for level in difficulty_levels_filter]
        q_difficulty_objects = Q()
        valid_model_difficulties = [choice[0] for choice in Pergunta.NIVEL_CHOICES]
        for level_from_filter in normalized_difficulty_filter:
            for model_level in valid_model_difficulties:
                if level_from_filter == model_level.lower():
                    q_difficulty_objects |= Q(nivel_dificuldade=model_level)
                    break
        if q_difficulty_objects:
            perguntas_qs = perguntas_qs.filter(q_difficulty_objects)
        else:
            perguntas_qs = Pergunta.objects.none()

    if category_ids_filter:
        valid_category_ids_str_list = [cid for cid in category_ids_filter if cid.isdigit()]
        if valid_category_ids_str_list:
            descendant_ids = get_descendant_category_ids(valid_category_ids_str_list)
            if descendant_ids:
                perguntas_qs = perguntas_qs.filter(categorias__pk__in=descendant_ids).distinct()
            else:
                perguntas_qs = Pergunta.objects.none()
        else:
            perguntas_qs = Pergunta.objects.none()

    if quiz_mode == 'quick' and question_count is not None and question_count > 0:
        all_matching_question_ids = list(perguntas_qs.values_list('pk', flat=True))
        if len(all_matching_question_ids) > question_count:
            selected_ids = random.sample(all_matching_question_ids, question_count)
            perguntas_qs = Pergunta.objects.filter(pk__in=selected_ids)
    elif quiz_mode != 'quick' and num_questions_custom is not None and num_questions_custom > 0:
        all_matching_question_ids = list(perguntas_qs.values_list('pk', flat=True))
        if len(all_matching_question_ids) > num_questions_custom:
            selected_ids = random.sample(all_matching_question_ids, num_questions_custom)
            perguntas_qs = Pergunta.objects.filter(pk__in=selected_ids)

    perguntas_data_qs = perguntas_qs.prefetch_related('categorias', 'opcoes').distinct()
    filtered_pergunta_ids = [p.pk for p in perguntas_data_qs]
    opcoes_data_qs = OpcaoResposta.objects.filter(pergunta__pk__in=filtered_pergunta_ids).select_related('pergunta')

    user_favorite_ids = set()
    if user and user.is_authenticated:
        user_favorite_ids = set(QuestaoFavorita.objects.filter(
            usuario=user,
            pergunta__pk__in=filtered_pergunta_ids
        ).values_list('pergunta__pk', flat=True))

    categorias_data_list = [
        {
            'id_categoria': c.pk, 'nome_categoria': c.nome_categoria,
            'id_categoria_pai': c.id_categoria_pai.pk if c.id_categoria_pai else None,
            'descricao_categoria': c.descricao_categoria
        } for c in todas_categorias_qs
    ]
    perguntas_data_list = [
        {
            'id_pergunta': p.pk, 'texto_pergunta': p.texto_pergunta, 'url_imagem': p.url_imagem,
            'referencia_bibliografica': p.referencia_bibliografica,
            'categoria_ids': [cat.pk for cat in p.categorias.all()],
            'nivel_dificuldade': p.nivel_dificuldade,
            'explicacao_resposta': p.explicacao_resposta,
            'is_favorited': p.pk in user_favorite_ids if user and user.is_authenticated else False
        } for p in perguntas_data_qs
    ]
    opcoes_data_list = [
        {
            'id_opcao_resposta': o.pk, 'id_pergunta': o.pergunta.pk, 'texto_opcao': o.texto_opcao,
            'eh_correta': o.eh_correta, 'ordem_exibicao': o.ordem_exibicao,
            'feedback_opcao': o.feedback_opcao
         } for o in opcoes_data_qs
    ]
    return {
        'perguntas': perguntas_data_list,
        'categorias': categorias_data_list,
        'opcoesResposta': opcoes_data_list
    }

def get_or_create_daily_stats(user: User):
    today = date.today()
    stats, created = EstatisticasDiariasUsuario.objects.get_or_create(
        id_usuario=user,
        data_estatistica=today
    )
    return stats

def _filter_queryset_by_period(queryset, period_str: str, date_field_name: str ="data_estatistica"):
    today = timezone.now().date()
    if period_str == "all":
        return queryset

    days_map = {"7d": 7, "30d": 30, "90d": 90}
    days = days_map.get(period_str, 30)

    start_date = today - timedelta(days=days - 1)

    filter_kwargs = {
        f"{date_field_name}__gte": start_date,
        f"{date_field_name}__lte": today,
    }
    return queryset.filter(**filter_kwargs)

#endregion

#region Funções Auxiliares para Estatísticas do Usuário

def _get_key_metrics(user: User, daily_stats_period_qs):
    total_questions_answered_period = daily_stats_period_qs.aggregate(total=Sum('perguntas_respondidas_dia'))['total'] or 0
    total_study_time_seconds_period = daily_stats_period_qs.aggregate(total=Sum('tempo_estudo_segundos_dia'))['total'] or 0

    latest_daily_stat = EstatisticasDiariasUsuario.objects.filter(id_usuario=user).order_by('-data_estatistica').first()
    max_streak = latest_daily_stat.sequencia_dias_quiz if latest_daily_stat else 0

    total_score_all_time = SessoesQuizUsuario.objects.filter(
        id_usuario=user, status_sessao='Completa'
    ).aggregate(total_score=Sum('pontuacao_final'))['total_score'] or 0

    return {
        'total_questions_answered': total_questions_answered_period,
        'max_streak': max_streak,
        'total_score_all_time': total_score_all_time,
        'total_study_time_seconds': total_study_time_seconds_period,
    }

def _get_overall_accuracy_data(daily_stats_period_qs):
    total_questions_answered = daily_stats_period_qs.aggregate(total=Sum('perguntas_respondidas_dia'))['total'] or 0
    total_correct_answers = daily_stats_period_qs.aggregate(total=Sum('acertos_dia'))['total'] or 0
    return {
        'correct': total_correct_answers,
        'incorrect': total_questions_answered - total_correct_answers,
    }

def _get_category_performance_data(user_sessions_period_qs):
    category_performance = {}
    main_categories = Categoria.objects.filter(id_categoria_pai__isnull=True).prefetch_related('subcategorias')

    responses_in_period = RespostasUsuarioPorSessao.objects.filter(
        id_sessao_quiz__in=user_sessions_period_qs,
        id_opcao_resposta_selecionada__isnull=False
    ).select_related('id_pergunta').prefetch_related('id_pergunta__categorias')

    all_descendant_map = {cat.pk: get_descendant_category_ids([str(cat.pk)]) for cat in main_categories}

    for resp in responses_in_period:
        pergunta_obj = resp.id_pergunta
        for main_cat_obj in main_categories:
            if any(cat.pk in all_descendant_map[main_cat_obj.pk] for cat in pergunta_obj.categorias.all()):
                cat_name = main_cat_obj.nome_categoria
                if cat_name not in category_performance:
                    category_performance[cat_name] = {'correct': 0, 'total': 0, 'id': main_cat_obj.pk}

                category_performance[cat_name]['total'] += 1
                if resp.foi_correta:
                    category_performance[cat_name]['correct'] += 1

    category_performance_list = [
        {'name': name, **data, 'accuracy': (data['correct'] / data['total'] * 100) if data['total'] > 0 else 0}
        for name, data in category_performance.items() if data['total'] > 0
    ]
    category_performance_list.sort(key=lambda x: x['accuracy'], reverse=True)
    return category_performance_list

def _get_learning_progress_data(daily_stats_period_qs):
    data = list(
        daily_stats_period_qs.order_by('data_estatistica')
        .annotate(date_str_agg=TruncDate('data_estatistica'))
        .values('date_str_agg')
        .annotate(
            total_acertos_agg=Sum('acertos_dia'),
            total_respondidas_agg=Sum('perguntas_respondidas_dia')
        )
        .values('date_str_agg', 'total_acertos_agg', 'total_respondidas_agg')
    )

    processed_data = []
    for item in data:
        accuracy = 0
        if item.get('total_respondidas_agg') and item['total_respondidas_agg'] > 0:
            accuracy = round((item.get('total_acertos_agg', 0) / item['total_respondidas_agg']) * 100, 1)

        processed_data.append({
            'date_str': item['date_str_agg'].isoformat() if item.get('date_str_agg') else None,
            'daily_accuracy': accuracy
        })
    return processed_data

def _get_study_heatmap_data(daily_stats_period_qs):
    data = list(
        daily_stats_period_qs.annotate(date_str_agg=TruncDate('data_estatistica'))
        .values('date_str_agg')
        .annotate(questions_done=Sum('perguntas_respondidas_dia'))
        .order_by('date_str_agg')
        .values('date_str_agg', 'questions_done')
    )
    for item in data:
        item['date_str'] = item.pop('date_str_agg').isoformat() if item.get('date_str_agg') else None
        item['questions_done'] = item.get('questions_done') or 0
    return data

def _get_study_time_detail_data(user: User):
    seven_days_ago = timezone.now().date() - timedelta(days=6)
    today = timezone.now().date()

    study_time_data_qs = EstatisticasDiariasUsuario.objects.filter(
        id_usuario=user,
        data_estatistica__gte=seven_days_ago,
        data_estatistica__lte=today
    ).annotate(
        weekday=ExtractWeekDay('data_estatistica')
    ).values('weekday').annotate(
        total_seconds=Sum('tempo_estudo_segundos_dia')
    ).order_by('weekday')

    day_names_pt_short = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
    study_time_by_weekday = {i: 0 for i in range(1, 8)}
    for item in study_time_data_qs:
        study_time_by_weekday[item['weekday']] = round((item.get('total_seconds', 0) or 0) / 60)

    return {
        'labels': [day_names_pt_short[i-1] for i in range(1,8)],
        'data': [study_time_by_weekday[i] for i in range(1,8)]
    }

def _get_difficulty_performance_data(user_sessions_period_qs):
    difficulty_performance = {choice[0]: {'correct': 0, 'total': 0} for choice in Pergunta.NIVEL_CHOICES}

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
        {'name': name, **data, 'accuracy': (data['correct'] / data['total'] * 100) if data['total'] > 0 else 0}
        for name, data in difficulty_performance.items()
    ]

#endregion

#region Views Principais (Páginas HTML)

@login_required
def home_view(request):
    daily_stats = None
    accuracy_percentage_str = "0%"
    if request.user.is_authenticated:
        daily_stats = get_or_create_daily_stats(request.user)
        if daily_stats and daily_stats.perguntas_respondidas_dia > 0:
            accuracy = (daily_stats.acertos_dia / daily_stats.perguntas_respondidas_dia) * 100
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
    context = {'page_title': 'MedQuiz - Questões'}
    return render(request, 'quiz/questions_page.html', context)

def register_view(request):
    if request.user.is_authenticated:
        return redirect('quiz:home')
    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            messages.success(request, 'Cadastro realizado com sucesso! Bem-vindo(a).')
            return redirect('quiz:home')
        else:
            for field, errors in form.errors.items():
                field_label = form.fields[field].label if field in form.fields and field != '__all__' else ''
                for error in errors:
                    messages.error(request, f"{field_label}: {error}".strip(': '))
            if not form.errors:
                messages.error(request, 'Por favor, corrija os erros abaixo.')
    else:
        form = CustomUserCreationForm()
    context = {'form': form, 'page_title': 'Cadastro - MedQuiz'}
    return render(request, 'quiz/register.html', context)

@login_required
def account_view(request):
    user_sessions = SessoesQuizUsuario.objects.filter(id_usuario=request.user).order_by('-data_inicio')[:10]
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
            user_sessions = SessoesQuizUsuario.objects.filter(id_usuario=request.user).order_by('-data_inicio')[:10]
            delete_form = AccountDeleteForm(user=request.user)

            for field, errors_list in form.errors.items():
                field_label = form.fields[field].label if field in form.fields and field != '__all__' else ''
                for error in errors_list:
                    messages.error(request, f"{field_label}: {error}".strip(': '))
            if not form.errors:
                messages.error(request, 'Não foi possível atualizar seu perfil. Verifique os dados.')

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
        messages.success(request, 'Sua conta foi excluída com sucesso.')
        return redirect(reverse_lazy('quiz:home'))
    else:
        user_sessions = SessoesQuizUsuario.objects.filter(id_usuario=request.user).order_by('-data_inicio')[:10]
        update_form = UserUpdateForm(instance=request.user)

        for field, errors_list in form.errors.items():
            field_label = form.fields[field].label if field in form.fields and field != '__all__' else ''
            for error in errors_list:
                messages.error(request, f"{field_label}: {error}".strip(': '))
        if not form.errors:
            messages.error(request, 'Não foi possível excluir sua conta. Verifique sua senha.')

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

#endregion

#region API Views para Quiz e Dados do Usuário

@require_GET
def api_get_quiz_data_view(request):
    category_ids_str = request.GET.get('category_ids')
    difficulty_levels_str = request.GET.get('difficulty_levels')
    quiz_mode_str = request.GET.get('mode')
    question_count_str = request.GET.get('count')
    num_questions_custom_str = request.GET.get('num_questions')

    category_ids_filter = [cid.strip() for cid in category_ids_str.split(',') if cid.strip()] if category_ids_str else None
    difficulty_levels_filter = [diff.strip() for diff in difficulty_levels_str.split(',') if diff.strip()] if difficulty_levels_str else None

    quiz_mode = quiz_mode_str if quiz_mode_str else None
    question_count = None
    num_questions_custom_val = None

    if quiz_mode == 'quick' and question_count_str:
        try:
            question_count = int(question_count_str)
            if question_count <= 0: question_count = None
        except ValueError:
            question_count = None
    elif num_questions_custom_str:
        try:
            num_questions_custom_val = int(num_questions_custom_str)
            if num_questions_custom_val <= 0: num_questions_custom_val = None
        except ValueError:
            num_questions_custom_val = None

    user_for_favorites = request.user if request.user.is_authenticated else None
    quiz_data = get_quiz_data_dict(
        category_ids_filter=category_ids_filter,
        difficulty_levels_filter=difficulty_levels_filter,
        quiz_mode=quiz_mode,
        question_count=question_count,
        num_questions_custom=num_questions_custom_val,
        user=user_for_favorites
    )
    return JsonResponse(quiz_data)

@login_required
@require_POST
def start_quiz_session_view(request):
    try:
        data = json.loads(request.body.decode('utf-8'))
        modo_quiz = data.get('modo_quiz')
        categoria_ids_str_list = data.get('categoria_ids', [])
        question_ids_in_session = data.get('question_ids_in_session', [])

        if not isinstance(question_ids_in_session, list) or not all(isinstance(qid, int) for qid in question_ids_in_session):
            return JsonResponse({'status': 'error', 'message': 'IDs de perguntas da sessão inválidos ou ausentes.'}, status=400)

        total_perguntas_sessao = len(question_ids_in_session)
        if not modo_quiz or total_perguntas_sessao < 0:
            return JsonResponse({'status': 'error', 'message': 'Dados inválidos para iniciar sessão.'}, status=400)

        nova_sessao = SessoesQuizUsuario.objects.create(
            id_usuario=request.user,
            modo_quiz=modo_quiz,
            total_perguntas_sessao=total_perguntas_sessao,
            status_sessao='Em Andamento',
            data_inicio=timezone.now()
        )

        if modo_quiz == 'Por Categoria' and categoria_ids_str_list:
            try:
                categoria_ids_int = [int(cat_id) for cat_id in categoria_ids_str_list if str(cat_id).strip().isdigit()]
                if categoria_ids_int:
                    categorias_objs = Categoria.objects.filter(pk__in=categoria_ids_int)
                    nova_sessao.categorias_selecionadas.set(categorias_objs)
            except ValueError:
                pass
        return JsonResponse({'status': 'success', 'session_id': nova_sessao.pk})
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Corpo da requisição JSON inválido.'}, status=400)
    except Exception as e:
        print(f"Erro em start_quiz_session_view: {e}")
        return JsonResponse({'status': 'error', 'message': 'Erro interno ao iniciar sessão.'}, status=500)

@login_required
@require_POST
def register_answer_view(request):
    try:
        data = json.loads(request.body.decode('utf-8'))
        session_id = data.get('session_id')
        pergunta_id = data.get('pergunta_id')
        opcao_id_str = data.get('opcao_id')

        if not all([session_id, pergunta_id]):
            return JsonResponse({'status': 'error', 'message': 'Dados incompletos (session_id, pergunta_id).'}, status=400)

        sessao_quiz = get_object_or_404(SessoesQuizUsuario, pk=session_id, id_usuario=request.user)
        if sessao_quiz.status_sessao != 'Em Andamento':
            return JsonResponse({'status': 'error', 'message': 'Sessão de quiz não está em andamento.'}, status=400)

        pergunta = get_object_or_404(Pergunta, pk=pergunta_id)
        opcao_selecionada = None
        foi_correta_calculada = None

        if opcao_id_str is not None:
            try:
                opcao_selecionada = get_object_or_404(OpcaoResposta, pk=int(opcao_id_str), pergunta=pergunta)
                foi_correta_calculada = opcao_selecionada.eh_correta
            except (ValueError, OpcaoResposta.DoesNotExist):
                return JsonResponse({'status': 'error', 'message': 'Opção de resposta inválida.'}, status=400)

        RespostasUsuarioPorSessao.objects.update_or_create(
            id_sessao_quiz=sessao_quiz, id_pergunta=pergunta,
            defaults={
                'id_opcao_resposta_selecionada': opcao_selecionada,
                'foi_correta': foi_correta_calculada,
                'data_resposta': timezone.now()
            }
        )

        respostas_da_sessao = RespostasUsuarioPorSessao.objects.filter(id_sessao_quiz=sessao_quiz)
        sessao_quiz.total_acertos = respostas_da_sessao.filter(foi_correta=True).count()
        sessao_quiz.total_erros = respostas_da_sessao.filter(foi_correta=False, id_opcao_resposta_selecionada__isnull=False).count()
        sessao_quiz.pontuacao_final = max(0, (sessao_quiz.total_acertos * 15) - (sessao_quiz.total_erros * 5))
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
        print(f"Erro em register_answer_view: {e}")
        return JsonResponse({'status': 'error', 'message': 'Erro interno ao registrar resposta.'}, status=500)

@login_required
@require_POST
def end_quiz_session_view(request):
    try:
        data = json.loads(request.body.decode('utf-8'))
        session_id = data.get('session_id')
        tempo_total_segundos_frontend = int(data.get('tempo_total_segundos', 0))

        sessao_quiz = get_object_or_404(SessoesQuizUsuario, pk=session_id, id_usuario=request.user)

        if sessao_quiz.status_sessao != 'Em Andamento':
            return JsonResponse({
                'status': 'info', 'message': 'Sessão já finalizada.',
                'pontuacao_final': sessao_quiz.pontuacao_final,
                'total_acertos': sessao_quiz.total_acertos,
                'total_erros': sessao_quiz.total_erros
            }, status=200)

        sessao_quiz.data_fim = timezone.now()
        sessao_quiz.tempo_total_segundos = tempo_total_segundos_frontend
        sessao_quiz.status_sessao = 'Completa'
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
        print(f"Erro em end_quiz_session_view: {e}")
        return JsonResponse({'status': 'error', 'message': 'Erro interno ao finalizar sessão.'}, status=500)

@login_required
@require_POST
def toggle_favorite_status_view(request, pergunta_id):
    pergunta = get_object_or_404(Pergunta, pk=pergunta_id)
    favorito, created = QuestaoFavorita.objects.get_or_create(usuario=request.user, pergunta=pergunta)

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
    favoritos_qs = QuestaoFavorita.objects.filter(usuario=request.user).select_related('pergunta').order_by('-data_favoritada')

    perguntas_favoritas_data = []
    all_categories_dict = {cat.pk: cat for cat in Categoria.objects.all()}

    favorite_pergunta_ids = [fav.pergunta_id for fav in favoritos_qs]
    all_opcoes_for_favorites = OpcaoResposta.objects.filter(pergunta_id__in=favorite_pergunta_ids).order_by('pergunta_id', 'ordem_exibicao')

    opcoes_by_pergunta_id = {}
    for opcao in all_opcoes_for_favorites:
        if opcao.pergunta_id not in opcoes_by_pergunta_id:
            opcoes_by_pergunta_id[opcao.pergunta_id] = []
        opcoes_by_pergunta_id[opcao.pergunta_id].append({
            'id_opcao_resposta': opcao.pk, 'id_pergunta': opcao.pergunta_id,
            'texto_opcao': opcao.texto_opcao, 'eh_correta': opcao.eh_correta,
            'ordem_exibicao': opcao.ordem_exibicao, 'feedback_opcao': opcao.feedback_opcao
        })

    perguntas_obj_dict = {p.id: p for p in Pergunta.objects.filter(id__in=favorite_pergunta_ids).prefetch_related('categorias')}

    for fav in favoritos_qs:
        p = perguntas_obj_dict.get(fav.pergunta_id)
        if not p:
            continue

        categoria_ids_da_pergunta = [cat.pk for cat in p.categorias.all()]

        perguntas_favoritas_data.append({
            'id_pergunta': p.pk, 'texto_pergunta': p.texto_pergunta,
            'url_imagem': p.url_imagem, 'referencia_bibliografica': p.referencia_bibliografica,
            'categoria_ids': categoria_ids_da_pergunta,
            'nivel_dificuldade': p.nivel_dificuldade,
            'explicacao_resposta': p.explicacao_resposta,
            'opcoes': opcoes_by_pergunta_id.get(p.pk, []),
            'data_favoritada': fav.data_favoritada.isoformat()
        })

    all_categories_list_for_mapping = [
        {
            'id_categoria': c_id, 'nome_categoria': c_obj.nome_categoria,
            'id_categoria_pai': c_obj.id_categoria_pai_id if c_obj.id_categoria_pai else None,
            'descricao_categoria': c_obj.descricao_categoria
        } for c_id, c_obj in all_categories_dict.items()
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
            SessoesQuizUsuario.objects.filter(id_usuario=user, status_sessao='Completa'),
            period,
            "data_inicio"
        )

        key_metrics = _get_key_metrics(user, daily_stats_period_qs)
        overall_accuracy_data = _get_overall_accuracy_data(daily_stats_period_qs)
        category_performance_list = _get_category_performance_data(user_sessions_period_qs)
        learning_progress_data = _get_learning_progress_data(daily_stats_period_qs)
        study_heatmap_data = _get_study_heatmap_data(daily_stats_period_qs)
        study_time_chart_data = _get_study_time_detail_data(user)
        difficulty_performance_list = _get_difficulty_performance_data(user_sessions_period_qs)

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
        print(f"Erro em api_get_user_statistics_view para user {user.id} com período {period}: {type(e).__name__} - {e}")
        return JsonResponse({'status': 'error', 'message': 'Ocorreu um erro ao processar suas estatísticas.'}, status=500)

#endregion
