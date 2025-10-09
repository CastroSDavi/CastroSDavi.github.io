"""Infrastructure for adaptive question selection strategies."""

from __future__ import annotations

import random
from datetime import timedelta
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Type

from django.contrib.auth.models import AbstractBaseUser
from django.db.models import QuerySet
from django.utils import timezone

from quiz.models import UserQuestionStudyState


@dataclass(frozen=True)
class StudyMethodContext:
    """Encapsula metadados relevantes para seleção das perguntas."""

    quiz_mode: Optional[str] = None
    category_ids: Optional[Iterable[str]] = None
    difficulty_levels: Optional[Iterable[str]] = None
    search_query: Optional[str] = None


class StudyMethodStrategy:
    """Contrato base para novos algoritmos de estudo adaptativo."""

    key: str = 'base'
    display_name: str = 'Base'
    description: str = ''
    supports_personalization: bool = False

    def select_question_ids(
        self,
        *,
        user: Optional[AbstractBaseUser],
        base_queryset: QuerySet,
        limit: int,
        context: Optional[StudyMethodContext] = None,
    ) -> List[int]:
        raise NotImplementedError

    def serialize_metadata(self) -> Dict[str, object]:
        return {
            'key': self.key,
            'name': self.display_name,
            'description': self.description,
            'supports_personalization': bool(self.supports_personalization),
        }

    @staticmethod
    def _coerce_limit(limit: Optional[int], max_available: int) -> int:
        if not isinstance(limit, int) or limit <= 0:
            return max_available
        return min(limit, max_available)


class RandomStudyMethod(StudyMethodStrategy):
    """Mantém o comportamento tradicional de seleção aleatória de perguntas."""

    key = 'random'
    display_name = 'Aleatório Clássico'
    description = 'Seleciona questões de forma uniforme sem considerar histórico prévio.'

    def select_question_ids(
        self,
        *,
        user: Optional[AbstractBaseUser],
        base_queryset: QuerySet,
        limit: int,
        context: Optional[StudyMethodContext] = None,
    ) -> List[int]:
        question_ids = list(base_queryset.values_list('pk', flat=True))
        if not question_ids:
            return []

        limit = self._coerce_limit(limit, len(question_ids))
        if limit == len(question_ids):
            return question_ids

        return random.sample(question_ids, limit)


class SpacedRepetitionStudyMethod(StudyMethodStrategy):
    """Implementa um fluxo simplificado inspirado no algoritmo SM-2."""

    key = 'spaced_repetition'
    display_name = 'Revisão Espaçada (SM-2)'
    description = (
        'Prioriza cartões vencidos ou próximos do vencimento com base no fator de facilidade, '
        'abrindo espaço para novas questões quando necessário.'
    )
    supports_personalization = True

    def select_question_ids(
        self,
        *,
        user: Optional[AbstractBaseUser],
        base_queryset: QuerySet,
        limit: int,
        context: Optional[StudyMethodContext] = None,
    ) -> List[int]:
        if not user or not getattr(user, 'is_authenticated', False):
            # Sem usuário autenticado, voltamos ao modo aleatório.
            return RandomStudyMethod().select_question_ids(
                user=user,
                base_queryset=base_queryset,
                limit=limit,
                context=context,
            )

        question_ids = list(base_queryset.values_list('pk', flat=True))
        if not question_ids:
            return []

        limit = self._coerce_limit(limit, len(question_ids))
        if limit == 0:
            return []

        now = timezone.now()
        states = list(
            UserQuestionStudyState.objects.filter(
                user=user,
                pergunta_id__in=question_ids,
            )
        )
        state_by_question = {state.pergunta_id: state for state in states}

        def _due_weight(state: UserQuestionStudyState) -> float:
            due = state.due_at or (now - timedelta(days=365))
            # Prioriza itens atrasados (menor due_at) e com menor sequência de acertos.
            return (due.timestamp(), -float(state.correct_streak))

        due_states = [
            state
            for state in states
            if state.due_at is None or state.due_at <= now
        ]
        due_states.sort(key=_due_weight)

        selected_ids: List[int] = [state.pergunta_id for state in due_states[:limit]]

        if len(selected_ids) < limit:
            backlog = [state for state in states if state.pergunta_id not in selected_ids]
            backlog.sort(
                key=lambda state: (
                    (state.due_at or (now + timedelta(days=365))).timestamp(),
                    state.last_reviewed_at or (now - timedelta(days=365)),
                )
            )
            for state in backlog:
                if len(selected_ids) >= limit:
                    break
                selected_ids.append(state.pergunta_id)

        if len(selected_ids) < limit:
            unseen_ids = [qid for qid in question_ids if qid not in state_by_question]
            random.shuffle(unseen_ids)
            selected_ids.extend(unseen_ids[: limit - len(selected_ids)])

        return selected_ids


class StudyMethodRegistry:
    """Registro simples para centralizar os métodos disponíveis."""

    _strategies: Dict[str, StudyMethodStrategy] = {}
    _default_key: str = 'random'

    @classmethod
    def register(cls, strategy_cls: Type[StudyMethodStrategy]) -> Type[StudyMethodStrategy]:
        instance = strategy_cls()
        if not instance.key:
            raise ValueError('StudyMethodStrategy subclasses must define a non-empty key.')

        cls._strategies[instance.key] = instance
        if cls._default_key not in cls._strategies:
            cls._default_key = instance.key
        return strategy_cls

    @classmethod
    def get_default_key(cls) -> str:
        return cls._default_key

    @classmethod
    def resolve_key(cls, key: Optional[str]) -> str:
        if key and key in cls._strategies:
            return key
        return cls.get_default_key()

    @classmethod
    def get_strategy(cls, key: Optional[str]) -> StudyMethodStrategy:
        resolved = cls.resolve_key(key)
        strategy = cls._strategies.get(resolved)
        if not strategy:
            raise KeyError(f"Nenhuma estratégia registrada para a chave '{resolved}'.")
        return strategy

    @classmethod
    def list_metadata(cls) -> List[Dict[str, object]]:
        return [strategy.serialize_metadata() for strategy in cls._strategies.values()]

    @classmethod
    def get_display_name(cls, key: Optional[str]) -> Optional[str]:
        if not key:
            return None

        strategy = cls._strategies.get(key)
        if strategy:
            return strategy.display_name

        normalized = str(key).strip().lower()
        for registered_key, strategy_instance in cls._strategies.items():
            if registered_key.lower() == normalized:
                return strategy_instance.display_name
        return None


# Registro padrão dos métodos disponíveis.
StudyMethodRegistry.register(RandomStudyMethod)
StudyMethodRegistry.register(SpacedRepetitionStudyMethod)

