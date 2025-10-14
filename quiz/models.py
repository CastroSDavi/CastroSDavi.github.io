# quiz/models.py
from copy import deepcopy
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Set
from uuid import uuid4

from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models, transaction
from django.urls import reverse
from django.utils import timezone
from django.utils.text import slugify


def _generate_unique_slug(instance, value: str, *, slug_field: str = 'slug', max_length: int = 128, default_prefix: str = 'item') -> str:
    """
    Generate a slug for ``instance`` based on ``value`` ensuring uniqueness.

    Parameters
    ----------
    instance: models.Model
        Model instance that will receive the slug.
    value: str
        Base string used to generate the slug.
    slug_field: str
        Attribute name that stores the slug. Defaults to ``slug``.
    max_length: int
        Max length allowed for the slug. Defaults to 128.
    default_prefix: str
        Prefix used when ``value`` does not yield a valid slug.
    """
    base_slug = slugify(value or '')[:max_length].strip('-')
    if not base_slug:
        random_suffix = uuid4().hex[:6]
        base_slug = f"{slugify(default_prefix) or default_prefix}-{random_suffix}"

    ModelClass = instance.__class__
    queryset = ModelClass.objects.all()
    if instance.pk:
        queryset = queryset.exclude(pk=instance.pk)

    slug_candidate = base_slug
    counter = 2
    while queryset.filter(**{slug_field: slug_candidate}).exists():
        suffix = f"-{counter}"
        slug_candidate = f"{base_slug[: max_length - len(suffix)]}{suffix}"
        counter += 1

    return slug_candidate


def default_difficulty_rewards() -> Dict[str, Dict[str, int]]:
    """Configuração padrão para pontuação, XP e penalidades por dificuldade."""
    return {
        "Fácil": {"points": 10, "xp": 5, "penalty": 2},
        "Médio": {"points": 20, "xp": 12, "penalty": 5},
        "Difícil": {"points": 35, "xp": 20, "penalty": 8},
    }


def default_streak_bonus_rules() -> List[Dict[str, int]]:
    """Bônus padrão progressivo baseado em sequência de acertos."""
    return [
        {"streak": 3, "bonus_percent": 5},
        {"streak": 5, "bonus_percent": 12},
        {"streak": 8, "bonus_percent": 18},
        {"streak": 12, "bonus_percent": 25},
    ]


DEFAULT_SCORE_PANEL_SETTINGS: Dict[str, bool] = {
    "show_points": True,
    "show_correct": True,
    "show_incorrect": True,
    "show_streak": True,
    "show_multiplier": True,
    "show_timer": True,
    "allow_pause": True,
    "allow_manual_finish": True,
}


def default_score_panel_config() -> Dict[str, Dict[str, bool]]:
    """Retorna um dicionário padrão para todos os modos de quiz disponíveis."""

    config = {"default": deepcopy(DEFAULT_SCORE_PANEL_SETTINGS)}
    for mode_value in get_available_quiz_mode_values():
        config[mode_value] = deepcopy(DEFAULT_SCORE_PANEL_SETTINGS)
    return config


def get_available_quiz_mode_values() -> List[str]:
    """Lista os valores de todos os modos de quiz registrados."""

    return [value for value, _label in get_registered_score_panel_modes()]


def get_additional_score_panel_modes() -> List[Tuple[str, str]]:
    """Normaliza a configuração de modos extras definidos nas settings."""

    extra_modes = getattr(settings, "QUIZ_SCORE_PANEL_EXTRA_MODES", [])
    normalized: List[Tuple[str, str]] = []

    if isinstance(extra_modes, dict):
        iterator = extra_modes.items()
    else:
        iterator = extra_modes

    for entry in iterator:
        value: Optional[str]
        label: Optional[str]

        if isinstance(entry, (list, tuple)):
            if not entry:
                continue
            value = str(entry[0]) if entry[0] is not None else None
            label = str(entry[1]) if len(entry) > 1 and entry[1] is not None else None
        elif isinstance(entry, str):
            value = entry
            label = entry
        else:
            continue

        if not value:
            continue

        normalized.append((value, label or value))

    return normalized


def get_registered_score_panel_modes() -> List[Tuple[str, str]]:
    """Retorna todos os modos conhecidos para configuração do painel."""

    modes: List[Tuple[str, str]] = []
    seen: Set[str] = set()

    try:
        for choice in SessoesQuizUsuario.ModoQuiz:
            value = str(choice.value)
            if value and value not in seen:
                modes.append((value, str(choice.label)))
                seen.add(value)
    except NameError:
        # Durante migrações iniciais SessoesQuizUsuario pode não estar disponível ainda.
        pass

    for value, label in get_additional_score_panel_modes():
        if value not in seen:
            modes.append((value, label))
            seen.add(value)

    return modes


def _coerce_score_panel_flag(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "on", "sim"}:
            return True
        if normalized in {"false", "0", "no", "off", "nao", "não"}:
            return False
    return default


def _coerce_score_panel_settings(data: Optional[Dict[str, Any]]) -> Dict[str, bool]:
    settings = deepcopy(DEFAULT_SCORE_PANEL_SETTINGS)
    if not isinstance(data, dict):
        return settings
    for key in settings.keys():
        if key in data:
            settings[key] = _coerce_score_panel_flag(data[key], settings[key])
    return settings


def sanitize_score_panel_config(payload: Optional[Dict[str, Any]]) -> Dict[str, Dict[str, bool]]:
    """Normaliza um payload bruto de configuração do painel de pontuação."""

    payload = payload or {}
    if not isinstance(payload, dict):
        payload = {}

    sanitized: Dict[str, Dict[str, bool]] = {
        "default": _coerce_score_panel_settings(payload.get("default"))
    }

    for mode in get_available_quiz_mode_values():
        sanitized[mode] = _coerce_score_panel_settings(payload.get(mode))

    return sanitized

# --- Modelos de Conteúdo do Quiz ---


class SingletonModel(models.Model):
    """Base simples para modelos tratados como singleton via admin."""

    singleton_instance_id: int = 1

    id = models.PositiveSmallIntegerField(primary_key=True, default=singleton_instance_id, editable=False)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):  # type: ignore[override]
        self.id = self.singleton_instance_id
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        instance, _created = cls.objects.get_or_create(pk=cls.singleton_instance_id)
        return instance

class Categoria(models.Model):
    """
    Categoriza as perguntas. Pode ter uma estrutura hierárquica (pai/filho).
    """
    codigo_importacao = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        blank=True,
        null=True,
        verbose_name="Código de Importação",
        help_text="Identificador externo usado durante processos de importação. Deixe em branco para gerar automaticamente.",
    )
    nome_categoria = models.CharField(
        max_length=150,
        verbose_name="Nome da Categoria"
    )
    id_categoria_pai = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='subcategorias',
        verbose_name="Categoria Pai",
        help_text="Deixe em branco se esta for uma categoria principal."
    )
    descricao_categoria = models.TextField(
        blank=True,
        null=True,
        verbose_name="Descrição"
    )
    data_criacao = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Data de Criação"
    )
    data_atualizacao = models.DateTimeField(
        auto_now=True,
        verbose_name="Data de Atualização"
    )

    def __str__(self):
        if self.id_categoria_pai:
            return f"{self.id_categoria_pai.nome_categoria} -> {self.nome_categoria}"
        return self.nome_categoria

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        old_parent_id = None
        descendant_ids = None
        if not is_new and self.pk:
            old_parent_id = Categoria.objects.filter(pk=self.pk).values_list(
                'id_categoria_pai_id', flat=True
            ).first()
            descendant_ids = list(
                CategoriaHierarquia.objects.filter(ancestor_id=self.pk)
                .values_list('descendant_id', flat=True)
            )

        with transaction.atomic():
            super().save(*args, **kwargs)

            # Se a categoria é nova ou seu pai mudou, precisamos recalcular a hierarquia
            parent_changed = old_parent_id != self.id_categoria_pai_id
            if is_new or parent_changed:
                ids_to_rebuild = descendant_ids if descendant_ids else []
                if is_new:
                    ids_to_rebuild.append(self.pk)
                CategoriaHierarquia.rebuild_for_descendants(ids_to_rebuild or [self.pk])
            else:
                # Garante que pelo menos o elo reflexivo exista
                if not CategoriaHierarquia.objects.filter(
                    ancestor_id=self.pk, descendant_id=self.pk
                ).exists():
                    CategoriaHierarquia.rebuild_for_descendants([self.pk])

    def delete(self, *args, **kwargs):
        descendant_ids = list(
            CategoriaHierarquia.objects.filter(ancestor_id=self.pk)
            .values_list('descendant_id', flat=True)
        )

        with transaction.atomic():
            super().delete(*args, **kwargs)

            remaining_descendants = [
                pk for pk in descendant_ids if pk and pk != self.pk
            ]
            if remaining_descendants:
                CategoriaHierarquia.rebuild_for_descendants(remaining_descendants)

    class Meta:
        verbose_name = "Categoria de Pergunta"
        verbose_name_plural = "Categorias de Perguntas"
        unique_together = ('nome_categoria', 'id_categoria_pai')
        ordering = ['nome_categoria']


class CategoriaHierarquia(models.Model):
    ancestor = models.ForeignKey(
        'Categoria',
        related_name='hierarquia_descendentes',
        on_delete=models.CASCADE,
    )
    descendant = models.ForeignKey(
        'Categoria',
        related_name='hierarquia_ancestrais',
        on_delete=models.CASCADE,
    )
    depth = models.PositiveIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['ancestor', 'descendant'],
                name='uq_cat_hier_anc_desc'
            )
        ]
        indexes = [
            models.Index(
                fields=['ancestor', 'descendant'],
                name='cat_hier_anc_desc_idx',
            ),
            models.Index(
                fields=['descendant', 'ancestor'],
                name='cat_hier_desc_anc_idx',
            ),
        ]

    def __str__(self):
        return f"{self.ancestor_id} -> {self.descendant_id} (depth={self.depth})"

    @classmethod
    def rebuild_for_descendants(cls, descendant_ids, batch_size=1000):
        if not descendant_ids:
            return

        ids = {int(pk) for pk in descendant_ids if pk is not None}
        if not ids:
            return

        cls.objects.filter(descendant_id__in=ids).delete()

        parent_map = dict(
            Categoria.objects.all().values_list('pk', 'id_categoria_pai_id')
        )
        to_create = []
        for descendant_id in ids:
            if descendant_id not in parent_map:
                continue
            depth = 0
            current_id = descendant_id
            visited = set()
            while current_id is not None and current_id not in visited:
                visited.add(current_id)
                to_create.append(cls(
                    ancestor_id=current_id,
                    descendant_id=descendant_id,
                    depth=depth,
                ))
                depth += 1
                current_id = parent_map.get(current_id)

        if to_create:
            cls.objects.bulk_create(to_create, batch_size=batch_size)

    @classmethod
    def rebuild_tree(cls, batch_size=1000):
        parent_map = dict(
            Categoria.objects.all().values_list('pk', 'id_categoria_pai_id')
        )
        cls.objects.all().delete()

        to_create = []
        for descendant_id in parent_map.keys():
            depth = 0
            current_id = descendant_id
            visited = set()
            while current_id is not None and current_id not in visited:
                visited.add(current_id)
                to_create.append(cls(
                    ancestor_id=current_id,
                    descendant_id=descendant_id,
                    depth=depth,
                ))
                depth += 1
                current_id = parent_map.get(current_id)

        if to_create:
            cls.objects.bulk_create(to_create, batch_size=batch_size)


