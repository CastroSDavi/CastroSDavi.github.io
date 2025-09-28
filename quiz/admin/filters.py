"""Custom filters for the admin dashboard."""

from django.contrib import admin

from quiz.models import Categoria, CategoriaHierarquia


class TopLevelCategoriaFilter(admin.SimpleListFilter):
    title = "Categoria principal"
    parameter_name = "categoria_raiz"

    def lookups(self, request, model_admin):
        categorias = (
            Categoria.objects.filter(id_categoria_pai__isnull=True)
            .order_by("nome_categoria")
        )
        return [(str(cat.pk), cat.nome_categoria) for cat in categorias]

    def queryset(self, request, queryset):
        value = self.value()
        if not value:
            return queryset

        try:
            categoria_id = int(value)
        except (TypeError, ValueError):
            return queryset

        descendant_ids = list(
            CategoriaHierarquia.objects.filter(ancestor_id=categoria_id)
            .values_list("descendant_id", flat=True)
        )
        if not descendant_ids:
            return queryset.none()
        return queryset.filter(categorias__in=descendant_ids).distinct()
