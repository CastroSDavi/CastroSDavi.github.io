# quiz/admin.py
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
# from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
# from django.contrib.auth.models import User

from .models import (
    Categoria, Pergunta, OpcaoResposta,
    SessoesQuizUsuario, RespostasUsuarioPorSessao, EstatisticasDiariasUsuario,
    QuestaoFavorita, # Adicionado se não estiver lá
    QuizDefinicao, QuizDefinicaoPergunta, ConfiguracoesGeraisQuiz, # Novos modelos
    UserPreferences,
    NivelGamificacao, Conquista, PerfilGamificacaoUsuario, ConquistaUsuario,
    DesafioDinamico, ProgressoDesafioUsuario, RecompensaNivelResgatada,
)

# Inline para OpcoesResposta dentro de PerguntaAdmin
class OpcaoRespostaInline(admin.TabularInline):
    model = OpcaoResposta
    extra = 1
    fields = ['texto_opcao', 'eh_correta', 'ordem_exibicao', 'feedback_opcao']
    # classes = ['collapse'] # Para tornar o inline recolhível, se desejar


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ('nome_categoria', 'get_nome_categoria_pai_display', 'id', 'contagem_perguntas', 'data_criacao_formatada', 'data_atualizacao_formatada')
    search_fields = ('nome_categoria', 'descricao_categoria', 'id_categoria_pai__nome_categoria')
    list_filter = ('id_categoria_pai', 'data_criacao')
    autocomplete_fields = ['id_categoria_pai']
    readonly_fields = ('data_criacao', 'data_atualizacao')
    fieldsets = (
        (None, {
            'fields': ('nome_categoria', 'id_categoria_pai', 'descricao_categoria')
        }),
        ('Datas de Auditoria', {
            'fields': ('data_criacao', 'data_atualizacao'),
            'classes': ('collapse',),
        }),
    )

    @admin.display(description='Categoria Pai', ordering='id_categoria_pai__nome_categoria')
    def get_nome_categoria_pai_display(self, obj):
        return obj.id_categoria_pai.nome_categoria if obj.id_categoria_pai else "--- Categoria Principal ---"

    @admin.display(description='Nº de Perguntas')
    def contagem_perguntas(self, obj):
        # Considera apenas perguntas ativas associadas diretamente ou a subcategorias
        # Para uma contagem mais precisa de hierarquia, seria necessário um método mais complexo.
        return obj.perguntas_associadas.filter(ativa=True).count()

    @admin.display(description='Criação', ordering='data_criacao')
    def data_criacao_formatada(self, obj):
        return obj.data_criacao.strftime("%d/%m/%Y %H:%M") if obj.data_criacao else "-"

    @admin.display(description='Atualização', ordering='data_atualizacao')
    def data_atualizacao_formatada(self, obj):
        return obj.data_atualizacao.strftime("%d/%m/%Y %H:%M") if obj.data_atualizacao else "-"


@admin.register(Pergunta)
class PerguntaAdmin(admin.ModelAdmin):
    list_display = ('id', 'texto_curto', 'nivel_dificuldade', 'mostrar_categorias_formatado', 'ativa', 'link_usuario_criador', 'data_criacao_formatada')
    search_fields = ('texto_pergunta', 'referencia_bibliografica', 'explicacao_resposta', 'id_usuario_criador__username', 'categorias__nome_categoria')
    list_filter = ('nivel_dificuldade', 'categorias', 'ativa', 'data_criacao', 'id_usuario_criador')
    filter_horizontal = ('categorias',) # Melhor para ManyToManyField
    inlines = [OpcaoRespostaInline]
    readonly_fields = ('data_criacao', 'data_atualizacao')
    autocomplete_fields = ['id_usuario_criador'] # 'categorias' é melhor com filter_horizontal
    list_select_related = ('id_usuario_criador',)
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

    @admin.display(description='Texto da Pergunta')
    def texto_curto(self, obj):
        return obj.texto_pergunta[:80] + '...' if len(obj.texto_pergunta) > 80 else obj.texto_pergunta

    @admin.display(description='Categorias')
    def mostrar_categorias_formatado(self, obj):
        return ", ".join([cat.nome_categoria for cat in obj.categorias.all()[:5]])

    @admin.display(description='Criador', ordering='id_usuario_criador__username')
    def link_usuario_criador(self, obj):
        if obj.id_usuario_criador:
            link = reverse("admin:auth_user_change", args=[obj.id_usuario_criador.id])
            return format_html('<a href="{}">{}</a>', link, obj.id_usuario_criador.username)
        return "N/A (Sistema)"

    @admin.display(description='Criação', ordering='data_criacao')
    def data_criacao_formatada(self, obj):
        return obj.data_criacao.strftime("%d/%m/%Y %H:%M") if obj.data_criacao else "-"


