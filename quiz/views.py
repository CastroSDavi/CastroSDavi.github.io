# quiz/views.py
import json
import random
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_GET
from django.utils import timezone
from datetime import timedelta # Mantido, pode ser útil
from django.db import models # Para isinstance em _filter_queryset_by_period
from django.db.models import (
    Q, Sum, Count, Case, When, Value, FloatField, ExpressionWrapper, Prefetch
)
# TruncDate e ExtractWeekDay não são usados diretamente nas funções modificadas,
# mas podem ser úteis em outras partes ou nas funções de estatísticas não alteradas.
from django.db.models.functions import TruncDate
from django.contrib import messages
from django.urls import reverse_lazy
from django.contrib.auth.models import User
from collections import defaultdict

from .models import (
    Pergunta, Categoria, OpcaoResposta,
    SessoesQuizUsuario, RespostasUsuarioPorSessao, EstatisticasDiariasUsuario,
    QuestaoFavorita,
    QuizDefinicao, # NOVO MODELO
    QuizDefinicaoPergunta, # NOVO MODELO
    ConfiguracoesGeraisQuiz # NOVO MODELO
)
from .forms import (
    CustomUserCreationForm,
    UserUpdateForm,
    AccountDeleteForm,
    CustomPasswordChangeForm
)

#region Lógica de Negócio e Utilitários de Dados

# Cache simples em memória para configurações gerais
_quiz_config_cache = None

def get_quiz_config():
    """
    Retorna a instância (singleton) de ConfiguracoesGeraisQuiz.
    Cria uma instância com valores padrão se não existir, pressupondo que o ID/PK 1 é usado para o singleton.
    Cacheia a instância em memória para evitar queries repetidas durante o mesmo request/processo.
    """
    global _quiz_config_cache
    if _quiz_config_cache is None:
        config, created = ConfiguracoesGeraisQuiz.objects.get_or_create(
            pk=1, # Garante que sempre tentamos obter/criar a mesma linha.
            defaults={
                'numero_perguntas_quiz_rapido': 10, # Valor padrão
                'pontuacao_por_acerto': 15,       # Valor padrão
                'penalidade_por_erro': 5          # Valor padrão
            }
        )
        if created:
            # Idealmente, logar isso ou ter um passo de setup inicial para criar essa entrada.
            print(f"INFO: Instância de ConfiguracoesGeraisQuiz (pk=1) criada com valores padrão.")
        _quiz_config_cache = config
    return _quiz_config_cache


def get_descendant_category_ids(category_ids_str_list):
    """
    Obtém todos os IDs de categorias descendentes a partir de uma lista inicial de IDs de categoria.
    Isso inclui os IDs iniciais na lista retornada.
    """
    if not category_ids_str_list:
        return set()
    try:
        # Garante que apenas IDs numéricos válidos sejam processados
        initial_ids = set(int(cat_id) for cat_id in category_ids_str_list if str(cat_id).strip().isdigit())
    except ValueError:
        # Se houver algum valor não numérico que não foi filtrado, retorna conjunto vazio
        return set()

    if not initial_ids:
        return set()

    all_descendant_ids = set()
    queue = list(initial_ids) # Fila para processamento BFS (Breadth-First Search)
    processed_ids = set()     # Para evitar reprocessar e ciclos infinitos

    while queue:
        current_id = queue.pop(0)
        if current_id in processed_ids:
            continue
        processed_ids.add(current_id)
        all_descendant_ids.add(current_id)

        subcategorias = Categoria.objects.filter(id_categoria_pai_id=current_id).values_list('pk', flat=True)
        for sub_cat_id in subcategorias:
            if sub_cat_id not in processed_ids:
                queue.append(sub_cat_id)
    return all_descendant_ids


