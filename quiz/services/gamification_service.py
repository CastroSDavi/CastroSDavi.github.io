"""Utilities for gamifying the MedQuiz experience."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Literal, Sequence


# Experience rewarded for each difficulty level. The "medium" value is used as
# the fallback when the caller does not specify a difficulty.
_DIFFICULTY_EXPERIENCE = {
    "easy": 8,
    "medium": 12,
    "hard": 18,
}


@dataclass(frozen=True)
class AchievementRule:
    """Represents the rule for unlocking a gamification achievement."""

    code: str
    name: str
    description: str
    threshold: int
    metric: Literal["total_correct", "streak", "experience"] = "total_correct"


@dataclass(frozen=True)
class GamificationSnapshot:
    """Immutable representation of the current gamification state."""

    experience: int
    level: int
    correct_answers: int
    wrong_answers: int
    streak: int
    unlocked_achievements: tuple[str, ...]


@dataclass
class GamificationState:
    """Mutable working state used internally by :class:`GamificationService`."""

    experience: int = 0
    level: int = 1
    correct_answers: int = 0
    wrong_answers: int = 0
    streak: int = 0
    unlocked_achievements: list[str] = field(default_factory=list)


_DEFAULT_LEVEL_THRESHOLDS: tuple[int, ...] = (0, 60, 150, 280, 450, 660)
_DEFAULT_ACHIEVEMENTS: tuple[AchievementRule, ...] = (
    AchievementRule(
        code="first_correct",
        name="Primeiro acerto",
        description="Responda corretamente uma questão.",
        threshold=1,
    ),
    AchievementRule(
        code="streak_5",
        name="Embalado",
        description="Acerte cinco questões seguidas.",
        threshold=5,
        metric="streak",
    ),
    AchievementRule(
        code="experience_250",
        name="Experiente",
        description="Acumule 250 pontos de experiência.",
        threshold=250,
        metric="experience",
    ),
)


class GamificationService:
    """Service that encapsulates the quiz gamification rules."""

    def __init__(
        self,
        *,
        level_thresholds: Sequence[int] | None = None,
        achievement_rules: Iterable[AchievementRule] | None = None,
        streak_bonus: int = 2,
    ) -> None:
        self._difficulty_experience = _DIFFICULTY_EXPERIENCE
        self._default_experience = _DIFFICULTY_EXPERIENCE["medium"]
        self._streak_bonus = max(0, streak_bonus)

        thresholds = tuple(level_thresholds or _DEFAULT_LEVEL_THRESHOLDS)
        if not thresholds:
            raise ValueError("level_thresholds must define at least one level")
        if tuple(sorted(thresholds)) != thresholds:
            raise ValueError("level_thresholds must be sorted in ascending order")
        self._level_thresholds = thresholds

        rules = tuple(achievement_rules or _DEFAULT_ACHIEVEMENTS)
        codes = {rule.code for rule in rules}
        if len(codes) != len(rules):
            raise ValueError("achievement_rules codes must be unique")
        self._achievement_rules = rules

        self._state = GamificationState()

    def reset_session(self) -> GamificationSnapshot:
        """Reset all counters for a new quiz session."""

        self._state = GamificationState()
        return self.snapshot()

    def register_answer(
        self,
        *,
        is_correct: bool,
        difficulty: str | None = None,
    ) -> GamificationSnapshot:
        """Record the result of a single question and return the new state."""

        if is_correct:
            self._handle_correct_answer(difficulty)
        else:
            self._handle_wrong_answer()
        self._update_level()
        self._unlock_achievements()
        return self.snapshot()

    def _handle_correct_answer(self, difficulty: str | None) -> None:
        self._state.correct_answers += 1
        self._state.streak += 1

        base_experience = self._difficulty_experience_for(difficulty)
        streak_reward = max(0, self._state.streak - 1) * self._streak_bonus
        self._state.experience += base_experience + streak_reward

    def _handle_wrong_answer(self) -> None:
        self._state.wrong_answers += 1
        self._state.streak = 0

    def _difficulty_experience_for(self, difficulty: str | None) -> int:
        if not difficulty:
            return self._default_experience
        normalized = difficulty.lower()
        return self._difficulty_experience.get(normalized, self._default_experience)

    def _update_level(self) -> None:
        current_level = 1
        for index, threshold in enumerate(self._level_thresholds, start=1):
            if self._state.experience >= threshold:
                current_level = index
            else:
                break
        self._state.level = current_level

    def _unlock_achievements(self) -> None:
        unlocked = set(self._state.unlocked_achievements)
        for rule in self._achievement_rules:
            if rule.code in unlocked:
                continue
            progress_value = self._resolve_metric(rule.metric)
            if progress_value >= rule.threshold:
                unlocked.add(rule.code)
        self._state.unlocked_achievements = sorted(unlocked)

    def _resolve_metric(self, metric: str) -> int:
        if metric == "streak":
            return self._state.streak
        if metric == "experience":
            return self._state.experience
        return self._state.correct_answers

    def snapshot(self) -> GamificationSnapshot:
        """Return an immutable view of the current gamification state."""

        state = self._state
        return GamificationSnapshot(
            experience=state.experience,
            level=state.level,
            correct_answers=state.correct_answers,
            wrong_answers=state.wrong_answers,
            streak=state.streak,
            unlocked_achievements=tuple(state.unlocked_achievements),
        )

