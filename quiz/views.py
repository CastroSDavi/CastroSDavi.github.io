# quiz/views.py
import json
import random # Para o modo Quiz Rápido e seleção de número customizado
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, logout # Adicionado logout
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_GET
from django.utils import timezone
from datetime import date # MODIFICADO: datetime.date para date
from django.db.models import Q # Para queries OR complexas
from django.contrib import messages # Para feedback ao usuário
from django.urls import reverse_lazy # Para redirects após logout

from .models import (
    Pergunta, Categoria, OpcaoResposta,
    SessoesQuizUsuario, RespostasUsuarioPorSessao, EstatisticasDiariasUsuario,
    QuestaoFavorita
)
# Importar os novos formulários e o PasswordChangeForm customizado
from .forms import (
    CustomUserCreationForm,
    UserUpdateForm,
    AccountDeleteForm,
    CustomPasswordChangeForm # Importando o formulário de mudança de senha customizado
)

# --- FUNÇÕES AUXILIARES DE LÓGICA DE NEGÓCIO ---

def get_descendant_category_ids(category_ids_str_list):
    """
    Retorna um set de IDs de categorias, incluindo todas as descendentes
    das categorias fornecidas.
    Espera uma lista de strings de IDs.
    """
    if not category_ids_str_list:
        return set()

    try:
        # Garante que apenas IDs numéricos sejam processados
        initial_ids = set(int(cat_id) for cat_id in category_ids_str_list if cat_id.isdigit())
    except ValueError:
        # Lidar com IDs inválidos, talvez logar ou retornar erro silenciosamente
        return set()

    all_descendant_ids = set()
    if not initial_ids: # Se após a filtragem de isdigit() a lista ficar vazia
        return set()

    queue = list(initial_ids)
    processed_ids = set() # Para evitar loops infinitos em caso de dados malformados

    while queue:
        current_id = queue.pop(0)
        if current_id in processed_ids:
            continue
        processed_ids.add(current_id)
        all_descendant_ids.add(current_id)
        
        # Adiciona subcategorias diretas à fila
        subcategorias = Categoria.objects.filter(id_categoria_pai_id=current_id)
        for sub_cat in subcategorias:
            if sub_cat.pk not in processed_ids: # Verifica para não reprocessar
                queue.append(sub_cat.pk)
    return all_descendant_ids


def get_quiz_data_dict(category_ids_filter=None, difficulty_levels_filter=None, quiz_mode=None, question_count=None, num_questions_custom=None, user=None):
    """
    Monta o dicionário de dados do quiz, com filtros opcionais.
    - user: o objeto User atual, para verificar questões favoritas.
    """
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
            perguntas_qs = perguntas_qs.none()

    if category_ids_filter:
        valid_category_ids_str_list = [cid for cid in category_ids_filter if cid.isdigit()]
        if valid_category_ids_str_list:
            descendant_ids = get_descendant_category_ids(valid_category_ids_str_list)
            if descendant_ids:
                perguntas_qs = perguntas_qs.filter(categorias__pk__in=descendant_ids).distinct()
            else:
                perguntas_qs = perguntas_qs.none()
        else:
             perguntas_qs = perguntas_qs.none()

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
        {'id_categoria': c.pk, 'nome_categoria': c.nome_categoria,
         'id_categoria_pai': c.id_categoria_pai.pk if c.id_categoria_pai else None,
         'descricao_categoria': c.descricao_categoria} for c in todas_categorias_qs
    ]
    perguntas_data_list = [
        {'id_pergunta': p.pk, 'texto_pergunta': p.texto_pergunta, 'url_imagem': p.url_imagem,
         'referencia_bibliografica': p.referencia_bibliografica,
         'categoria_ids': [cat.pk for cat in p.categorias.all()],
         'nivel_dificuldade': p.nivel_dificuldade,
         'explicacao_resposta': p.explicacao_resposta,
         'is_favorited': p.pk in user_favorite_ids if user and user.is_authenticated else False
        } for p in perguntas_data_qs
    ]
    opcoes_data_list = [
        {'id_opcao_resposta': o.pk, 'id_pergunta': o.pergunta.pk, 'texto_opcao': o.texto_opcao,
         'eh_correta': o.eh_correta, 'ordem_exibicao': o.ordem_exibicao,
         'feedback_opcao': o.feedback_opcao} for o in opcoes_data_qs
    ]
    return {
        'perguntas': perguntas_data_list,
        'categorias': categorias_data_list,
        'opcoesResposta': opcoes_data_list
    }

def get_or_create_daily_stats(user):
    today = date.today()
    stats, created = EstatisticasDiariasUsuario.objects.get_or_create(
        id_usuario=user,
        data_estatistica=today
    )
    return stats