@admin.register(OpcaoResposta)
class OpcaoRespostaAdmin(admin.ModelAdmin):
    list_display = ('id', 'texto_opcao_curto', 'link_pergunta_associada', 'eh_correta', 'ordem_exibicao', 'data_criacao_formatada')
    search_fields = ('texto_opcao', 'feedback_opcao', 'pergunta__texto_pergunta')
    list_filter = ('eh_correta', 'pergunta__nivel_dificuldade', 'data_criacao', 'pergunta__categorias')
    autocomplete_fields = ['pergunta']
    readonly_fields = ('data_criacao', 'data_atualizacao')
    list_select_related = ('pergunta',)

    @admin.display(description='Texto da Opção')
    def texto_opcao_curto(self, obj):
        return obj.texto_opcao[:75] + '...' if len(obj.texto_opcao) > 75 else obj.texto_opcao

    @admin.display(description='Pergunta Associada', ordering='pergunta__texto_pergunta')
    def link_pergunta_associada(self, obj):
        if obj.pergunta:
            link = reverse("admin:quiz_pergunta_change", args=[obj.pergunta.id])
            return format_html('<a href="{}">P{}: {}...</a>', link, obj.pergunta.id, obj.pergunta.texto_pergunta[:30])
        return "N/A"

    @admin.display(description='Criação', ordering='data_criacao')
    def data_criacao_formatada(self, obj):
        return obj.data_criacao.strftime("%d/%m/%Y %H:%M") if obj.data_criacao else "-"


class RespostasUsuarioPorSessaoInline(admin.TabularInline):
    model = RespostasUsuarioPorSessao
    extra = 0
    fields = ('link_pergunta_inline', 'link_opcao_selecionada_inline', 'foi_correta', 'data_resposta_formatada_inline')
    readonly_fields = fields # Todos readonly no inline
    can_delete = False
    show_change_link = True # Permite clicar para ver/editar a resposta individual

    def has_add_permission(self, request, obj=None):
        return False

    @admin.display(description="Pergunta")
    def link_pergunta_inline(self, obj):
        if obj.id_pergunta:
            link = reverse("admin:quiz_pergunta_change", args=[obj.id_pergunta.id])
            return format_html('<a href="{}">P{}</a>', link, obj.id_pergunta.id)
        return "N/A"

    @admin.display(description="Opção Sel.")
    def link_opcao_selecionada_inline(self, obj):
        if obj.id_opcao_resposta_selecionada:
            link = reverse("admin:quiz_opcaoresposta_change", args=[obj.id_opcao_resposta_selecionada.id])
            return format_html('<a href="{}">O{}</a>', link, obj.id_opcao_resposta_selecionada.id)
        return "Pulada"

    @admin.display(description='Respondida às')
    def data_resposta_formatada_inline(self, obj):
        return obj.data_resposta.strftime("%H:%M:%S") if obj.data_resposta else "-"


