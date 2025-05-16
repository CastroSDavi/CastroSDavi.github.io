# quiz/admin.py
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin # Para personalizar User
from django.contrib.auth.models import User # Para personalizar User

from .models import (
    Categoria, Pergunta, OpcaoResposta,
    SessoesQuizUsuario, RespostasUsuarioPorSessao, EstatisticasDiariasUsuario
)

# Inline para OpcoesResposta dentro de PerguntaAdmin
class OpcaoRespostaInline(admin.TabularInline):
    model = OpcaoResposta
    extra = 1
    fields = ['texto_opcao', 'eh_correta', 'ordem_exibicao', 'feedback_opcao']
    # classes = ['collapse'] # Para tornar o inline recolhível, se desejar


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ('nome_categoria', 'get_nome_categoria_pai', 'id', 'contagem_perguntas', 'data_criacao_formatada', 'data_atualizacao_formatada')
    search_fields = ('nome_categoria', 'descricao_categoria')
    list_filter = ('id_categoria_pai', 'data_criacao')
    autocomplete_fields = ['id_categoria_pai']
    readonly_fields = ('data_criacao', 'data_atualizacao') # Campos automáticos
    fieldsets = (
        (None, {
            'fields': ('nome_categoria', 'id_categoria_pai', 'descricao_categoria')
        }),
        ('Timestamps (Automático)', {
            'fields': ('data_criacao', 'data_atualizacao'),
            'classes': ('collapse',),
        }),
    )

    def get_nome_categoria_pai(self, obj):
        return obj.id_categoria_pai.nome_categoria if obj.id_categoria_pai else "--- Categoria Principal ---"
    get_nome_categoria_pai.short_description = 'Categoria Pai'
    get_nome_categoria_pai.admin_order_field = 'id_categoria_pai__nome_categoria'

    def contagem_perguntas(self, obj):
        return obj.perguntas_associadas.count()
    contagem_perguntas.short_description = 'Nº de Perguntas'

    def data_criacao_formatada(self, obj):
        return obj.data_criacao.strftime("%d/%m/%Y %H:%M") if obj.data_criacao else "-"
    data_criacao_formatada.short_description = 'Data de Criação'
    data_criacao_formatada.admin_order_field = 'data_criacao'

    def data_atualizacao_formatada(self, obj):
        return obj.data_atualizacao.strftime("%d/%m/%Y %H:%M") if obj.data_atualizacao else "-"
    data_atualizacao_formatada.short_description = 'Data de Atualização'
    data_atualizacao_formatada.admin_order_field = 'data_atualizacao'


@admin.register(Pergunta)
class PerguntaAdmin(admin.ModelAdmin):
    list_display = ('id', 'texto_curto', 'nivel_dificuldade', 'mostrar_categorias_formatado', 'ativa', 'link_usuario_criador', 'data_criacao_formatada')
    search_fields = ('texto_pergunta', 'referencia_bibliografica', 'explicacao_resposta', 'id_usuario_criador__username')
    list_filter = ('nivel_dificuldade', 'categorias', 'ativa', 'data_criacao', 'id_usuario_criador')
    filter_horizontal = ('categorias',)
    inlines = [OpcaoRespostaInline]
    readonly_fields = ('data_criacao', 'data_atualizacao')
    autocomplete_fields = ['id_usuario_criador', 'categorias'] # Categorias aqui também pode ser útil
    fieldsets = (
        (None, {
            'fields': ('texto_pergunta', 'url_imagem', 'referencia_bibliografica', 'explicacao_resposta')
        }),
        ('Configurações do Quiz', {
            'fields': ('categorias', 'nivel_dificuldade', 'ativa')
        }),
        ('Metadados', {
            'fields': ('id_usuario_criador', 'data_criacao', 'data_atualizacao'),
            'classes': ('collapse',),
        }),
    )
    list_select_related = ('id_usuario_criador',)

    def texto_curto(self, obj):
        return obj.texto_pergunta[:80] + '...' if len(obj.texto_pergunta) > 80 else obj.texto_pergunta
    texto_curto.short_description = 'Texto da Pergunta'

    def mostrar_categorias_formatado(self, obj):
        return ", ".join([cat.nome_categoria for cat in obj.categorias.all()[:5]]) # Limita a 5 para não poluir
    mostrar_categorias_formatado.short_description = 'Categorias'

    def link_usuario_criador(self, obj):
        if obj.id_usuario_criador:
            link = reverse("admin:auth_user_change", args=[obj.id_usuario_criador.id])
            return format_html('<a href="{}">{}</a>', link, obj.id_usuario_criador.username)
        return "N/A (Sistema)"
    link_usuario_criador.short_description = 'Criador'
    link_usuario_criador.admin_order_field = 'id_usuario_criador__username'

    def data_criacao_formatada(self, obj):
        return obj.data_criacao.strftime("%d/%m/%Y %H:%M") if obj.data_criacao else "-"
    data_criacao_formatada.short_description = 'Data de Criação'
    data_criacao_formatada.admin_order_field = 'data_criacao'


