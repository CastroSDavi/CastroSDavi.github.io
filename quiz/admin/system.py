"""Admin registrations for system level preferences and messaging."""

from django.contrib import admin

from quiz.models import SystemMessageBroadcast, UserPreferences


@admin.register(SystemMessageBroadcast)
class SystemMessageBroadcastAdmin(admin.ModelAdmin):
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
class UserPreferencesAdmin(admin.ModelAdmin):
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
