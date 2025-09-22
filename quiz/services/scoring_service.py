"""Rules and helpers for computing session scores and gamification XP."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, List, Optional

from django.utils import timezone

from quiz.models import ConfiguracoesGeraisQuiz, RespostasUsuarioPorSessao


@dataclass
class ResponseScore:
    """Represents the scoring outcome for a single response."""

    response_id: int
    pontos: int
    xp: int
    multiplicador: float
    foi_correta: Optional[bool]
    dificuldade: Optional[str]


@dataclass
class SessionScoreResult:
    """Aggregated totals for a quiz session."""

    total_points: int
    total_xp: int
    total_correct: int
    total_incorrect: int
    total_answered: int
    current_streak: int
    best_streak: int
    response_scores: List[ResponseScore]
    secondary_xp_bonus: int = 0

    @property
    def last_multiplier(self) -> float:
        if not self.response_scores:
            return 1.0
        return self.response_scores[-1].multiplicador


class ScoringService:
    """Encapsula a lógica de pontuação dinâmica baseada em configurações."""

    def __init__(self, config: ConfiguracoesGeraisQuiz):
        self.config = config

    @staticmethod
    def _normalize_difficulty_label(difficulty: Optional[str]) -> str:
        if not difficulty:
            return ''
        return str(difficulty).strip().lower()

    def _get_difficulty_xp_bonus(self, difficulty: Optional[str]) -> float:
        label = self._normalize_difficulty_label(difficulty)
        if label in {'difícil', 'dificil'}:
            return 0.5
        if label in {'médio', 'medio'}:
            return 0.25
        if label in {'fácil', 'facil'}:
            return 0.1
        return 0.0

    def _calculate_secondary_xp_bonus(
        self,
        *,
        total_correct: int,
        total_answered: int,
        best_streak: int,
        duration_seconds: Optional[int],
    ) -> float:
        bonus = 0.0
        if total_answered > 0:
            accuracy = total_correct / total_answered
            if accuracy >= 0.95:
                bonus += 15.0
            elif accuracy >= 0.8:
                bonus += 8.0

        if best_streak >= 10:
            bonus += 10.0
        elif best_streak >= 5:
            bonus += 5.0

        if duration_seconds and total_answered > 0:
            avg_time = duration_seconds / total_answered
            if avg_time < 20:
                bonus += 5.0
            elif avg_time < 40:
                bonus += 2.0

        return bonus

    def compute_session_result(
        self,
        responses: Iterable[RespostasUsuarioPorSessao],
        *,
        session: Optional[Any] = None,
        duration_seconds: Optional[int] = None,
    ) -> SessionScoreResult:
        """Calcula a pontuação consolidada de uma sessão."""

        responses_list = list(responses)
        responses_list.sort(key=lambda r: (r.data_resposta or timezone.now(), r.pk))

        session_duration = duration_seconds
        if session_duration is None and session is not None:
            session_duration = getattr(session, 'tempo_total_segundos', None)
            if session_duration in (None, 0) and getattr(session, 'data_inicio', None) and getattr(session, 'data_fim', None):
                delta = session.data_fim - session.data_inicio
                session_duration = int(max(delta.total_seconds(), 0))

        total_points_raw = 0.0
        total_xp = 0.0
        total_correct = 0
        total_incorrect = 0
        total_answered = 0
        current_streak = 0
        best_streak = 0
        response_scores: List[ResponseScore] = []

        for response in responses_list:
            pergunta = getattr(response, "id_pergunta", None)
            dificuldade = getattr(pergunta, "nivel_dificuldade", None)
            rule = self.config.get_difficulty_rule(dificuldade or "")
            difficulty_bonus_factor = self._get_difficulty_xp_bonus(dificuldade)

            base_points = float(rule.get("points", self.config.pontuacao_por_acerto))
            base_xp = float(rule.get("xp", self.config.pontuacao_por_acerto))
            penalty = float(rule.get("penalty", self.config.penalidade_por_erro))

            pontos_resposta = 0.0
            xp_resposta = 0.0
            multiplicador = 1.0

            if response.id_opcao_resposta_selecionada_id is not None:
                total_answered += 1

            if response.foi_correta:
                total_correct += 1
                current_streak += 1
                multiplicador = 1.0 + (self.config.get_bonus_percent_for_streak(current_streak) / 100.0)
                multiplicador = min(multiplicador, self.config.get_max_bonus_multiplier())
                pontos_resposta = base_points * multiplicador
                xp_resposta = base_xp * multiplicador
                xp_resposta += base_xp * difficulty_bonus_factor
            elif response.foi_correta is False and response.id_opcao_resposta_selecionada_id is not None:
                total_incorrect += 1
                current_streak = 0
                pontos_resposta = -abs(penalty)
                multiplicador = 1.0
            else:
                # Pergunta pulada ou ainda não respondida
                current_streak = 0
                multiplicador = 1.0

            best_streak = max(best_streak, current_streak)
            total_points_raw += pontos_resposta
            total_xp += xp_resposta

            response_scores.append(
                ResponseScore(
                    response_id=response.pk,
                    pontos=int(round(pontos_resposta)),
                    xp=int(round(max(xp_resposta, 0))),
                    multiplicador=float(multiplicador),
                    foi_correta=response.foi_correta,
                    dificuldade=dificuldade,
                )
            )

        total_points = int(round(max(total_points_raw, 0)))
        total_xp_int = int(round(max(total_xp, 0)))

        secondary_bonus = self._calculate_secondary_xp_bonus(
            total_correct=total_correct,
            total_answered=total_answered,
            best_streak=best_streak,
            duration_seconds=session_duration,
        )
        secondary_bonus_int = int(round(max(secondary_bonus, 0)))
        total_xp_int += secondary_bonus_int

        return SessionScoreResult(
            total_points=total_points,
            total_xp=total_xp_int,
            total_correct=total_correct,
            total_incorrect=total_incorrect,
            total_answered=total_answered,
            current_streak=current_streak,
            best_streak=best_streak,
            response_scores=response_scores,
            secondary_xp_bonus=secondary_bonus_int,
        )