@admin.register(SessoesQuizUsuario)
class SessoesQuizUsuarioAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'link_usuario', 'data_inicio_formatada', 'duracao_sessao_formatada',
        'modo_quiz', 'status_sessao', 'pontuacao_final', 'xp_total_sessao',
        'total_acertos', 'percentual_acertos', 'total_erros',
        'sequencia_acertos_atual', 'melhor_sequencia_acertos',
        'total_perguntas_sessao', 'link_quiz_definicao'
    )
    list_filter = ('modo_quiz', 'status_sessao', 'data_inicio', 'id_usuario__username', 'id_quiz_definicao')
    search_fields = ('id_usuario__username', 'id_usuario__email', 'id', 'id_quiz_definicao__nome_quiz')
    readonly_fields = (
        'data_inicio', 'data_fim', 'tempo_total_segundos', 'pontuacao_final', 'xp_total_sessao',
        'total_acertos', 'total_erros', 'total_perguntas_sessao',
        'duracao_sessao_formatada', 'percentual_acertos', 'sequencia_acertos_atual', 'melhor_sequencia_acertos',
        'ids_perguntas_json', 'indice_ultima_pergunta_vista' # Novos campos como readonly
    )
    autocomplete_fields = ['id_usuario', 'id_quiz_definicao']
    filter_horizontal = ('categorias_selecionadas',) # Se ainda for relevante para algum modo
    inlines = [RespostasUsuarioPorSessaoInline]
    list_select_related = ('id_usuario', 'id_quiz_definicao')
    date_hierarchy = 'data_inicio'

    fieldsets = (
        ('Informações da Sessão', {
            'fields': ('id_usuario', 'modo_quiz', 'status_sessao', 'id_quiz_definicao', 'categorias_selecionadas',
                       'dificuldades_selecionadas_json', 'num_questoes_solicitadas')
        }),
        ('Progresso e Estado da Sessão', {
            'fields': ('ids_perguntas_json', 'indice_ultima_pergunta_vista'),
            'classes': ('collapse',),
        }),
        ('Datas e Tempo (Automático)', {
            'fields': ('data_inicio', 'data_fim', 'tempo_total_segundos', 'duracao_sessao_formatada'),
            'classes': ('collapse',),
        }),
        ('Resultados (Automático)', {
            'fields': (
                'pontuacao_final', 'xp_total_sessao', 'total_perguntas_sessao',
                'total_acertos', 'percentual_acertos', 'total_erros',
                'sequencia_acertos_atual', 'melhor_sequencia_acertos'
            ),
            'classes': ('collapse',),
        }),
    )

    @admin.display(description='Usuário', ordering='id_usuario__username')
    def link_usuario(self, obj):
        if obj.id_usuario:
            link = reverse("admin:auth_user_change", args=[obj.id_usuario.id])
            return format_html('<a href="{}">{}</a>', link, obj.id_usuario.username)
        return "N/A"

    @admin.display(description='Início', ordering='data_inicio')
    def data_inicio_formatada(self, obj):
        return obj.data_inicio.strftime("%d/%m/%Y %H:%M") if obj.data_inicio else "-"

    @admin.display(description='Quiz Definido', ordering='id_quiz_definicao__nome_quiz')
    def link_quiz_definicao(self, obj):
        if obj.id_quiz_definicao:
            link = reverse("admin:quiz_quizdefinicao_change", args=[obj.id_quiz_definicao.id])
            return format_html('<a href="{}">{}</a>', link, obj.id_quiz_definicao.nome_quiz)
        return "N/A"


@admin.register(RespostasUsuarioPorSessao)
class RespostasUsuarioPorSessaoAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'link_sessao_quiz_formatado', 'link_pergunta_curta', 'link_opcao_selecionada_curta',
        'foi_correta', 'pontos_obtidos', 'xp_obtido', 'multiplicador_aplicado', 'data_resposta_formatada'
    )
    list_filter = ('foi_correta', 'data_resposta', 'id_sessao_quiz__id_usuario__username', 'id_pergunta__nivel_dificuldade', 'id_sessao_quiz__modo_quiz')
    search_fields = ('id_sessao_quiz__id', 'id_pergunta__texto_pergunta', 'id_opcao_resposta_selecionada__texto_opcao', 'id_sessao_quiz__id_usuario__username')
    readonly_fields = ('data_resposta', 'pontos_obtidos', 'xp_obtido', 'multiplicador_aplicado')
    autocomplete_fields = ['id_sessao_quiz', 'id_pergunta', 'id_opcao_resposta_selecionada']
    list_select_related = ('id_sessao_quiz__id_usuario', 'id_pergunta', 'id_opcao_resposta_selecionada')
    date_hierarchy = 'data_resposta'

    @admin.display(description="Sessão (Usuário)", ordering='id_sessao_quiz__id')
    def link_sessao_quiz_formatado(self, obj):
        link = reverse("admin:quiz_sessoesquizusuario_change", args=[obj.id_sessao_quiz.id])
        return format_html('<a href="{}">Sessão {} ({})</a>', link, obj.id_sessao_quiz.id, obj.id_sessao_quiz.id_usuario.username)

    @admin.display(description="Pergunta", ordering='id_pergunta__texto_pergunta')
    def link_pergunta_curta(self, obj):
        if obj.id_pergunta:
            link = reverse("admin:quiz_pergunta_change", args=[obj.id_pergunta.id])
            return format_html('<a href="{}">P{}: {}...</a>', link, obj.id_pergunta.id, obj.id_pergunta.texto_pergunta[:20])
        return "N/A"

    @admin.display(description="Opção Sel.", ordering='id_opcao_resposta_selecionada__texto_opcao')
    def link_opcao_selecionada_curta(self, obj):
        if obj.id_opcao_resposta_selecionada:
            link = reverse("admin:quiz_opcaoresposta_change", args=[obj.id_opcao_resposta_selecionada.id])
            return format_html('<a href="{}">O{}: {}...</a>', link, obj.id_opcao_resposta_selecionada.id, obj.id_opcao_resposta_selecionada.texto_opcao[:20])
        return "Pulada"

    @admin.display(description='Data Resposta', ordering='data_resposta')
    def data_resposta_formatada(self, obj):
        return obj.data_resposta.strftime("%d/%m/%Y %H:%M:%S") if obj.data_resposta else "-"