@admin.register(OpcaoResposta)
class OpcaoRespostaAdmin(admin.ModelAdmin):
    list_display = ('id', 'texto_opcao_curto', 'link_pergunta_associada', 'eh_correta', 'ordem_exibicao', 'data_criacao_formatada')
    search_fields = ('texto_opcao', 'feedback_opcao', 'pergunta__texto_pergunta')
    list_filter = ('eh_correta', 'pergunta__nivel_dificuldade', 'data_criacao')
    autocomplete_fields = ['pergunta']
    readonly_fields = ('data_criacao', 'data_atualizacao')
    list_select_related = ('pergunta',)

    def texto_opcao_curto(self, obj):
        return obj.texto_opcao[:75] + '...' if len(obj.texto_opcao) > 75 else obj.texto_opcao
    texto_opcao_curto.short_description = 'Texto da Opção'

    def link_pergunta_associada(self, obj):
        if obj.pergunta:
            link = reverse("admin:quiz_pergunta_change", args=[obj.pergunta.id])
            return format_html('<a href="{}">P{}: {}...</a>', link, obj.pergunta.id, obj.pergunta.texto_pergunta[:30])
        return "N/A"
    link_pergunta_associada.short_description = 'Pergunta Associada'
    link_pergunta_associada.admin_order_field = 'pergunta__texto_pergunta'

    def data_criacao_formatada(self, obj):
        return obj.data_criacao.strftime("%d/%m/%Y %H:%M") if obj.data_criacao else "-"
    data_criacao_formatada.short_description = 'Data de Criação'
    data_criacao_formatada.admin_order_field = 'data_criacao'


class RespostasUsuarioPorSessaoInline(admin.TabularInline):
    model = RespostasUsuarioPorSessao
    extra = 0
    fields = ('link_pergunta_inline', 'link_opcao_selecionada_inline', 'foi_correta', 'data_resposta_formatada_inline')
    readonly_fields = ('link_pergunta_inline', 'link_opcao_selecionada_inline', 'foi_correta', 'data_resposta_formatada_inline')
    can_delete = False # Geralmente não se deletam respostas individuais de uma sessão desta forma

    def has_add_permission(self, request, obj=None):
        return False # Não permitir adicionar respostas diretamente pelo inline

    def link_pergunta_inline(self, obj):
        if obj.id_pergunta:
            link = reverse("admin:quiz_pergunta_change", args=[obj.id_pergunta.id])
            return format_html('<a href="{}">P{}</a>', link, obj.id_pergunta.id)
        return "N/A"
    link_pergunta_inline.short_description = "Pergunta"

    def link_opcao_selecionada_inline(self, obj):
        if obj.id_opcao_resposta_selecionada:
            link = reverse("admin:quiz_opcaoresposta_change", args=[obj.id_opcao_resposta_selecionada.id])
            return format_html('<a href="{}">O{}</a>', link, obj.id_opcao_resposta_selecionada.id)
        return "Pulada"
    link_opcao_selecionada_inline.short_description = "Opção Sel."

    def data_resposta_formatada_inline(self, obj):
        return obj.data_resposta.strftime("%H:%M:%S") if obj.data_resposta else "-" # Só hora no inline
    data_resposta_formatada_inline.short_description = 'Respondida às'


