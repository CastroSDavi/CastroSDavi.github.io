"""Utilities for caching and retrieving the singleton quiz configuration."""
from __future__ import annotations

from typing import Optional, TYPE_CHECKING

from django.apps import apps

if TYPE_CHECKING:  # pragma: no cover - only for type checkers
    from .models import ConfiguracoesGeraisQuiz

_DEFAULT_CONFIG_VALUES = {
    'numero_perguntas_quiz_rapido': 10,
    'pontuacao_por_acerto': 15,
    'penalidade_por_erro': 5,
}

_quiz_config_cache: Optional[ConfiguracoesGeraisQuiz] = None


def _get_config_model():
    """Return the ConfiguracoesGeraisQuiz model without causing circular imports."""
    return apps.get_model('quiz', 'ConfiguracoesGeraisQuiz')


def invalidate_quiz_config_cache() -> None:
    """Clear the in-memory cache for the quiz configuration singleton."""
    global _quiz_config_cache
    _quiz_config_cache = None


def get_quiz_config():
    """Fetch the cached quiz configuration, creating it with defaults if necessary."""
    global _quiz_config_cache
    if _quiz_config_cache is None:
        config_model = _get_config_model()
        config, created = config_model.objects.get_or_create(
            pk=1,
            defaults=_DEFAULT_CONFIG_VALUES,
        )
        if created:
            print(
                "INFO: Instância de ConfiguracoesGeraisQuiz (pk=1) criada com valores padrão."
            )
        _quiz_config_cache = config
    return _quiz_config_cache
