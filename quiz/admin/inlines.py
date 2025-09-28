"""Reusable inlines for admin screens."""

from django.contrib import admin
from django.core.exceptions import ValidationError
from django.forms.models import BaseInlineFormSet
from django.urls import reverse
from django.utils.html import format_html

from quiz.models import (
    OpcaoResposta,
    QuizDefinicaoPergunta,
    RespostasUsuarioPorSessao,
)

class OpcaoRespostaInlineFormSet(BaseInlineFormSet):
    """Ensure at least two options and one correct answer are provided."""

    def clean(self):
        super().clean()

        non_deleted = []
        for form in self.forms:
            if not hasattr(form, "cleaned_data"):
                continue
            if form.cleaned_data.get("DELETE", False):
                continue
            if not form.cleaned_data or form.errors:
                continue
            non_deleted.append(form.cleaned_data)

        if len(non_deleted) < 2:
            raise ValidationError("Adicione pelo menos duas opcoes de resposta.")

        if not any(data.get("eh_correta") for data in non_deleted):
            raise ValidationError("Defina ao menos uma opcao como correta.")


class OpcaoRespostaInline(admin.TabularInline):
    model = OpcaoResposta
    extra = 0
    min_num = 2
    formset = OpcaoRespostaInlineFormSet
    validate_min = True
    show_change_link = True
    fields = [
        "codigo_importacao",
        "texto_opcao",
        "eh_correta",
        "ordem_exibicao",
        "feedback_opcao",
    ]


class RespostasUsuarioPorSessaoInline(admin.TabularInline):
    model = RespostasUsuarioPorSessao
    extra = 0
    fields = (
        "link_pergunta_inline",
        "link_opcao_selecionada_inline",
        "foi_correta",
        "data_resposta_formatada_inline",
    )
    readonly_fields = fields
    can_delete = False
    show_change_link = True

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
            link = reverse(
                "admin:quiz_opcaoresposta_change",
                args=[obj.id_opcao_resposta_selecionada.id],
            )
            return format_html(
                '<a href="{}">O{}</a>',
                link,
                obj.id_opcao_resposta_selecionada.id,
            )
        return "Pulada"

    @admin.display(description="Respondida às")
    def data_resposta_formatada_inline(self, obj):
        return (
            obj.data_resposta.strftime("%H:%M:%S")
            if obj.data_resposta
            else "-"
        )


class QuizDefinicaoPerguntaInline(admin.TabularInline):
    model = QuizDefinicaoPergunta
    extra = 1
    autocomplete_fields = ["pergunta"]
    fields = ("pergunta", "ordem")
    ordering = ["ordem"]
    verbose_name = "Pergunta do Quiz"
    verbose_name_plural = "Perguntas do Quiz (com ordem)"
