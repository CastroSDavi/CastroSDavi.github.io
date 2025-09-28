"""Admin registrations for configuration models."""

from django.contrib import admin

from quiz.models import ConfiguracoesGeraisQuiz, QuizDefinicao

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