@admin.register(EstatisticasDiariasUsuario)
class EstatisticasDiariasUsuarioAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'link_usuario_stats', 'data_estatistica', 'perguntas_respondidas_dia',
        'acertos_dia', 'precisao_dia',
        'pontos_dia', 'xp_ganho_dia', 'sequencia_dias_quiz',
        'tempo_estudo_formatado',
        'data_atualizacao_estatistica_fmt'
    )
    list_filter = ('data_estatistica', 'id_usuario__username', 'sequencia_dias_quiz')
    search_fields = ('id_usuario__username', 'id_usuario__email', 'data_estatistica')
    readonly_fields = ('data_atualizacao_estatistica', 'tempo_estudo_formatado', 'precisao_dia')
    autocomplete_fields = ['id_usuario']
    date_hierarchy = 'data_estatistica'
    list_select_related = ('id_usuario',)

    fieldsets = (
        (None, {'fields': ('id_usuario', 'data_estatistica')}),
        ('Desempenho Diário', {'fields': ('perguntas_respondidas_dia', 'acertos_dia', 'precisao_dia', 'pontos_dia', 'xp_ganho_dia', 'tempo_estudo_segundos_dia', 'tempo_estudo_formatado')}),
        ('Engajamento', {'fields': ('sequencia_dias_quiz',)}),
        ('Datas de Auditoria', {'fields': ('data_atualizacao_estatistica',), 'classes': ('collapse',)}),
    )

    @admin.display(description='Usuário', ordering='id_usuario__username')
    def link_usuario_stats(self, obj):
        if obj.id_usuario:
            link = reverse("admin:auth_user_change", args=[obj.id_usuario.id])
            return format_html('<a href="{}">{}</a>', link, obj.id_usuario.username)
        return "N/A"

    @admin.display(description='Última Atualização', ordering='data_atualizacao_estatistica')
    def data_atualizacao_estatistica_fmt(self, obj):
        return obj.data_atualizacao_estatistica.strftime("%d/%m/%Y %H:%M:%S") if obj.data_atualizacao_estatistica else "-"


@admin.register(QuestaoFavorita)
class QuestaoFavoritaAdmin(admin.ModelAdmin):
    list_display = ('id', 'link_usuario_favorito', 'link_pergunta_favorita', 'data_favoritada_formatada')
    list_filter = ('data_favoritada', 'usuario__username', 'pergunta__categorias')
    search_fields = ('usuario__username', 'pergunta__texto_pergunta')
    autocomplete_fields = ['usuario', 'pergunta']
    readonly_fields = ('data_favoritada',)
    list_select_related = ('usuario', 'pergunta')
    date_hierarchy = 'data_favoritada'

    @admin.display(description='Usuário', ordering='usuario__username')
    def link_usuario_favorito(self, obj):
        link = reverse("admin:auth_user_change", args=[obj.usuario.id])
        return format_html('<a href="{}">{}</a>', link, obj.usuario.username)

    @admin.display(description='Pergunta Favorita', ordering='pergunta__texto_pergunta')
    def link_pergunta_favorita(self, obj):
        link = reverse("admin:quiz_pergunta_change", args=[obj.pergunta.id])
        return format_html('<a href="{}">P{}: {}...</a>', link, obj.pergunta.id, obj.pergunta.texto_pergunta[:50])

    @admin.display(description='Data Favoritada', ordering='data_favoritada')
    def data_favoritada_formatada(self, obj):
        return obj.data_favoritada.strftime("%d/%m/%Y %H:%M") if obj.data_favoritada else "-"


