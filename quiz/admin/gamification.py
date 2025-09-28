"""Admin modules focusing on gamification structures."""

from django.contrib import admin

from quiz.models import (
    Conquista,
    ConquistaUsuario,
    DesafioDinamico,
    NivelGamificacao,
    PerfilGamificacaoUsuario,
    ProgressoDesafioUsuario,
    RecompensaNivelResgatada,
)


@admin.register(NivelGamificacao)
class NivelGamificacaoAdmin(admin.ModelAdmin):
    list_display = ("nome", "ordem", "xp_minimo", "xp_maximo")
    search_fields = ("nome", "identificador")
    list_editable = ("ordem",)
    ordering = ("ordem", "xp_minimo")


@admin.register(Conquista)
class ConquistaAdmin(admin.ModelAdmin):
    list_display = ("nome", "slug", "ordem_exibicao")
    search_fields = ("nome", "slug")
    list_editable = ("ordem_exibicao",)
    ordering = ("ordem_exibicao", "nome")


@admin.register(PerfilGamificacaoUsuario)
class PerfilGamificacaoUsuarioAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "xp_total",
        "nivel_atual",
        "melhor_sequencia_geral",
        "sequencia_atual",
        "ultima_atualizacao",
    )
    search_fields = ("user__username", "user__email")
    list_select_related = ("user", "nivel_atual")
    readonly_fields = ("ultima_atualizacao",)
    autocomplete_fields = ("user", "nivel_atual", "conquistas")


@admin.register(ConquistaUsuario)
class ConquistaUsuarioAdmin(admin.ModelAdmin):
    list_display = ("perfil", "conquista", "data_conquista")
    search_fields = ("perfil__user__username", "conquista__nome")
    list_filter = ("conquista", "data_conquista")
    autocomplete_fields = ("perfil", "conquista")


@admin.register(DesafioDinamico)
class DesafioDinamicoAdmin(admin.ModelAdmin):
    list_display = (
        "nome",
        "slug",
        "tipo",
        "ativo",
        "data_inicio",
        "data_fim",
        "criterio_resumo",
        "recompensa_resumo",
    )
    list_filter = ("tipo", "ativo", "data_inicio", "data_fim")
    search_fields = ("nome", "slug", "descricao")
    readonly_fields = ("criado_em", "atualizado_em")
    fieldsets = (
        (None, {"fields": ("nome", "slug", "descricao", "tipo", "ativo")}),
        ("Regras", {"fields": ("criterio_json", "recompensa_json")}),
        ("Janela de Ativação", {"fields": ("data_inicio", "data_fim")}),
        (
            "Auditoria",
            {
                "fields": ("criado_em", "atualizado_em"),
                "classes": ("collapse",),
            },
        ),
    )

    @admin.display(description="Critério")
    def criterio_resumo(self, obj):
        criterio = obj.criterio_json or {}
        tipo = criterio.get("tipo")
        valor = criterio.get("valor")
        if tipo is None and not valor:
            return "—"
        return f"{tipo}: {valor}"

    @admin.display(description="Recompensa")
    def recompensa_resumo(self, obj):
        recompensa = obj.recompensa_json or {}
        if not recompensa:
            return "—"
        titulo = (
            recompensa.get("titulo")
            or recompensa.get("nome")
            or recompensa.get("type")
        )
        if not titulo and isinstance(recompensa, dict):
            titulo = ", ".join(recompensa.keys())[:40]
        return titulo or "Configuração"


@admin.register(ProgressoDesafioUsuario)
class ProgressoDesafioUsuarioAdmin(admin.ModelAdmin):
    list_display = (
        "perfil",
        "desafio",
        "valor_atual",
        "concluido",
        "data_conclusao",
        "atualizado_em",
    )
    list_filter = ("concluido", "desafio__tipo")
    search_fields = (
        "perfil__user__username",
        "perfil__user__email",
        "desafio__nome",
    )
    autocomplete_fields = ("perfil", "desafio")
    readonly_fields = ("criado_em", "atualizado_em")


@admin.register(RecompensaNivelResgatada)
class RecompensaNivelResgatadaAdmin(admin.ModelAdmin):
    list_display = ("perfil", "nivel", "recompensa_id", "data_resgate")
    list_filter = ("nivel",)
    search_fields = (
        "perfil__user__username",
        "perfil__user__email",
        "nivel__nome",
        "recompensa_id",
    )
    autocomplete_fields = ("perfil", "nivel")
    readonly_fields = ("data_resgate",)
