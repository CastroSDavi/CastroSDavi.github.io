"""Administration of quiz sessions and answers."""

from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html

from quiz.models import RespostasUsuarioPorSessao, SessoesQuizUsuario

from .inlines import RespostasUsuarioPorSessaoInline


@admin.register(SessoesQuizUsuario)
class SessoesQuizUsuarioAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "link_usuario",
        "data_inicio_formatada",
        "duracao_sessao_formatada",
        "modo_quiz",
        "metodo_estudo",
        "status_sessao",
        "pontuacao_final",
        "xp_total_sessao",
        "total_acertos",
        "percentual_acertos",
        "total_erros",
        "sequencia_acertos_atual",
        "melhor_sequencia_acertos",
        "total_perguntas_sessao",
        "link_quiz_definicao",
    )
    list_filter = (
        "modo_quiz",
        "metodo_estudo",
        "status_sessao",
        "data_inicio",
        "id_usuario__username",
        "id_quiz_definicao",
    )
    search_fields = (
        "id_usuario__username",
        "id_usuario__email",
        "id",
        "id_quiz_definicao__nome_quiz",
    )
    readonly_fields = (
        "data_inicio",
        "data_fim",
        "tempo_total_segundos",
        "pontuacao_final",
        "xp_total_sessao",
        "total_acertos",
        "total_erros",
        "total_perguntas_sessao",
        "duracao_sessao_formatada",
        "percentual_acertos",
        "sequencia_acertos_atual",
        "melhor_sequencia_acertos",
        "ids_perguntas_json",
        "indice_ultima_pergunta_vista",
    )
    autocomplete_fields = ["id_usuario", "id_quiz_definicao"]
    filter_horizontal = ("categorias_selecionadas",)
    inlines = [RespostasUsuarioPorSessaoInline]
    list_select_related = ("id_usuario", "id_quiz_definicao")
    date_hierarchy = "data_inicio"

    fieldsets = (
        (
            "Informações da Sessão",
            {
                "fields": (
                    "id_usuario",
                    "modo_quiz",
                    "metodo_estudo",
                    "status_sessao",
                    "id_quiz_definicao",
                    "categorias_selecionadas",
                    "dificuldades_selecionadas_json",
                    "num_questoes_solicitadas",
                )
            },
        ),
        (
            "Progresso e Estado da Sessão",
            {
                "fields": ("ids_perguntas_json", "indice_ultima_pergunta_vista"),
                "classes": ("collapse",),
            },
        ),
        (
            "Datas e Tempo (Automático)",
            {
                "fields": (
                    "data_inicio",
                    "data_fim",
                    "tempo_total_segundos",
                    "duracao_sessao_formatada",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "Resultados (Automático)",
            {
                "fields": (
                    "pontuacao_final",
                    "xp_total_sessao",
                    "total_perguntas_sessao",
                    "total_acertos",
                    "percentual_acertos",
                    "total_erros",
                    "sequencia_acertos_atual",
                    "melhor_sequencia_acertos",
                ),
                "classes": ("collapse",),
            },
        ),
    )

    @admin.display(description="Usuário", ordering="id_usuario__username")
    def link_usuario(self, obj):
        if obj.id_usuario:
            link = reverse("admin:auth_user_change", args=[obj.id_usuario.id])
            return format_html('<a href="{}">{}</a>', link, obj.id_usuario.username)
        return "N/A"

    @admin.display(description="Início", ordering="data_inicio")
    def data_inicio_formatada(self, obj):
        return obj.data_inicio.strftime("%d/%m/%Y %H:%M") if obj.data_inicio else "-"

    @admin.display(description="Quiz Definido", ordering="id_quiz_definicao__nome_quiz")
    def link_quiz_definicao(self, obj):
        if obj.id_quiz_definicao:
            link = reverse(
                "admin:quiz_quizdefinicao_change",
                args=[obj.id_quiz_definicao.id],
            )
            return format_html('<a href="{}">{}</a>', link, obj.id_quiz_definicao.nome_quiz)
        return "N/A"


@admin.register(RespostasUsuarioPorSessao)
class RespostasUsuarioPorSessaoAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "link_sessao_quiz_formatado",
        "link_pergunta_curta",
        "link_opcao_selecionada_curta",
        "foi_correta",
        "pontos_obtidos",
        "xp_obtido",
        "multiplicador_aplicado",
        "data_resposta_formatada",
    )
    list_filter = (
        "foi_correta",
        "data_resposta",
        "id_sessao_quiz__id_usuario__username",
        "id_pergunta__nivel_dificuldade",
        "id_sessao_quiz__modo_quiz",
    )
    search_fields = (
        "id_sessao_quiz__id",
        "id_pergunta__texto_pergunta",
        "id_opcao_resposta_selecionada__texto_opcao",
        "id_sessao_quiz__id_usuario__username",
    )
    readonly_fields = (
        "data_resposta",
        "pontos_obtidos",
        "xp_obtido",
        "multiplicador_aplicado",
    )
    autocomplete_fields = [
        "id_sessao_quiz",
        "id_pergunta",
        "id_opcao_resposta_selecionada",
    ]
    list_select_related = (
        "id_sessao_quiz__id_usuario",
        "id_pergunta",
        "id_opcao_resposta_selecionada",
    )
    date_hierarchy = "data_resposta"

    @admin.display(description="Sessão (Usuário)", ordering="id_sessao_quiz__id")
    def link_sessao_quiz_formatado(self, obj):
        link = reverse(
            "admin:quiz_sessoesquizusuario_change",
            args=[obj.id_sessao_quiz.id],
        )
        return format_html(
            '<a href="{}">Sessão {} ({})</a>',
            link,
            obj.id_sessao_quiz.id,
            obj.id_sessao_quiz.id_usuario.username,
        )

    @admin.display(description="Pergunta", ordering="id_pergunta__texto_pergunta")
    def link_pergunta_curta(self, obj):
        if obj.id_pergunta:
            link = reverse("admin:quiz_pergunta_change", args=[obj.id_pergunta.id])
            return format_html(
                '<a href="{}">P{}: {}...</a>',
                link,
                obj.id_pergunta.id,
                obj.id_pergunta.texto_pergunta[:20],
            )
        return "N/A"

    @admin.display(
        description="Opção Sel.",
        ordering="id_opcao_resposta_selecionada__texto_opcao",
    )
    def link_opcao_selecionada_curta(self, obj):
        if obj.id_opcao_resposta_selecionada:
            link = reverse(
                "admin:quiz_opcaoresposta_change",
                args=[obj.id_opcao_resposta_selecionada.id],
            )
            return format_html(
                '<a href="{}">O{}: {}...</a>',
                link,
                obj.id_opcao_resposta_selecionada.id,
                obj.id_opcao_resposta_selecionada.texto_opcao[:20],
            )
        return "Pulada"

    @admin.display(description="Data Resposta", ordering="data_resposta")
    def data_resposta_formatada(self, obj):
        return (
            obj.data_resposta.strftime("%d/%m/%Y %H:%M:%S")
            if obj.data_resposta
            else "-"
        )