# --- Admin para os Novos Modelos ---

class QuizDefinicaoPerguntaInline(admin.TabularInline):
    model = QuizDefinicaoPergunta
    extra = 1
    autocomplete_fields = ['pergunta']
    fields = ('pergunta', 'ordem')
    ordering = ['ordem']
    verbose_name = "Pergunta do Quiz"
    verbose_name_plural = "Perguntas do Quiz (com ordem)"


@admin.register(QuizDefinicao)
class QuizDefinicaoAdmin(admin.ModelAdmin):
    list_display = ('nome_quiz', 'ativo', 'data_criacao_formatada', 'data_atualizacao_formatada', 'contagem_perguntas_definidas')
    list_filter = ('ativo', 'data_criacao')
    search_fields = ('nome_quiz', 'descricao')
    inlines = [QuizDefinicaoPerguntaInline]
    readonly_fields = ('data_criacao', 'data_atualizacao')
    fieldsets = (
        (None, {'fields': ('nome_quiz', 'descricao', 'ativo')}),
        ('Datas de Auditoria', {'fields': ('data_criacao', 'data_atualizacao'), 'classes': ('collapse',)}),
    )

    @admin.display(description='Nº de Perguntas')
    def contagem_perguntas_definidas(self, obj):
        return obj.perguntas.count()

    @admin.display(description='Criação', ordering='data_criacao')
    def data_criacao_formatada(self, obj):
        return obj.data_criacao.strftime("%d/%m/%Y %H:%M") if obj.data_criacao else "-"

    @admin.display(description='Atualização', ordering='data_atualizacao')
    def data_atualizacao_formatada(self, obj):
        return obj.data_atualizacao.strftime("%d/%m/%Y %H:%M") if obj.data_atualizacao else "-"


@admin.register(ConfiguracoesGeraisQuiz)
class ConfiguracoesGeraisQuizAdmin(admin.ModelAdmin):
    list_display = (
        '__str__',
        'numero_perguntas_quiz_rapido',
        'pontuacao_por_acerto',
        'penalidade_por_erro',
        'multiplicador_bonus_maximo',
        'data_modificacao_formatada',
    )
    readonly_fields = ('data_modificacao',)
    fieldsets = (
        (None, {
            'fields': (
                'numero_perguntas_quiz_rapido',
                'pontuacao_por_acerto',
                'penalidade_por_erro',
                'multiplicador_bonus_maximo',
            )
        }),
        ('Pontuação Dinâmica', {
            'fields': (
                'configuracao_pontuacao_dificuldade',
                'bonus_sequencia_acertos',
            ),
            'classes': ('collapse',),
            'description': (
                'Configure recompensas específicas por dificuldade e os bônus aplicados a sequências de acertos. '
                'Essas estruturas JSON permitem integrar regras avançadas sem alterar o código.'
            ),
        }),
        ('Datas de Auditoria', {
            'fields': ('data_modificacao',),
            'classes': ('collapse',),
        }),
    )

    def has_add_permission(self, request):
        # Impede a adição de novas instâncias se uma já existir (padrão Singleton)
        return not ConfiguracoesGeraisQuiz.objects.exists()

    def has_delete_permission(self, request, obj=None):
        # Opcional: impedir a exclusão da única instância
        return False

    @admin.display(description='Última Modificação', ordering='data_modificacao')
    def data_modificacao_formatada(self, obj):
        return obj.data_modificacao.strftime("%d/%m/%Y %H:%M") if obj.data_modificacao else "-"


