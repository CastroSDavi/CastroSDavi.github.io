"""Admin registrations for configuration models."""

from django.contrib import admin

from quiz.models import (
    ChallengeHubActionCard,
    ChallengeHubHeroAction,
    ChallengeHubHeroStat,
    ChallengeHubPredefinedSection,
    ChallengeHubPlaceholderSettings,
    ChallengeHubResumeCardSettings,
    ChallengeHubSettings,
    ConfiguracoesGeraisQuiz,
    HomeHeroCTA,
    HomeHeroStatTemplate,
    HomeIntroHighlight,
    HomeIntroStep,
    HomePageSettings,
    HomeQuickLink,
    HomeProgressSectionSettings,
    HomeRecentSessionCardSettings,
    HomeActiveChallengeCardSettings,
    HomeAchievementCardSettings,
    QuizDefinicao,
)

from .inlines import QuizDefinicaoPerguntaInline
from .score_panel import ConfiguracoesGeraisQuizForm, QuizDefinicaoAdminForm


@admin.register(QuizDefinicao)
class QuizDefinicaoAdmin(admin.ModelAdmin):
    form = QuizDefinicaoAdminForm
    inlines = [QuizDefinicaoPerguntaInline]
    list_display = (
        "nome_quiz",
        "ativo",
        "data_criacao_formatada",
        "data_atualizacao_formatada",
        "contagem_perguntas_definidas",
    )
    list_filter = ("ativo", "data_criacao")
    search_fields = ("nome_quiz", "descricao")
    readonly_fields = ("data_criacao", "data_atualizacao")

    def get_fieldsets(self, request, obj=None):
        fieldsets = [
            (None, {"fields": ("nome_quiz", "descricao", "ativo")}),
        ]

        for mode_key, mode_label in self.form.get_score_panel_modes():
            title = (
                "Painel de Pontuação - Configuração Padrão"
                if mode_key == "default"
                else f"Painel de Pontuação - {mode_label}"
            )
            classes = () if mode_key == "default" else ("collapse",)
            description = (
                "Definições básicas aplicadas a todos os modos quando nenhum ajuste específico estiver definido."
                if mode_key == "default"
                else "Personalize os elementos do painel lateral para este modo de quiz nesta definição."
            )
            fields = tuple(
                self.form.build_field_name(mode_key, flag_key)
                for flag_key, *_ in self.form.SCORE_PANEL_FIELDS
            )
            fieldsets.append(
                (title, {"fields": fields, "classes": classes, "description": description})
            )

        fieldsets.append(
            (
                "Painel de Pontuação - Dados Internos",
                {
                    "fields": ("score_panel_overrides",),
                    "classes": ("collapse", "wide"),
                    "description": "Representação estruturada dos ajustes armazenados para esta definição.",
                },
            )
        )
        fieldsets.append(
            (
                "Datas de Auditoria",
                {"fields": ("data_criacao", "data_atualizacao"), "classes": ("collapse",)},
            )
        )
        return fieldsets

    @admin.display(description="Nº de Perguntas")
    def contagem_perguntas_definidas(self, obj):
        return obj.perguntas.count()

    @admin.display(description="Criação", ordering="data_criacao")
    def data_criacao_formatada(self, obj):
        return obj.data_criacao.strftime("%d/%m/%Y %H:%M") if obj.data_criacao else "-"

    @admin.display(description="Atualização", ordering="data_atualizacao")
    def data_atualizacao_formatada(self, obj):
        return (
            obj.data_atualizacao.strftime("%d/%m/%Y %H:%M")
            if obj.data_atualizacao
            else "-"
        )


