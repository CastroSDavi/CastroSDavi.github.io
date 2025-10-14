"""Admin registrations for core quiz content."""

from django.contrib import admin
from django.db.models import Count, Max
from django.urls import reverse
from django.utils.html import format_html

from quiz.models import Categoria, OpcaoResposta, Pergunta, QuestaoFavorita

from .filters import TopLevelCategoriaFilter
from .inlines import OpcaoRespostaInline
from .mixins import AdminAutoImportCodeMixin, assign_auto_import_code
from .base import EnhancedModelAdmin


@admin.register(Categoria)
class CategoriaAdmin(AdminAutoImportCodeMixin, EnhancedModelAdmin):
    import_code_prefix = "cat"
    import_code_source_fields = ("nome_categoria",)

    list_display = (
        "nome_categoria",
        "codigo_importacao",
        "get_nome_categoria_pai_display",
        "id",
        "contagem_perguntas",
        "data_criacao_formatada",
        "data_atualizacao_formatada",
    )
    search_fields = (
        "nome_categoria",
        "descricao_categoria",
        "codigo_importacao",
        "id_categoria_pai__nome_categoria",
    )
    list_filter = ("id_categoria_pai", "data_criacao")
    autocomplete_fields = ["id_categoria_pai"]
    readonly_fields = ("data_criacao", "data_atualizacao")
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "nome_categoria",
                    "codigo_importacao",
                    "id_categoria_pai",
                    "descricao_categoria",
                ),
                "classes": ("wide",),
            },
        ),
        (
            "Datas de Auditoria",
            {
                "fields": ("data_criacao", "data_atualizacao"),
                "classes": ("collapse",),
            },
        ),
    )

    @admin.display(
        description="Categoria Pai",
        ordering="id_categoria_pai__nome_categoria",
    )
    def get_nome_categoria_pai_display(self, obj):
        return (
            obj.id_categoria_pai.nome_categoria
            if obj.id_categoria_pai
            else "--- Categoria Principal ---"
        )

    @admin.display(description="Nº de Perguntas")
    def contagem_perguntas(self, obj):
        return obj.perguntas_associadas.filter(ativa=True).count()

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


