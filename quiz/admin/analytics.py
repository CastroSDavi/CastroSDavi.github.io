"""Admin configuration for study tracking and analytics."""

from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html

from quiz.models import (
    EstatisticasDiariasUsuario,
    UserQuestionStudyState,
)

from .base import EnhancedModelAdmin


@admin.register(UserQuestionStudyState)
class UserQuestionStudyStateAdmin(EnhancedModelAdmin):
    list_display = (
        "user",
        "pergunta",
        "due_at",
        "repetitions",
        "interval_days",
        "easiness_factor",
        "last_outcome",
    )
    list_filter = ("last_outcome", "user")
    search_fields = ("user__username", "pergunta__texto_pergunta")
    autocomplete_fields = ["user", "pergunta", "last_session"]
    readonly_fields = ("created_at", "updated_at")
    select_related_fields = ("user", "pergunta", "last_session")


@admin.register(EstatisticasDiariasUsuario)
class EstatisticasDiariasUsuarioAdmin(EnhancedModelAdmin):
    list_display = (
        "id",
        "link_usuario_stats",
        "data_estatistica",
        "perguntas_respondidas_dia",
        "acertos_dia",
        "precisao_dia",
        "pontos_dia",
        "xp_ganho_dia",
        "sequencia_dias_quiz",
        "tempo_estudo_formatado",
        "data_atualizacao_estatistica_fmt",
    )
    list_filter = (
        "data_estatistica",
        "id_usuario__username",
        "sequencia_dias_quiz",
    )
    search_fields = (
        "id_usuario__username",
        "id_usuario__email",
        "data_estatistica",
    )
    readonly_fields = (
        "data_atualizacao_estatistica",
        "tempo_estudo_formatado",
        "precisao_dia",
    )
    autocomplete_fields = ["id_usuario"]
    date_hierarchy = "data_estatistica"
    select_related_fields = ("id_usuario",)

    fieldsets = (
        (None, {"fields": ("id_usuario", "data_estatistica")}),
        (
            "Desempenho Diário",
            {
                "fields": (
                    "perguntas_respondidas_dia",
                    "acertos_dia",
                    "precisao_dia",
                    "pontos_dia",
                    "xp_ganho_dia",
                    "tempo_estudo_segundos_dia",
                    "tempo_estudo_formatado",
                )
            },
        ),
        ("Engajamento", {"fields": ("sequencia_dias_quiz",)}),
        (
            "Datas de Auditoria",
            {
                "fields": ("data_atualizacao_estatistica",),
                "classes": ("collapse",),
            },
        ),
    )

    @admin.display(description="Usuário", ordering="id_usuario__username")
    def link_usuario_stats(self, obj):
        if obj.id_usuario:
            link = reverse("admin:auth_user_change", args=[obj.id_usuario.id])
            return format_html('<a href="{}">{}</a>', link, obj.id_usuario.username)
        return "N/A"

    @admin.display(
        description="Última Atualização",
        ordering="data_atualizacao_estatistica",
    )
    def data_atualizacao_estatistica_fmt(self, obj):
        return (
            obj.data_atualizacao_estatistica.strftime("%d/%m/%Y %H:%M:%S")
            if obj.data_atualizacao_estatistica
            else "-"
        )