# --- VIEWS PRINCIPAIS ---

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
            # Adiciona mensagens de erro do formulário para serem exibidas no template
            for field, errors in form.errors.items():
                for error in errors:
                    messages.error(request, f"{form.fields[field].label if field != '__all__' else ''}: {error}")
            if not form.errors: # Caso haja non_field_errors
                 messages.error(request, 'Por favor, corrija os erros abaixo.')
    else:
        form = CustomUserCreationForm()
    context = {
        'form': form,
        'page_title': 'Cadastro - MedQuiz'
    }
    return render(request, 'quiz/register.html', context)


# --- VIEWS DA PÁGINA "MINHA CONTA" ---

@login_required
def account_view(request):
    user_sessions = SessoesQuizUsuario.objects.filter(id_usuario=request.user).order_by('-data_inicio')[:10]
    user_daily_stats_summary = EstatisticasDiariasUsuario.objects.filter(id_usuario=request.user).order_by('-data_estatistica')[:30]

    # Os formulários são instanciados aqui para serem passados ao template.
    # Se houver um erro POST em update_profile_view ou delete_account_view,
    # esses formulários serão substituídos pelos formulários com erros vindos dessas views.
    update_form = UserUpdateForm(instance=request.user)
    delete_form = AccountDeleteForm(user=request.user)
    
    # Verifica se há mensagens de erro de um POST anterior para os formulários
    # Isso é uma maneira de não perder os dados do formulário com erro ao recarregar a página
    # No entanto, o ideal é que as views de POST já re-renderizem a página da conta com os erros.
    # Esta lógica será simplificada, pois as views de POST vão lidar com a renderização dos erros.

    context = {
        'page_title': 'MedQuiz - Minha Conta',
        'user_sessions': user_sessions,
        'user_daily_stats_summary': user_daily_stats_summary,
        'update_form': update_form, # Formulário para atualizar perfil
        'delete_form': delete_form, # Formulário para deletar conta (usado no modal)
        # 'password_change_form': CustomPasswordChangeForm(request.user), # Para a view de mudar senha
    }
    return render(request, 'quiz/account_page.html', context)

@login_required
def update_profile_view(request): # Não precisa mais de @require_POST se quisermos mostrar o form via GET
    if request.method == 'POST':
        form = UserUpdateForm(request.POST, instance=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, 'Seu perfil foi atualizado com sucesso!')
            return redirect('quiz:account')
        else:
            # Se o formulário não for válido, re-renderiza a página da conta com os erros
            user_sessions = SessoesQuizUsuario.objects.filter(id_usuario=request.user).order_by('-data_inicio')[:10]
            user_daily_stats_summary = EstatisticasDiariasUsuario.objects.filter(id_usuario=request.user).order_by('-data_estatistica')[:30]
            delete_form = AccountDeleteForm(user=request.user) # Precisa recriar o form de delete
            # password_change_form = CustomPasswordChangeForm(request.user) # E o de mudar senha

            # Adiciona mensagens de erro do formulário
            for field, errors in form.errors.items():
                for error in errors:
                    messages.error(request, f"{form.fields[field].label if field != '__all__' else ''}: {error}")
            if not form.errors:
                messages.error(request, 'Não foi possível atualizar seu perfil. Verifique os dados.')

            context = {
                'page_title': 'MedQuiz - Minha Conta',
                'user_sessions': user_sessions,
                'user_daily_stats_summary': user_daily_stats_summary,
                'update_form': form, # Passa o formulário de atualização com erros
                'delete_form': delete_form,
                # 'password_change_form': password_change_form,
                'active_tab_on_error': 'security-content' # Dica para o JS reabrir a aba
            }
            return render(request, 'quiz/account_page.html', context)
    else: # Se for GET, apenas redireciona para a página da conta (o formulário já é carregado lá)
        return redirect('quiz:account')