class Pergunta(models.Model):
    """
    Representa uma pergunta do quiz.
    """
    codigo_importacao = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        blank=True,
        null=True,
        verbose_name="Código de Importação",
        help_text="Identificador externo usado durante processos de importação. Deixe em branco para gerar automaticamente.",
    )
    texto_pergunta = models.TextField(verbose_name="Texto da Pergunta")
    slug = models.SlugField(
        max_length=220,
        unique=True,
        blank=True,
        verbose_name="Slug legível",
        help_text="Identificador amigável usado nas URLs públicas da pergunta.",
    )
    url_imagem = models.URLField(
        max_length=512,
        blank=True,
        null=True,
        verbose_name="URL da Imagem (Opcional)"
    )
    referencia_bibliografica = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="Referência Bibliográfica"
    )
    categorias = models.ManyToManyField(
        Categoria,
        related_name='perguntas_associadas',
        verbose_name="Categorias",
        help_text="Selecione uma ou mais categorias para esta pergunta."
    )

    class NivelDificuldade(models.TextChoices):
        FACIL = 'Fácil', 'Fácil'
        MEDIO = 'Médio', 'Médio'
        DIFICIL = 'Difícil', 'Difícil'

    nivel_dificuldade = models.CharField(
        max_length=50,
        choices=NivelDificuldade.choices,
        default=NivelDificuldade.MEDIO,
        verbose_name="Nível de Dificuldade"
    )
    explicacao_resposta = models.TextField(
        blank=True,
        null=True,
        help_text="Explicação detalhada da resposta correta ou do tópico da pergunta.",
        verbose_name="Explicação da Resposta"
    )
    ativa = models.BooleanField(
        default=True,
        verbose_name="Ativa",
        help_text="Perguntas inativas não aparecerão nos quizzes."
    )
    id_usuario_criador = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='perguntas_criadas',
        verbose_name="Criador da Pergunta"
    )
    data_criacao = models.DateTimeField(auto_now_add=True, verbose_name="Data de Criação")
    data_atualizacao = models.DateTimeField(auto_now=True, verbose_name="Data de Atualização")

    def __str__(self):
        return f"P{self.pk}: {self.texto_pergunta[:70]}..."

    def save(self, *args, **kwargs):
        if not self.slug:
            base_value = self.texto_pergunta[:140] if self.texto_pergunta else self.codigo_importacao or ''
            self.slug = _generate_unique_slug(self, base_value, max_length=220, default_prefix='pergunta')
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        base_url = reverse('quiz:questions')
        return f"{base_url}?question_id={self.pk}"

    class Meta:
        verbose_name = "Pergunta do Quiz"
        verbose_name_plural = "Perguntas do Quiz"
        ordering = ['-data_criacao']


class OpcaoResposta(models.Model):
    """
    Representa uma opção de resposta para uma Pergunta.
    """
    codigo_importacao = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        blank=True,
        null=True,
        verbose_name="Código de Importação",
        help_text="Identificador externo usado durante processos de importação. Deixe em branco para gerar automaticamente.",
    )
    pergunta = models.ForeignKey(
        Pergunta,
        related_name='opcoes',
        on_delete=models.CASCADE,
        verbose_name="Pergunta Associada"
    )
    texto_opcao = models.TextField(verbose_name="Texto da Opção")
    eh_correta = models.BooleanField(
        default=False,
        verbose_name="É Correta?",
        help_text="Marque se esta é a opção correta para a pergunta."
    )
    ordem_exibicao = models.PositiveIntegerField(
        default=0,
        help_text="Usado para ordenar as opções na exibição, se necessário (0, 1, 2...).",
        verbose_name="Ordem de Exibição"
    )
    feedback_opcao = models.TextField(
        blank=True,
        null=True,
        help_text="Feedback específico para esta opção, exibido após o usuário responder.",
        verbose_name="Feedback da Opção (Opcional)"
    )
    data_criacao = models.DateTimeField(auto_now_add=True, verbose_name="Data de Criação")
    data_atualizacao = models.DateTimeField(auto_now=True, verbose_name="Data de Atualização")

    def __str__(self):
        return f"Opção ({self.pk}) para P{self.pergunta.pk}: {self.texto_opcao[:50]}..."

    class Meta:
        verbose_name = "Opção de Resposta"
        verbose_name_plural = "Opções de Resposta"
        ordering = ['pergunta', 'ordem_exibicao', 'pk']
        # Garante que para uma pergunta, a ordem de exibição seja única se você quiser usar isso como um controle rígido.
        # unique_together = ('pergunta', 'ordem_exibicao') # Descomente se a ordem DEVE ser única por pergunta.

# --- Modelos de Configuração e Definição de Quizzes ---

class QuizDefinicao(models.Model):
    """Modelo para definir quizzes pré-configurados com estratégias flexíveis."""

    class GenerationType(models.TextChoices):
        MANUAL = "manual", "Lista fixa de perguntas"
        FAVORITES = "favorites", "Revisão de favoritos do usuário"
        REPEAT_LAST = "repeat_last", "Repetir último modo executado"
        FILTERS = "filters", "Gerado a partir de filtros dinâmicos"

    nome_quiz = models.CharField(
        max_length=200,
        unique=True,
        verbose_name="Nome do Quiz Definido"
    )
    slug = models.SlugField(
        max_length=180,
        unique=True,
        blank=True,
        verbose_name="Slug legível",
        help_text="Identificador amigável usado nas URLs públicas do desafio/quiz.",
    )
    descricao = models.TextField(
        blank=True,
        null=True,
        verbose_name="Descrição do Quiz"
    )
    perguntas = models.ManyToManyField(
        Pergunta,
        through='QuizDefinicaoPergunta',
        related_name='definicoes_quiz_associadas',
        verbose_name="Perguntas do Quiz"
    )
    ativo = models.BooleanField(
        default=True,
        verbose_name="Quiz Ativo",
        help_text="Se este quiz pode ser selecionado pelos usuários."
    )
    generation_type = models.CharField(
        max_length=40,
        choices=GenerationType.choices,
        default=GenerationType.MANUAL,
        verbose_name="Estratégia de geração",
        help_text="Define como as perguntas serão selecionadas ao iniciar este quiz.",
    )
    generation_config = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Configurações dinâmicas",
        help_text="Parâmetros extras utilizados pelas estratégias dinâmicas (limites, filtros, ordenação, etc).",
    )
    study_method_override = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="Método de estudo preferencial",
        help_text="Se definido, aplica automaticamente este método de estudo ao iniciar o quiz.",
    )
    score_panel_overrides = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Ajustes do Painel de Pontuação",
        help_text=(
            "Permite personalizar a visibilidade dos itens do painel lateral "
            "para cada modo de quiz suportado."
        ),
    )
    data_criacao = models.DateTimeField(auto_now_add=True, verbose_name="Data de Criação")
    data_atualizacao = models.DateTimeField(auto_now=True, verbose_name="Data de Atualização")

    def __str__(self):
        return self.nome_quiz

    def _sanitize_generation_config(self) -> Dict[str, object]:
        if isinstance(self.generation_config, dict):
            return self.generation_config
        return {}

    def get_generation_config(self) -> Dict[str, object]:
        """Retorna a configuração dinâmica sanitizada."""

        return self._sanitize_generation_config()

    def get_estimated_question_count(self) -> Optional[int]:
        """Estimativa amigável da quantidade de perguntas desta definição."""

        if self.generation_type == self.GenerationType.MANUAL:
            return self.perguntas.count()

        config = self.get_generation_config()
        limit = config.get("limit") or config.get("question_limit")
        if isinstance(limit, int) and limit > 0:
            return limit

        if self.generation_type == self.GenerationType.REPEAT_LAST:
            ids = config.get("question_ids")
            if isinstance(ids, list):
                return len(ids)

        minimum_expected = config.get("minimum_expected")
        if isinstance(minimum_expected, int):
            return minimum_expected
        try:
            return int(minimum_expected)
        except (TypeError, ValueError):
            return None

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = _generate_unique_slug(self, self.nome_quiz, max_length=180, default_prefix='quiz')
        self.score_panel_overrides = sanitize_score_panel_config(self.score_panel_overrides)
        self.generation_config = self._sanitize_generation_config()
        super().save(*args, **kwargs)

    def get_score_panel_overrides(self) -> Dict[str, Dict[str, bool]]:
        return sanitize_score_panel_config(self.score_panel_overrides)

    def get_absolute_url(self):
        base_url = reverse('quiz:questions')
        if not self.slug:
            return base_url
        return f"{base_url}?predefined_slug={self.slug}#challenge-hub-container"

    class Meta:
        verbose_name = "Definição de Quiz"
        verbose_name_plural = "Definições de Quizzes"
        ordering = ['nome_quiz']


class QuizDefinicaoPergunta(models.Model):
    """
    Modelo intermediário para o relacionamento ManyToMany entre QuizDefinicao e Pergunta.
    Armazena a ordem de cada pergunta dentro de uma definição de quiz específica.
    """
    quiz_definicao = models.ForeignKey(
        QuizDefinicao,
        on_delete=models.CASCADE,
        verbose_name="Definição do Quiz"
    )
    pergunta = models.ForeignKey(
        Pergunta,
        on_delete=models.CASCADE,
        verbose_name="Pergunta"
    )
    ordem = models.PositiveIntegerField(
        verbose_name="Ordem no Quiz",
        help_text="Define a posição da pergunta dentro deste quiz (começando em 0 ou 1).",
        validators=[MinValueValidator(0)]
    )

    class Meta:
        verbose_name = "Pergunta em Definição de Quiz"
        verbose_name_plural = "Perguntas em Definições de Quizzes"
        ordering = ['quiz_definicao', 'ordem']
        unique_together = (
            ('quiz_definicao', 'pergunta'), # Uma pergunta não pode aparecer duas vezes no mesmo quiz
            ('quiz_definicao', 'ordem')     # A ordem deve ser única dentro de um quiz
        )

    def __str__(self):
        return f"'{self.pergunta.texto_pergunta[:30]}...' no quiz '{self.quiz_definicao.nome_quiz}' (Ordem: {self.ordem})"



