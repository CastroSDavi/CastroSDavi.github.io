# quiz/views.py
import json
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.utils import timezone
from datetime import date

from .models import (
    Pergunta, Categoria, OpcaoResposta,
    SessoesQuizUsuario, RespostasUsuarioPorSessao, EstatisticasDiariasUsuario
)
from .forms import CustomUserCreationForm

def get_or_create_daily_stats(user):
    today = date.today()
    stats, created = EstatisticasDiariasUsuario.objects.get_or_create(
        id_usuario=user,
        data_estatistica=today
    )
    return stats

@login_required
def home_view(request):
    todas_categorias_qs = Categoria.objects.all().order_by('nome_categoria')
    perguntas_data_qs = Pergunta.objects.filter(ativa=True).prefetch_related('categorias', 'opcoes')
    opcoes_data_qs = OpcaoResposta.objects.all().select_related('pergunta')

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
         'explicacao_resposta': p.explicacao_resposta} for p in perguntas_data_qs
    ]
    opcoes_data_list = [
        {'id_opcao_resposta': o.pk, 'id_pergunta': o.pergunta.pk, 'texto_opcao': o.texto_opcao,
         'eh_correta': o.eh_correta, 'ordem_exibicao': o.ordem_exibicao,
         'feedback_opcao': o.feedback_opcao} for o in opcoes_data_qs
    ]

    daily_stats = None
    accuracy_percentage_str = "0%" # Valor padrão

    if request.user.is_authenticated:
        daily_stats = get_or_create_daily_stats(request.user)
        if daily_stats:
            if daily_stats.perguntas_respondidas_dia > 0:
                accuracy = (daily_stats.acertos_dia / daily_stats.perguntas_respondidas_dia) * 100
                accuracy_percentage_str = f"{accuracy:.0f}%" # Formata como inteiro com %
            # Se não respondeu perguntas, accuracy_percentage_str permanece "0%"

    context = {
        'page_title': 'MedQuiz - Início',
        'django_quiz_data_json': json.dumps({
            'perguntas': perguntas_data_list,
            'categorias': categorias_data_list,
            'opcoesResposta': opcoes_data_list
        }),
        'daily_stats': daily_stats,
        'accuracy_percentage': accuracy_percentage_str, # Passando a porcentagem calculada
    }
    return render(request, 'quiz/home.html', context)

@login_required
def questions_view(request):
    todas_categorias_qs = Categoria.objects.all().order_by('nome_categoria')
    perguntas_data_qs = Pergunta.objects.filter(ativa=True).prefetch_related('categorias', 'opcoes')
    opcoes_data_qs = OpcaoResposta.objects.all().select_related('pergunta')

    categorias_data_list = [{'id_categoria': c.pk, 'nome_categoria': c.nome_categoria, 'id_categoria_pai': c.id_categoria_pai.pk if c.id_categoria_pai else None, 'descricao_categoria': c.descricao_categoria} for c in todas_categorias_qs]
    perguntas_data_list = [{'id_pergunta': p.pk, 'texto_pergunta': p.texto_pergunta, 'url_imagem': p.url_imagem, 'referencia_bibliografica': p.referencia_bibliografica,
                            'categoria_ids': [cat.pk for cat in p.categorias.all()],
                            'nivel_dificuldade': p.nivel_dificuldade, 'explicacao_resposta': p.explicacao_resposta} for p in perguntas_data_qs]
    opcoes_data_list = [{'id_opcao_resposta': o.pk, 'id_pergunta': o.pergunta.pk, 'texto_opcao': o.texto_opcao, 'eh_correta': o.eh_correta, 'ordem_exibicao': o.ordem_exibicao, 'feedback_opcao': o.feedback_opcao} for o in opcoes_data_qs]

    context = {
        'page_title': 'MedQuiz - Questões',
        'django_quiz_data_json': json.dumps({
            'perguntas': perguntas_data_list,
            'categorias': categorias_data_list,
            'opcoesResposta': opcoes_data_list
        })
    }
    return render(request, 'quiz/questions_page.html', context)

def register_view(request):
    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('quiz:home')
    else:
        form = CustomUserCreationForm()
    context = {
        'form': form,
        'page_title': 'Cadastro - MedQuiz'
    }
    return render(request, 'quiz/register.html', context)

