"""Services encapsulating quiz statistics business rules."""

from __future__ import annotations

import re
from datetime import timedelta
from typing import Optional

from django.db import models
from django.db.models import Sum
from django.utils import timezone

from quiz.models import EstatisticasDiariasUsuario, SessoesQuizUsuario


class StatisticsService:
    period_regex = re.compile(r"^(\d+)(d)?$")

    @classmethod
    def filter_queryset_by_period(cls, queryset, period_str: Optional[str], date_field_name: str = "data_estatistica"):
        normalized_period = str(period_str).strip().lower() if period_str is not None else "30d"

        if normalized_period == "all":
            return queryset

        days = None

        if isinstance(period_str, (int, float)):
            try:
                days = int(period_str)
            except (TypeError, ValueError):
                days = None
        else:
            match = cls.period_regex.match(normalized_period)
            if match:
                days = int(match.group(1))

        if not days or days <= 0:
            days = 30

        current_ts = timezone.now()

        try:
            model_field = queryset.model._meta.get_field(date_field_name)
        except models.FieldDoesNotExist:
            return queryset.none()

        if isinstance(model_field, models.DateTimeField):
            end_range = current_ts.replace(hour=23, minute=59, second=59, microsecond=999999)
            start_range_dt = current_ts - timedelta(days=days - 1)
            start_range = start_range_dt.replace(hour=0, minute=0, second=0, microsecond=0)
            filter_kwargs = {
                f"{date_field_name}__gte": start_range,
                f"{date_field_name}__lte": end_range,
            }
        elif isinstance(model_field, models.DateField):
            today_date_obj = current_ts.date()
            start_date_obj = today_date_obj - timedelta(days=days - 1)
            filter_kwargs = {
                f"{date_field_name}__gte": start_date_obj,
                f"{date_field_name}__lte": today_date_obj,
            }
        else:
            return queryset.none()

        return queryset.filter(**filter_kwargs)

    @staticmethod
    def get_key_metrics(user, daily_stats_period_qs):
        total_questions_answered_period = daily_stats_period_qs.aggregate(
            total=Sum("perguntas_respondidas_dia")
        )["total"] or 0
        total_study_time_seconds_period = daily_stats_period_qs.aggregate(
            total=Sum("tempo_estudo_segundos_dia")
        )["total"] or 0
        total_xp_period = daily_stats_period_qs.aggregate(
            total=Sum("xp_ganho_dia")
        )["total"] or 0

        latest_daily_stat = (
            EstatisticasDiariasUsuario.objects.filter(id_usuario=user).order_by("-data_estatistica").first()
        )
        max_streak = latest_daily_stat.sequencia_dias_quiz if latest_daily_stat else 0

        total_score_all_time = SessoesQuizUsuario.objects.filter(
            id_usuario=user, status_sessao=SessoesQuizUsuario.StatusSessao.COMPLETA
        ).aggregate(total_score=Sum("pontuacao_final"))["total_score"] or 0
        total_xp_all_time = SessoesQuizUsuario.objects.filter(
            id_usuario=user, status_sessao=SessoesQuizUsuario.StatusSessao.COMPLETA
        ).aggregate(total_xp=Sum("xp_total_sessao"))["total_xp"] or 0

        return {
            "total_questions_answered": total_questions_answered_period,
            "max_streak": max_streak,
            "total_score_all_time": total_score_all_time,
            "total_xp_all_time": total_xp_all_time,
            "total_study_time_seconds": total_study_time_seconds_period,
            "total_xp_period": total_xp_period,
        }

    @staticmethod
    def _get_previous_daily_stat(stats: EstatisticasDiariasUsuario):
        if not stats or not stats.data_estatistica:
            return None

        previous_date = stats.data_estatistica - timedelta(days=1)
        return (
            EstatisticasDiariasUsuario.objects.filter(
                id_usuario=stats.id_usuario,
                data_estatistica=previous_date,
            )
            .order_by("-data_estatistica")
            .first()
        )

    @classmethod
    def initialize_daily_streak(cls, stats: EstatisticasDiariasUsuario) -> bool:
        """Ensure new daily stat records inherit the correct streak baseline."""

        if (
            not stats
            or stats.perguntas_respondidas_dia > 0
            or stats.sequencia_dias_quiz
        ):
            return False

        previous_stat = cls._get_previous_daily_stat(stats)
        base_streak = 0
        if previous_stat and previous_stat.perguntas_respondidas_dia > 0:
            base_streak = previous_stat.sequencia_dias_quiz or 0

        if stats.sequencia_dias_quiz != base_streak:
            stats.sequencia_dias_quiz = base_streak
            return True
        return False

    @classmethod
    def update_daily_streak_after_activity(
        cls,
        stats: EstatisticasDiariasUsuario,
        *,
        had_activity_before: bool = False,
    ) -> bool:
        """Update the user's consecutive-day streak once activity is registered."""

        if not stats or stats.perguntas_respondidas_dia <= 0:
            return False

        if had_activity_before and stats.sequencia_dias_quiz > 0:
            return False

        previous_stat = cls._get_previous_daily_stat(stats)

        if previous_stat and previous_stat.perguntas_respondidas_dia > 0:
            new_streak = (previous_stat.sequencia_dias_quiz or 0) + 1
        else:
            new_streak = 1

        if stats.sequencia_dias_quiz != new_streak:
            stats.sequencia_dias_quiz = new_streak
            return True
        return False