@admin.register(Pergunta)
class PerguntaAdmin(AdminAutoImportCodeMixin, EnhancedModelAdmin):
    import_code_prefix = "pergunta"
    import_code_source_fields = ("texto_pergunta",)

    list_display = (
        "texto_curto",
        "codigo_importacao",
        "nivel_dificuldade",
        "mostrar_categorias_formatado",
        "ativa",
        "numero_opcoes",
        "link_usuario_criador",
        "data_criacao_formatada",
    )
    list_display_links = ("texto_curto",)
    list_editable = ("nivel_dificuldade", "ativa")
    search_fields = (
        "texto_pergunta",
        "codigo_importacao",
        "referencia_bibliografica",
        "explicacao_resposta",
        "id_usuario_criador__username",
        "categorias__nome_categoria",
    )
    search_help_text = "Busque por texto, categorias, criador ou referencia."
    list_filter = (
        "nivel_dificuldade",
        TopLevelCategoriaFilter,
        ("categorias", admin.RelatedOnlyFieldListFilter),
        "ativa",
        "data_criacao",
        "id_usuario_criador",
    )
    filter_horizontal = ("categorias",)
    inlines = [OpcaoRespostaInline]
    readonly_fields = ("data_criacao", "data_atualizacao")
    autocomplete_fields = ["id_usuario_criador"]
    select_related_fields = ("id_usuario_criador",)
    date_hierarchy = "data_criacao"
    list_per_page = 30
    save_as = True
    radio_fields = {"nivel_dificuldade": admin.HORIZONTAL}
    actions = [
        "marcar_como_ativas",
        "marcar_como_inativas",
        "duplicar_perguntas",
    ]
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "texto_pergunta",
                    "codigo_importacao",
                    "url_imagem",
                    "referencia_bibliografica",
                    "explicacao_resposta",
                ),
                "classes": ("wide",),
            },
        ),
        (
            "Configuracoes do Quiz",
            {
                "fields": ("categorias", "nivel_dificuldade", "ativa"),
                "classes": ("wide",),
            },
        ),
        (
            "Metadados",
            {
                "fields": (
                    "id_usuario_criador",
                    "data_criacao",
                    "data_atualizacao",
                ),
                "classes": ("collapse",),
            },
        ),
    )

    @admin.display(description="Texto da Pergunta")
    def texto_curto(self, obj):
        return (
            obj.texto_pergunta[:80] + "..."
            if len(obj.texto_pergunta) > 80
            else obj.texto_pergunta
        )

    @admin.display(description="Categorias")
    def mostrar_categorias_formatado(self, obj):
        return ", ".join([cat.nome_categoria for cat in obj.categorias.all()[:5]])

    @admin.display(description="Opcoes", ordering="opcoes_count")
    def numero_opcoes(self, obj):
        return getattr(obj, "opcoes_count", 0)

    @admin.display(description="Criador", ordering="id_usuario_criador__username")
    def link_usuario_criador(self, obj):
        if obj.id_usuario_criador:
            link = reverse("admin:auth_user_change", args=[obj.id_usuario_criador.id])
            return format_html(
                '<a href="{}">{}</a>',
                link,
                obj.id_usuario_criador.username,
            )
        return "N/A (Sistema)"

    @admin.display(description="Criacao", ordering="data_criacao")
    def data_criacao_formatada(self, obj):
        return obj.data_criacao.strftime("%d/%m/%Y %H:%M") if obj.data_criacao else "-"

    @admin.display(description="Atualizacao", ordering="data_atualizacao")
    def data_atualizacao_formatada(self, obj):
        return (
            obj.data_atualizacao.strftime("%d/%m/%Y %H:%M")
            if obj.data_atualizacao
            else "-"
        )

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return (
            qs.select_related("id_usuario_criador")
            .prefetch_related("categorias")
            .annotate(opcoes_count=Count("opcoes"))
        )

    def save_model(self, request, obj, form, change):
        if not obj.id_usuario_criador and request.user.is_authenticated:
            obj.id_usuario_criador = request.user
        super().save_model(request, obj, form, change)

    def save_formset(self, request, form, formset, change):
        instances = formset.save(commit=False)
        for deleted in formset.deleted_objects:
            deleted.delete()

        for instance in instances:
            if isinstance(instance, OpcaoResposta):
                assign_auto_import_code(
                    instance,
                    prefix="opcao",
                    source_text=getattr(instance, "texto_opcao", None),
                )
                if instance.pk is None and (
                    instance.ordem_exibicao is None or instance.ordem_exibicao == 0
                ):
                    max_ordem = (
                        instance.pergunta.opcoes.exclude(pk=instance.pk)
                        .aggregate(max_ordem=Max("ordem_exibicao"))
                        .get("max_ordem")
                    )
                    instance.ordem_exibicao = (max_ordem or 0) + 1
            instance.save()

        formset.save_m2m()

    @admin.action(description="Marcar como ativas")
    def marcar_como_ativas(self, request, queryset):
        atualizadas = queryset.update(ativa=True)
        self.message_user(request, f"{atualizadas} perguntas marcadas como ativas.")

    @admin.action(description="Marcar como inativas")
    def marcar_como_inativas(self, request, queryset):
        atualizadas = queryset.update(ativa=False)
        self.message_user(request, f"{atualizadas} perguntas marcadas como inativas.")

    @admin.action(description="Duplicar perguntas selecionadas (com opcoes)")
    def duplicar_perguntas(self, request, queryset):
        criadas = 0
        for pergunta in queryset:
            nova_pergunta = Pergunta.objects.create(
                texto_pergunta=pergunta.texto_pergunta,
                url_imagem=pergunta.url_imagem,
                referencia_bibliografica=pergunta.referencia_bibliografica,
                nivel_dificuldade=pergunta.nivel_dificuldade,
                explicacao_resposta=pergunta.explicacao_resposta,
                ativa=False,
                id_usuario_criador=
                    request.user if request.user.is_authenticated else pergunta.id_usuario_criador,
            )
            categorias = list(pergunta.categorias.all())
            if categorias:
                nova_pergunta.categorias.set(categorias)

            opcoes = pergunta.opcoes.all()
            bulk = [
                OpcaoResposta(
                    pergunta=nova_pergunta,
                    texto_opcao=opcao.texto_opcao,
                    eh_correta=opcao.eh_correta,
                    ordem_exibicao=opcao.ordem_exibicao,
                    feedback_opcao=opcao.feedback_opcao,
                )
                for opcao in opcoes
            ]
            if bulk:
                OpcaoResposta.objects.bulk_create(bulk)

            criadas += 1

        self.message_user(
            request,
            f"{criadas} perguntas duplicadas e marcadas como inativas para revisao.",
        )


