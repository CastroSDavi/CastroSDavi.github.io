# quiz/views.py
from django.shortcuts import render
import json
from .models import Pergunta, Categoria, OpcaoResposta

def home_view(request):
    # ... (lógica existente para buscar dados e criar o contexto para django_quiz_data_json) ...
    # Por simplicidade, vamos replicar a lógica de dados aqui, idealmente seria otimizado
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
    # Esta view agora renderiza seu próprio template.
    todas_categorias_qs = Categoria.objects.all().order_by('nome_categoria')
    perguntas_data_qs = Pergunta.objects.all().prefetch_related('categorias', 'opcoes')
    opcoes_data_qs = OpcaoResposta.objects.all().select_related('pergunta')

    # Replicando a lógica de formatação dos dados para o contexto
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
    return render(request, 'quiz/questions_page.html', context) # <<< MUDOU AQUI

def account_view(request):
    # Quando você criar account_page.html, mude aqui também.
    # Por enquanto, vamos apenas renderizar a home para não dar erro na URL.
    # No futuro, esta view teria seu próprio contexto e template.
    context = {'page_title': 'MedQuiz - Minha Conta'}
    # return render(request, 'quiz/account_page.html', context) # Descomente quando criar o template
    return render(request, 'quiz/home.html', context) # Placeholder temporário