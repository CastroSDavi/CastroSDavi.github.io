"""Shared admin base classes focused on a fast, polished authoring experience."""

from __future__ import annotations

import re
from typing import Iterable, Sequence

from django import forms
from django.contrib import admin
from django.core import serializers
from django.core.exceptions import FieldDoesNotExist
from django.db import models
from django.http import HttpResponse
from django.utils import timezone

from .mixins import AuditFieldsReadonlyMixin


def _apply_widget_enhancements(
    widget: forms.Widget,
    label: str | None = None,
    help_text: str | None = None,
) -> None:
    """Normalize widget appearance and hints for a better authoring flow."""

    if not hasattr(widget, "attrs"):
        return

    if label:
        widget.attrs.setdefault("aria-label", str(label))

    if help_text:
        widget.attrs.setdefault("title", str(help_text))

    placeholder = widget.attrs.get("placeholder")
    if not placeholder:
        label_placeholder = (label or "").strip()
        if label_placeholder:
            widget.attrs["placeholder"] = label_placeholder

    if isinstance(widget, forms.TextInput):
        widget.attrs.setdefault("style", "width: 72%;")
        widget.attrs.setdefault("autocomplete", "off")

    if isinstance(widget, forms.Textarea):
        current_style = widget.attrs.get("style", "")
        additions = ["resize: vertical", "min-height: 120px"]
        if current_style:
            additions.insert(0, current_style.rstrip(";"))
        widget.attrs["style"] = "; ".join(additions)
        widget.attrs.setdefault("rows", 4)

    if isinstance(widget, forms.URLInput):
        widget.attrs.setdefault("style", "width: 80%;")
        widget.attrs.setdefault("placeholder", (label or "https://exemplo.com"))
        widget.attrs.setdefault("autocomplete", "url")

    if isinstance(widget, forms.EmailInput):
        widget.attrs.setdefault("placeholder", (label or "email@exemplo.com"))
        widget.attrs.setdefault("autocomplete", "email")

    if isinstance(widget, forms.NumberInput):
        widget.attrs.setdefault("style", "width: 40%;")
        widget.attrs.setdefault("step", "any")
        widget.attrs.setdefault("inputmode", "decimal")


class _EnhancedAdminBase:
    """Mixin shared between our enhanced admin classes."""

    save_on_top = True
    save_as = True
    actions_on_top = True
    actions_on_bottom = True
    list_per_page = 40
    list_max_show_all = 200
    preserve_filters = True

    class Media:
        js = ("admin/enhancements.js",)

    export_datetime_format = "%Y%m%d-%H%M%S"

    def get_actions(self, request):
        actions = super().get_actions(request)
        if "export_as_json_action" not in actions:
            actions["export_as_json_action"] = (
                self.export_as_json_action,
                "export_as_json_action",
                "Exportar selecionados como JSON",
            )
        return actions

    def export_as_json_action(self, request, queryset):
        if not queryset.exists():
            self.message_user(request, "Nenhum registro selecionado para exportação.")
            return None

        opts = self.model._meta
        timestamp = timezone.now().strftime(self.export_datetime_format)
        filename = f"{opts.app_label}-{opts.model_name}-{timestamp}.json"
        response = HttpResponse(content_type="application/json")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        serializers.serialize("json", queryset, stream=response)
        return response

    export_as_json_action.short_description = "Exportar selecionados como JSON"