@admin.register(OpcaoResposta)
class OpcaoRespostaAdmin(AdminAutoImportCodeMixin, EnhancedModelAdmin):
    import_code_prefix = "opcao"
    import_code_source_fields = ("texto_opcao",)

    list_display = (
        "id",
        "codigo_importacao",
        "texto_opcao_curto",
        "link_pergunta_associada",
        "eh_correta",
        "ordem_exibicao",
        "data_criacao_formatada",
    )
    search_fields = (
        "texto_opcao",
        "codigo_importacao",
        "feedback_opcao",
        "pergunta__texto_pergunta",
    )
    list_filter = (
        "eh_correta",
        "pergunta__nivel_dificuldade",
        "data_criacao",
        "pergunta__categorias",
    )
    autocomplete_fields = ["pergunta"]
    readonly_fields = ("data_criacao", "data_atualizacao")
    select_related_fields = ("pergunta",)

    @admin.display(description="Texto da Opção")
    def texto_opcao_curto(self, obj):
        return (
            obj.texto_opcao[:75] + "..."
            if len(obj.texto_opcao) > 75
            else obj.texto_opcao
        )

    @admin.display(
        description="Pergunta Associada",
        ordering="pergunta__texto_pergunta",
    )
    def link_pergunta_associada(self, obj):
        if obj.pergunta:
            link = reverse("admin:quiz_pergunta_change", args=[obj.pergunta.id])
            return format_html(
                '<a href="{}">P{}: {}...</a>',
                link,
                obj.pergunta.id,
                obj.pergunta.texto_pergunta[:30],
            )
        return "N/A"

    @admin.display(description="Criação", ordering="data_criacao")
    def data_criacao_formatada(self, obj):
        return obj.data_criacao.strftime("%d/%m/%Y %H:%M") if obj.data_criacao else "-"


@admin.register(QuestaoFavorita)
class QuestaoFavoritaAdmin(EnhancedModelAdmin):
    list_display = (
        "id",
        "link_usuario_favorito",
        "link_pergunta_favorita",
        "data_favoritada_formatada",
    )
    list_filter = ("data_favoritada", "usuario__username", "pergunta__categorias")
    search_fields = ("usuario__username", "pergunta__texto_pergunta")
    autocomplete_fields = ["usuario", "pergunta"]
    readonly_fields = ("data_favoritada",)
    select_related_fields = ("usuario", "pergunta")
    date_hierarchy = "data_favoritada"

    @admin.display(description="Usuário", ordering="usuario__username")
    def link_usuario_favorito(self, obj):
        link = reverse("admin:auth_user_change", args=[obj.usuario.id])
        return format_html('<a href="{}">{}</a>', link, obj.usuario.username)

    @admin.display(
        description="Pergunta Favorita",
        ordering="pergunta__texto_pergunta",
    )
    def link_pergunta_favorita(self, obj):
        link = reverse("admin:quiz_pergunta_change", args=[obj.pergunta.id])
        return format_html(
            '<a href="{}">P{}: {}...</a>',
            link,
            obj.pergunta.id,
            obj.pergunta.texto_pergunta[:50],
        )

    @admin.display(description="Data Favoritada", ordering="data_favoritada")
    def data_favoritada_formatada(self, obj):
        return (
            obj.data_favoritada.strftime("%d/%m/%Y %H:%M")
            if obj.data_favoritada
            else "-"
        )