def get_quiz_data_dict(
    category_ids_filter=None,
    difficulty_levels_filter=None,
    quiz_mode=None, 
    question_count_str=None, 
    num_questions_custom_str=None,
    user: User = None,
    quiz_definicao_id=None
    ):
    
    todas_categorias_qs = Categoria.objects.all().order_by('nome_categoria')
    perguntas_qs = Pergunta.objects.filter(ativa=True)
    quiz_config = get_quiz_config()

    if quiz_definicao_id:
        try:
            quiz_def = QuizDefinicao.objects.get(pk=quiz_definicao_id, ativo=True)
            perguntas_ordenadas_ids = list(
                quiz_def.quizdefinicaopergunta_set.order_by('ordem').values_list('pergunta_id', flat=True)
            )
            if not perguntas_ordenadas_ids:
                perguntas_qs = Pergunta.objects.none()
            else:
                preserved_order = Case(*[When(pk=pk, then=pos) for pos, pk in enumerate(perguntas_ordenadas_ids)])
                perguntas_qs = Pergunta.objects.filter(pk__in=perguntas_ordenadas_ids, ativa=True).order_by(preserved_order)
        except QuizDefinicao.DoesNotExist:
            perguntas_qs = Pergunta.objects.none()
    else:
        if difficulty_levels_filter and 'all' not in (level.lower() for level in difficulty_levels_filter):
            normalized_difficulty_filter = [level.lower() for level in difficulty_levels_filter]
            q_difficulty_objects = Q()
            valid_model_difficulties = [choice[0] for choice in Pergunta.NivelDificuldade.choices]
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
            valid_category_ids_str_list = [cid for cid in category_ids_filter if str(cid).strip().isdigit()]
            if valid_category_ids_str_list:
                descendant_ids = get_descendant_category_ids(valid_category_ids_str_list)
                if descendant_ids:
                    perguntas_qs = perguntas_qs.filter(categorias__pk__in=descendant_ids).distinct()
                else:
                    perguntas_qs = Pergunta.objects.none()
            else:
                perguntas_qs = Pergunta.objects.none()

        num_perguntas_a_selecionar = 0
        if quiz_mode == SessoesQuizUsuario.ModoQuiz.RAPIDO:
            try:
                num_perguntas_a_selecionar = int(question_count_str) if question_count_str and question_count_str.isdigit() and int(question_count_str) > 0 else quiz_config.numero_perguntas_quiz_rapido
            except (ValueError, TypeError):
                num_perguntas_a_selecionar = quiz_config.numero_perguntas_quiz_rapido
        elif num_questions_custom_str:
            try:
                num_val = int(num_questions_custom_str)
                if num_val > 0:
                    num_perguntas_a_selecionar = num_val
            except (ValueError, TypeError):
                num_perguntas_a_selecionar = 0

        if num_perguntas_a_selecionar > 0:
            all_matching_question_ids = list(perguntas_qs.values_list('pk', flat=True))
            if len(all_matching_question_ids) > num_perguntas_a_selecionar:
                selected_ids = random.sample(all_matching_question_ids, num_perguntas_a_selecionar)
                perguntas_qs = Pergunta.objects.filter(pk__in=selected_ids).order_by('?')

    perguntas_data_qs = perguntas_qs.prefetch_related(
        Prefetch('categorias', queryset=Categoria.objects.all().only('pk', 'nome_categoria')),
        Prefetch('opcoes', queryset=OpcaoResposta.objects.all().only('pk', 'pergunta_id', 'texto_opcao', 'eh_correta', 'ordem_exibicao', 'feedback_opcao'))
    ).distinct()

    filtered_pergunta_ids = [p.pk for p in perguntas_data_qs]

    user_favorite_ids = set()
    if user and user.is_authenticated:
        user_favorite_ids = set(QuestaoFavorita.objects.filter(
            usuario=user,
            pergunta_id__in=filtered_pergunta_ids
        ).values_list('pergunta_id', flat=True))

    categorias_data_list = [
        {
            'id_categoria': c.pk, 'nome_categoria': c.nome_categoria,
            'id_categoria_pai': c.id_categoria_pai_id,
            'descricao_categoria': c.descricao_categoria
        } for c in todas_categorias_qs
    ]

    perguntas_data_list = []
    opcoes_dict_por_pergunta = defaultdict(list)

    opcoes_para_perguntas_selecionadas = OpcaoResposta.objects.filter(pergunta_id__in=filtered_pergunta_ids)
    for o in opcoes_para_perguntas_selecionadas:
        opcoes_dict_por_pergunta[o.pergunta_id].append({
            'id_opcao_resposta': o.pk,
            'id_pergunta': o.pergunta_id,
            'texto_opcao': o.texto_opcao,
            'eh_correta': o.eh_correta,
            'ordem_exibicao': o.ordem_exibicao,
            'feedback_opcao': o.feedback_opcao
        })

    for p in perguntas_data_qs:
        perguntas_data_list.append({
            'id_pergunta': p.pk,
            'texto_pergunta': p.texto_pergunta,
            'url_imagem': p.url_imagem,
            'referencia_bibliografica': p.referencia_bibliografica,
            'categoria_ids': [cat.pk for cat in p.categorias.all()],
            'nivel_dificuldade': p.nivel_dificuldade,
            'explicacao_resposta': p.explicacao_resposta,
            'is_favorited': p.pk in user_favorite_ids if user and user.is_authenticated else False,
            'opcoes': sorted(opcoes_dict_por_pergunta.get(p.pk, []), key=lambda x: x.get('ordem_exibicao', 0))
        })

    return {
        'perguntas': perguntas_data_list,
        'categorias': categorias_data_list,
        'opcoesResposta': [opt for opts_list in opcoes_dict_por_pergunta.values() for opt in opts_list]
    }

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