class EnhancedModelAdmin(AuditFieldsReadonlyMixin, _EnhancedAdminBase, admin.ModelAdmin):
    """Opinionated admin base with sensible defaults for content-heavy models."""

    show_full_result_count = False
    search_by_pk: bool = True
    default_ordering: Sequence[str] = ("-pk",)
    select_related_fields: Iterable[str] = ()
    prefetch_related_fields: Iterable[str] = ()
    auto_detect_search_fields: bool = True
    auto_search_field_names: Sequence[str] = (
        "nome",
        "name",
        "titulo",
        "title",
        "descricao",
        "description",
        "texto",
        "texto_pergunta",
        "slug",
        "email",
    )
    auto_detect_list_filter: bool = True
    auto_list_filter_cap: int = 4
    auto_date_hierarchy: bool = True
    auto_date_hierarchy_fields: Sequence[str] = (
        "data_atualizacao",
        "data_criacao",
        "updated_at",
        "created_at",
        "modified",
        "created",
    )
    formfield_overrides = {
        models.CharField: {
            "widget": forms.TextInput(attrs={"style": "width: 72%;", "autocomplete": "off"})
        },
        models.SlugField: {
            "widget": forms.TextInput(
                attrs={"style": "width: 72%;", "placeholder": "slug-gerado-automaticamente"}
            )
        },
        models.TextField: {
            "widget": forms.Textarea(
                attrs={
                    "rows": 4,
                    "style": "min-height: 120px; resize: vertical;",
                }
            )
        },
        models.URLField: {
            "widget": forms.URLInput(attrs={"style": "width: 80%;", "placeholder": "https://exemplo.com"})
        },
        models.JSONField: {
            "widget": forms.Textarea(
                attrs={
                    "rows": 10,
                    "style": "font-family: var(--font-family-monospace, monospace); resize: vertical;",
                    "placeholder": "{\n    \"chave\": \"valor\"\n}",
                }
            )
        },
    }

    def __init__(self, model, admin_site):
        super().__init__(model, admin_site)
        self._auto_configure_date_hierarchy()
        self._auto_configure_search_fields()
        self._auto_configure_list_filter()

    def get_ordering(self, request):
        ordering = super().get_ordering(request)
        if ordering:
            return ordering
        return self.default_ordering

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        if self.select_related_fields:
            queryset = queryset.select_related(*self.select_related_fields)
        if self.prefetch_related_fields:
            queryset = queryset.prefetch_related(*self.prefetch_related_fields)
        return queryset

    def get_search_results(self, request, queryset, search_term):
        queryset, use_distinct = super().get_search_results(request, queryset, search_term)
        if self.search_by_pk and search_term:
            raw_term = search_term.strip()
            candidate = re.sub(r"[^\d]", "", raw_term)
            if candidate.isdigit():
                queryset |= self.model._default_manager.filter(pk=int(candidate))
        return queryset, use_distinct

    def get_form(self, request, obj=None, change=False, **kwargs):
        form = super().get_form(request, obj, change, **kwargs)
        for name, field in form.base_fields.items():
            _apply_widget_enhancements(field.widget, field.label, field.help_text)
        return form

    def formfield_for_dbfield(self, db_field, request, **kwargs):
        formfield = super().formfield_for_dbfield(db_field, request, **kwargs)
        if formfield and formfield.widget:
            _apply_widget_enhancements(
                formfield.widget,
                getattr(formfield, "label", None),
                getattr(formfield, "help_text", None),
            )
        return formfield

    # ------------------------------------------------------------------
    # Auto-configuration helpers
    # ------------------------------------------------------------------

    def _auto_configure_search_fields(self) -> None:
        if not self.auto_detect_search_fields or self.search_fields:
            return

        detected: list[str] = []
        for field_name in self.auto_search_field_names:
            field = self._get_concrete_field(field_name)
            if isinstance(
                field,
                (
                    models.CharField,
                    models.TextField,
                    models.EmailField,
                    models.SlugField,
                ),
            ):
                detected.append(field_name)

        if not detected:
            for field in self.model._meta.get_fields():
                if not getattr(field, "concrete", False):
                    continue
                if isinstance(field, (models.CharField, models.TextField)) and not getattr(
                    field, "choices", None
                ):
                    detected.append(field.name)
                if len(detected) >= 3:
                    break

        if detected:
            self.search_fields = tuple(dict.fromkeys(detected))

    def _auto_configure_list_filter(self) -> None:
        if not self.auto_detect_list_filter or self.list_filter:
            return

        detected: list[str] = []
        for field in self.model._meta.get_fields():
            if not getattr(field, "concrete", False) or getattr(field, "many_to_many", False):
                continue
            if getattr(field, "choices", None):
                detected.append(field.name)
            elif isinstance(field, models.BooleanField):
                detected.append(field.name)

        if detected:
            limited = detected[: self.auto_list_filter_cap]
            self.list_filter = tuple(dict.fromkeys(limited))

    def _auto_configure_date_hierarchy(self) -> None:
        if not self.auto_date_hierarchy or self.date_hierarchy:
            return

        for field_name in self.auto_date_hierarchy_fields:
            field = self._get_concrete_field(field_name)
            if isinstance(field, (models.DateField, models.DateTimeField)):
                self.date_hierarchy = field_name
                return

        for field in self.model._meta.get_fields():
            if not getattr(field, "concrete", False):
                continue
            if isinstance(field, (models.DateField, models.DateTimeField)):
                self.date_hierarchy = field.name
                return

    def _get_concrete_field(self, field_name: str):
        try:
            field = self.model._meta.get_field(field_name)
        except FieldDoesNotExist:
            return None
        return field if getattr(field, "concrete", False) else None


class EnhancedTabularInline(_EnhancedAdminBase, admin.TabularInline):
    """Inline version of :class:`EnhancedModelAdmin` defaults."""

    extra = 1
    show_change_link = True

    formfield_overrides = EnhancedModelAdmin.formfield_overrides

    def get_formset(self, request, obj=None, **kwargs):
        formset = super().get_formset(request, obj, **kwargs)
        base_form = formset.form
        for field in base_form.base_fields.values():
            _apply_widget_enhancements(field.widget, field.label, field.help_text)
        return formset


class EnhancedStackedInline(_EnhancedAdminBase, admin.StackedInline):
    """Stacked inline variant offering the same enhancements."""

    extra = 0
    show_change_link = True

    formfield_overrides = EnhancedModelAdmin.formfield_overrides

    def get_formset(self, request, obj=None, **kwargs):
        formset = super().get_formset(request, obj, **kwargs)
        base_form = formset.form
        for field in base_form.base_fields.values():
            _apply_widget_enhancements(field.widget, field.label, field.help_text)
        return formset