@admin.register(SessoesQuizUsuario)
class SessoesQuizUsuarioAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'link_usuario', 'data_inicio_formatada', 'duracao_sessao_formatada', # Usando a property
        'modo_quiz', 'status_sessao', 'pontuacao_final',
        'total_acertos', 'percentual_acertos', # Usando a property
        'total_erros', 'total_perguntas_sessao'
    )
    list_filter = ('modo_quiz', 'status_sessao', 'data_inicio', 'id_usuario__username')
    search_fields = ('id_usuario__username', 'id_usuario__email', 'id')
    readonly_fields = (
        'data_inicio', 'data_fim', 'tempo_total_segundos', 'pontuacao_final',
        'total_acertos', 'total_erros', 'total_perguntas_sessao',
        'duracao_sessao_formatada', 'percentual_acertos' # Propriedades também como readonly
    )
    filter_horizontal = ('categorias_selecionadas',)
    inlines = [RespostasUsuarioPorSessaoInline]
    list_select_related = ('id_usuario',)
    date_hierarchy = 'data_inicio'

    fieldsets = (
        ('Informações da Sessão', {
            'fields': ('id_usuario', 'modo_quiz', 'status_sessao', 'categorias_selecionadas')
        }),
        ('Datas e Tempo (Automático)', {
            'fields': ('data_inicio', 'data_fim', 'tempo_total_segundos', 'duracao_sessao_formatada'),
            'classes': ('collapse',),
        }),
        ('Resultados (Automático)', {
            'fields': ('pontuacao_final', 'total_perguntas_sessao', 'total_acertos', 'percentual_acertos', 'total_erros'),
            'classes': ('collapse',),
        }),
    )

    def link_usuario(self, obj):
        if obj.id_usuario:
            link = reverse("admin:auth_user_change", args=[obj.id_usuario.id])
            return format_html('<a href="{}">{}</a>', link, obj.id_usuario.username)
        return "N/A"
    link_usuario.short_description = 'Usuário'
    link_usuario.admin_order_field = 'id_usuario__username'

    def data_inicio_formatada(self, obj):
        return obj.data_inicio.strftime("%d/%m/%Y %H:%M") if obj.data_inicio else "-"
    data_inicio_formatada.short_description = 'Início'
    data_inicio_formatada.admin_order_field = 'data_inicio'

    # A propriedade duracao_sessao_formatada já está no modelo
    # A propriedade percentual_acertos já está no modelo


@admin.register(RespostasUsuarioPorSessao)
class RespostasUsuarioPorSessaoAdmin(admin.ModelAdmin):
    list_display = ('id', 'link_sessao_quiz', 'link_pergunta_curta', 'link_opcao_selecionada_curta', 'foi_correta', 'data_resposta_formatada')
    list_filter = ('foi_correta', 'data_resposta', 'id_sessao_quiz__id_usuario__username', 'id_pergunta__nivel_dificuldade')
    search_fields = ('id_sessao_quiz__id', 'id_pergunta__texto_pergunta', 'id_opcao_resposta_selecionada__texto_opcao')
    readonly_fields = ('data_resposta',)
    autocomplete_fields = ['id_sessao_quiz', 'id_pergunta', 'id_opcao_resposta_selecionada']
    list_select_related = ('id_sessao_quiz__id_usuario', 'id_pergunta', 'id_opcao_resposta_selecionada')

    def link_sessao_quiz(self, obj):
        link = reverse("admin:quiz_sessoesquizusuario_change", args=[obj.id_sessao_quiz.id])
        return format_html('<a href="{}">Sessão {} ({})</a>', link, obj.id_sessao_quiz.id, obj.id_sessao_quiz.id_usuario.username)
    link_sessao_quiz.short_description = "Sessão"
    link_sessao_quiz.admin_order_field = 'id_sessao_quiz__id' # Ordenável pelo ID da sessão

    def link_pergunta_curta(self, obj):
        if obj.id_pergunta:
            link = reverse("admin:quiz_pergunta_change", args=[obj.id_pergunta.id])
            return format_html('<a href="{}">P{}: {}...</a>', link, obj.id_pergunta.id, obj.id_pergunta.texto_pergunta[:20])
        return "N/A"
    link_pergunta_curta.short_description = "Pergunta"
    link_pergunta_curta.admin_order_field = 'id_pergunta__texto_pergunta'

    def link_opcao_selecionada_curta(self, obj):
        if obj.id_opcao_resposta_selecionada:
            link = reverse("admin:quiz_opcaoresposta_change", args=[obj.id_opcao_resposta_selecionada.id])
            return format_html('<a href="{}">O{}: {}...</a>', link, obj.id_opcao_resposta_selecionada.id, obj.id_opcao_resposta_selecionada.texto_opcao[:20])
        return "Pulada"
    link_opcao_selecionada_curta.short_description = "Opção Sel."
    link_opcao_selecionada_curta.admin_order_field = 'id_opcao_resposta_selecionada__texto_opcao'

    def data_resposta_formatada(self, obj):
        return obj.data_resposta.strftime("%d/%m/%Y %H:%M:%S") if obj.data_resposta else "-"
    data_resposta_formatada.short_description = 'Data Resposta'
    data_resposta_formatada.admin_order_field = 'data_resposta'