@login_required
@require_POST # Exclusão de conta deve ser sempre POST
def delete_account_view(request):
    form = AccountDeleteForm(request.user, request.POST)
    if form.is_valid():
        user = request.user
        logout(request) # Desloga o usuário ANTES de apagar
        user.delete() # Deleta o usuário
        messages.success(request, 'Sua conta foi excluída com sucesso.')
        return redirect(reverse_lazy('quiz:home')) # Redireciona para a home page
    else:
        # Se o formulário de deleção não for válido (ex: senha incorreta)
        # Re-renderiza a página da conta com a mensagem de erro e o modal potencialmente aberto
        user_sessions = SessoesQuizUsuario.objects.filter(id_usuario=request.user).order_by('-data_inicio')[:10]
        user_daily_stats_summary = EstatisticasDiariasUsuario.objects.filter(id_usuario=request.user).order_by('-data_estatistica')[:30]
        update_form = UserUpdateForm(instance=request.user) # Recria o form de update
        # password_change_form = CustomPasswordChangeForm(request.user) # E o de mudar senha
        
        # Adiciona mensagens de erro do formulário de deleção
        for field, errors in form.errors.items():
            for error in errors:
                 messages.error(request, f"{form.fields[field].label if field != '__all__' else ''}: {error}")
        if not form.errors:
            messages.error(request, 'Não foi possível excluir sua conta. Verifique sua senha.')

        context = {
            'page_title': 'MedQuiz - Minha Conta',
            'user_sessions': user_sessions,
            'user_daily_stats_summary': user_daily_stats_summary,
            'update_form': update_form,
            'delete_form': form, # Passa o formulário de deleção com erros
            # 'password_change_form': password_change_form,
            'active_tab_on_error': 'security-content', # Dica para o JS reabrir a aba
            'show_delete_account_modal_on_error': True # Dica para o JS reabrir o modal
        }
        return render(request, 'quiz/account_page.html', context)
    # Se não for POST (o que não deveria acontecer devido ao @require_POST, mas por segurança)
    return redirect('quiz:account')