class UserPreferences(models.Model):
    """Armazena as preferências do usuário relacionadas à experiência na plataforma."""

    class ThemePreference(models.TextChoices):
        LIGHT = 'light', 'Claro'
        DARK = 'dark', 'Escuro'

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='preferences',
        verbose_name='Usuário',
    )
    theme_preference = models.CharField(
        max_length=20,
        choices=ThemePreference.choices,
        default=ThemePreference.LIGHT,
        verbose_name='Tema da Interface',
        help_text='Define a aparência padrão utilizada na interface.',
    )
    receive_product_updates = models.BooleanField(
        default=True,
        verbose_name='Receber novidades do MedQuiz',
        help_text='Recebe emails com atualizações importantes e comunicados.',
    )
    receive_progress_reports = models.BooleanField(
        default=False,
        verbose_name='Receber resumos de progresso',
        help_text='Recebe um resumo periódico com seus indicadores de estudo.',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Preferência do Usuário'
        verbose_name_plural = 'Preferências dos Usuários'

    def __str__(self):
        return f"Preferências de {self.user.get_username()}"

    @property
    def email_preferences(self):
        """Retorna um dicionário resumindo as preferências de email."""
        return {
            'product_updates': self.receive_product_updates,
            'progress_reports': self.receive_progress_reports,
        }


# --- Modelos de Interação do Usuário e Estatísticas ---

class SessoesQuizUsuario(models.Model):
    """
    Registra cada sessão de quiz iniciada por um usuário.
    """
    id_usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="sessoes_quiz",
        verbose_name="Usuário"
    )
    id_quiz_definicao = models.ForeignKey(
        QuizDefinicao,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="sessoes_realizadas",
        verbose_name="Quiz Pré-definido (se aplicável)",
        help_text="Se esta sessão foi baseada em um quiz pré-definido."
    )
    data_inicio = models.DateTimeField(default=timezone.now, verbose_name="Data de Início")
    data_fim = models.DateTimeField(null=True, blank=True, verbose_name="Data de Fim")
    tempo_total_segundos = models.IntegerField(
        null=True, blank=True, verbose_name="Tempo Total (s)",
        validators=[MinValueValidator(0)]
    )
    pontuacao_final = models.IntegerField(default=0, verbose_name="Pontuação Final")
    total_perguntas_sessao = models.IntegerField(
        default=0,
        verbose_name="Total de Perguntas na Sessão",
        validators=[MinValueValidator(0)]
    )
    total_acertos = models.IntegerField(default=0, verbose_name="Total de Acertos", validators=[MinValueValidator(0)])
    total_erros = models.IntegerField(default=0, verbose_name="Total de Erros", validators=[MinValueValidator(0)])
    xp_total_sessao = models.IntegerField(
        default=0,
        verbose_name="XP Ganha na Sessão",
        validators=[MinValueValidator(0)],
        help_text="Experiência total acumulada pelo usuário nesta sessão.",
    )
    sequencia_acertos_atual = models.IntegerField(
        default=0,
        verbose_name="Sequência Atual de Acertos",
        validators=[MinValueValidator(0)],
    )
    melhor_sequencia_acertos = models.IntegerField(
        default=0,
        verbose_name="Melhor Sequência de Acertos",
        validators=[MinValueValidator(0)],
        help_text="Maior sequência contínua de acertos registrada na sessão.",
    )

    class ModoQuiz(models.TextChoices):
        POR_CATEGORIA = 'Por Categoria', 'Por Categoria'
        RAPIDO = 'Rápido', 'Rápido'
        DEFINIDO = 'Definido', 'Pré-Definido' # Quiz baseado em QuizDefinicao

    modo_quiz = models.CharField(
        max_length=50,
        choices=ModoQuiz.choices,
        verbose_name="Modo do Quiz"
    )
    metodo_estudo = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        default='random',
        verbose_name="Método de Estudo",
        help_text="Identificador do algoritmo utilizado para selecionar as perguntas da sessão.",
    )

    class StatusSessao(models.TextChoices):
        EM_ANDAMENTO = 'Em Andamento', 'Em Andamento'
        COMPLETA = 'Completa', 'Completa'
        ABANDONADA = 'Abandonada', 'Abandonada'

    status_sessao = models.CharField(
        max_length=50,
        choices=StatusSessao.choices,
        default=StatusSessao.EM_ANDAMENTO,
        verbose_name="Status da Sessão"
    )

    # Filtros usados para gerar o quiz (se não for modo 'Definido')
    categorias_selecionadas = models.ManyToManyField(
        Categoria,
        blank=True,
        related_name="sessoes_filtradas_por_categoria",
        verbose_name="Categorias Selecionadas (Modo Categoria)"
    )
    dificuldades_selecionadas_json = models.JSONField(
        blank=True, null=True,
        help_text="Lista de níveis de dificuldade selecionados, ex: ['Fácil', 'Médio'] ou ['all']",
        verbose_name='Níveis de Dificuldade Selecionados (JSON)'
    )
    num_questoes_solicitadas = models.PositiveIntegerField(
        blank=True, null=True,
        help_text='Número de questões que o usuário pediu (para modo personalizado ou rápido)',
        verbose_name='Número de Questões Solicitadas'
    )

    # Para "Continuar de Onde Parou" e log detalhado da sessão
    ids_perguntas_json = models.JSONField(
        null=True, blank=True,
        verbose_name="IDs Ordenados das Perguntas da Sessão",
        help_text="Lista dos IDs das perguntas que compõem esta sessão, na ordem em que foram apresentadas."
    )
    indice_ultima_pergunta_vista = models.PositiveIntegerField(
        null=True, blank=True,
        verbose_name="Índice da Última Pergunta Vista",
        help_text="Índice (base 0) na lista 'IDs Ordenados das Perguntas da Sessão' que o usuário visualizou por último.",
        validators=[MinValueValidator(0)]
    )

    def clean(self):
        super().clean()
        if self.data_fim and self.data_inicio and self.data_fim < self.data_inicio:
            raise ValidationError({'data_fim': 'A data de fim não pode ser anterior à data de início.'})
        if self.total_acertos > self.total_perguntas_sessao:
            raise ValidationError({'total_acertos': 'O número de acertos não pode ser maior que o total de perguntas.'})
        if self.total_erros > self.total_perguntas_sessao:
            raise ValidationError({'total_erros': 'O número de erros não pode ser maior que o total de perguntas.'})
        if self.xp_total_sessao < 0:
            raise ValidationError({'xp_total_sessao': 'O XP total da sessão deve ser zero ou positivo.'})
        if self.sequencia_acertos_atual < 0:
            raise ValidationError({'sequencia_acertos_atual': 'Sequência atual não pode ser negativa.'})
        if self.melhor_sequencia_acertos < 0:
            raise ValidationError({'melhor_sequencia_acertos': 'Melhor sequência não pode ser negativa.'})
        
        # Validação de modo_quiz e id_quiz_definicao
        if self.modo_quiz == self.ModoQuiz.DEFINIDO and not self.id_quiz_definicao:
            raise ValidationError({'id_quiz_definicao': 'Um Quiz Pré-Definido deve ser selecionado para o modo "Definido".'})
        if self.modo_quiz != self.ModoQuiz.DEFINIDO and self.id_quiz_definicao:
            self.id_quiz_definicao = None # Garante que não haja quiz_definicao se não for modo 'Definido'
            # Ou raise ValidationError ... dependendo da sua preferência de UX no admin.
            # raise ValidationError({'id_quiz_definicao': 'Quiz Pré-Definido só deve ser associado a sessões do modo "Definido".'})

        # Validação do índice da última pergunta
        if self.ids_perguntas_json and self.indice_ultima_pergunta_vista is not None:
            if not isinstance(self.ids_perguntas_json, list):
                 raise ValidationError({'ids_perguntas_json': 'Deve ser uma lista de IDs de perguntas.'})
            if self.indice_ultima_pergunta_vista >= len(self.ids_perguntas_json):
                raise ValidationError({'indice_ultima_pergunta_vista': 'Índice fora do intervalo da lista de perguntas da sessão.'})

    @property
    def duracao_sessao_formatada(self):
        # ... (implementação existente) ...
        if self.tempo_total_segundos is not None and self.tempo_total_segundos >= 0:
            total_seconds = self.tempo_total_segundos
        elif self.data_fim and self.data_inicio:
            duracao = self.data_fim - self.data_inicio
            total_seconds = int(duracao.total_seconds())
        else:
            return "Em andamento"

        if total_seconds < 0: return "Inválida"

        hours, remainder = divmod(total_seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        if hours > 0:
            return f"{hours}h {minutes:02d}m {seconds:02d}s"
        elif minutes > 0:
            return f"{minutes}m {seconds:02d}s"
        return f"{seconds}s"
    duracao_sessao_formatada.fget.short_description = "Duração"

    @property
    def percentual_acertos(self):
        # ... (implementação existente) ...
        if self.total_perguntas_sessao > 0:
            return round((self.total_acertos / self.total_perguntas_sessao) * 100, 1)
        return 0.0
    percentual_acertos.fget.short_description = "% Acertos"

    def __str__(self):
        username = self.id_usuario.get_username()
        quiz_info = self.id_quiz_definicao.nome_quiz if self.modo_quiz == self.ModoQuiz.DEFINIDO and self.id_quiz_definicao else self.modo_quiz
        return f"Sessão {self.pk} - {username} ({self.data_inicio.strftime('%d/%m/%y %H:%M')}) - {quiz_info}"

    class Meta:
        verbose_name = "Sessão de Quiz do Usuário"
        verbose_name_plural = "Sessões de Quiz dos Usuários"
        ordering = ['-data_inicio']


class RespostasUsuarioPorSessao(models.Model):
    """
    Registra a resposta específica de um usuário a uma pergunta dentro de uma sessão.
    """
    id_sessao_quiz = models.ForeignKey(
        SessoesQuizUsuario,
        on_delete=models.CASCADE,
        related_name="respostas_dadas",
        verbose_name="Sessão do Quiz"
    )
    id_pergunta = models.ForeignKey(
        Pergunta,
        on_delete=models.CASCADE,
        related_name="respostas_dadas_em_sessoes",
        verbose_name="Pergunta"
    )
    id_opcao_resposta_selecionada = models.ForeignKey(
        OpcaoResposta,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="vezes_selecionada_em_respostas", # Alterado para mais clareza
        verbose_name="Opção Selecionada"
    )
    foi_correta = models.BooleanField(
        null=True,
        blank=True,
        verbose_name="Foi Correta?",
        help_text="True se correta, False se incorreta, Nulo se pulada/não respondida."
    )
    data_resposta = models.DateTimeField(default=timezone.now, verbose_name="Data da Resposta")
    pontos_obtidos = models.IntegerField(
        default=0,
        verbose_name="Pontos da Resposta",
        help_text="Pontuação líquida obtida nesta resposta específica.",
    )
    xp_obtido = models.IntegerField(
        default=0,
        verbose_name="XP Obtido",
        help_text="Experiência concedida por esta resposta.",
        validators=[MinValueValidator(0)],
    )
    multiplicador_aplicado = models.FloatField(
        default=1.0,
        verbose_name="Multiplicador Aplicado",
        help_text="Fator de multiplicação aplicado em função de bônus de sequência.",
    )

    def __str__(self):
        status_resposta = "Pulada/Não Avaliada"
        if self.id_opcao_resposta_selecionada:
            if self.foi_correta is True:
                status_resposta = "Correta"
            elif self.foi_correta is False:
                status_resposta = "Incorreta"
        return f"Resposta à P{self.id_pergunta.pk} na Sessão {self.id_sessao_quiz.pk}: {status_resposta}"

    class Meta:
        verbose_name = "Resposta do Usuário por Sessão"
        verbose_name_plural = "Respostas dos Usuários por Sessão"
        unique_together = ('id_sessao_quiz', 'id_pergunta')
        ordering = ['id_sessao_quiz', 'data_resposta']


class UserQuestionStudyState(models.Model):
    """Rastreia o desempenho individual por pergunta para apoiar métodos adaptativos."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='question_study_states',
        verbose_name="Usuário",
    )
    pergunta = models.ForeignKey(
        Pergunta,
        on_delete=models.CASCADE,
        related_name='study_states',
        verbose_name="Pergunta",
    )
    last_reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Última Revisão",
    )
    due_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Próxima Revisão",
    )
    repetitions = models.PositiveIntegerField(
        default=0,
        verbose_name="Repetições",
    )
    interval_days = models.PositiveIntegerField(
        default=1,
        verbose_name="Intervalo (dias)",
    )
    easiness_factor = models.FloatField(
        default=2.5,
        verbose_name="Fator de Facilidade",
        help_text="Parâmetro do algoritmo SM-2 usado para revisão espaçada.",
    )
    correct_streak = models.PositiveIntegerField(
        default=0,
        verbose_name="Sequência de Acertos",
    )
    incorrect_streak = models.PositiveIntegerField(
        default=0,
        verbose_name="Sequência de Erros",
    )
    total_correct = models.PositiveIntegerField(
        default=0,
        verbose_name="Total de Acertos",
    )
    total_incorrect = models.PositiveIntegerField(
        default=0,
        verbose_name="Total de Erros",
    )
    last_outcome = models.BooleanField(
        null=True,
        blank=True,
        verbose_name="Último Resultado",
        help_text="True para acerto, False para erro, None para não respondida.",
    )
    last_session = models.ForeignKey(
        'SessoesQuizUsuario',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='study_state_entries',
        verbose_name="Última Sessão",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Criado em")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Atualizado em")

    class Meta:
        verbose_name = "Estado de Estudo da Pergunta"
        verbose_name_plural = "Estados de Estudo das Perguntas"
        unique_together = ('user', 'pergunta')
        ordering = ['user', 'pergunta']

    def __str__(self):
        username = self.user.get_username()
        return f"{username} • P{self.pergunta_id}"


class EstatisticasDiariasUsuario(models.Model):
    """
    Agrega estatísticas diárias de desempenho do usuário.
    """
    id_usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="estatisticas_diarias",
        verbose_name="Usuário"
    )
    data_estatistica = models.DateField(verbose_name="Data da Estatística")
    perguntas_respondidas_dia = models.IntegerField(default=0, verbose_name="Perguntas Respondidas", validators=[MinValueValidator(0)])
    acertos_dia = models.IntegerField(default=0, verbose_name="Acertos no Dia", validators=[MinValueValidator(0)])
    pontos_dia = models.IntegerField(default=0, verbose_name="Pontos Ganhos no Dia")
    xp_ganho_dia = models.IntegerField(
        default=0,
        verbose_name="XP Ganhado no Dia",
        validators=[MinValueValidator(0)],
    )
    sequencia_dias_quiz = models.IntegerField(default=0, verbose_name="Sequência de Dias Consecutivos de Quiz", validators=[MinValueValidator(0)])
    tempo_estudo_segundos_dia = models.IntegerField(default=0, verbose_name="Tempo de Estudo no Dia (segundos)", validators=[MinValueValidator(0)])
    data_atualizacao_estatistica = models.DateTimeField(auto_now=True, verbose_name="Última Atualização")

    def clean(self):
        super().clean()
        if self.acertos_dia > self.perguntas_respondidas_dia:
            raise ValidationError({'acertos_dia': 'O número de acertos não pode ser maior que o de perguntas respondidas.'})

    @property
    def tempo_estudo_formatado(self):
        # ... (implementação existente) ...
        if self.tempo_estudo_segundos_dia is not None and self.tempo_estudo_segundos_dia >= 0:
            total_seconds = self.tempo_estudo_segundos_dia
            hours, remainder = divmod(total_seconds, 3600)
            minutes, _ = divmod(remainder, 60)
            if hours > 0:
                return f"{hours}h {minutes:02d}m"
            return f"{minutes}m"
        return "0m"
    tempo_estudo_formatado.fget.short_description = "Tempo de Estudo (Formatado)"

    @property
    def precisao_dia(self):
        # ... (implementação existente) ...
        if self.perguntas_respondidas_dia > 0:
            return round((self.acertos_dia / self.perguntas_respondidas_dia) * 100, 1)
        return 0.0
    precisao_dia.fget.short_description = "% Precisão no Dia"

    def __str__(self):
        username = self.id_usuario.get_username()
        return f"Estatísticas de {username} para {self.data_estatistica.strftime('%d/%m/%Y')}"

    class Meta:
        verbose_name = "Estatística Diária do Usuário"
        verbose_name_plural = "Estatísticas Diárias dos Usuários"
        unique_together = ('id_usuario', 'data_estatistica')
        ordering = ['id_usuario', '-data_estatistica']


class QuestaoFavorita(models.Model):
    """
    Registra as perguntas favoritadas por cada usuário.
    """
    usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='questoes_favoritas',
        verbose_name="Usuário"
    )
    pergunta = models.ForeignKey(
        Pergunta,
        on_delete=models.CASCADE,
        related_name='favoritada_por_usuarios', # Alterado para mais clareza
        verbose_name="Pergunta"
    )
    data_favoritada = models.DateTimeField(auto_now_add=True, verbose_name="Data de Inclusão nos Favoritos")

    class Meta:
        verbose_name = "Questão Favorita do Usuário"
        verbose_name_plural = "Questões Favoritas dos Usuários"
        unique_together = ('usuario', 'pergunta')
        ordering = ['-data_favoritada']

    def __str__(self):
        return f"'{self.pergunta.texto_pergunta[:30]}...' favorita de {self.usuario.username}"


class QuestionIssueReport(models.Model):
    """Armazena relatos de problemas enviados pelos usuários para perguntas específicas."""

    ORIGEM_SESSAO = 'quiz_session'
    ORIGEM_REVIEW = 'review'
    ORIGEM_OUTRA = 'other'

    ORIGEM_CHOICES = (
        (ORIGEM_SESSAO, 'Sessão de Quiz'),
        (ORIGEM_REVIEW, 'Revisão de Questões'),
        (ORIGEM_OUTRA, 'Outra'),
    )

    class Categoria(models.TextChoices):
        GABARITO = 'answer_key', 'Gabarito incorreto'
        ENUNCIADO = 'statement', 'Enunciado confuso ou incompleto'
        OPCAO = 'option_issue', 'Alternativa ambígua ou incorreta'
        REFERENCIA = 'reference_issue', 'Explicação ou referência desatualizada'
        OUTRO = 'other', 'Outro problema no conteúdo'

    pergunta = models.ForeignKey(
        Pergunta,
        on_delete=models.CASCADE,
        related_name='issue_reports',
        verbose_name='Pergunta relatada',
    )
    usuario = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='question_issue_reports',
        verbose_name='Usuário (opcional)',
    )
    descricao = models.TextField(verbose_name='Descrição do problema')
    origem = models.CharField(
        max_length=24,
        choices=ORIGEM_CHOICES,
        default=ORIGEM_SESSAO,
        verbose_name='Origem do relato',
    )
    criado_em = models.DateTimeField(auto_now_add=True, verbose_name='Data de criação')
    categoria = models.CharField(
        max_length=32,
        choices=Categoria.choices,
        default=Categoria.GABARITO,
        verbose_name='Categoria do relato',
        help_text='Classificação rápida do tipo de problema apontado.',
    )

    class Meta:
        verbose_name = 'Relato de Problema da Questão'
        verbose_name_plural = 'Relatos de Problemas das Questões'
        ordering = ['-criado_em']

    def __str__(self):
        identificador = f'#{self.pergunta_id}'
        if self.pergunta and self.pergunta.slug:
            identificador = f'{identificador} ({self.pergunta.slug})'
        usuario = (
            self.usuario.get_full_name()
            or self.usuario.username
            if self.usuario
            else 'anônimo'
        )
        categoria_display = dict(self.Categoria.choices).get(self.categoria, self.categoria)
        return f'Relato {identificador} [{categoria_display}] por {usuario} em {self.criado_em:%d/%m/%Y}'


class SupportRequest(models.Model):
    """Centraliza reclamações e dúvidas enviadas diretamente pelo site."""

    ORIGEM_GERAL = 'general'
    ORIGEM_MENSAGEM = 'inline_message'

    ORIGEM_CHOICES = (
        (ORIGEM_GERAL, 'Formulário geral'),
        (ORIGEM_MENSAGEM, 'Ação do sistema'),
    )

    class TipoContato(models.TextChoices):
        SUPORTE_GERAL = 'general', 'Dúvida ou orientação'
        PROBLEMA_TECNICO = 'technical_issue', 'Problema técnico'
        CONTEUDO = 'content_error', 'Erro em conteúdo'
        SUGESTAO = 'improvement', 'Sugestão de melhoria'

    class Status(models.TextChoices):
        ABERTO = 'open', 'Aberto'
        EM_ANALISE = 'in_progress', 'Em análise'
        RESOLVIDO = 'resolved', 'Resolvido'
        ARQUIVADO = 'archived', 'Arquivado'

    usuario = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='support_requests',
        verbose_name='Usuário',
    )
    nome = models.CharField(
        max_length=150,
        blank=True,
        verbose_name='Nome de contato',
    )
    email = models.EmailField(
        blank=True,
        verbose_name='E-mail de contato',
    )
    mensagem = models.TextField(verbose_name='Mensagem')
    origem = models.CharField(
        max_length=32,
        choices=ORIGEM_CHOICES,
        default=ORIGEM_GERAL,
        verbose_name='Origem do relato',
    )
    tipo_contato = models.CharField(
        max_length=32,
        choices=TipoContato.choices,
        default=TipoContato.SUPORTE_GERAL,
        verbose_name='Tipo de contato',
        help_text='Ajuda a classificar rapidamente o motivo principal do contato.',
    )
    status = models.CharField(
        max_length=24,
        choices=Status.choices,
        default=Status.ABERTO,
        verbose_name='Status',
    )
    contexto = models.JSONField(
        blank=True,
        null=True,
        verbose_name='Contexto adicional',
        help_text='Informações auxiliares como página, rota ou mensagem que gerou o contato.',
    )
    criado_em = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    atualizado_em = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Contato de Suporte'
        verbose_name_plural = 'Contatos de Suporte'
        ordering = ['-criado_em']

    def __str__(self):
        if self.usuario:
            remetente = self.nome or self.usuario.get_full_name() or self.usuario.username
        else:
            remetente = self.nome or 'visitante'
        origem_display = dict(self.ORIGEM_CHOICES).get(self.origem, self.origem)
        tipo_display = dict(self.TipoContato.choices).get(self.tipo_contato, self.tipo_contato)
        return f'{origem_display} · {tipo_display} · {remetente} ({self.criado_em:%d/%m/%Y})'


class ConfiguracoesGeraisQuiz(models.Model):
    """
    Modelo Singleton para armazenar configurações globais do sistema de quiz,
    gerenciáveis pelo Admin do Django.
    """
    numero_perguntas_quiz_rapido = models.PositiveIntegerField(
        default=10,
        verbose_name="Nº de Perguntas Padrão (Quiz Rápido)",
        help_text="Quantidade padrão de perguntas para o modo 'Quiz Rápido', caso o usuário não especifique."
    )
    pontuacao_por_acerto = models.IntegerField(
        default=15,
        verbose_name="Pontos por Acerto",
        help_text="Número de pontos concedidos por cada resposta correta."
    )
    penalidade_por_erro = models.IntegerField(
        default=5,
        verbose_name="Penalidade por Erro",
        help_text="Número de pontos deduzidos por cada resposta incorreta (use 0 se não houver penalidade)."
    )
    configuracao_pontuacao_dificuldade = models.JSONField(
        default=default_difficulty_rewards,
        verbose_name="Regras de Pontuação por Dificuldade",
        help_text=(
            "Estrutura JSON com pontos, XP e penalidades por nível de dificuldade. "
            "Exemplo: {'Fácil': {'points': 10, 'xp': 5, 'penalty': 2}}"
        ),
    )
    bonus_sequencia_acertos = models.JSONField(
        default=default_streak_bonus_rules,
        verbose_name="Bônus por Sequência de Acertos",
        help_text=(
            "Lista ordenada de objetos contendo 'streak' e 'bonus_percent', representando o aumento percentual "
            "aplicado ao acerto conforme a sequência atual."
        ),
    )
    multiplicador_bonus_maximo = models.FloatField(
        default=2.0,
        verbose_name="Multiplicador Máximo de Bônus",
        help_text="Limita o multiplicador total aplicado por bônus de sequência para evitar valores extremos.",
        validators=[MinValueValidator(1.0)],
    )
    score_panel_config = models.JSONField(
        default=default_score_panel_config,
        verbose_name="Configurações do Painel de Pontuação",
        help_text=(
            "Mapa JSON que define a visibilidade e permissões do painel de pontuação "
            "para cada modo de quiz (Por Categoria, Rápido e Definido)."
        ),
    )
    # Adicione outros campos de configuração global aqui conforme necessário
    # Ex: permitir_pular_questoes = models.BooleanField(default=True, ...)
    # Ex: tempo_limite_padrao_quiz_minutos = models.PositiveIntegerField(default=30, ...)

    data_modificacao = models.DateTimeField(auto_now=True, verbose_name="Última Modificação")

    def __str__(self):
        return "Configurações Gerais do Quiz"

    def save(self, *args, **kwargs):
        # Garante que apenas uma instância deste modelo exista
        if not self.pk and ConfiguracoesGeraisQuiz.objects.exists():
            raise ValidationError('Só pode haver uma instância de ConfiguracoesGeraisQuiz. Edite a existente.')
        if self.penalidade_por_erro < 0:
            raise ValidationError({'penalidade_por_erro': 'A penalidade por erro não pode ser negativa.'})
        self._validate_dificuldades()
        self._validate_bonus()
        self.score_panel_config = sanitize_score_panel_config(self.score_panel_config)
        result = super().save(*args, **kwargs)
        try:
            from .views import invalidate_quiz_config_cache
            invalidate_quiz_config_cache()
        except ImportError:
            # Durante alguns fluxos de import (como migrações) as views podem não estar disponíveis.
            pass
        return result

    def _validate_dificuldades(self) -> None:
        payload = self.configuracao_pontuacao_dificuldade or {}
        if not isinstance(payload, dict):
            raise ValidationError({'configuracao_pontuacao_dificuldade': 'A configuração deve ser um objeto JSON.'})

        required = {'points', 'xp', 'penalty'}
        for difficulty, rule in payload.items():
            if not isinstance(rule, dict):
                raise ValidationError({
                    'configuracao_pontuacao_dificuldade': f"A configuração de '{difficulty}' deve ser um objeto com pontos/xp/penalidade."
                })
            missing = required - set(rule.keys())
            if missing:
                raise ValidationError({
                    'configuracao_pontuacao_dificuldade': f"A configuração de '{difficulty}' está sem as chaves: {', '.join(sorted(missing))}."
                })
            for key in required:
                value = rule[key]
                if not isinstance(value, (int, float)):
                    raise ValidationError({
                        'configuracao_pontuacao_dificuldade': f"O valor de '{key}' para '{difficulty}' deve ser numérico."
                    })
                if key != 'penalty' and value < 0:
                    raise ValidationError({
                        'configuracao_pontuacao_dificuldade': f"O valor de '{key}' para '{difficulty}' deve ser não negativo."
                    })
                if key == 'penalty' and value < 0:
                    raise ValidationError({
                        'configuracao_pontuacao_dificuldade': f"A penalidade para '{difficulty}' deve ser zero ou positiva."
                    })

    def _validate_bonus(self) -> None:
        payload = self.bonus_sequencia_acertos or []
        if not isinstance(payload, list):
            raise ValidationError({'bonus_sequencia_acertos': 'A configuração deve ser uma lista de objetos ordenados.'})

        last_streak = 0
        for index, rule in enumerate(payload):
            if not isinstance(rule, dict):
                raise ValidationError({'bonus_sequencia_acertos': f"A posição {index} deve conter um objeto com 'streak' e 'bonus_percent'."})
            if 'streak' not in rule or 'bonus_percent' not in rule:
                raise ValidationError({'bonus_sequencia_acertos': f"A posição {index} deve conter as chaves 'streak' e 'bonus_percent'."})
            streak_value = rule['streak']
            bonus_value = rule['bonus_percent']
            if not isinstance(streak_value, int) or streak_value <= 0:
                raise ValidationError({'bonus_sequencia_acertos': f"O valor de sequência na posição {index} deve ser um inteiro positivo."})
            if streak_value <= last_streak:
                raise ValidationError({'bonus_sequencia_acertos': 'As sequências devem ser fornecidas em ordem crescente.'})
            if not isinstance(bonus_value, (int, float)):
                raise ValidationError({'bonus_sequencia_acertos': f"O bônus na posição {index} deve ser numérico."})
            last_streak = streak_value

    def _sanitize_score_panel_config(self, payload: Optional[Dict[str, Any]]) -> Dict[str, Dict[str, bool]]:
        """Mantido por compatibilidade retroativa com chamadas existentes."""

        return sanitize_score_panel_config(payload)

    @staticmethod
    def _apply_score_panel_override(
        base_settings: Dict[str, bool],
        override_settings: Optional[Dict[str, Any]],
    ) -> Dict[str, bool]:
        if not isinstance(override_settings, dict):
            return base_settings

        for key in base_settings.keys():
            if key in override_settings:
                base_settings[key] = bool(override_settings[key])
        return base_settings

    def get_score_panel_settings_for_mode(
        self,
        mode: Optional[str] = None,
        quiz_definicao: Optional['QuizDefinicao'] = None,
    ) -> Dict[str, bool]:
        sanitized = sanitize_score_panel_config(self.score_panel_config)
        resolved = deepcopy(sanitized.get('default', DEFAULT_SCORE_PANEL_SETTINGS))

        mode_key = str(mode) if mode else None
        if mode_key and mode_key in sanitized:
            resolved = self._apply_score_panel_override(resolved, sanitized.get(mode_key))

        if quiz_definicao is not None:
            overrides = quiz_definicao.get_score_panel_overrides()
            resolved = self._apply_score_panel_override(resolved, overrides.get('default'))
            if mode_key and mode_key in overrides:
                resolved = self._apply_score_panel_override(resolved, overrides.get(mode_key))

        return resolved

    def get_difficulty_rule(self, difficulty: str) -> Dict[str, float]:
        payload = self.configuracao_pontuacao_dificuldade or {}
        if difficulty in payload:
            return payload[difficulty]
        normalized = difficulty.lower()
        for key, value in payload.items():
            if key.lower() == normalized:
                return value
        return {
            'points': float(self.pontuacao_por_acerto),
            'xp': float(self.pontuacao_por_acerto),
            'penalty': float(self.penalidade_por_erro),
        }

    def get_bonus_percent_for_streak(self, streak: int) -> float:
        if streak <= 0:
            return 0.0
        applicable = 0.0
        for rule in self.bonus_sequencia_acertos or []:
            try:
                if streak >= int(rule.get('streak', 0)):
                    applicable = float(rule.get('bonus_percent', 0))
            except (TypeError, ValueError):
                continue
        return applicable

    def get_max_bonus_multiplier(self) -> float:
        try:
            return float(self.multiplicador_bonus_maximo)
        except (TypeError, ValueError):
            return 2.0

    class Meta:
        verbose_name = "Configuração Geral do Quiz"
        verbose_name_plural = "Configurações Gerais do Quiz" # Embora seja singleton, o admin usa isso.


class NivelGamificacao(models.Model):
    """Representa os níveis de progressão disponíveis na plataforma."""

    identificador = models.CharField(
        max_length=100,
        unique=True,
        verbose_name="Identificador Interno",
        help_text="Slug único para integrações ou referências em código.",
    )
    nome = models.CharField(max_length=150, verbose_name="Nome do Nível")
    descricao = models.TextField(blank=True, verbose_name="Descrição do Nível")
    ordem = models.PositiveIntegerField(
        default=1,
        verbose_name="Ordem de Exibição",
        help_text="Determina a ordem dos níveis (menor valor aparece primeiro).",
    )
    xp_minimo = models.PositiveIntegerField(verbose_name="XP Mínimo")
    xp_maximo = models.PositiveIntegerField(
        verbose_name="XP Máximo",
        null=True,
        blank=True,
        help_text="Opcional. Se vazio, considera-se que o nível não possui limite superior.",
    )
    recompensas_json = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Recompensas",
        help_text="Campo flexível para descrever benefícios concedidos ao alcançar o nível (ex: descontos, acesso antecipado).",
    )

    class Meta:
        verbose_name = "Nível de Gamificação"
        verbose_name_plural = "Níveis de Gamificação"
        ordering = ['ordem', 'xp_minimo']

    def __str__(self):
        return f"{self.nome} (XP {self.xp_minimo}+ )"

    def clean(self):
        super().clean()
        if self.xp_maximo is not None and self.xp_maximo < self.xp_minimo:
            raise ValidationError({'xp_maximo': 'O XP máximo deve ser maior ou igual ao XP mínimo.'})

    def get_reward_definitions(self) -> List[Dict[str, Any]]:
        """Normaliza o JSON de recompensas em uma lista de itens estruturados."""

        payload = self.recompensas_json or {}
        items: List[Dict[str, Any]] = []

        if isinstance(payload, dict):
            raw_items = payload.get('items') or payload.get('recompensas') or payload
        else:
            raw_items = payload

        if isinstance(raw_items, dict):
            for key, value in raw_items.items():
                if isinstance(value, dict):
                    normalized = {
                        'id': str(value.get('id') or key),
                        'nome': value.get('nome') or str(key).replace('_', ' ').title(),
                        'descricao': value.get('descricao') or value.get('description'),
                        'tipo': value.get('tipo'),
                        'valor': value.get('valor'),
                        'metadata': value.get('metadata') or {},
                    }
                else:
                    normalized = {
                        'id': str(key),
                        'nome': str(key).replace('_', ' ').title(),
                        'descricao': str(value),
                        'tipo': None,
                        'valor': value,
                        'metadata': {},
                    }
                items.append(normalized)
        elif isinstance(raw_items, list):
            for index, value in enumerate(raw_items):
                if isinstance(value, dict):
                    normalized = {
                        'id': str(value.get('id') or value.get('slug') or f'item-{index}'),
                        'nome': value.get('nome') or value.get('titulo') or value.get('title') or f'Recompensa {index + 1}',
                        'descricao': value.get('descricao') or value.get('description'),
                        'tipo': value.get('tipo'),
                        'valor': value.get('valor'),
                        'metadata': value.get('metadata') or {},
                    }
                else:
                    normalized = {
                        'id': f'item-{index}',
                        'nome': f'Recompensa {index + 1}',
                        'descricao': str(value),
                        'tipo': None,
                        'valor': value,
                        'metadata': {},
                    }
                items.append(normalized)

        deduped: Dict[str, Dict[str, Any]] = {}
        for item in items:
            identifier = item.get('id') or f"item-{len(deduped)}"
            if identifier in deduped:
                continue
            item['id'] = identifier
            deduped[identifier] = item

        return list(deduped.values())


class Conquista(models.Model):
    """Define conquistas/badges desbloqueáveis pelos usuários."""

    slug = models.SlugField(
        max_length=150,
        unique=True,
        verbose_name="Slug da Conquista",
        help_text="Identificador único usado para integrar regras de gamificação.",
    )
    nome = models.CharField(max_length=150, verbose_name="Nome da Conquista")
    descricao = models.TextField(blank=True, verbose_name="Descrição")
    criterio_json = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Critério",
        help_text="Estrutura flexível descrevendo a regra para desbloqueio (ex: {'tipo': 'xp_total', 'valor': 1000}).",
    )
    icone = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Ícone",
        help_text="Nome de ícone ou caminho para imagem a ser exibida ao usuário.",
    )
    ordem_exibicao = models.PositiveIntegerField(
        default=0,
        verbose_name="Ordem de Exibição",
        help_text="Permite priorizar a exibição de conquistas em coleções.",
    )

    class Meta:
        verbose_name = "Conquista"
        verbose_name_plural = "Conquistas"
        ordering = ['ordem_exibicao', 'nome']

    def __str__(self):
        return self.nome


class PerfilGamificacaoUsuario(models.Model):
    """Perfil agregador das métricas de gamificação de cada usuário."""

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='gamification_profile',
        verbose_name="Usuário",
    )
    xp_total = models.PositiveIntegerField(default=0, verbose_name="XP Total")
    nivel_atual = models.ForeignKey(
        NivelGamificacao,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='perfis_associados',
        verbose_name="Nível Atual",
    )
    melhor_sequencia_geral = models.PositiveIntegerField(
        default=0,
        verbose_name="Melhor Sequência Geral",
    )
    sequencia_atual = models.PositiveIntegerField(
        default=0,
        verbose_name="Sequência Atual",
    )
    conquistas = models.ManyToManyField(
        Conquista,
        through='ConquistaUsuario',
        related_name='perfis_dos_usuarios',
        blank=True,
        verbose_name="Conquistas Desbloqueadas",
    )
    ultima_atualizacao = models.DateTimeField(auto_now=True, verbose_name="Última Atualização")

    class Meta:
        verbose_name = "Perfil de Gamificação do Usuário"
        verbose_name_plural = "Perfis de Gamificação dos Usuários"

    def __str__(self):
        return f"Perfil de Gamificação de {self.user.get_username()}"

    def atualizar_nivel(self):
        """Atualiza o nível do usuário com base no XP total."""
        nivel_compativel = (
            NivelGamificacao.objects.filter(
                xp_minimo__lte=self.xp_total,
            )
            .filter(
                models.Q(xp_maximo__gte=self.xp_total) | models.Q(xp_maximo__isnull=True)
            )
            .order_by('ordem', 'xp_minimo')
            .last()
        )
        if nivel_compativel != self.nivel_atual:
            self.nivel_atual = nivel_compativel
            self.save(update_fields=['nivel_atual', 'ultima_atualizacao'])


class ConquistaUsuario(models.Model):
    """Relaciona um perfil de gamificação com uma conquista desbloqueada."""

    perfil = models.ForeignKey(
        PerfilGamificacaoUsuario,
        on_delete=models.CASCADE,
        related_name='conquistas_usuarios',
    )
    conquista = models.ForeignKey(
        Conquista,
        on_delete=models.CASCADE,
        related_name='desbloqueios',
    )
    data_conquista = models.DateTimeField(auto_now_add=True, verbose_name="Data da Conquista")
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Metadados",
        help_text="Informações extras sobre o desbloqueio (ex: motivo, valores alcançados).",
    )

    class Meta:
        verbose_name = "Conquista do Usuário"
        verbose_name_plural = "Conquistas dos Usuários"
        unique_together = ('perfil', 'conquista')
        ordering = ['-data_conquista']

    def __str__(self):
        return f"{self.perfil.user.get_username()} -> {self.conquista.nome}"


class DesafioDinamicoQuerySet(models.QuerySet):
    def ativos(self, reference_time: Optional[datetime] = None):
        reference = reference_time or timezone.now()
        return self.filter(ativo=True).filter(
            models.Q(data_inicio__isnull=True) | models.Q(data_inicio__lte=reference)
        ).filter(
            models.Q(data_fim__isnull=True) | models.Q(data_fim__gte=reference)
        )


class DesafioDinamico(models.Model):
    """Desafios temporários para manter o engajamento."""

    class TipoDesafio(models.TextChoices):
        DIARIO = 'daily', 'Diário'
        SEMANAL = 'weekly', 'Semanal'
        ESPECIAL = 'event', 'Evento'

    slug = models.SlugField(max_length=150, unique=True, verbose_name="Slug do Desafio")
    nome = models.CharField(max_length=200, verbose_name="Nome do Desafio")
    descricao = models.TextField(blank=True, verbose_name="Descrição")
    tipo = models.CharField(
        max_length=20,
        choices=TipoDesafio.choices,
        default=TipoDesafio.ESPECIAL,
        verbose_name="Tipo",
    )
    criterio_json = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Critério",
        help_text="Estrutura {'tipo': 'xp_total', 'valor': 500} ou similar.",
    )
    recompensa_json = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Recompensa",
        help_text="Metadados da recompensa entregue ao concluir o desafio.",
    )
    data_inicio = models.DateTimeField(null=True, blank=True, verbose_name="Início")
    data_fim = models.DateTimeField(null=True, blank=True, verbose_name="Fim")
    ativo = models.BooleanField(default=True, verbose_name="Ativo")
    criado_em = models.DateTimeField(auto_now_add=True, verbose_name="Criado em")
    atualizado_em = models.DateTimeField(auto_now=True, verbose_name="Atualizado em")

    objects = DesafioDinamicoQuerySet.as_manager()

    class Meta:
        verbose_name = "Desafio Dinâmico"
        verbose_name_plural = "Desafios Dinâmicos"
        ordering = ['-ativo', 'data_inicio', 'nome']

    def __str__(self):
        return self.nome

    def clean(self):
        super().clean()
        if self.data_inicio and self.data_fim and self.data_fim < self.data_inicio:
            raise ValidationError({'data_fim': 'A data de término deve ser posterior à data de início.'})

    def is_active(self, reference_time: Optional[datetime] = None) -> bool:
        reference = reference_time or timezone.now()
        return DesafioDinamico.objects.ativos(reference).filter(pk=self.pk).exists()

    def get_target_value(self) -> float:
        criterio = self.criterio_json or {}
        try:
            return float(criterio.get('valor') or 0)
        except (TypeError, ValueError):
            return 0.0

    def get_metric_type(self) -> str:
        criterio = self.criterio_json or {}
        return str(criterio.get('tipo', '')).lower()

    def get_absolute_url(self):
        base_url = reverse('quiz:questions')
        if not self.slug:
            return base_url
        return f"{base_url}?challenge_slug={self.slug}#challenge-hub-container"


class ProgressoDesafioUsuario(models.Model):
    """Progresso do usuário dentro de um desafio dinâmico."""

    desafio = models.ForeignKey(
        DesafioDinamico,
        on_delete=models.CASCADE,
        related_name='progresso_usuarios',
        verbose_name="Desafio",
    )
    perfil = models.ForeignKey(
        PerfilGamificacaoUsuario,
        on_delete=models.CASCADE,
        related_name='progresso_desafios',
        verbose_name="Perfil",
    )
    valor_atual = models.FloatField(default=0.0, verbose_name="Valor Atual")
    concluido = models.BooleanField(default=False, verbose_name="Concluído")
    data_conclusao = models.DateTimeField(null=True, blank=True, verbose_name="Concluído em")
    janela_inicio = models.DateTimeField(null=True, blank=True, verbose_name="Início do Ciclo")
    janela_fim = models.DateTimeField(null=True, blank=True, verbose_name="Fim do Ciclo")
    metadata = models.JSONField(default=dict, blank=True, verbose_name="Metadados")
    criado_em = models.DateTimeField(auto_now_add=True, verbose_name="Criado em")
    atualizado_em = models.DateTimeField(auto_now=True, verbose_name="Atualizado em")

    class Meta:
        verbose_name = "Progresso de Desafio do Usuário"
        verbose_name_plural = "Progressos de Desafios dos Usuários"
        unique_together = ('desafio', 'perfil')
        indexes = [
            models.Index(fields=['perfil', 'desafio'], name='idx_desafio_perfil'),
        ]

    def __str__(self):
        return f"{self.perfil.user.get_username()} em {self.desafio.nome}"

    def reset_for_challenge_window(self, desafio: DesafioDinamico) -> bool:
        """Reseta o progresso se o período do desafio foi alterado."""

        new_start = desafio.data_inicio
        new_end = desafio.data_fim
        if self.janela_inicio == new_start and self.janela_fim == new_end:
            return False

        self.valor_atual = 0.0
        self.concluido = False
        self.data_conclusao = None
        self.metadata = {}
        self.janela_inicio = new_start
        self.janela_fim = new_end
        return True

    def progress_percent(self, target: float) -> float:
        if target <= 0:
            return 0.0
        return max(0.0, min((self.valor_atual / target) * 100.0, 100.0))


class RecompensaNivelResgatada(models.Model):
    """Recompensas de nível que já foram resgatadas."""

    perfil = models.ForeignKey(
        PerfilGamificacaoUsuario,
        on_delete=models.CASCADE,
        related_name='recompensas_resgatadas',
        verbose_name="Perfil",
    )
    nivel = models.ForeignKey(
        NivelGamificacao,
        on_delete=models.CASCADE,
        related_name='recompensas_resgatadas',
        verbose_name="Nível",
    )
    recompensa_id = models.CharField(max_length=150, verbose_name="Identificador da Recompensa")
    dados_recompensa = models.JSONField(default=dict, blank=True, verbose_name="Dados da Recompensa")
    data_resgate = models.DateTimeField(auto_now_add=True, verbose_name="Data de Resgate")

    class Meta:
        verbose_name = "Recompensa de Nível Resgatada"
        verbose_name_plural = "Recompensas de Nível Resgatadas"
        unique_together = ('perfil', 'nivel', 'recompensa_id')
        indexes = [
            models.Index(fields=['perfil', 'nivel'], name='idx_resgate_perfil_nivel'),
        ]

    def __str__(self):
        return f"{self.recompensa_id} - {self.perfil.user.get_username()}"


class SystemMessageBroadcastQuerySet(models.QuerySet):
    """QuerySet especializado para mensagens do sistema controladas via admin."""

    def active(self, reference_time: Optional[datetime] = None):
        """Retorna apenas mensagens ativas na janela configurada."""

        now = reference_time or timezone.now()

        return (
            self.filter(is_active=True)
            .filter(models.Q(start_at__isnull=True) | models.Q(start_at__lte=now))
            .filter(models.Q(end_at__isnull=True) | models.Q(end_at__gte=now))
            .order_by('-priority', '-start_at', '-created_at')
        )


class SystemMessageBroadcast(models.Model):
    """Mensagens globais controladas pelo admin para o centro de mensagens do front-end."""

    class MessageType(models.TextChoices):
        SUCCESS = 'success', 'Sucesso'
        INFO = 'info', 'Informação'
        WARNING = 'warning', 'Aviso'
        ERROR = 'error', 'Erro'

    class Channel(models.TextChoices):
        TOAST = 'toast', 'Toast (notificação)'
        INLINE = 'inline', 'Inline (painel embutido)'

    class Audience(models.TextChoices):
        ALL = 'all', 'Todos os usuários'
        AUTHENTICATED = 'auth', 'Somente usuários autenticados'
        ANONYMOUS = 'anon', 'Somente visitantes anônimos'

    slug = models.SlugField(
        unique=True,
        verbose_name='Identificador',
        help_text='Usado como chave estável para a mensagem. Não use espaços nem caracteres especiais.',
    )
    title = models.CharField(
        max_length=150,
        blank=True,
        verbose_name='Título',
    )
    body = models.TextField(verbose_name='Mensagem principal')
    supporting_text = models.TextField(
        blank=True,
        verbose_name='Texto complementar',
        help_text='Opcional: complemento exibido abaixo do corpo principal.',
    )
    detail = models.CharField(
        max_length=255,
        blank=True,
        verbose_name='Detalhe adicional',
        help_text='Valor passado como detail para renderizações personalizadas.',
    )
    message_type = models.CharField(
        max_length=12,
        choices=MessageType.choices,
        default=MessageType.INFO,
        verbose_name='Tipo',
    )
    icon = models.CharField(
        max_length=40,
        blank=True,
        verbose_name='Ícone personalizado',
        help_text='Nome do ícone do Google Material Symbols (opcional).',
    )
    channel = models.CharField(
        max_length=10,
        choices=Channel.choices,
        default=Channel.TOAST,
        verbose_name='Canal padrão',
    )
    extra_tags = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Tags extras',
        help_text="Separadas por espaço. Use, por exemplo, 'sticky centered inline'.",
    )
    auto_dismiss = models.BooleanField(
        default=True,
        verbose_name='Fechar automaticamente',
        help_text='Define se o toast deve sumir sozinho após alguns segundos.',
    )
    dismiss_in = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name='Dispensar em (ms)',
        help_text='Tempo em milissegundos para fechar automaticamente. Deixe em branco para usar o padrão.',
    )
    audience = models.CharField(
        max_length=8,
        choices=Audience.choices,
        default=Audience.ALL,
        verbose_name='Audiência',
    )
    priority = models.IntegerField(
        default=0,
        verbose_name='Prioridade',
        help_text='Mensagens com prioridade mais alta aparecem primeiro.',
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Ativa',
        help_text='Desative para ocultar sem apagar a mensagem.',
    )
    start_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Início da vigência',
        help_text='Opcional: data/hora a partir da qual a mensagem é exibida.',
    )
    end_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Fim da vigência',
        help_text='Opcional: data/hora após a qual a mensagem deixa de ser exibida.',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criada em')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Atualizada em')

    objects = SystemMessageBroadcastQuerySet.as_manager()

    class Meta:
        verbose_name = 'Mensagem do Sistema'
        verbose_name_plural = 'Mensagens do Sistema'
        ordering = ['-priority', '-start_at', 'title']

    def clean(self):
        super().clean()

        if not self.auto_dismiss and self.dismiss_in:
            raise ValidationError(
                "Defina 'Dispensar em' apenas quando a opção de fechar automaticamente estiver marcada."
            )

        if self.dismiss_in and self.dismiss_in < 1000:
            raise ValidationError("O tempo mínimo para fechamento automático é de 1000 ms (1 segundo).")

        if self.start_at and self.end_at and self.end_at <= self.start_at:
            raise ValidationError('O fim da vigência deve ser posterior ao início.')

    def save(self, *args, **kwargs):
        if self.extra_tags:
            normalized_tokens = []
            for token in self.extra_tags.split():
                token = token.strip()
                if token and token not in normalized_tokens:
                    normalized_tokens.append(token)
            self.extra_tags = ' '.join(normalized_tokens)

        super().save(*args, **kwargs)

    def __str__(self):
        return self.title or self.slug

    def is_visible_for_user(self, user: Optional[User]) -> bool:
        """Determina se a mensagem deve aparecer para o usuário informado."""

        is_authenticated = getattr(user, 'is_authenticated', False)

        if self.audience == self.Audience.AUTHENTICATED:
            return bool(is_authenticated)

        if self.audience == self.Audience.ANONYMOUS:
            return not bool(is_authenticated)

        return True

    def as_seed_payload(self) -> Dict[str, Any]:
        """Monta os atributos esperados pelo SystemMessageCenter no front-end."""

        payload: Dict[str, Any] = {
            'dataset_id': f'broadcast-{self.slug}',
            'channel': self.channel,
            'type': self.message_type,
            'title': self.title or '',
            'body': self.body or '',
            'supporting_text': self.supporting_text or '',
            'detail': self.detail or '',
            'icon': self.icon or '',
            'tags': self.extra_tags or '',
            'auto_dismiss': self.auto_dismiss,
            'dismiss_in': self.dismiss_in,
        }

        return payload


# --- Configurações dinâmicas de conteúdo para Home e Challenge Hub ---


class HomeContentAudience(models.TextChoices):
    AUTHENTICATED = "authenticated", "Usuários autenticados"
    ANONYMOUS = "anonymous", "Visitantes"


class ValueSourceType(models.TextChoices):
    STATIC = "static", "Valor definido manualmente"
    DAILY_RESPONDED = "daily_responded", "Perguntas respondidas no dia"
    DAILY_ACCURACY = "daily_accuracy", "Precisão diária"
    STREAK_DAYS = "streak_days", "Dias de sequência ativa"
    PLATFORM_TOTAL_QUESTIONS = "platform_total_questions", "Total de questões do banco"
    PLATFORM_TOTAL_CATEGORIES = "platform_total_categories", "Total de categorias"
    PLATFORM_CURATED_COUNT = "platform_curated_count", "Curadorias ativas"
    QUICK_QUIZ_DEFAULT = "quick_quiz_default", "Quantidade padrão do quiz rápido"
    PREDEFINED_COLLECTIONS = "predefined_collections", "Total de coleções pré-definidas"


class HomePageSettings(SingletonModel):
    """Configurações gerenciáveis da página inicial."""

    hero_authenticated_eyebrow = models.CharField(
        max_length=120,
        default="Hub de estudos MedQuiz",
        help_text="Texto curto acima do título para usuários autenticados.",
    )
    hero_authenticated_title = models.CharField(
        max_length=200,
        default="Bem-vindo de volta, {first_name}.",
        help_text="Use {first_name} para inserir automaticamente o primeiro nome do usuário logado.",
    )
    hero_authenticated_subtitle = models.CharField(
        max_length=300,
        default="Veja seu progresso em uma linha, foque no que rende agora e retome a prática com atalhos pensados para o seu ritmo.",
        help_text="Subtítulo exibido quando o usuário está autenticado.",
    )
    hero_anonymous_eyebrow = models.CharField(
        max_length=120,
        default="Hub de estudos MedQuiz",
        help_text="Texto curto acima do título para visitantes.",
    )
    hero_anonymous_title = models.CharField(
        max_length=200,
        default="Domine medicina com treinos guiados e métricas em tempo real.",
        help_text="Título da hero section para visitantes.",
    )
    hero_anonymous_subtitle = models.CharField(
        max_length=320,
        default="Estude em blocos inteligentes, acompanhe evolução e mantenha constância com feedback imediato.",
        help_text="Subtítulo exibido para visitantes.",
    )
    quick_section_title = models.CharField(
        max_length=200,
        default="Continue de onde parou",
        help_text="Título da seção de atalhos rápidos para usuários autenticados.",
    )
    quick_section_subtitle = models.CharField(
        max_length=250,
        default="Entre direto nos modos que mantêm sua evolução em alta.",
        help_text="Descrição curta da seção de atalhos.",
    )
    intro_section_title = models.CharField(
        max_length=200,
        default="Por que começar pelo MedQuiz?",
        help_text="Título da seção introdutória para visitantes.",
    )
    intro_section_subtitle = models.CharField(
        max_length=250,
        default="Um ecossistema completo para criar constância nos estudos.",
        help_text="Descrição curta da seção introdutória para visitantes.",
    )
    intro_highlight_eyebrow = models.CharField(
        max_length=120,
        default="Resultados comprovados",
        help_text="Eyebrow card da coluna de destaques na home pública.",
    )
    intro_highlight_title = models.CharField(
        max_length=200,
        default="Métricas e conteúdos sempre atualizados",
        help_text="Título do card de destaques na home pública.",
    )
    intro_steps_eyebrow = models.CharField(
        max_length=120,
        default="Comece agora",
        help_text="Eyebrow do card de passos iniciais para visitantes.",
    )
    intro_steps_title = models.CharField(
        max_length=200,
        default="Três passos para entrar no ritmo",
        help_text="Título do card de passos para visitantes.",
    )
    intro_primary_cta_label = models.CharField(
        max_length=120,
        default="Criar conta",
        help_text="Rótulo do botão principal do card de passos.",
    )
    intro_primary_cta_url = models.CharField(
        max_length=255,
        default="/register/",
        help_text="URL relativa ou absoluta para o CTA principal do card de passos.",
    )
    intro_secondary_cta_label = models.CharField(
        max_length=120,
        default="Experimentar um quiz",
        help_text="Rótulo do botão secundário do card de passos.",
    )
    intro_secondary_cta_url = models.CharField(
        max_length=255,
        default="/questions/",
        help_text="URL relativa ou absoluta para o CTA secundário do card de passos.",
    )
    collections_section_title = models.CharField(
        max_length=200,
        default="Coleções em destaque",
        help_text="Título da seção de coleções.",
    )
    collections_section_subtitle = models.CharField(
        max_length=250,
        default="Seleções diretas para revisar rapidamente os temas mais cobrados.",
        help_text="Descrição da seção de coleções.",
    )
    methods_section_title = models.CharField(
        max_length=200,
        default="Métodos de estudo disponíveis",
        help_text="Título da seção de métodos de estudo.",
    )
    methods_section_subtitle = models.CharField(
        max_length=250,
        default="Ajuste a abordagem conforme o objetivo da semana.",
        help_text="Descrição da seção de métodos.",
    )

    @classmethod
    def load(cls):  # type: ignore[override]
        instance = super().load()
        instance.ensure_related_defaults()
        return instance

    def ensure_related_defaults(self):
        HomeProgressSectionSettings.objects.get_or_create(settings=self)
        HomeRecentSessionCardSettings.objects.get_or_create(settings=self)
        HomeActiveChallengeCardSettings.objects.get_or_create(settings=self)
        HomeAchievementCardSettings.objects.get_or_create(settings=self)

    class Meta:
        verbose_name = "Configurações da Home"

    def __str__(self):
        return "Configurações da Home"


class HomeHeroCTA(models.Model):
    """Botões configuráveis exibidos na hero da home."""

    class Position(models.TextChoices):
        PRIMARY = "primary", "Principal"
        SECONDARY = "secondary", "Secundário"

    settings = models.ForeignKey(HomePageSettings, related_name="hero_ctas", on_delete=models.CASCADE)
    audience = models.CharField(max_length=20, choices=HomeContentAudience.choices, default=HomeContentAudience.AUTHENTICATED)
    position = models.CharField(max_length=20, choices=Position.choices, default=Position.PRIMARY)
    label = models.CharField(max_length=120)
    url = models.CharField(max_length=255, help_text="Use URLs relativas (ex: /questions/) ou absolutas.")
    icon = models.CharField(max_length=80, blank=True, help_text="Nome do ícone Material Symbols a exibir.")
    css_class = models.CharField(
        max_length=200,
        default="button button--fancy button--fancy-primary",
        help_text="Classes CSS completas aplicadas ao botão.",
    )
    anchor_id = models.CharField(
        max_length=120,
        blank=True,
        help_text="ID opcional usado para tracking ou integrações front-end.",
    )
    open_in_new_tab = models.BooleanField(default=False, help_text="Abrir link em nova aba.")
    is_enabled = models.BooleanField(default=True)

    class Meta:
        verbose_name = "CTA da Home"
        verbose_name_plural = "CTAs da Home"
        unique_together = ("settings", "audience", "position")
        ordering = ("audience", "position")

    def __str__(self):
        return f"CTA {self.get_position_display()} ({self.get_audience_display()})"


class HomeHeroStatTemplate(models.Model):
    settings = models.ForeignKey(HomePageSettings, related_name="hero_stat_templates", on_delete=models.CASCADE)
    audience = models.CharField(max_length=20, choices=HomeContentAudience.choices, default=HomeContentAudience.AUTHENTICATED)
    order = models.PositiveIntegerField(default=0)
    icon = models.CharField(max_length=80, default="quiz")
    label = models.CharField(max_length=120)
    data_source = models.CharField(max_length=60, choices=ValueSourceType.choices, default=ValueSourceType.STATIC)
    prefix = models.CharField(max_length=40, blank=True)
    suffix = models.CharField(max_length=40, blank=True)
    static_value = models.CharField(max_length=120, blank=True)
    dom_id = models.CharField(max_length=120, blank=True, help_text="ID opcional aplicado ao valor para integrações JS.")
    is_enabled = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Métrica da Hero"
        verbose_name_plural = "Métricas da Hero"
        ordering = ("audience", "order", "pk")

    def __str__(self):
        return f"{self.label} ({self.get_audience_display()})"


class HomeQuickLink(models.Model):
    settings = models.ForeignKey(HomePageSettings, related_name="quick_links", on_delete=models.CASCADE)
    order = models.PositiveIntegerField(default=0)
    title = models.CharField(max_length=150)
    description = models.CharField(max_length=250, blank=True)
    icon = models.CharField(max_length=80, default="rocket_launch")
    url = models.CharField(max_length=255)
    extra_css_class = models.CharField(max_length=150, blank=True)
    anchor_id = models.CharField(max_length=120, blank=True)
    open_in_new_tab = models.BooleanField(default=False)
    is_enabled = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Atalho Rápido"
        verbose_name_plural = "Atalhos Rápidos"
        ordering = ("order", "pk")

    def __str__(self):
        return self.title


class HomeIntroHighlight(models.Model):
    settings = models.ForeignKey(HomePageSettings, related_name="intro_highlights", on_delete=models.CASCADE)
    order = models.PositiveIntegerField(default=0)
    icon = models.CharField(max_length=80, default="quiz")
    label = models.CharField(max_length=150)
    data_source = models.CharField(max_length=60, choices=ValueSourceType.choices, default=ValueSourceType.STATIC)
    static_value = models.CharField(max_length=120, blank=True)
    dom_id = models.CharField(max_length=120, blank=True)
    prefix = models.CharField(max_length=40, blank=True)
    suffix = models.CharField(max_length=40, blank=True)
    is_enabled = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Indicador Introdutório"
        verbose_name_plural = "Indicadores Introdutórios"
        ordering = ("order", "pk")

    def __str__(self):
        return self.label


class HomeIntroStep(models.Model):
    settings = models.ForeignKey(HomePageSettings, related_name="intro_steps", on_delete=models.CASCADE)
    order = models.PositiveIntegerField(default=0)
    text = models.CharField(max_length=200)

    class Meta:
        verbose_name = "Passo Inicial"
        verbose_name_plural = "Passos Iniciais"
        ordering = ("order", "pk")

    def __str__(self):
        return f"Passo {self.order}: {self.text}"


class HomeProgressSectionSettings(models.Model):
    settings = models.OneToOneField(
        HomePageSettings,
        related_name="progress_section",
        on_delete=models.CASCADE,
    )
    title = models.CharField(
        max_length=200,
        default="Resumo rápido do seu estudo",
        help_text="Título exibido quando o aluno está autenticado.",
    )
    subtitle = models.CharField(
        max_length=250,
        blank=True,
        default="Entre direto nos modos que mantêm sua evolução em alta.",
        help_text="Descrição auxiliar da seção de progresso.",
    )
    show_when_empty = models.BooleanField(
        default=False,
        help_text="Mantém a seção visível mesmo quando nenhum card tem dados.",
    )
    empty_state_title = models.CharField(
        max_length=200,
        default="Comece um treino para ver estatísticas aqui",
    )
    empty_state_description = models.CharField(
        max_length=300,
        blank=True,
        default="Assim que você concluir uma sessão ou desafio, os destaques aparecem automaticamente.",
    )

    class Meta:
        verbose_name = "Seção de progresso da home"

    def __str__(self):
        return "Seção de progresso"


class HomeRecentSessionCardSettings(models.Model):
    settings = models.OneToOneField(
        HomePageSettings,
        related_name="recent_session_card",
        on_delete=models.CASCADE,
    )
    icon = models.CharField(max_length=80, default="history")
    eyebrow = models.CharField(max_length=150, default="Última sessão")
    fallback_title = models.CharField(
        max_length=200,
        default="Sessão mais recente",
        help_text="Título usado quando não há sessão registrada.",
    )
    fallback_description = models.CharField(
        max_length=250,
        blank=True,
        default="Inicie um quiz para destravar análises detalhadas da sua sessão.",
    )
    badge_label_template = models.CharField(
        max_length=160,
        blank=True,
        default="{date_display}",
        help_text="Use {date_display} para inserir a data da sessão.",
    )
    stat_mode_label = models.CharField(max_length=80, default="Modo")
    stat_method_label = models.CharField(max_length=80, default="Método")
    stat_questions_label = models.CharField(max_length=80, default="Questões")
    stat_accuracy_label = models.CharField(max_length=80, default="Precisão")
    stat_duration_label = models.CharField(max_length=80, default="Duração")
    stat_mode_placeholder = models.CharField(max_length=80, default="—")
    stat_method_placeholder = models.CharField(max_length=80, default="—")
    stat_questions_placeholder = models.CharField(max_length=80, default="0")
    stat_accuracy_placeholder = models.CharField(max_length=80, default="0%")
    stat_duration_placeholder = models.CharField(max_length=80, default="0 min")
    cta_label = models.CharField(max_length=120, default="Retomar treino")
    cta_url = models.CharField(max_length=255, default="/questions/")
    cta_icon = models.CharField(max_length=80, blank=True, default="play_arrow")
    cta_css_class = models.CharField(max_length=200, default="button button--text")
    show_when_empty = models.BooleanField(
        default=False,
        help_text="Mantém o card visível mesmo sem sessão recente.",
    )

    class Meta:
        verbose_name = "Card de sessão recente"

    def __str__(self):
        return "Card de sessão recente"


class HomeActiveChallengeCardSettings(models.Model):
    settings = models.OneToOneField(
        HomePageSettings,
        related_name="active_challenge_card",
        on_delete=models.CASCADE,
    )
    icon = models.CharField(max_length=80, default="flag")
    eyebrow = models.CharField(max_length=150, default="Desafio em andamento")
    fallback_title = models.CharField(max_length=200, default="Nenhum desafio ativo")
    fallback_description = models.CharField(
        max_length=300,
        blank=True,
        default="Personalize o hub para iniciar um novo desafio em segundos.",
    )
    badge_label_template = models.CharField(
        max_length=160,
        blank=True,
        default="Termina em {time_remaining}",
        help_text="Use {time_remaining} para inserir a contagem restante.",
    )
    progress_label = models.CharField(max_length=120, default="Progresso")
    progress_placeholder = models.CharField(max_length=120, default="0%")
    reward_label_template = models.CharField(
        max_length=160,
        blank=True,
        default="Recompensa: {reward}",
        help_text="Use {reward} para exibir a recompensa.",
    )
    reward_placeholder = models.CharField(max_length=160, blank=True, default="")
    show_when_empty = models.BooleanField(
        default=True,
        help_text="Mantém o card visível para incentivar a criação de desafios.",
    )

    class Meta:
        verbose_name = "Card de desafio ativo"

    def __str__(self):
        return "Card de desafio ativo"


class HomeAchievementCardSettings(models.Model):
    settings = models.OneToOneField(
        HomePageSettings,
        related_name="achievement_card",
        on_delete=models.CASCADE,
    )
    icon = models.CharField(max_length=80, default="emoji_events")
    eyebrow = models.CharField(max_length=150, default="Próxima conquista")
    fallback_title = models.CharField(max_length=200, default="Acompanhe suas conquistas")
    fallback_description = models.CharField(
        max_length=300,
        blank=True,
        default="Complete desafios para desbloquear medalhas e acompanhar o progresso.",
    )
    progress_label = models.CharField(max_length=120, default="Status")
    progress_placeholder = models.CharField(max_length=120, default="0%")
    show_when_empty = models.BooleanField(
        default=True,
        help_text="Exibe o card mesmo sem conquista pendente.",
    )

    class Meta:
        verbose_name = "Card de conquista"

    def __str__(self):
        return "Card de conquista"


class ChallengeHubValueSource(models.TextChoices):
    TOTAL_QUESTIONS = "total_questions", "Total de questões"
    QUICK_QUIZ_DEFAULT = "quick_quiz_default", "Total sugerido para quiz rápido"
    PREDEFINED_TOTAL = "predefined_total", "Quantidade de coleções prontas"


class ChallengeHubSettings(SingletonModel):
    hero_eyebrow = models.CharField(
        max_length=120,
        default="Hub de desafios MedQuiz",
        help_text="Texto curto acima do título do Challenge Hub.",
    )
    hero_title = models.CharField(
        max_length=200,
        default="Escolha seu próximo desafio",
        help_text="Título principal do Challenge Hub.",
    )
    hero_subtitle_template = models.CharField(
        max_length=320,
        default="Combine modos inteligentes de estudo e aproveite as {total_questions} questões disponíveis.",
        help_text="Use {total_questions} para inserir automaticamente o contador principal.",
    )

    @classmethod
    def load(cls):  # type: ignore[override]
        instance = super().load()
        instance.ensure_related_defaults()
        return instance

    def ensure_related_defaults(self):
        ChallengeHubResumeCardSettings.objects.get_or_create(settings=self)
        ChallengeHubPredefinedSection.objects.get_or_create(settings=self)
        ChallengeHubPlaceholderSettings.objects.get_or_create(settings=self)

    class Meta:
        verbose_name = "Configurações do Challenge Hub"

    def __str__(self):
        return "Configurações do Challenge Hub"


class ChallengeHubHeroAction(models.Model):
    settings = models.ForeignKey(ChallengeHubSettings, related_name="hero_actions", on_delete=models.CASCADE)

    class ActionKey(models.TextChoices):
        CUSTOMIZE = "customize", "Botão Personalizar"
        QUICK_START = "quick_start", "Botão Começar Agora"

    key = models.CharField(max_length=20, choices=ActionKey.choices, unique=True)
    label = models.CharField(max_length=120)
    icon = models.CharField(max_length=80, default="play_arrow")
    css_class = models.CharField(
        max_length=200,
        default="button button--fancy button--fancy-primary challenge-hub__action-button",
    )
    dom_id = models.CharField(max_length=120, unique=True)
    is_enabled = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Ação do Challenge Hub"
        verbose_name_plural = "Ações do Challenge Hub"
        ordering = ("key",)

    def __str__(self):
        return self.get_key_display()


class ChallengeHubHeroStat(models.Model):
    settings = models.ForeignKey(ChallengeHubSettings, related_name="hero_stats", on_delete=models.CASCADE)
    order = models.PositiveIntegerField(default=0)
    label = models.CharField(max_length=150)
    data_source = models.CharField(max_length=30, choices=ChallengeHubValueSource.choices)
    dom_id = models.CharField(max_length=120, blank=True)
    prefix = models.CharField(max_length=40, blank=True)
    suffix = models.CharField(max_length=40, blank=True)
    is_enabled = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Métrica do Challenge Hub"
        verbose_name_plural = "Métricas do Challenge Hub"
        ordering = ("order", "pk")

    def __str__(self):
        return self.label


class ChallengeHubActionCard(models.Model):
    settings = models.ForeignKey(ChallengeHubSettings, related_name="action_cards", on_delete=models.CASCADE)

    class CardKey(models.TextChoices):
        SMART_DRILL = "smart_drill", "Foco guiado"
        TIMED_QUIZ = "timed_quiz", "Simulado cronometrado"
        FAVORITE_REVIEW = "favorite_review", "Revisão de favoritos"
        REPEAT_LAST = "repeat_last", "Repetir último desafio"

    key = models.CharField(max_length=40, choices=CardKey.choices, unique=True)
    title = models.CharField(max_length=150)
    description = models.CharField(max_length=250, blank=True)
    meta = models.CharField(max_length=250, blank=True)
    icon = models.CharField(max_length=80, default="quiz")
    dom_id = models.CharField(max_length=120, unique=True)
    extra_css_class = models.CharField(max_length=150, blank=True)
    is_enabled = models.BooleanField(default=True)
    quiz_definition = models.ForeignKey(
        'QuizDefinicao',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='linked_action_cards',
        verbose_name='Quiz definido vinculado',
        help_text=(
            "Quando preenchido, este card inicia diretamente a definição selecionada, "
            "permitindo acionar experiências personalizadas sem alterar o código."
        ),
    )

    class Meta:
        verbose_name = "Card do Challenge Hub"
        verbose_name_plural = "Cards do Challenge Hub"
        ordering = ("key",)

    def __str__(self):
        return self.get_key_display()


class TrainingMode(models.Model):
    """Define modos de treino adicionais configuráveis via admin."""

    name = models.CharField(max_length=120, verbose_name="Nome do modo")
    slug = models.SlugField(
        max_length=180,
        unique=True,
        verbose_name="Slug",
        help_text="Identificador utilizado em URLs internas e scripts.",
    )
    description = models.TextField(blank=True, verbose_name="Descrição")
    meta = models.CharField(
        max_length=160,
        blank=True,
        verbose_name="Etiqueta auxiliar",
        help_text="Texto exibido no rodapé do card (ex.: número de questões ou dica rápida).",
    )
    icon = models.CharField(
        max_length=80,
        default="sports_esports",
        verbose_name="Ícone",
        help_text="Nome do ícone Material Symbols (ex.: 'flag', 'auto_stories').",
    )
    accent_color = models.CharField(
        max_length=40,
        blank=True,
        verbose_name="Cor de destaque",
        help_text="Opcional: cor CSS (ex.: #4caf50) aplicada a detalhes visuais do card.",
    )
    quiz_definition = models.ForeignKey(
        "QuizDefinicao",
        on_delete=models.CASCADE,
        related_name="training_modes",
        verbose_name="Quiz associado",
        help_text="Definição que será executada ao iniciar este modo.",
    )
    order = models.PositiveIntegerField(default=0, verbose_name="Ordem de exibição")
    is_active = models.BooleanField(default=True, verbose_name="Ativo")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Modo de Treino"
        verbose_name_plural = "Modos de Treino"
        ordering = ("order", "name")

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = _generate_unique_slug(
                self,
                self.name,
                slug_field="slug",
                max_length=180,
                default_prefix="training-mode",
            )
        super().save(*args, **kwargs)


class ChallengeHubResumeCardSettings(models.Model):
    settings = models.OneToOneField(ChallengeHubSettings, related_name="resume_card", on_delete=models.CASCADE)
    title = models.CharField(max_length=150, default="Retomar sessão")
    description_template = models.CharField(
        max_length=300,
        default="Você tem uma sessão em andamento de <strong>{question_count}</strong> questões.",
        help_text="Use {question_count} para inserir a contagem dinâmica.",
    )
    icon = models.CharField(max_length=80, default="autorenew")
    discard_label = models.CharField(max_length=120, default="Descartar")
    continue_label = models.CharField(max_length=120, default="Continuar")

    class Meta:
        verbose_name = "Configuração do card de retomada"

    def __str__(self):
        return "Card de retomada"


class ChallengeHubPredefinedSection(models.Model):
    settings = models.OneToOneField(ChallengeHubSettings, related_name="predefined_section", on_delete=models.CASCADE)
    title = models.CharField(max_length=200, default="Listas especiais")
    subtitle = models.CharField(
        max_length=250,
        default="Explore quizzes prontos com curadoria da equipe MedQuiz.",
    )

    class Meta:
        verbose_name = "Seção de coleções do Challenge Hub"

    def __str__(self):
        return "Seção de coleções"


class ChallengeHubPlaceholderSettings(models.Model):
    settings = models.OneToOneField(
        ChallengeHubSettings,
        related_name="placeholders",
        on_delete=models.CASCADE,
    )
    filters_title = models.CharField(max_length=200, default="Ajuste seus filtros")
    filters_body = models.CharField(
        max_length=300,
        default="O painel lateral está aberto. Escolha categorias e dificuldade para liberar novos desafios.",
    )
    filters_supporting = models.CharField(
        max_length=300,
        blank=True,
        default="Após aplicar os filtros, clique em \"Aplicar\" para atualizar o hub.",
    )
    filters_cta_label = models.CharField(max_length=150, default="Voltar para Modos de Jogo")
    filters_cta_icon = models.CharField(max_length=80, default="arrow_back")
    filters_cta_css_class = models.CharField(
        max_length=200,
        default="button button--secondary button--small",
    )
    filters_cta_dom_id = models.CharField(
        max_length=120,
        default="close-filters-and-show-hub-btn",
        help_text="ID aplicado ao botão que fecha os filtros.",
    )

    class Meta:
        verbose_name = "Mensagens auxiliares do Challenge Hub"

    def __str__(self):
        return "Mensagens auxiliares do hub"
