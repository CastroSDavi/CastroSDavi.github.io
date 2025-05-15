# quiz/views.py
import json
from django.shortcuts import render, redirect
from django.contrib.auth import login # Para logar o usuário após o cadastro
from django.contrib.auth.decorators import login_required # Para proteger views

from .models import Pergunta, Categoria, OpcaoResposta
from .forms import CustomUserCreationForm 
@login_required 
def home_view(request):
    # Sua lógica existente para a home_view
    todas_categorias_qs = Categoria.objects.all().order_by('nome_categoria')
    perguntas_data_qs = Pergunta.objects.all().prefetch_related('categorias', 'opcoes')
    opcoes_data_qs = OpcaoResposta.objects.all().select_related('pergunta')

    categorias_data_list = [{'id_categoria': c.pk, 'nome_categoria': c.nome_categoria, 'id_categoria_pai': c.id_categoria_pai.pk if c.id_categoria_pai else None, 'descricao_categoria': c.descricao_categoria} for c in todas_categorias_qs]
    perguntas_data_list = [{'id_pergunta': p.pk, 'texto_pergunta': p.texto_pergunta, 'url_imagem': p.url_imagem, 'referencia_bibliografica': p.referencia_bibliografica, 'categoria_ids': [cat.pk for cat in p.categorias.all()], 'nivel_dificuldade': p.nivel_dificuldade, 'explicacao_resposta': p.explicacao_resposta} for p in perguntas_data_qs]
    opcoes_data_list = [{'id_opcao_resposta': o.pk, 'id_pergunta': o.pergunta.pk, 'texto_opcao': o.texto_opcao, 'eh_correta': o.eh_correta, 'ordem_exibicao': o.ordem_exibicao, 'feedback_opcao': o.feedback_opcao} for o in opcoes_data_qs]

    context = {
        'page_title': 'MedQuiz - Início',
        'django_quiz_data_json': json.dumps({
            'perguntas': perguntas_data_list,
            'categorias': categorias_data_list,
            'opcoesResposta': opcoes_data_list
        })
    }
    return render(request, 'quiz/home.html', context)

def questions_view(request):
    # Sua lógica existente para a questions_view
    todas_categorias_qs = Categoria.objects.all().order_by('nome_categoria')
    perguntas_data_qs = Pergunta.objects.all().prefetch_related('categorias', 'opcoes')
    opcoes_data_qs = OpcaoResposta.objects.all().select_related('pergunta')

    categorias_data_list = [{'id_categoria': c.pk, 'nome_categoria': c.nome_categoria, 'id_categoria_pai': c.id_categoria_pai.pk if c.id_categoria_pai else None, 'descricao_categoria': c.descricao_categoria} for c in todas_categorias_qs]
    perguntas_data_list = [{'id_pergunta': p.pk, 'texto_pergunta': p.texto_pergunta, 'url_imagem': p.url_imagem, 'referencia_bibliografica': p.referencia_bibliografica, 'categoria_ids': [cat.pk for cat in p.categorias.all()], 'nivel_dificuldade': p.nivel_dificuldade, 'explicacao_resposta': p.explicacao_resposta} for p in perguntas_data_qs]
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

# NOVA VIEW DE CADASTRO
def register_view(request):
    """
    Processa o formulário de cadastro de novos usuários.
    Se o método for POST e o formulário for válido, salva o novo usuário,
    faz o login automaticamente e redireciona para a página inicial.
    Caso contrário, exibe um formulário de cadastro vazio ou com erros.
    """
    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()  # Salva o novo usuário no banco de dados
            login(request, user)  # Loga o usuário na sessão atual
            # messages.success(request, 'Cadastro realizado com sucesso!') # Opcional: Adicionar mensagem de sucesso
            return redirect('quiz:home')  # Redireciona para a página inicial do quiz
        # Se o formulário não for válido, ele será renderizado novamente com os erros.
    else:
        form = CustomUserCreationForm() # Cria um formulário vazio para requisições GET

    context = {
        'form': form,
        'page_title': 'Cadastro - MedQuiz'
    }
    return render(request, 'quiz/register.html', context)

# VIEW DA CONTA - AGORA PROTEGIDA E RENDERIZANDO UM TEMPLATE ESPECÍFICO
@login_required # <<< DECORADOR PARA PROTEGER A VIEW
def account_view(request):
    """
    Exibe a página de conta do usuário.
    Apenas usuários autenticados podem acessar esta página.
    """
    # Aqui você pode adicionar lógica para permitir que o usuário edite o perfil,
    # por exemplo, criando um ProfileForm e processando-o.
    # Por enquanto, apenas exibe informações básicas.
    context = {
        'page_title': 'MedQuiz - Minha Conta',
        # O objeto 'user' já está disponível no contexto do template
        # automaticamente quando o usuário está logado e você usa RequestContext.
    }
    # Certifique-se de criar o template 'quiz/account_page.html'
    return render(request, 'quiz/account_page.html', context)