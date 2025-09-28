"""Score panel helpers shared by admin forms."""

from typing import Dict, Iterable, Tuple

from django import forms
from django.utils.text import slugify

from quiz.models import (
    ConfiguracoesGeraisQuiz,
    DEFAULT_SCORE_PANEL_SETTINGS,
    QuizDefinicao,
    SessoesQuizUsuario,
    get_registered_score_panel_modes,
    sanitize_score_panel_config,
)


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

    class Meta:
        model = QuizDefinicao
        fields = "__all__"

    @classmethod
    def get_score_panel_modes(cls) -> Iterable[Tuple[str, str]]:
        return get_score_panel_modes_with_labels()

    @classmethod
    def build_field_name(cls, mode_key: str, flag_key: str) -> str:
        return ConfiguracoesGeraisQuizForm.build_field_name(mode_key, flag_key)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        if "score_panel_overrides" in self.fields:
            self.fields["score_panel_overrides"].widget = forms.HiddenInput()
            self.fields["score_panel_overrides"].required = False

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