# --- API VIEWS PARA O QUIZ ---
# (api_get_quiz_data_view, start_quiz_session_view, register_answer_view, end_quiz_session_view,
# toggle_favorite_status_view, get_favorite_questions_view permanecem como estavam antes)
@require_GET
def api_get_quiz_data_view(request):
    """
    API para buscar dados do quiz, agora com capacidade de filtragem.
    """
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
            if question_count <= 0: 
                question_count = None 
        except ValueError:
            question_count = None 
    elif num_questions_custom_str: 
        try:
            num_questions_custom_val = int(num_questions_custom_str)
            if num_questions_custom_val <= 0: 
                num_questions_custom_val = None 
        except ValueError:
            num_questions_custom_val = None 

    quiz_data = get_quiz_data_dict(
        category_ids_filter=category_ids_filter,
        difficulty_levels_filter=difficulty_levels_filter,
        quiz_mode=quiz_mode,
        question_count=question_count,
        num_questions_custom=num_questions_custom_val,
        user=request.user
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
            return JsonResponse({'status': 'error', 'message': 'Dados inválidos para iniciar sessão (modo_quiz, total_perguntas_sessao).'}, status=400)
        
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
                    categorias_selecionadas_objs = Categoria.objects.filter(pk__in=categoria_ids_int)
                    nova_sessao.categorias_selecionadas.set(categorias_selecionadas_objs)
            except ValueError:
                pass 

        return JsonResponse({'status': 'success', 'session_id': nova_sessao.pk})
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Corpo da requisição JSON inválido.'}, status=400)
    except Exception as e:
        # Log o erro real no servidor para depuração
        print(f"Erro em start_quiz_session_view: {e}") # Adicionar log
        return JsonResponse({'status': 'error', 'message': f'Erro interno ao iniciar sessão.'}, status=500)

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
            return JsonResponse({'status': 'error', 'message': 'Esta sessão de quiz não está mais em andamento.'}, status=400)

        pergunta = get_object_or_404(Pergunta, pk=pergunta_id)
        opcao_selecionada = None
        foi_correta_calc = None 

        if opcao_id_str is not None: # Permite null para registrar pulo
            try:
                opcao_selecionada = get_object_or_404(OpcaoResposta, pk=int(opcao_id_str), pergunta=pergunta)
                foi_correta_calc = opcao_selecionada.eh_correta
            except ValueError:
                return JsonResponse({'status': 'error', 'message': 'ID da opção de resposta inválido.'}, status=400)
            except OpcaoResposta.DoesNotExist:
                 return JsonResponse({'status': 'error', 'message': 'Opção de resposta inválida para a pergunta fornecida.'}, status=400)
        else: 
            foi_correta_calc = None 
        
        resposta_usuario, created = RespostasUsuarioPorSessao.objects.update_or_create(
            id_sessao_quiz=sessao_quiz,
            id_pergunta=pergunta,
            defaults={
                'id_opcao_resposta_selecionada': opcao_selecionada,
                'foi_correta': foi_correta_calc,
                'data_resposta': timezone.now()
            }
        )

        respostas_da_sessao = RespostasUsuarioPorSessao.objects.filter(id_sessao_quiz=sessao_quiz)
        total_acertos_sessao = respostas_da_sessao.filter(foi_correta=True).count()
        total_erros_sessao = respostas_da_sessao.filter(foi_correta=False, id_opcao_resposta_selecionada__isnull=False).count()

        sessao_quiz.total_acertos = total_acertos_sessao
        sessao_quiz.total_erros = total_erros_sessao
        sessao_quiz.pontuacao_final = max(0, (total_acertos_sessao * 15) - (total_erros_sessao * 5))
        sessao_quiz.save()

        return JsonResponse({
            'status': 'success', 
            'message': 'Resposta registrada.', 
            'foi_correta': foi_correta_calc,
            'pontuacao_sessao': sessao_quiz.pontuacao_final,
            'total_acertos_sessao': total_acertos_sessao,
            'total_erros_sessao': total_erros_sessao
            })

    except SessoesQuizUsuario.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Sessão de quiz inválida ou não pertence ao usuário.'}, status=403)
    except Pergunta.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Pergunta inválida.'}, status=400)
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Corpo da requisição JSON inválido.'}, status=400)
    except Exception as e:
        print(f"Erro em register_answer_view: {e}") # Adicionar log
        return JsonResponse({'status': 'error', 'message': f'Erro interno ao registrar resposta.'}, status=500)

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
                'status': 'info', 
                'message': 'Sessão já finalizada.', 
                'pontuacao_final': sessao_quiz.pontuacao_final,
                'total_acertos': sessao_quiz.total_acertos,
                'total_erros': sessao_quiz.total_erros
            }, status=200)

        sessao_quiz.data_fim = timezone.now()
        sessao_quiz.tempo_total_segundos = tempo_total_segundos_frontend
        sessao_quiz.status_sessao = 'Completa'
        sessao_quiz.save()

        stats = get_or_create_daily_stats(request.user)
        
        perguntas_respondidas_nesta_sessao = RespostasUsuarioPorSessao.objects.filter(
            id_sessao_quiz=sessao_quiz
        ).exclude(id_opcao_resposta_selecionada__isnull=True).count()

        stats.perguntas_respondidas_dia += perguntas_respondidas_nesta_sessao
        stats.acertos_dia += sessao_quiz.total_acertos 
        stats.pontos_dia += sessao_quiz.pontuacao_final 
        stats.tempo_estudo_segundos_dia += tempo_total_segundos_frontend
        stats.save()

        return JsonResponse({
            'status': 'success',
            'message': 'Sessão finalizada com sucesso.',
            'pontuacao_final': sessao_quiz.pontuacao_final,
            'total_acertos': sessao_quiz.total_acertos,
            'total_erros': sessao_quiz.total_erros
        })
    except SessoesQuizUsuario.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Sessão de quiz inválida ou não pertence ao usuário.'}, status=403)
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Corpo da requisição JSON inválido.'}, status=400)
    except Exception as e:
        print(f"Erro em end_quiz_session_view: {e}") # Adicionar log
        return JsonResponse({'status': 'error', 'message': f'Erro interno ao finalizar sessão.'}, status=500)


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
    favoritos = QuestaoFavorita.objects.filter(usuario=request.user).select_related('pergunta').order_by('-data_favoritada')
    
    perguntas_favoritas_data = []
    todas_categorias_qs = Categoria.objects.all()
    
    for fav in favoritos:
        p = fav.pergunta
        categoria_ids_da_pergunta = [cat.pk for cat in p.categorias.all()]
        
        opcoes_da_pergunta = OpcaoResposta.objects.filter(pergunta=p).order_by('ordem_exibicao')
        opcoes_data_list = [
            {'id_opcao_resposta': o.pk, 'id_pergunta': o.pergunta.pk, 'texto_opcao': o.texto_opcao,
             'eh_correta': o.eh_correta, 'ordem_exibicao': o.ordem_exibicao,
             'feedback_opcao': o.feedback_opcao} for o in opcoes_da_pergunta
        ]

        perguntas_favoritas_data.append({
            'id_pergunta': p.pk,
            'texto_pergunta': p.texto_pergunta,
            'url_imagem': p.url_imagem,
            'referencia_bibliografica': p.referencia_bibliografica,
            'categoria_ids': categoria_ids_da_pergunta,
            'nivel_dificuldade': p.nivel_dificuldade,
            'explicacao_resposta': p.explicacao_resposta,
            'opcoes': opcoes_data_list,
            'data_favoritada': fav.data_favoritada.isoformat()
        })

    categorias_data_list = [
        {'id_categoria': c.pk, 'nome_categoria': c.nome_categoria,
         'id_categoria_pai': c.id_categoria_pai.pk if c.id_categoria_pai else None,
         'descricao_categoria': c.descricao_categoria} for c in todas_categorias_qs
    ]

    return JsonResponse({
        'status': 'success',
        'favorite_questions': perguntas_favoritas_data,
        'all_categories_for_mapping': categorias_data_list
    })