def _filter_queryset_by_period(queryset, period_str: str, date_field_name: str ="data_estatistica"):
    if period_str == "all":
        return queryset

    days_map = {"7d": 7, "30d": 30, "90d": 90}
    days = days_map.get(str(period_str).lower(), 30) 

    current_ts = timezone.now()
    
    try:
        model_field = queryset.model._meta.get_field(date_field_name)
    except models.FieldDoesNotExist:
        print(f"Warning: Campo '{date_field_name}' não encontrado no modelo {queryset.model.__name__} em _filter_queryset_by_period.")
        return queryset.none()
    
    if isinstance(model_field, models.DateTimeField):
        end_range = current_ts.replace(hour=23, minute=59, second=59, microsecond=999999)
        start_range_dt = current_ts - timedelta(days=days - 1)
        start_range = start_range_dt.replace(hour=0, minute=0, second=0, microsecond=0)
        
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
        print(f"Warning: _filter_queryset_by_period recebeu um tipo de campo inesperado: {type(model_field)} para o campo {date_field_name}")
        return queryset.none()

    return queryset.filter(**filter_kwargs)

#endregion

#region Funções Auxiliares para Estatísticas do Usuário
def _get_key_metrics(user: User, daily_stats_period_qs):
    total_questions_answered_period = daily_stats_period_qs.aggregate(total=Sum('perguntas_respondidas_dia'))['total'] or 0
    total_study_time_seconds_period = daily_stats_period_qs.aggregate(total=Sum('tempo_estudo_segundos_dia'))['total'] or 0

    latest_daily_stat = EstatisticasDiariasUsuario.objects.filter(id_usuario=user).order_by('-data_estatistica').first()
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
    
    category_performance_list = []
    if category_performance:
        category_performance_list = [
            {'name': name, **data, 'accuracy': (data['correct'] / data['total'] * 100) if data['total'] > 0 else 0}
            for name, data in category_performance.items() if data['total'] > 0
        ]
        category_performance_list.sort(key=lambda x: x['accuracy'], reverse=True)
    return category_performance_list