@login_required
def account_view(request):
    user_sessions = SessoesQuizUsuario.objects.filter(id_usuario=request.user).order_by('-data_inicio')[:10]
    user_daily_stats_summary = EstatisticasDiariasUsuario.objects.filter(id_usuario=request.user).order_by('-data_estatistica')[:30]
    
    context = {
        'page_title': 'MedQuiz - Minha Conta',
        'user_sessions': user_sessions,
        'user_daily_stats_summary': user_daily_stats_summary,
    }
    return render(request, 'quiz/account_page.html', context)

@login_required
@require_POST
def start_quiz_session_view(request):
    try:
        data = json.loads(request.body.decode('utf-8'))
        modo_quiz = data.get('modo_quiz')
        categoria_ids_str = data.get('categoria_ids', [])
        total_perguntas_sessao = int(data.get('total_perguntas_sessao', 0))

        if not modo_quiz or not isinstance(total_perguntas_sessao, int) or total_perguntas_sessao < 0:
            return JsonResponse({'status': 'error', 'message': 'Dados inválidos para iniciar sessão.'}, status=400)

        nova_sessao = SessoesQuizUsuario.objects.create(
            id_usuario=request.user,
            modo_quiz=modo_quiz,
            total_perguntas_sessao=total_perguntas_sessao,
            status_sessao='Em Andamento',
            data_inicio=timezone.now()
        )

        if modo_quiz == 'Por Categoria' and categoria_ids_str:
            try:
                categoria_ids_int = [int(cat_id) for cat_id in categoria_ids_str if str(cat_id).isdigit()]
                categorias_selecionadas = Categoria.objects.filter(pk__in=categoria_ids_int)
                nova_sessao.categorias_selecionadas.set(categorias_selecionadas)
            except ValueError:
                return JsonResponse({'status': 'error', 'message': 'IDs de categoria inválidos.'}, status=400)

        return JsonResponse({'status': 'success', 'session_id': nova_sessao.pk})
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Corpo da requisição JSON inválido.'}, status=400)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': f'Erro interno ao iniciar sessão: {str(e)}'}, status=500)

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

        if opcao_id_str is not None:
            try:
                opcao_selecionada = get_object_or_404(OpcaoResposta, pk=int(opcao_id_str), pergunta=pergunta)
                foi_correta_calc = opcao_selecionada.eh_correta
            except ValueError:
                return JsonResponse({'status': 'error', 'message': 'ID da opção de resposta inválido.'}, status=400)

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
        total_erros_sessao = respostas_da_sessao.filter(foi_correta=False).count()

        sessao_quiz.total_acertos = total_acertos_sessao
        sessao_quiz.total_erros = total_erros_sessao
        sessao_quiz.pontuacao_final = (total_acertos_sessao * 15) - (total_erros_sessao * 5)
        if sessao_quiz.pontuacao_final < 0: sessao_quiz.pontuacao_final = 0
        sessao_quiz.save()

        return JsonResponse({'status': 'success', 'message': 'Resposta registrada.', 'foi_correta': foi_correta_calc, 'pontuacao_sessao': sessao_quiz.pontuacao_final})

    except SessoesQuizUsuario.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Sessão de quiz inválida ou não pertence ao usuário.'}, status=403)
    except Pergunta.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Pergunta inválida.'}, status=400)
    except OpcaoResposta.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Opção de resposta inválida para a pergunta fornecida.'}, status=400)
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Corpo da requisição JSON inválido.'}, status=400)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': f'Erro interno ao registrar resposta: {str(e)}'}, status=500)

@login_required
@require_POST
def end_quiz_session_view(request):
    try:
        data = json.loads(request.body.decode('utf-8'))
        session_id = data.get('session_id')
        tempo_total_segundos_frontend = int(data.get('tempo_total_segundos', 0))

        sessao_quiz = get_object_or_404(SessoesQuizUsuario, pk=session_id, id_usuario=request.user)
        
        if sessao_quiz.status_sessao != 'Em Andamento':
            return JsonResponse({'status': 'info', 'message': 'Sessão já finalizada.', 'pontuacao_final': sessao_quiz.pontuacao_final}, status=200)

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
        
        # Lógica placeholder para sequência de dias - precisa ser melhorada
        if stats.perguntas_respondidas_dia > 0:
            # Esta lógica de sequência não está correta, precisa comparar com o dia anterior.
            # stats.sequencia_dias_quiz = (stats.sequencia_dias_quiz or 0) + 1 
            pass # Manter a lógica de sequência para ser implementada depois
        
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
        return JsonResponse({'status': 'error', 'message': f'Erro interno ao finalizar sessão: {str(e)}'}, status=500)