@admin.register(DesafioDinamico)
class DesafioDinamicoAdmin(admin.ModelAdmin):
    list_display = (
        'nome', 'slug', 'tipo', 'ativo', 'data_inicio', 'data_fim', 'criterio_resumo', 'recompensa_resumo'
    )
    list_filter = ('tipo', 'ativo', 'data_inicio', 'data_fim')
    search_fields = ('nome', 'slug', 'descricao')
    readonly_fields = ('criado_em', 'atualizado_em')
    fieldsets = (
        (None, {'fields': ('nome', 'slug', 'descricao', 'tipo', 'ativo')}),
        ('Regras', {'fields': ('criterio_json', 'recompensa_json')}),
        ('Janela de Ativação', {'fields': ('data_inicio', 'data_fim')}),
        ('Auditoria', {'fields': ('criado_em', 'atualizado_em'), 'classes': ('collapse',)}),
    )

    @admin.display(description='Critério')
    def criterio_resumo(self, obj):
        criterio = obj.criterio_json or {}
        tipo = criterio.get('tipo')
        valor = criterio.get('valor')
        if tipo is None and not valor:
            return '—'
        return f"{tipo}: {valor}"

    @admin.display(description='Recompensa')
    def recompensa_resumo(self, obj):
        recompensa = obj.recompensa_json or {}
        if not recompensa:
            return '—'
        titulo = recompensa.get('titulo') or recompensa.get('nome') or recompensa.get('type')
        if not titulo and isinstance(recompensa, dict):
            titulo = ', '.join(recompensa.keys())[:40]
        return titulo or 'Configuração'


@admin.register(ProgressoDesafioUsuario)
class ProgressoDesafioUsuarioAdmin(admin.ModelAdmin):
    list_display = (
        'perfil', 'desafio', 'valor_atual', 'concluido', 'data_conclusao', 'atualizado_em'
    )
    list_filter = ('concluido', 'desafio__tipo')
    search_fields = (
        'perfil__user__username', 'perfil__user__email', 'desafio__nome',
    )
    autocomplete_fields = ['perfil', 'desafio']
    readonly_fields = ('criado_em', 'atualizado_em')


@admin.register(RecompensaNivelResgatada)
class RecompensaNivelResgatadaAdmin(admin.ModelAdmin):
    list_display = ('perfil', 'nivel', 'recompensa_id', 'data_resgate')
    list_filter = ('nivel',)
    search_fields = (
        'perfil__user__username', 'perfil__user__email', 'nivel__nome', 'recompensa_id'
    )
    autocomplete_fields = ['perfil', 'nivel']
    readonly_fields = ('data_resgate',)


@admin.register(UserPreferences)
class UserPreferencesAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'theme_preference',
        'receive_product_updates',
        'receive_progress_reports',
        'updated_at',
    )
    list_filter = ('theme_preference', 'receive_product_updates', 'receive_progress_reports')
    search_fields = ('user__username', 'user__email', 'user__first_name', 'user__last_name')
    readonly_fields = ('created_at', 'updated_at')

# Opcional: Desregistrar e registrar UserAdmin se quiser adicionar inlines ou campos
# from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
# from django.contrib.auth.models import User
# admin.site.unregister(User)
# @admin.register(User)
# class CustomUserAdmin(BaseUserAdmin):
#     pass

@admin.register(NivelGamificacao)
class NivelGamificacaoAdmin(admin.ModelAdmin):
    list_display = ('nome', 'ordem', 'xp_minimo', 'xp_maximo')
    search_fields = ('nome', 'identificador')
    list_editable = ('ordem',)
    ordering = ('ordem', 'xp_minimo')


@admin.register(Conquista)
class ConquistaAdmin(admin.ModelAdmin):
    list_display = ('nome', 'slug', 'ordem_exibicao')
    search_fields = ('nome', 'slug')
    list_editable = ('ordem_exibicao',)
    ordering = ('ordem_exibicao', 'nome')


@admin.register(PerfilGamificacaoUsuario)
class PerfilGamificacaoUsuarioAdmin(admin.ModelAdmin):
    list_display = ('user', 'xp_total', 'nivel_atual', 'melhor_sequencia_geral', 'sequencia_atual', 'ultima_atualizacao')
    search_fields = ('user__username', 'user__email')
    list_select_related = ('user', 'nivel_atual')
    readonly_fields = ('ultima_atualizacao',)
    autocomplete_fields = ('user', 'nivel_atual', 'conquistas')


@admin.register(ConquistaUsuario)
class ConquistaUsuarioAdmin(admin.ModelAdmin):
    list_display = ('perfil', 'conquista', 'data_conquista')
    search_fields = ('perfil__user__username', 'conquista__nome')
    list_filter = ('conquista', 'data_conquista')
    autocomplete_fields = ('perfil', 'conquista')
