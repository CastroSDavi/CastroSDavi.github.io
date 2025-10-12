"""Score panel helpers shared by admin forms."""

from typing import Dict, Iterable, Tuple

from django import forms
from django.utils.text import slugify

from quiz.models import (
    ConfiguracoesGeraisQuiz,
    DEFAULT_SCORE_PANEL_SETTINGS,
    Pergunta,
    QuizDefinicao,
    SessoesQuizUsuario,
    get_registered_score_panel_modes,
    sanitize_score_panel_config,
)
from quiz.services.study_methods import StudyMethodRegistry


def get_score_panel_modes_with_labels() -> Iterable[Tuple[str, str]]:
    modes = [("default", "Configuração padrão (todos os modos)")]
    for mode_value, mode_label in get_registered_score_panel_modes():
        friendly_label = mode_label or mode_value
        modes.append((mode_value, f'Modo "{friendly_label}"'))
    return modes


def get_score_panel_mode_prefix(mode_key: str) -> str:
    if mode_key == "default":
        return "default"
    try:
        return SessoesQuizUsuario.ModoQuiz(mode_key).name.lower()
    except ValueError:
        return slugify(mode_key, allow_unicode=False).replace("-", "_")


class ConfiguracoesGeraisQuizForm(forms.ModelForm):
    """ModelForm that exposes boolean helpers for score panel toggles."""

    SCORE_PANEL_FIELDS = [
        (
            "show_timer",
            "Exibir cronômetro",
            "Controla a visibilidade do cronômetro do quiz.",
        ),
        (
            "allow_pause",
            "Permitir pausar cronômetro",
            "Habilita o botão de pausa quando o cronômetro estiver visível.",
        ),
        (
            "allow_manual_finish",
            "Permitir encerramento manual",
            'Mostra o botão "Encerrar" para finalizar a sessão manualmente.',
        ),
        (
            "show_points",
            "Mostrar pontos",
            "Exibe a quantidade de pontos acumulados pelo usuário.",
        ),
        (
            "show_correct",
            "Mostrar acertos",
            "Mostra o total de respostas corretas.",
        ),
        (
            "show_incorrect",
            "Mostrar erros",
            "Mostra o total de respostas incorretas.",
        ),
        (
            "show_streak",
            "Mostrar sequência de acertos",
            "Exibe a sequência atual de acertos do usuário.",
        ),
        (
            "show_multiplier",
            "Mostrar multiplicador",
            "Mostra o multiplicador aplicado aos pontos (depende da sequência de acertos).",
        ),
    ]

    class Meta:
        model = ConfiguracoesGeraisQuiz
        fields = "__all__"

    @classmethod
    def get_score_panel_modes(cls) -> Iterable[Tuple[str, str]]:
        return get_score_panel_modes_with_labels()

    @classmethod
    def build_field_name(cls, mode_key: str, flag_key: str) -> str:
        prefix = get_score_panel_mode_prefix(mode_key)
        return f"{prefix}_{flag_key}"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        if "score_panel_config" in self.fields:
            self.fields["score_panel_config"].widget = forms.HiddenInput()
            self.fields["score_panel_config"].required = False

        sanitized = sanitize_score_panel_config(
            getattr(self.instance, "score_panel_config", None)
        )

        for mode_key, _mode_label in self.get_score_panel_modes():
            prefix = get_score_panel_mode_prefix(mode_key)
            mode_settings: Dict[str, bool] = (
                sanitized.get(mode_key)
                or sanitized.get("default")
                or DEFAULT_SCORE_PANEL_SETTINGS
            )

            for flag_key, _label, _help_text in self.SCORE_PANEL_FIELDS:
                field_name = f"{prefix}_{flag_key}"
                field = self.fields[field_name]
                field.initial = bool(
                    mode_settings.get(
                        flag_key, DEFAULT_SCORE_PANEL_SETTINGS.get(flag_key, True)
                    )
                )

    def clean(self):
        cleaned_data = super().clean()

        config_payload = {}
        for mode_key, _mode_label in self.get_score_panel_modes():
            prefix = get_score_panel_mode_prefix(mode_key)
            config_payload[mode_key] = {}
            for flag_key, _label, _help_text in self.SCORE_PANEL_FIELDS:
                field_name = f"{prefix}_{flag_key}"
                config_payload[mode_key][flag_key] = bool(
                    cleaned_data.get(field_name, False)
                )

        cleaned_data["score_panel_config"] = sanitize_score_panel_config(
            config_payload
        )
        return cleaned_data