@admin.register(ConfiguracoesGeraisQuiz)
class ConfiguracoesGeraisQuizAdmin(admin.ModelAdmin):
    form = ConfiguracoesGeraisQuizForm
    list_display = (
        "__str__",
        "numero_perguntas_quiz_rapido",
        "pontuacao_por_acerto",
        "penalidade_por_erro",
        "multiplicador_bonus_maximo",
        "data_modificacao_formatada",
    )
    readonly_fields = ("data_modificacao",)

    def get_fieldsets(self, request, obj=None):
        fieldsets = [
            (
                None,
                {
                    "fields": (
                        "numero_perguntas_quiz_rapido",
                        "pontuacao_por_acerto",
                        "penalidade_por_erro",
                        "multiplicador_bonus_maximo",
                    )
                },
            ),
            (
                "Pontuação Dinâmica",
                {
                    "fields": (
                        "configuracao_pontuacao_dificuldade",
                        "bonus_sequencia_acertos",
                    ),
                    "classes": ("collapse",),
                    "description": (
                        "Configure recompensas específicas por dificuldade e os bônus aplicados a sequências de acertos. "
                        "Essas estruturas JSON permitem integrar regras avançadas sem alterar o código."
                    ),
                },
            ),
        ]

        for mode_key, mode_label in self.form.get_score_panel_modes():
            title = (
                "Painel de Pontuação - Configuração Padrão"
                if mode_key == "default"
                else f"Painel de Pontuação - {mode_label}"
            )
            classes = () if mode_key == "default" else ("collapse",)
            description = (
                "Definições básicas aplicadas a todos os modos de quiz por padrão."
                if mode_key == "default"
                else "Personalize a visibilidade dos elementos do painel para este modo específico."
            )
            fields = tuple(
                self.form.build_field_name(mode_key, flag_key)
                for flag_key, *_ in self.form.SCORE_PANEL_FIELDS
            )
            fieldsets.append(
                (title, {"fields": fields, "classes": classes, "description": description})
            )

        fieldsets.append(
            (
                "Painel de Pontuação - Dados Internos",
                {
                    "fields": ("score_panel_config",),
                    "classes": ("collapse", "wide"),
                    "description": "Campo técnico utilizado para armazenar a configuração consolidada do painel.",
                },
            )
        )
        fieldsets.append(
            (
                "Datas de Auditoria",
                {"fields": ("data_modificacao",), "classes": ("collapse",)},
            )
        )
        return fieldsets

    def has_add_permission(self, request):
        return not ConfiguracoesGeraisQuiz.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.display(description="Última Modificação", ordering="data_modificacao")
    def data_modificacao_formatada(self, obj):
        return obj.data_modificacao.strftime("%d/%m/%Y %H:%M") if obj.data_modificacao else "-"


class HomeProgressSectionInline(admin.StackedInline):
    model = HomeProgressSectionSettings
    extra = 0
    max_num = 1
    can_delete = False
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "title",
                    "subtitle",
                    "show_when_empty",
                    "empty_state_title",
                    "empty_state_description",
                ),
                "classes": ("wide",),
            },
        ),
    )


class HomeRecentSessionCardInline(admin.StackedInline):
    model = HomeRecentSessionCardSettings
    extra = 0
    max_num = 1
    can_delete = False
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "icon",
                    "eyebrow",
                    "fallback_title",
                    "fallback_description",
                    "badge_label_template",
                    "show_when_empty",
                )
            },
        ),
        (
            "Estatísticas exibidas",
            {
                "fields": (
                    "stat_mode_label",
                    "stat_method_label",
                    "stat_questions_label",
                    "stat_accuracy_label",
                    "stat_duration_label",
                    "stat_mode_placeholder",
                    "stat_method_placeholder",
                    "stat_questions_placeholder",
                    "stat_accuracy_placeholder",
                    "stat_duration_placeholder",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "Ação principal",
            {
                "fields": (
                    "cta_label",
                    "cta_url",
                    "cta_icon",
                    "cta_css_class",
                ),
                "classes": ("collapse",),
            },
        ),
    )


class HomeActiveChallengeCardInline(admin.StackedInline):
    model = HomeActiveChallengeCardSettings
    extra = 0
    max_num = 1
    can_delete = False
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "icon",
                    "eyebrow",
                    "fallback_title",
                    "fallback_description",
                    "show_when_empty",
                )
            },
        ),
        (
            "Conteúdos dinâmicos",
            {
                "fields": (
                    "badge_label_template",
                    "progress_label",
                    "progress_placeholder",
                    "reward_label_template",
                    "reward_placeholder",
                ),
                "classes": ("collapse",),
            },
        ),
    )


class HomeAchievementCardInline(admin.StackedInline):
    model = HomeAchievementCardSettings
    extra = 0
    max_num = 1
    can_delete = False
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "icon",
                    "eyebrow",
                    "fallback_title",
                    "fallback_description",
                    "progress_label",
                    "progress_placeholder",
                    "show_when_empty",
                )
            },
        ),
    )


class HomeHeroCTAInline(admin.TabularInline):
    model = HomeHeroCTA
    extra = 0
    ordering = ("audience", "position")
    fields = ("audience", "position", "label", "url", "icon", "css_class", "anchor_id", "open_in_new_tab", "is_enabled")


class HomeHeroStatInline(admin.TabularInline):
    model = HomeHeroStatTemplate
    extra = 0
    ordering = ("audience", "order")
    fields = (
        "audience",
        "order",
        "label",
        "icon",
        "data_source",
        "prefix",
        "suffix",
        "static_value",
        "dom_id",
        "is_enabled",
    )


class HomeQuickLinkInline(admin.TabularInline):
    model = HomeQuickLink
    extra = 0
    ordering = ("order",)
    fields = (
        "order",
        "title",
        "description",
        "icon",
        "url",
        "extra_css_class",
        "anchor_id",
        "open_in_new_tab",
        "is_enabled",
    )


