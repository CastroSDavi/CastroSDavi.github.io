# quiz/admin.py
from django.contrib import admin
from .models import (
    Categoria, Pergunta, OpcaoResposta,
    SessoesQuizUsuario, RespostasUsuarioPorSessao, EstatisticasDiariasUsuario
)

class OpcaoRespostaInline(admin.TabularInline):
    model = OpcaoResposta
    extra = 1
    fields = ['texto_opcao', 'eh_correta', 'ordem_exibicao', 'feedback_opcao']

@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ('nome_categoria', 'id_categoria_pai', 'id', 'data_criacao', 'data_atualizacao')
    search_fields = ('nome_categoria', 'descricao_categoria')
    list_filter = ('id_categoria_pai', 'data_criacao')
    autocomplete_fields = ['id_categoria_pai']

@admin.register(Pergunta)
class PerguntaAdmin(admin.ModelAdmin):
    list_display = ('id', 'texto_curto', 'nivel_dificuldade', 'mostrar_categorias', 'ativa', 'id_usuario_criador', 'data_criacao')
    search_fields = ('texto_pergunta', 'referencia_bibliografica', 'explicacao_resposta')
    list_filter = ('nivel_dificuldade', 'categorias', 'ativa', 'data_criacao', 'id_usuario_criador')
    filter_horizontal = ('categorias',)
    inlines = [OpcaoRespostaInline]
    readonly_fields = ('data_criacao', 'data_atualizacao') # Tornar campos auto-gerados readonly

    def texto_curto(self, obj):
        return obj.texto_pergunta[:100] + '...' if len(obj.texto_pergunta) > 100 else obj.texto_pergunta
    texto_curto.short_description = 'Texto da Pergunta (Início)'

    def mostrar_categorias(self, obj):
        return ", ".join([cat.nome_categoria for cat in obj.categorias_associadas.all()])
    mostrar_categorias.short_description = 'Categorias'

@admin.register(OpcaoResposta)
class OpcaoRespostaAdmin(admin.ModelAdmin):
    list_display = ('id', 'texto_opcao_curto', 'pergunta_associada', 'eh_correta', 'ordem_exibicao', 'data_criacao')
    search_fields = ('texto_opcao', 'feedback_opcao')
    list_filter = ('eh_correta', 'pergunta__nivel_dificuldade', 'data_criacao')
    autocomplete_fields = ['pergunta']
    readonly_fields = ('data_criacao', 'data_atualizacao')

    def texto_opcao_curto(self, obj):
        return obj.texto_opcao[:75] + '...' if len(obj.texto_opcao) > 75 else obj.texto_opcao
    texto_opcao_curto.short_description = 'Texto da Opção'

    def pergunta_associada(self, obj):
        return obj.pergunta.texto_pergunta[:50] + '...' if obj.pergunta else '-'
    pergunta_associada.short_description = 'Pergunta Associada'

# Novos Modelos no Admin
class RespostasUsuarioPorSessaoInline(admin.TabularInline):
    model = RespostasUsuarioPorSessao
    extra = 0 # Normalmente não adiciona respostas manualmente aqui
    readonly_fields = ('id_pergunta', 'id_opcao_resposta_selecionada', 'foi_correta', 'data_resposta')
    can_delete = False # Geralmente não se deleta respostas individuais de uma sessão assim

    def has_add_permission(self, request, obj=None):
        return False

@admin.register(SessoesQuizUsuario)
class SessoesQuizUsuarioAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'id_usuario', 'data_inicio', 'data_fim', 'modo_quiz',
        'status_sessao', 'pontuacao_final', 'total_acertos', 'total_erros', 'total_perguntas_sessao'
    )
    list_filter = ('modo_quiz', 'status_sessao', 'data_inicio', 'id_usuario')
    search_fields = ('id_usuario__username', 'id_usuario__email')
    readonly_fields = ('data_inicio', 'data_fim') # data_fim pode ser editável se precisar corrigir
    filter_horizontal = ('categorias_selecionadas',)
    inlines = [RespostasUsuarioPorSessaoInline]

@admin.register(RespostasUsuarioPorSessao)
class RespostasUsuarioPorSessaoAdmin(admin.ModelAdmin):
    list_display = ('id', 'id_sessao_quiz_info', 'id_pergunta_info', 'id_opcao_resposta_selecionada_info', 'foi_correta', 'data_resposta')
    list_filter = ('foi_correta', 'data_resposta', 'id_sessao_quiz__id_usuario')
    search_fields = ('id_sessao_quiz__id', 'id_pergunta__texto_pergunta')
    readonly_fields = ('data_resposta',)
    autocomplete_fields = ['id_sessao_quiz', 'id_pergunta', 'id_opcao_resposta_selecionada']

    def id_sessao_quiz_info(self, obj):
        return f"Sessão {obj.id_sessao_quiz.pk} ({obj.id_sessao_quiz.id_usuario.username})"
    id_sessao_quiz_info.short_description = "Sessão do Quiz"

    def id_pergunta_info(self, obj):
        return f"P{obj.id_pergunta.pk}: {obj.id_pergunta.texto_pergunta[:30]}..."
    id_pergunta_info.short_description = "Pergunta"

    def id_opcao_resposta_selecionada_info(self, obj):
        if obj.id_opcao_resposta_selecionada:
            return f"O{obj.id_opcao_resposta_selecionada.pk}: {obj.id_opcao_resposta_selecionada.texto_opcao[:30]}..."
        return "N/A (Pulada)"
    id_opcao_resposta_selecionada_info.short_description = "Opção Selecionada"


@admin.register(EstatisticasDiariasUsuario)
class EstatisticasDiariasUsuarioAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'id_usuario', 'data_estatistica', 'perguntas_respondidas_dia',
        'acertos_dia', 'pontos_dia', 'sequencia_dias_quiz', 'tempo_estudo_segundos_dia', 'data_atualizacao_estatistica'
    )
    list_filter = ('data_estatistica', 'id_usuario')
    search_fields = ('id_usuario__username', 'id_usuario__email', 'data_estatistica')
    readonly_fields = ('data_atualizacao_estatistica',)