class QuizDefinicaoAdminForm(forms.ModelForm):
    SCORE_PANEL_FIELDS = ConfiguracoesGeraisQuizForm.SCORE_PANEL_FIELDS
    FAVORITES_SORT_CHOICES = (
        ("recent", "Mais recentes primeiro"),
        ("oldest", "Mais antigas primeiro"),
        ("random", "Ordem aleatória"),
    )

    generation_type = forms.ChoiceField(label="Estratégia de geração", choices=QuizDefinicao.GenerationType.choices)
    study_method_override = forms.ChoiceField(
        label="Método de estudo preferencial",
        required=False,
    )

    config_manual_shuffle = forms.BooleanField(
        label="Embaralhar ordem das perguntas", required=False,
        help_text="Ative para apresentar as perguntas desta lista fixa em ordem aleatória."
    )
    config_manual_limit = forms.IntegerField(
        label="Limitar quantidade", required=False, min_value=1,
        help_text="Opcionalmente exibe apenas as primeiras N perguntas desta lista."
    )

    config_favorites_limit = forms.IntegerField(
        label="Limite de favoritos", required=False, min_value=1,
        help_text="Número máximo de perguntas favoritas a carregar por sessão."
    )
    config_favorites_sort = forms.ChoiceField(
        label="Ordenação dos favoritos",
        choices=FAVORITES_SORT_CHOICES,
        required=False,
    )
    config_favorites_include_inactive = forms.BooleanField(
        label="Permitir questões arquivadas",
        required=False,
        help_text="Inclui favoritos mesmo que estejam inativos no banco atual."
    )

    config_filters_categories = forms.CharField(
        label="Categorias (IDs separados por vírgula)",
        required=False,
        help_text="Use os IDs das categorias desejadas. Deixe em branco para considerar todas."
    )
    config_filters_difficulties = forms.MultipleChoiceField(
        label="Níveis de dificuldade",
        choices=Pergunta.NivelDificuldade.choices,
        required=False,
    )
    config_filters_limit = forms.IntegerField(
        label="Limite de questões", required=False, min_value=1,
    )
    config_filters_search = forms.CharField(
        label="Termo de busca",
        required=False,
        help_text="Filtra as perguntas contendo o termo informado."
    )
    config_filters_only_favorites = forms.BooleanField(
        label="Usar apenas favoritos do usuário", required=False,
        help_text="Aplica os filtros somente nas questões favoritedas pelo usuário autenticado."
    )
    config_filters_shuffle = forms.BooleanField(
        label="Embaralhar seleção", required=False,
    )
    config_filters_study_method = forms.ChoiceField(
        label="Método de estudo específico",
        required=False,
    )

    config_repeat_limit = forms.IntegerField(
        label="Limite de questões", required=False, min_value=1,
    )
    config_repeat_include_incomplete = forms.BooleanField(
        label="Considerar sessões não finalizadas", required=False,
    )
    config_repeat_use_same_questions = forms.BooleanField(
        label="Reapresentar mesmas perguntas",
        required=False,
        initial=True,
        help_text="Quando marcado, reutiliza exatamente as questões da sessão anterior (quando disponíveis)."
    )
    config_repeat_include_inactive = forms.BooleanField(
        label="Permitir questões inativas", required=False,
    )
    config_repeat_shuffle = forms.BooleanField(
        label="Embaralhar perguntas repetidas", required=False,
    )

    class Meta:
        model = QuizDefinicao
        fields = "__all__"

    @classmethod
    def get_score_panel_modes(cls) -> Iterable[Tuple[str, str]]:
        return get_score_panel_modes_with_labels()

    @classmethod
    def build_field_name(cls, mode_key: str, flag_key: str) -> str:
        return ConfiguracoesGeraisQuizForm.build_field_name(mode_key, flag_key)

    @staticmethod
    def _build_study_method_choices() -> List[Tuple[str, str]]:
        metadata = StudyMethodRegistry.list_metadata()
        choices = [("", "Usar padrão do sistema")]
        for method in metadata:
            label = method.get("name") or method.get("key")
            choices.append((method.get("key"), label))
        return choices

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        if "score_panel_overrides" in self.fields:
            self.fields["score_panel_overrides"].widget = forms.HiddenInput()
            self.fields["score_panel_overrides"].required = False

        if "generation_config" in self.fields:
            self.fields["generation_config"].widget = forms.HiddenInput()
            self.fields["generation_config"].required = False

        method_choices = self._build_study_method_choices()
        self.fields["study_method_override"].choices = method_choices
        self.fields["config_filters_study_method"].choices = method_choices

        sanitized = sanitize_score_panel_config(
            getattr(self.instance, "score_panel_overrides", None)
        )

        for mode_key, _mode_label in self.get_score_panel_modes():
            prefix = get_score_panel_mode_prefix(mode_key)
            mode_settings: Dict[str, bool] = (
                sanitized.get(mode_key)
                or sanitized.get("default")
                or DEFAULT_SCORE_PANEL_SETTINGS
            )
            for flag_key, _label, _help_text in self.SCORE_PANEL_FIELDS:
                field_name = f"{prefix}_{flag_key}"
                field = self.fields[field_name]
                field.initial = bool(
                    mode_settings.get(
                        flag_key, DEFAULT_SCORE_PANEL_SETTINGS.get(flag_key, True)
                    )
                )

        # Inicializa campos dinâmicos com base na instância atual.
        config = {}
        if isinstance(getattr(self.instance, "generation_config", None), dict):
            config = self.instance.generation_config

        self.fields["generation_type"].initial = (
            getattr(self.instance, "generation_type", QuizDefinicao.GenerationType.MANUAL)
        )
        if getattr(self.instance, "study_method_override", None):
            self.fields["study_method_override"].initial = self.instance.study_method_override

        # Manual
        self.fields["config_manual_shuffle"].initial = bool(config.get("shuffle"))
        manual_limit = config.get("limit") if self.instance.generation_type == QuizDefinicao.GenerationType.MANUAL else None
        if isinstance(manual_limit, int):
            self.fields["config_manual_limit"].initial = manual_limit

        # Favorites
        if self.instance.generation_type == QuizDefinicao.GenerationType.FAVORITES:
            limit = config.get("limit")
            if isinstance(limit, int):
                self.fields["config_favorites_limit"].initial = limit
            sort = config.get("sort") or "recent"
            self.fields["config_favorites_sort"].initial = sort
            self.fields["config_favorites_include_inactive"].initial = bool(config.get("include_inactive"))

        # Filters
        if self.instance.generation_type == QuizDefinicao.GenerationType.FILTERS:
            categories = config.get("category_ids")
            if isinstance(categories, (list, tuple)):
                self.fields["config_filters_categories"].initial = ", ".join(str(cat) for cat in categories)
            difficulties = config.get("difficulty_levels")
            if isinstance(difficulties, (list, tuple)):
                self.fields["config_filters_difficulties"].initial = list(map(str, difficulties))
            limit = config.get("limit") or config.get("question_limit")
            if isinstance(limit, int):
                self.fields["config_filters_limit"].initial = limit
            if config.get("search_query"):
                self.fields["config_filters_search"].initial = config.get("search_query")
            self.fields["config_filters_only_favorites"].initial = bool(config.get("only_favorites"))
            self.fields["config_filters_shuffle"].initial = bool(config.get("shuffle"))
            if config.get("study_method"):
                self.fields["config_filters_study_method"].initial = config.get("study_method")

        # Repeat last
        if self.instance.generation_type == QuizDefinicao.GenerationType.REPEAT_LAST:
            limit = config.get("limit")
            if isinstance(limit, int):
                self.fields["config_repeat_limit"].initial = limit
            self.fields["config_repeat_include_incomplete"].initial = bool(config.get("include_incomplete"))
            if "use_same_questions" in config:
                self.fields["config_repeat_use_same_questions"].initial = bool(config.get("use_same_questions"))
            self.fields["config_repeat_include_inactive"].initial = bool(config.get("include_inactive"))
            self.fields["config_repeat_shuffle"].initial = bool(config.get("shuffle"))

    def clean(self):
        cleaned_data = super().clean()

        overrides_payload = {}
        for mode_key, _mode_label in self.get_score_panel_modes():
            prefix = get_score_panel_mode_prefix(mode_key)
            overrides_payload[mode_key] = {}
            for flag_key, _label, _help_text in self.SCORE_PANEL_FIELDS:
                field_name = f"{prefix}_{flag_key}"
                overrides_payload[mode_key][flag_key] = bool(
                    cleaned_data.get(field_name, False)
                )
        cleaned_data["score_panel_overrides"] = sanitize_score_panel_config(
            overrides_payload
        )

        # Geração dinâmica
        generation_type = cleaned_data.get("generation_type") or QuizDefinicao.GenerationType.MANUAL
        config_payload: Dict[str, object] = {}

        if generation_type == QuizDefinicao.GenerationType.MANUAL:
            if cleaned_data.get("config_manual_shuffle"):
                config_payload["shuffle"] = True
            manual_limit = cleaned_data.get("config_manual_limit")
            if isinstance(manual_limit, int):
                config_payload["limit"] = manual_limit

        elif generation_type == QuizDefinicao.GenerationType.FAVORITES:
            limit = cleaned_data.get("config_favorites_limit")
            if isinstance(limit, int):
                config_payload["limit"] = limit
            sort = cleaned_data.get("config_favorites_sort") or "recent"
            config_payload["sort"] = sort
            if cleaned_data.get("config_favorites_include_inactive"):
                config_payload["include_inactive"] = True

        elif generation_type == QuizDefinicao.GenerationType.FILTERS:
            categories_raw = cleaned_data.get("config_filters_categories")
            if categories_raw:
                category_ids = [cid.strip() for cid in categories_raw.split(",") if cid.strip()]
                config_payload["category_ids"] = category_ids
            difficulties = cleaned_data.get("config_filters_difficulties")
            if difficulties:
                config_payload["difficulty_levels"] = list(difficulties)
            limit = cleaned_data.get("config_filters_limit")
            if isinstance(limit, int):
                config_payload["limit"] = limit
            if cleaned_data.get("config_filters_search"):
                config_payload["search_query"] = cleaned_data.get("config_filters_search")
            if cleaned_data.get("config_filters_only_favorites"):
                config_payload["only_favorites"] = True
            if cleaned_data.get("config_filters_shuffle"):
                config_payload["shuffle"] = True
            method = cleaned_data.get("config_filters_study_method")
            if method:
                config_payload["study_method"] = method

        elif generation_type == QuizDefinicao.GenerationType.REPEAT_LAST:
            limit = cleaned_data.get("config_repeat_limit")
            if isinstance(limit, int):
                config_payload["limit"] = limit
            if cleaned_data.get("config_repeat_include_incomplete"):
                config_payload["include_incomplete"] = True
            use_same = cleaned_data.get("config_repeat_use_same_questions")
            if use_same is not None:
                config_payload["use_same_questions"] = bool(use_same)
            if cleaned_data.get("config_repeat_include_inactive"):
                config_payload["include_inactive"] = True
            if cleaned_data.get("config_repeat_shuffle"):
                config_payload["shuffle"] = True

        cleaned_data["generation_config"] = config_payload

        study_method_override = cleaned_data.get("study_method_override") or None
        cleaned_data["study_method_override"] = study_method_override

        return cleaned_data


def register_score_panel_boolean_fields(form_cls):
    for mode_key, _mode_label in form_cls.get_score_panel_modes():
        for flag_key, label, help_text in form_cls.SCORE_PANEL_FIELDS:
            field_name = form_cls.build_field_name(mode_key, flag_key)
            if field_name not in form_cls.base_fields:
                field = forms.BooleanField(
                    label=label,
                    required=False,
                    help_text=help_text,
                )
                form_cls.base_fields[field_name] = field
                form_cls.declared_fields[field_name] = field


register_score_panel_boolean_fields(ConfiguracoesGeraisQuizForm)
register_score_panel_boolean_fields(QuizDefinicaoAdminForm)