class HomeIntroHighlightInline(admin.TabularInline):
    model = HomeIntroHighlight
    extra = 0
    ordering = ("order",)
    fields = (
        "order",
        "label",
        "icon",
        "data_source",
        "prefix",
        "suffix",
        "static_value",
        "dom_id",
        "is_enabled",
    )


class HomeIntroStepInline(admin.TabularInline):
    model = HomeIntroStep
    extra = 0
    ordering = ("order",)
    fields = ("order", "text")


@admin.register(HomePageSettings)
class HomePageSettingsAdmin(admin.ModelAdmin):
    inlines = [
        HomeProgressSectionInline,
        HomeRecentSessionCardInline,
        HomeActiveChallengeCardInline,
        HomeAchievementCardInline,
        HomeHeroCTAInline,
        HomeHeroStatInline,
        HomeQuickLinkInline,
        HomeIntroHighlightInline,
        HomeIntroStepInline,
    ]

    fieldsets = (
        (
            "Hero - Usuários Autenticados",
            {
                "fields": (
                    "hero_authenticated_eyebrow",
                    "hero_authenticated_title",
                    "hero_authenticated_subtitle",
                )
            },
        ),
        (
            "Hero - Visitantes",
            {
                "fields": (
                    "hero_anonymous_eyebrow",
                    "hero_anonymous_title",
                    "hero_anonymous_subtitle",
                )
            },
        ),
        (
            "Seção de Atalhos Rápidos",
            {"fields": ("quick_section_title", "quick_section_subtitle")},
        ),
        (
            "Seção Introdutória",
            {
                "fields": (
                    "intro_section_title",
                    "intro_section_subtitle",
                    "intro_highlight_eyebrow",
                    "intro_highlight_title",
                    "intro_steps_eyebrow",
                    "intro_steps_title",
                    "intro_primary_cta_label",
                    "intro_primary_cta_url",
                    "intro_secondary_cta_label",
                    "intro_secondary_cta_url",
                )
            },
        ),
        (
            "Coleções e Métodos",
            {
                "fields": (
                    "collections_section_title",
                    "collections_section_subtitle",
                    "methods_section_title",
                    "methods_section_subtitle",
                )
            },
        ),
    )

    def has_add_permission(self, request):
        return not HomePageSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


class ChallengeHubHeroActionInline(admin.TabularInline):
    model = ChallengeHubHeroAction
    extra = 0
    fields = ("key", "label", "icon", "css_class", "dom_id", "is_enabled")
    ordering = ("key",)


class ChallengeHubHeroStatInline(admin.TabularInline):
    model = ChallengeHubHeroStat
    extra = 0
    fields = ("order", "label", "data_source", "prefix", "suffix", "dom_id", "is_enabled")
    ordering = ("order",)


class ChallengeHubActionCardInline(admin.TabularInline):
    model = ChallengeHubActionCard
    extra = 0
    fields = ("key", "title", "description", "meta", "icon", "dom_id", "extra_css_class", "is_enabled")
    ordering = ("key",)


class ChallengeHubResumeCardInline(admin.StackedInline):
    model = ChallengeHubResumeCardSettings
    extra = 0
    max_num = 1
    can_delete = False
    fields = ("title", "description_template", "icon", "discard_label", "continue_label")


class ChallengeHubPredefinedSectionInline(admin.StackedInline):
    model = ChallengeHubPredefinedSection
    extra = 0
    max_num = 1
    can_delete = False
    fields = ("title", "subtitle")


class ChallengeHubPlaceholderInline(admin.StackedInline):
    model = ChallengeHubPlaceholderSettings
    extra = 0
    max_num = 1
    can_delete = False
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "filters_title",
                    "filters_body",
                    "filters_supporting",
                )
            },
        ),
        (
            "Botão do aviso",
            {
                "fields": (
                    "filters_cta_label",
                    "filters_cta_icon",
                    "filters_cta_css_class",
                    "filters_cta_dom_id",
                ),
                "classes": ("collapse",),
            },
        ),
    )


@admin.register(ChallengeHubSettings)
class ChallengeHubSettingsAdmin(admin.ModelAdmin):
    inlines = [
        ChallengeHubHeroActionInline,
        ChallengeHubHeroStatInline,
        ChallengeHubActionCardInline,
        ChallengeHubResumeCardInline,
        ChallengeHubPredefinedSectionInline,
        ChallengeHubPlaceholderInline,
    ]

    fields = ("hero_eyebrow", "hero_title", "hero_subtitle_template")

    def has_add_permission(self, request):
        return not ChallengeHubSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
