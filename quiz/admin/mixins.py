"""Utility mixins and helpers shared across admin modules."""
from __future__ import annotations

from typing import Iterable, Optional
from uuid import uuid4

from django.core.exceptions import FieldDoesNotExist
from django.utils.text import slugify


def assign_auto_import_code(
    instance,
    *,
    prefix: str,
    source_text: Optional[str] = None,
    field_name: str = "codigo_importacao",
    max_length: int = 64,
) -> Optional[str]:
    """Populate an import code field with a semi human friendly identifier."""

    if not hasattr(instance, field_name):
        return None

    current_value = getattr(instance, field_name)
    if current_value:
        return current_value

    normalized_source = (source_text or "").strip()
    base_slug = slugify(normalized_source, allow_unicode=False).strip("-")

    suffix_length = 9  # dash + 8 uuid characters
    available = max_length - suffix_length
    if available < 1:
        available = max_length

    if base_slug and available:
        base_core = base_slug[:available]
    else:
        base_core = prefix[:available] if available else prefix

    if not base_core:
        base_core = prefix or "item"

    model = type(instance)
    exclude_pk = getattr(instance, "pk", None)

    for _ in range(8):
        suffix = uuid4().hex[:8]
        candidate = f"{base_core}-{suffix}" if base_core else suffix
        candidate = candidate[:max_length]
        queryset = model.objects.filter(**{field_name: candidate})
        if exclude_pk:
            queryset = queryset.exclude(pk=exclude_pk)
        if not queryset.exists():
            setattr(instance, field_name, candidate)
            return candidate

    fallback = uuid4().hex[:max_length]
    setattr(instance, field_name, fallback)
    return fallback


class AdminAutoImportCodeMixin:
    """Ensure the configured import code is always populated automatically."""

    import_code_field: str = "codigo_importacao"
    import_code_prefix: str = "item"
    import_code_source_fields: Iterable[str] = ()

    def get_import_code_source_value(self, instance) -> Optional[str]:
        for field_name in self.import_code_source_fields:
            value = getattr(instance, field_name, None)
            if value:
                if isinstance(value, str):
                    return value[:150]
                return str(value)
        return None

    def ensure_import_code(self, instance) -> Optional[str]:
        return assign_auto_import_code(
            instance,
            prefix=self.import_code_prefix,
            source_text=self.get_import_code_source_value(instance),
            field_name=self.import_code_field,
        )

    def save_model(self, request, obj, form, change):
        self.ensure_import_code(obj)
        super().save_model(request, obj, form, change)


class AuditFieldsReadonlyMixin:
    """Automatically mark timestamp fields as read-only when present."""

    audit_field_names: tuple[str, ...] = ("data_criacao", "data_atualizacao")

    def get_readonly_fields(self, request, obj=None):
        readonly = list(super().get_readonly_fields(request, obj))
        for field_name in self.audit_field_names:
            if field_name in readonly:
                continue
            try:
                self.model._meta.get_field(field_name)
            except FieldDoesNotExist:
                continue
            readonly.append(field_name)
        return tuple(readonly)