@admin.register(EstatisticasDiariasUsuario)
class EstatisticasDiariasUsuarioAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'link_usuario_stats', 'data_estatistica', 'perguntas_respondidas_dia',
        'acertos_dia', 'precisao_dia', # Usando a property
        'pontos_dia', 'sequencia_dias_quiz',
        'tempo_estudo_formatado', # Usando a property
        'data_atualizacao_estatistica_fmt'
    )
    list_filter = ('data_estatistica', 'id_usuario__username', 'sequencia_dias_quiz')
    search_fields = ('id_usuario__username', 'id_usuario__email', 'data_estatistica')
    readonly_fields = ('data_atualizacao_estatistica', 'tempo_estudo_formatado', 'precisao_dia') # Propriedades como readonly
    date_hierarchy = 'data_estatistica'
    list_select_related = ('id_usuario',)

    fieldsets = (
        (None, {'fields': ('id_usuario', 'data_estatistica')}),
        ('Desempenho Diário', {'fields': ('perguntas_respondidas_dia', 'acertos_dia', 'precisao_dia', 'pontos_dia', 'tempo_estudo_segundos_dia', 'tempo_estudo_formatado')}),
        ('Engajamento', {'fields': ('sequencia_dias_quiz',)}),
        ('Timestamps', {'fields': ('data_atualizacao_estatistica',), 'classes': ('collapse',)}),
    )

    def link_usuario_stats(self, obj):
        if obj.id_usuario:
            link = reverse("admin:auth_user_change", args=[obj.id_usuario.id])
            return format_html('<a href="{}">{}</a>', link, obj.id_usuario.username)
        return "N/A"
    link_usuario_stats.short_description = 'Usuário'
    link_usuario_stats.admin_order_field = 'id_usuario__username'

    def data_atualizacao_estatistica_fmt(self, obj):
        return obj.data_atualizacao_estatistica.strftime("%d/%m/%Y %H:%M:%S") if obj.data_atualizacao_estatistica else "-"
    data_atualizacao_estatistica_fmt.short_description = 'Última Atualização'
    data_atualizacao_estatistica_fmt.admin_order_field = 'data_atualizacao_estatistica'

    # A propriedade tempo_estudo_formatado já está no modelo
    # A propriedade precisao_dia já está no modelo

# Opcional: Personalizar o modelo User (descomente e ajuste se necessário)
# admin.site.unregister(User)
# @admin.register(User)
# class CustomUserAdmin(BaseUserAdmin):
#     list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff', 'is_active', 'date_joined', 'last_login')
#     list_filter = BaseUserAdmin.list_filter + ('date_joined', 'last_login')
#     # Se você tiver um modelo Profile com OneToOne para User:
#     # class ProfileInline(admin.StackedInline):
#     #     model = Profile
#     #     can_delete = False
#     #     verbose_name_plural = 'Perfil'
#     # inlines = (ProfileInline, )