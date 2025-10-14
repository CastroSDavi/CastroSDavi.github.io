"""Admin registrations for system level preferences and messaging."""

import json

from django.contrib import admin
from django.utils.html import format_html

from quiz.models import SupportRequest, SystemMessageBroadcast, UserPreferences

from .base import EnhancedModelAdmin


@admin.register(SystemMessageBroadcast)
class SystemMessageBroadcastAdmin(EnhancedModelAdmin):
    list_display = (
        "admin_title",
        "message_type",
        "channel",
        "audience",
        "is_active",
        "priority",
        "start_at",
        "end_at",
        "updated_at",
    )
    list_filter = (
        "message_type",
        "channel",
        "audience",
        "is_active",
    )
    search_fields = ("title", "body", "slug")
    ordering = ("-is_active", "-priority", "-start_at", "title")
    readonly_fields = ("created_at", "updated_at")
    prepopulated_fields = {"slug": ("title",)}
    fieldsets = (
        (
            "Conteúdo",
            {
                "fields": (
                    "title",
                    "slug",
                    "body",
                    "supporting_text",
                    "detail",
                )
            },
        ),
        (
            "Apresentação",
            {
                "fields": (
                    "message_type",
                    "icon",
                    "channel",
                    "extra_tags",
                    "audience",
                    "priority",
                )
            },
        ),
        (
            "Comportamento",
            {"fields": ("auto_dismiss", "dismiss_in")},
        ),
        (
            "Vigência",
            {
                "fields": (
                    "is_active",
                    "start_at",
                    "end_at",
                )
            },
        ),
        (
            "Auditoria",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )

    @admin.display(description="Título")
    def admin_title(self, obj):
        return obj.title or obj.slug


@admin.register(UserPreferences)
class UserPreferencesAdmin(EnhancedModelAdmin):
    list_display = (
        "user",
        "theme_preference",
        "receive_product_updates",
        "receive_progress_reports",
        "updated_at",
    )
    list_filter = (
        "theme_preference",
        "receive_product_updates",
        "receive_progress_reports",
    )
    search_fields = (
        "user__username",
        "user__email",
        "user__first_name",
        "user__last_name",
    )
    readonly_fields = ("created_at", "updated_at")
    select_related_fields = ("user",)


@admin.register(SupportRequest)
class SupportRequestAdmin(EnhancedModelAdmin):
    list_display = (
        "criado_em",
        "status_badge",
        "tipo_contato_badge",
        "origem",
        "nome",
        "email",
        "usuario",
    )
    list_filter = ("status", "tipo_contato", "origem", "criado_em")
    search_fields = (
        "nome",
        "email",
        "mensagem",
        "usuario__username",
        "usuario__email",
    )
    readonly_fields = ("mensagem", "contexto_pretty", "criado_em", "atualizado_em")
    ordering = ("-criado_em",)
    select_related_fields = ("usuario",)
    fieldsets = (
        (
            "Identificação",
            {
                "fields": (
                    "usuario",
                    "nome",
                    "email",
                    "origem",
                    "tipo_contato",
                )
            },
        ),
        (
            "Mensagem",
            {"fields": ("mensagem",)},
        ),
        (
            "Contexto adicional",
            {"fields": ("contexto_pretty",)},
        ),
        (
            "Acompanhamento",
            {"fields": ("status", "atualizado_em")},
        ),
        (
            "Auditoria",
            {"fields": ("criado_em",)},
        ),
    )

    @admin.display(description="Status", ordering="status")
    def status_badge(self, obj):
        colors = {
            SupportRequest.Status.ABERTO: "#1a5f9e",
            SupportRequest.Status.EM_ANALISE: "#c05621",
            SupportRequest.Status.RESOLVIDO: "#2f855a",
            SupportRequest.Status.ARQUIVADO: "#4a5568",
        }
        return format_html(
            '<span style="display:inline-block;padding:0.15rem 0.6rem;border-radius:999px;background:{}20;color:{};font-weight:600;font-size:0.85rem;text-transform:uppercase;">{}</span>',
            colors.get(obj.status, "#4a5568"),
            colors.get(obj.status, "#4a5568"),
            obj.get_status_display(),
        )

    @admin.display(description="Tipo", ordering="tipo_contato")
    def tipo_contato_badge(self, obj):
        colors = {
            SupportRequest.TipoContato.PROBLEMA_TECNICO: "#c53030",
            SupportRequest.TipoContato.CONTEUDO: "#805ad5",
            SupportRequest.TipoContato.SUGESTAO: "#3182ce",
            SupportRequest.TipoContato.SUPORTE_GERAL: "#2d3748",
        }
        return format_html(
            '<span style="display:inline-block;padding:0.1rem 0.55rem;border-radius:0.45rem;background:{}15;color:{};font-size:0.8rem;">{}</span>',
            colors.get(obj.tipo_contato, "#2d3748"),
            colors.get(obj.tipo_contato, "#2d3748"),
            obj.get_tipo_contato_display(),
        )

    @admin.display(description="Contexto")
    def contexto_pretty(self, obj):
        if not obj.contexto:
            return "—"
        formatted = json.dumps(obj.contexto, indent=2, ensure_ascii=False)
        return format_html(
            '<pre style="white-space:pre-wrap;background:#f7fafc;border:1px solid #e2e8f0;border-radius:6px;padding:0.75rem;margin:0;max-height:320px;overflow:auto;">{}</pre>',
            formatted,
        )
