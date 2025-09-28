"""Utilities to keep user study states in sync with quiz interactions."""

from __future__ import annotations

from datetime import timedelta
from typing import Optional

from django.contrib.auth.models import AbstractBaseUser
from django.utils import timezone

from quiz.models import Pergunta, SessoesQuizUsuario, UserQuestionStudyState


class StudyProgressService:
    """Atualiza métricas de desempenho individual para algoritmos adaptativos."""

    MIN_EASINESS = 1.3

    @classmethod
    def register_answer(
        cls,
        *,
        user: Optional[AbstractBaseUser],
        pergunta: Pergunta,
        was_correct: Optional[bool],
        session: Optional[SessoesQuizUsuario] = None,
    ) -> Optional[UserQuestionStudyState]:
        if not user or not getattr(user, 'is_authenticated', False):
            return None

        if was_correct is None:
            # Pergunta pulada: não altera algoritmo de revisão.
            return None

        state, _ = UserQuestionStudyState.objects.get_or_create(
            user=user,
            pergunta=pergunta,
        )

        now = timezone.now()
        state.last_reviewed_at = now
        state.last_session = session
        state.last_outcome = was_correct

        if was_correct:
            state.total_correct += 1
            state.correct_streak += 1
            state.incorrect_streak = 0
            state.repetitions += 1
            if state.repetitions == 1:
                state.interval_days = 1
            elif state.repetitions == 2:
                state.interval_days = 6
            else:
                state.interval_days = max(1, int(round(state.interval_days * state.easiness_factor)))
        else:
            state.total_incorrect += 1
            state.correct_streak = 0
            state.incorrect_streak += 1
            state.repetitions = 0
            state.interval_days = 1

        quality = 5 if was_correct else 2
        state.easiness_factor = cls._updated_easiness_factor(state.easiness_factor, quality)

        if was_correct:
            delta = timedelta(days=state.interval_days)
        else:
            # Repetição rápida para erros recentes.
            delta = timedelta(hours=12)

        state.due_at = now + delta
        state.save()
        return state

    @classmethod
    def _updated_easiness_factor(cls, current: float, quality: int) -> float:
        # Fórmula tradicional do SM-2.
        easiness = current + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
        return max(cls.MIN_EASINESS, round(easiness, 4))

