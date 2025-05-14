# quiz/admin.py
from django.contrib import admin
from .models import Categoria, Pergunta, OpcaoResposta # Importe seus modelos

class OpcaoRespostaInline(admin.TabularInline): # Ou admin.StackedInline para um layout diferente
    model = OpcaoResposta
    extra = 1 # Quantas opções vazias mostrar para adicionar novas
    fields = ['texto_opcao', 'eh_correta', 'ordem_exibicao', 'feedback_opcao']
    # readonly_fields = ['id_algum_campo_do_json_se_tivesse'] # Exemplo

@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ('nome_categoria', 'id_categoria_pai', 'id', 'descricao_categoria_curta')
    search_fields = ('nome_categoria', 'descricao_categoria')
    list_filter = ('id_categoria_pai',)
    # autocomplete_fields = ['id_categoria_pai'] # Se tivesse muitas categorias para selecionar como pai

    def descricao_categoria_curta(self, obj):
        if obj.descricao_categoria:
            return obj.descricao_categoria[:75] + '...' if len(obj.descricao_categoria) > 75 else obj.descricao_categoria
        return "-"
    descricao_categoria_curta.short_description = 'Descrição Curta'

@admin.register(Pergunta)
class PerguntaAdmin(admin.ModelAdmin):
    list_display = ('id','texto_curto', 'nivel_dificuldade', 'mostrar_categorias', 'explicacao_resposta_curta')
    search_fields = ('texto_pergunta', 'referencia_bibliografica', 'explicacao_resposta')
    list_filter = ('nivel_dificuldade', 'categorias')
    filter_horizontal = ('categorias',) # Melhor interface para ManyToManyField
    inlines = [OpcaoRespostaInline] # Permite adicionar/editar opções diretamente na página da pergunta

    def texto_curto(self, obj):
        return obj.texto_pergunta[:100] + '...' if len(obj.texto_pergunta) > 100 else obj.texto_pergunta
    texto_curto.short_description = 'Texto da Pergunta (Início)'

    def explicacao_resposta_curta(self, obj):
        if obj.explicacao_resposta:
            return obj.explicacao_resposta[:75] + '...' if len(obj.explicacao_resposta) > 75 else obj.explicacao_resposta
        return "-"
    explicacao_resposta_curta.short_description = 'Explicação (Início)'

    def mostrar_categorias(self, obj):
        return ", ".join([cat.nome_categoria for cat in obj.categorias.all()])
    mostrar_categorias.short_description = 'Categorias'

@admin.register(OpcaoResposta)
class OpcaoRespostaAdmin(admin.ModelAdmin):
    list_display = ('id', 'texto_opcao_curto', 'pergunta_associada', 'eh_correta', 'ordem_exibicao')
    search_fields = ('texto_opcao', 'feedback_opcao')
    list_filter = ('eh_correta', 'pergunta__nivel_dificuldade')
    autocomplete_fields = ['pergunta'] # Ajuda a selecionar a pergunta

    def texto_opcao_curto(self, obj):
        return obj.texto_opcao[:75] + '...' if len(obj.texto_opcao) > 75 else obj.texto_opcao
    texto_opcao_curto.short_description = 'Texto da Opção'

    def pergunta_associada(self, obj):
        # Acessa o texto da pergunta através da ForeignKey 'pergunta'
        return obj.pergunta.texto_pergunta[:50] + '...' if obj.pergunta else '-'
    pergunta_associada.short_description = 'Pergunta Associada'