def _get_learning_progress_data(daily_stats_period_qs):
    raw_stats = daily_stats_period_qs.order_by('data_estatistica').values(
        'data_estatistica', 
        'acertos_dia', 
        'perguntas_respondidas_dia'
    )
    grouped_by_date = defaultdict(lambda: {'total_acertos_agg': 0, 'total_respondidas_agg': 0})
    for stat in raw_stats:
        date_key = stat['data_estatistica']
        grouped_by_date[date_key]['total_acertos_agg'] += stat.get('acertos_dia', 0) or 0
        grouped_by_date[date_key]['total_respondidas_agg'] += stat.get('perguntas_respondidas_dia', 0) or 0
    
    processed_data = []
    sorted_dates = sorted(grouped_by_date.keys())
    for date_key in sorted_dates:
        item = grouped_by_date[date_key]
        accuracy = 0
        if item['total_respondidas_agg'] > 0:
            accuracy = round((item['total_acertos_agg'] / item['total_respondidas_agg']) * 100, 1)
        
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
        grouped_by_date[date_key]['questions_done'] += stat.get('perguntas_respondidas_dia', 0) or 0
            
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
        daily_study_seconds[py_weekday] += stat.get('tempo_estudo_segundos_dia', 0) or 0

    day_labels_pt_ordered_sun_first = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
    
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
    difficulty_performance = {choice[0]: {'correct': 0, 'total': 0} for choice in Pergunta.NivelDificuldade.choices}

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
        for name, data in difficulty_performance.items() if data['total'] > 0
    ]
#endregion

#region Views Principais (Páginas HTML)

@login_required
def home_view(request):
    daily_stats = None
    accuracy_percentage_str = "0%"
    if request.user.is_authenticated:
        # **** CHAMADA CORRIGIDA ****
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
            messages.success(request, 'Cadastro realizado com sucesso! Bem-vindo(a).')
            return redirect('quiz:home')
        else:
            for field, errors in form.errors.items():
                field_label = form.fields[field].label if field in form.fields and field != '__all__' else ''
                for error in errors:
                    messages.error(request, f"{field_label if field_label else 'Erro Geral'}: {error}".strip(': '))
            if not form.errors: 
                messages.error(request, 'Por favor, corrija os erros abaixo para prosseguir.')
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
                    messages.error(request, f"{field_label if field_label else 'Formulário'}: {error}".strip(': '))
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
                messages.error(request, f"{field_label if field_label else 'Formulário de Deleção'}: {error}".strip(': '))
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
    quiz_definicao_id_str = request.GET.get('quiz_definicao_id')

    category_ids_filter = [cid.strip() for cid in category_ids_str.split(',') if cid.strip()] if category_ids_str else None
    difficulty_levels_filter = [diff.strip() for diff in difficulty_levels_str.split(',') if diff.strip()] if difficulty_levels_str else None
    
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
            quiz_definicao_id=quiz_definicao_id
        )
        return JsonResponse(quiz_data)
    except Exception as e:
        print(f"Erro em api_get_quiz_data_view: {type(e).__name__} - {e}")
        return JsonResponse({'status': 'error', 'message': 'Erro ao buscar dados do quiz.'}, status=500)


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
                quiz_definicao_obj = QuizDefinicao.objects.get(pk=int(quiz_definicao_id), ativo=True)
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
            dificuldades_selecionadas_json=data.get('dificuldades_selecionadas'), 
            num_questoes_solicitadas=data.get('num_questoes_solicitadas') 
        )

        if modo_quiz_frontend == SessoesQuizUsuario.ModoQuiz.POR_CATEGORIA and categoria_ids_str_list:
            try:
                categoria_ids_int = [int(cat_id) for cat_id in categoria_ids_str_list if str(cat_id).strip().isdigit()]
                if categoria_ids_int:
                    categorias_objs = Categoria.objects.filter(pk__in=categoria_ids_int)
                    nova_sessao.categorias_selecionadas.set(categorias_objs)
            except ValueError:
                print(f"Warning: Erro ao converter IDs de categoria para inteiros na sessão {nova_sessao.pk}.")
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

        sessao_quiz = get_object_or_404(SessoesQuizUsuario, pk=session_id, id_usuario=request.user)
        if sessao_quiz.status_sessao != SessoesQuizUsuario.StatusSessao.EM_ANDAMENTO:
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
            id_sessao_quiz=sessao_quiz,
            id_pergunta=pergunta,
            defaults={
                'id_opcao_resposta_selecionada': opcao_selecionada,
                'foi_correta': foi_correta_calculada,
                'data_resposta': timezone.now()
            }
        )

        respostas_da_sessao = RespostasUsuarioPorSessao.objects.filter(id_sessao_quiz=sessao_quiz)
        sessao_quiz.total_acertos = respostas_da_sessao.filter(foi_correta=True).count()
        sessao_quiz.total_erros = respostas_da_sessao.filter(foi_correta=False, id_opcao_resposta_selecionada__isnull=False).count()
        
        sessao_quiz.pontuacao_final = max(0, (sessao_quiz.total_acertos * quiz_config.pontuacao_por_acerto) - \
                                             (sessao_quiz.total_erros * quiz_config.penalidade_por_erro))

        if current_question_index is not None:
            try:
                idx = int(current_question_index)
                if sessao_quiz.ids_perguntas_json and 0 <= idx < len(sessao_quiz.ids_perguntas_json):
                    sessao_quiz.indice_ultima_pergunta_vista = idx
                else:
                    print(f"Warning: Índice de pergunta inválido ({idx}) recebido para sessão {sessao_quiz.pk}.")
            except ValueError:
                print(f"Warning: Valor de current_question_index não numérico ({current_question_index}) para sessão {sessao_quiz.pk}.")
        
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
        tempo_total_segundos_frontend = int(data.get('tempo_total_segundos', 0))

        sessao_quiz = get_object_or_404(SessoesQuizUsuario, pk=session_id, id_usuario=request.user)

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
        ).order_by('-data_inicio').first()

        if not sessao_ativa:
            return JsonResponse({'status': 'not_found', 'message': 'Nenhuma sessão de quiz em andamento encontrada.'}, status=404)

        if not sessao_ativa.ids_perguntas_json:
            sessao_ativa.status_sessao = SessoesQuizUsuario.StatusSessao.ABANDONADA
            sessao_ativa.save()
            return JsonResponse({'status': 'error', 'message': 'Sessão corrompida, não foi possível retomar.'}, status=500)

        ids_perguntas_ordenadas = sessao_ativa.ids_perguntas_json
        
        preserved_order = Case(*[When(pk=pk, then=pos) for pos, pk in enumerate(ids_perguntas_ordenadas)])
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
        
        opcoes_para_perguntas_da_sessao = OpcaoResposta.objects.filter(pergunta_id__in=ids_perguntas_ordenadas)
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
        
        respostas_dadas_qs = RespostasUsuarioPorSessao.objects.filter(id_sessao_quiz=sessao_ativa)
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

        return JsonResponse({
                'status': 'success',
                'session_id': sessao_ativa.pk,
                'modo_quiz': sessao_ativa.modo_quiz,
                'id_quiz_definicao': sessao_ativa.id_quiz_definicao_id,
                'perguntas': perguntas_data_list,
                'categorias': categorias_data_list,
                'respostas_dadas': respostas_dadas_map,
                'indice_ultima_pergunta_vista': sessao_ativa.indice_ultima_pergunta_vista,
                'pontuacao_atual': sessao_ativa.pontuacao_final,
                'total_acertos_atual': sessao_ativa.total_acertos,
                'total_erros_atual': sessao_ativa.total_erros,
                'data_inicio_sessao_iso': sessao_ativa.data_inicio.isoformat(), # <<< ADICIONAR ESTA LINHA
            })

    except Exception as e:
        print(f"Erro em api_resume_quiz_session_view: {type(e).__name__} - {e}")
        return JsonResponse({'status': 'error', 'message': 'Erro interno ao tentar retomar sessão.'}, status=500)


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
    favoritos_qs = QuestaoFavorita.objects.filter(usuario=request.user) \
        .select_related('pergunta') \
        .prefetch_related(
            Prefetch('pergunta__categorias', queryset=Categoria.objects.all().only('pk', 'nome_categoria')),
            Prefetch('pergunta__opcoes', queryset=OpcaoResposta.objects.all().order_by('ordem_exibicao'))
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

        perguntas_favoritas_data.append({
            'id_pergunta': p.pk,
            'texto_pergunta': p.texto_pergunta,
            'url_imagem': p.url_imagem,
            'referencia_bibliografica': p.referencia_bibliografica,
            'categoria_ids': [cat.pk for cat in p.categorias.all()],
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
            SessoesQuizUsuario.objects.filter(id_usuario=user, status_sessao=SessoesQuizUsuario.StatusSessao.COMPLETA),
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