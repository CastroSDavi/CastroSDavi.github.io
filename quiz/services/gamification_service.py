"""Utilities for updating gamification profiles and achievements."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count, Max
from django.utils import timezone

from quiz.models import (
    Conquista,
    ConquistaUsuario,
    EstatisticasDiariasUsuario,
    DesafioDinamico,
    NivelGamificacao,
    PerfilGamificacaoUsuario,
    ProgressoDesafioUsuario,
    RecompensaNivelResgatada,
    SessoesQuizUsuario,
)
from quiz.services.scoring_service import SessionScoreResult


@dataclass
class GamificationUpdateResult:
    """Resumo da atualização de gamificação."""

    profile: PerfilGamificacaoUsuario
    conquistas_desbloqueadas: int
    snapshot: Dict[str, Any]
    desafios_concluidos: int


@dataclass
class GamificationContext:
    """Estado agregado reutilizado durante o processamento de gamificação."""

    daily_stats: Optional[EstatisticasDiariasUsuario]
    daily_questions: int
    daily_xp: int
    daily_streak: int
    session_metrics: Dict[str, Any]
    reference_time: datetime


class GamificationService:
    """Aplica regras de gamificação ao final de uma sessão."""

    def ensure_profile(self, user) -> PerfilGamificacaoUsuario:
        profile, _ = PerfilGamificacaoUsuario.objects.get_or_create(user=user)
        return profile

    def _build_context(
        self,
        profile: PerfilGamificacaoUsuario,
        *,
        daily_stats: Optional[EstatisticasDiariasUsuario] = None,
    ) -> GamificationContext:
        reference_time = timezone.now()

        daily_stat_reference = daily_stats
        if not daily_stat_reference:
            daily_stat_reference = (
                EstatisticasDiariasUsuario.objects.filter(id_usuario=profile.user)
                .order_by('-data_estatistica')
                .first()
            )

        perguntas_dia = 0
        xp_diario = 0
        daily_streak = 0

        if daily_stat_reference:
            perguntas_dia = daily_stat_reference.perguntas_respondidas_dia or 0
            xp_diario = daily_stat_reference.xp_ganho_dia or 0
            if perguntas_dia > 0:
                daily_streak = daily_stat_reference.sequencia_dias_quiz or 0

        sessions_qs = SessoesQuizUsuario.objects.filter(
            id_usuario=profile.user,
            status_sessao=SessoesQuizUsuario.StatusSessao.COMPLETA,
        )
        session_metrics = sessions_qs.aggregate(
            max_score=Max('pontuacao_final'),
            max_correct=Max('total_acertos'),
            total_sessions=Count('id'),
        )

        return GamificationContext(
            daily_stats=daily_stat_reference,
            daily_questions=perguntas_dia,
            daily_xp=xp_diario,
            daily_streak=daily_streak,
            session_metrics=session_metrics,
            reference_time=reference_time,
        )

    @transaction.atomic
    def apply_session_result(
        self,
        user,
        sessao: SessoesQuizUsuario,
        score_result: SessionScoreResult,
        daily_stats: Optional[EstatisticasDiariasUsuario] = None,
    ) -> GamificationUpdateResult:
        profile = self.ensure_profile(user)

        nivel_anterior = profile.nivel_atual

        fields_to_update = ['xp_total', 'sequencia_atual', 'ultima_atualizacao']
        profile.xp_total += max(score_result.total_xp, 0)
        profile.sequencia_atual = score_result.current_streak
        if score_result.best_streak > profile.melhor_sequencia_geral:
            profile.melhor_sequencia_geral = score_result.best_streak
            fields_to_update.append('melhor_sequencia_geral')

        profile.save(update_fields=fields_to_update)
        profile.atualizar_nivel()

        context = self._build_context(profile, daily_stats=daily_stats)

        conquistas_novas = self._unlock_achievements(
            profile,
            sessao,
            score_result,
            context=context,
        )

        desafios_atualizados = self._update_dynamic_challenges(
            profile,
            sessao,
            score_result,
            context=context,
        )

        snapshot = self._serialize_profile(
            profile=profile,
            xp_ganho=score_result.total_xp,
            conquistas_novas=conquistas_novas,
            nivel_anterior=nivel_anterior,
            context=context,
            challenges_updates=desafios_atualizados,
        )

        return GamificationUpdateResult(
            profile=profile,
            conquistas_desbloqueadas=len(conquistas_novas),
            snapshot=snapshot,
            desafios_concluidos=sum(1 for _, concluido in desafios_atualizados if concluido),
        )

    def get_profile_snapshot(
        self,
        user,
        *,
        include_catalog: bool = False,
    ) -> Dict[str, Any]:
        """Retorna um snapshot serializado do perfil de gamificação do usuário."""

        profile = self.ensure_profile(user)
        profile.atualizar_nivel()
        daily_stats = (
            EstatisticasDiariasUsuario.objects.filter(id_usuario=user)
            .order_by('-data_estatistica')
            .first()
        )
        context = self._build_context(profile, daily_stats=daily_stats)
        return self._serialize_profile(
            profile=profile,
            xp_ganho=0,
            conquistas_novas=None,
            nivel_anterior=None,
            include_catalog=include_catalog,
            context=context,
        )

    def _unlock_achievements(
        self,
        profile: PerfilGamificacaoUsuario,
        sessao: SessoesQuizUsuario,
        score_result: SessionScoreResult,
        *,
        context: GamificationContext,
    ) -> List[ConquistaUsuario]:
        conquistas_disponiveis = Conquista.objects.all()
        ja_desbloqueadas = set(profile.conquistas.values_list('id', flat=True))
        a_criar: List[Dict[str, Any]] = []

        perguntas_dia = context.daily_questions
        xp_diario_val = context.daily_xp
        daily_streak = context.daily_streak
        session_metrics = context.session_metrics or {}
        total_sessions_completed = session_metrics.get('total_sessions') or 0

        for conquista in conquistas_disponiveis:
            if conquista.id in ja_desbloqueadas:
                continue

            criterio = conquista.criterio_json or {}
            tipo = str(criterio.get('tipo', '')).lower()
            valor = criterio.get('valor')
            if valor in (None, ''):
                continue

            try:
                valor_num = float(valor)
            except (TypeError, ValueError):
                continue

            if tipo == 'xp_total' and profile.xp_total >= valor_num:
                a_criar.append({'conquista': conquista, 'metadata': {'xp_total': profile.xp_total}})
            elif tipo == 'melhor_sequencia' and score_result.best_streak >= valor_num:
                a_criar.append({'conquista': conquista, 'metadata': {'melhor_sequencia': score_result.best_streak}})
            elif tipo == 'pontuacao_sessao' and sessao.pontuacao_final >= valor_num:
                a_criar.append({'conquista': conquista, 'metadata': {'pontuacao': sessao.pontuacao_final}})
            elif tipo == 'respostas_corretas_sessao' and score_result.total_correct >= valor_num:
                a_criar.append({'conquista': conquista, 'metadata': {'acertos': score_result.total_correct}})
            elif tipo == 'dias_consecutivos' and daily_streak >= valor_num:
                a_criar.append({'conquista': conquista, 'metadata': {'dias_consecutivos': daily_streak}})
            elif tipo == 'quizzes_completos' and total_sessions_completed >= valor_num:
                a_criar.append({'conquista': conquista, 'metadata': {'quizzes_completos': total_sessions_completed}})
            elif tipo == 'perguntas_diarias' and perguntas_dia >= valor_num:
                a_criar.append({'conquista': conquista, 'metadata': {'perguntas_diarias': perguntas_dia}})
            elif tipo == 'xp_diario' and xp_diario_val >= valor_num:
                a_criar.append({'conquista': conquista, 'metadata': {'xp_diario': xp_diario_val}})

        criadas: List[ConquistaUsuario] = []
        for payload in a_criar:
            conquista_obj = payload['conquista']
            metadata = payload.get('metadata') or {}
            conquista_relacao = ConquistaUsuario.objects.create(
                perfil=profile,
                conquista=conquista_obj,
                metadata=metadata,
            )
            criadas.append(conquista_relacao)

        return criadas

    def _resolve_challenge_metric(
        self,
        *,
        challenge: DesafioDinamico,
        sessao: SessoesQuizUsuario,
        score_result: SessionScoreResult,
        context: GamificationContext,
    ) -> Optional[Tuple[str, float]]:
        metric_type = challenge.get_metric_type()
        if not metric_type:
            return None

        metric_type = metric_type.lower()
        if metric_type == 'xp_total':
            return 'accumulate', float(max(score_result.total_xp, 0))
        if metric_type == 'xp_diario':
            return 'accumulate', float(max(score_result.total_xp, 0))
        if metric_type == 'perguntas_diarias':
            return 'accumulate', float(max(score_result.total_answered, 0))
        if metric_type == 'quizzes_completos':
            return 'accumulate', 1.0 if sessao.status_sessao == SessoesQuizUsuario.StatusSessao.COMPLETA else 0.0
        if metric_type == 'pontuacao_sessao':
            value = sessao.pontuacao_final if sessao and sessao.pontuacao_final is not None else score_result.total_points
            return 'max', float(max(value or 0, 0))
        if metric_type == 'respostas_corretas_sessao':
            return 'max', float(max(score_result.total_correct, 0))
        if metric_type == 'melhor_sequencia':
            return 'max', float(max(score_result.best_streak, 0))
        if metric_type == 'dias_consecutivos':
            return 'max', float(max(context.daily_streak, 0))
        return None

    def _update_dynamic_challenges(
        self,
        profile: PerfilGamificacaoUsuario,
        sessao: SessoesQuizUsuario,
        score_result: SessionScoreResult,
        *,
        context: GamificationContext,
    ) -> List[Tuple[ProgressoDesafioUsuario, bool]]:
        active_challenges = list(DesafioDinamico.objects.ativos(context.reference_time))
        if not active_challenges:
            return []

        progress_map = {
            progress.desafio_id: progress
            for progress in ProgressoDesafioUsuario.objects.filter(
                perfil=profile,
                desafio__in=active_challenges,
            )
        }

        updates: List[Tuple[ProgressoDesafioUsuario, bool]] = []
        for challenge in active_challenges:
            progress = progress_map.get(challenge.id)
            if not progress:
                progress = ProgressoDesafioUsuario.objects.create(
                    desafio=challenge,
                    perfil=profile,
                    janela_inicio=challenge.data_inicio,
                    janela_fim=challenge.data_fim,
                )
                progress_map[challenge.id] = progress

            window_reset = progress.reset_for_challenge_window(challenge)

            metric_payload = self._resolve_challenge_metric(
                challenge=challenge,
                sessao=sessao,
                score_result=score_result,
                context=context,
            )

            if metric_payload is None:
                if window_reset:
                    progress.save(
                        update_fields=[
                            'valor_atual',
                            'concluido',
                            'data_conclusao',
                            'metadata',
                            'janela_inicio',
                            'janela_fim',
                        ]
                    )
                    updates.append((progress, False))
                continue

            strategy, measurement = metric_payload
            measurement = float(measurement or 0.0)

            target_value = challenge.get_target_value()
            previous_value = progress.valor_atual
            previous_completed = progress.concluido
            fields_to_update: List[str] = []

            if window_reset:
                fields_to_update.extend(
                    ['valor_atual', 'concluido', 'data_conclusao', 'metadata', 'janela_inicio', 'janela_fim']
                )

            new_value = previous_value
            changed = window_reset

            if strategy == 'accumulate':
                if measurement > 0:
                    new_value = previous_value + measurement
                    changed = True
            elif strategy == 'max':
                new_value = max(previous_value, measurement)
                changed = changed or new_value != previous_value
            else:
                new_value = max(measurement, 0.0)
                changed = changed or new_value != previous_value

            if target_value > 0:
                new_value = min(new_value, target_value)

            if new_value != progress.valor_atual:
                progress.valor_atual = new_value
                if 'valor_atual' not in fields_to_update:
                    fields_to_update.append('valor_atual')

            metadata = progress.metadata or {}
            metadata['ultima_contribuicao'] = measurement
            metadata['atualizado_em'] = context.reference_time.isoformat()
            progress.metadata = metadata
            if 'metadata' not in fields_to_update:
                fields_to_update.append('metadata')

            newly_completed = False
            if target_value > 0 and progress.valor_atual >= target_value:
                if not progress.concluido:
                    newly_completed = True
                progress.concluido = True
                progress.data_conclusao = context.reference_time
                fields_to_update.extend(['concluido', 'data_conclusao'])
            elif progress.concluido and progress.valor_atual < target_value:
                progress.concluido = False
                progress.data_conclusao = None
                fields_to_update.extend(['concluido', 'data_conclusao'])

            if fields_to_update:
                if 'atualizado_em' not in fields_to_update:
                    fields_to_update.append('atualizado_em')
                progress.save(update_fields=list(dict.fromkeys(fields_to_update)))
                changed = True

            if changed or newly_completed or previous_completed != progress.concluido:
                updates.append((progress, newly_completed))

        return updates

    def _serialize_profile(
        self,
        *,
        profile: PerfilGamificacaoUsuario,
        xp_ganho: int,
        conquistas_novas: Optional[List[ConquistaUsuario]] = None,
        nivel_anterior: Optional[NivelGamificacao] = None,
        include_catalog: bool = False,
        context: Optional[GamificationContext] = None,
        challenges_updates: Optional[List[Tuple[ProgressoDesafioUsuario, bool]]] = None,
    ) -> Dict[str, Any]:
        """Transforma o perfil em um payload amigável para o frontend."""

        xp_ganho_int = int(max(xp_ganho or 0, 0))

        context_obj = context or self._build_context(profile)
        daily_stats_obj = context_obj.daily_stats

        daily_engagement_payload = None
        if daily_stats_obj:
            daily_engagement_payload = {
                'date': daily_stats_obj.data_estatistica.isoformat(),
                'questions_today': daily_stats_obj.perguntas_respondidas_dia,
                'correct_today': daily_stats_obj.acertos_dia,
                'xp_today': daily_stats_obj.xp_ganho_dia,
                'points_today': daily_stats_obj.pontos_dia,
                'streak_days': daily_stats_obj.sequencia_dias_quiz,
                'has_activity_today': daily_stats_obj.perguntas_respondidas_dia > 0,
            }

        daily_streak_value = 0
        if daily_engagement_payload:
            daily_streak_value = daily_engagement_payload.get('streak_days') or 0
        elif context_obj:
            daily_streak_value = context_obj.daily_streak

        session_metrics = context_obj.session_metrics or {}

        conquistas_relacoes = list(
            profile.conquistas_usuarios.select_related('conquista').order_by('-data_conquista')
        )
        conquistas_novas = conquistas_novas or []

        total_desbloqueadas = len(conquistas_relacoes)
        total_disponiveis = Conquista.objects.count()

        current_level = profile.nivel_atual
        next_level = None
        if current_level:
            next_level = (
                NivelGamificacao.objects.filter(xp_minimo__gt=current_level.xp_minimo)
                .order_by('ordem', 'xp_minimo')
                .first()
            )
        else:
            next_level = (
                NivelGamificacao.objects.filter(xp_minimo__gt=profile.xp_total)
                .order_by('ordem', 'xp_minimo')
                .first()
            )

        xp_base = current_level.xp_minimo if current_level else 0
        xp_limite = None
        if current_level and current_level.xp_maximo is not None:
            xp_limite = current_level.xp_maximo
        elif next_level:
            xp_limite = next_level.xp_minimo

        xp_dentro_nivel = max(profile.xp_total - xp_base, 0)
        if xp_limite:
            intervalo = max(xp_limite - xp_base, 1)
            progresso_percent = max(0.0, min((xp_dentro_nivel / intervalo) * 100, 100.0))
            xp_para_proximo = max(xp_limite - profile.xp_total, 0)
        else:
            progresso_percent = 100.0 if profile.xp_total >= xp_base else 0.0
            xp_para_proximo = None

        def _serialize_relacao(relacao: ConquistaUsuario) -> Dict[str, Any]:
            conquista = relacao.conquista
            return {
                'slug': conquista.slug,
                'nome': conquista.nome,
                'descricao': conquista.descricao,
                'icone': conquista.icone,
                'data_conquista': relacao.data_conquista.isoformat() if relacao.data_conquista else None,
                'metadata': relacao.metadata or {},
            }

        conquistas_recentemente = [_serialize_relacao(rel) for rel in conquistas_novas]
        conquistas_recentes = [_serialize_relacao(rel) for rel in conquistas_relacoes[:3]]

        relacoes_por_conquista = {rel.conquista_id: rel for rel in conquistas_relacoes}
        catalogo_conquistas_itens: List[Dict[str, Any]] = []
        upcoming_candidates: List[Dict[str, Any]] = []
        for conquista in Conquista.objects.all().order_by('ordem_exibicao', 'nome'):
            rel = relacoes_por_conquista.get(conquista.id)
            progress_payload = self._build_achievement_progress(
                conquista=conquista,
                profile=profile,
                context=context_obj,
            )

            if rel is None and progress_payload:
                upcoming_candidates.append(
                    {
                        'slug': conquista.slug,
                        'nome': conquista.nome,
                        'descricao': conquista.descricao,
                        'icone': conquista.icone,
                        'progress': progress_payload,
                    }
                )

            if include_catalog:
                catalogo_conquistas_itens.append(
                    {
                        'slug': conquista.slug,
                        'nome': conquista.nome,
                        'descricao': conquista.descricao,
                        'icone': conquista.icone,
                        'is_unlocked': rel is not None,
                        'data_conquista': rel.data_conquista.isoformat() if rel and rel.data_conquista else None,
                        'metadata': rel.metadata if rel else {},
                        'progress': progress_payload,
                    }
                )

        catalogo_conquistas: Optional[List[Dict[str, Any]]] = (
            catalogo_conquistas_itens if include_catalog else None
        )
        upcoming_highlights = sorted(
            upcoming_candidates,
            key=lambda item: (-item['progress']['percent'], item['nome']),
        )[:3]

        current_level_payload = None
        if current_level:
            current_level_payload = {
                'id': current_level.id,
                'identificador': current_level.identificador,
                'nome': current_level.nome,
                'descricao': current_level.descricao,
                'xp_minimo': current_level.xp_minimo,
                'xp_maximo': current_level.xp_maximo,
            }

        next_level_payload = None
        if next_level:
            next_level_payload = {
                'id': next_level.id,
                'identificador': next_level.identificador,
                'nome': next_level.nome,
                'xp_minimo': next_level.xp_minimo,
            }

        previous_level_payload = None
        if nivel_anterior:
            previous_level_payload = {
                'id': nivel_anterior.id,
                'identificador': nivel_anterior.identificador,
                'nome': nivel_anterior.nome,
            }

        level_up = False
        if nivel_anterior or current_level:
            prev_id = getattr(nivel_anterior, 'id', None)
            atual_id = getattr(current_level, 'id', None)
            level_up = atual_id is not None and atual_id != prev_id

        return {
            'xp_total': profile.xp_total,
            'xp_ganho': xp_ganho_int,
            'current_streak': profile.sequencia_atual,
            'best_streak': profile.melhor_sequencia_geral,
            'level_up': level_up,
            'level': current_level_payload,
            'previous_level': previous_level_payload,
            'next_level': next_level_payload,
            'progress': {
                'percent': round(progresso_percent, 2),
                'xp_into_level': xp_dentro_nivel,
                'xp_range_start': xp_base,
                'xp_range_end': xp_limite,
                'xp_to_next_level': xp_para_proximo,
            },
            'daily_engagement': daily_engagement_payload,
            'achievements': {
                'total_unlocked': total_desbloqueadas,
                'total_available': total_disponiveis,
                'newly_unlocked': conquistas_recentemente,
                'recent': conquistas_recentes,
                'catalog': catalogo_conquistas,
                'upcoming': upcoming_highlights,
            },
            'challenges': self._serialize_challenges(
                profile=profile,
                context=context_obj,
                recently_updated=challenges_updates,
            ),
            'rewards': self._serialize_rewards(profile=profile, current_level=current_level),
        }

    def _build_achievement_progress(
        self,
        *,
        conquista: Conquista,
        profile: PerfilGamificacaoUsuario,
        context: GamificationContext,
    ) -> Optional[Dict[str, Any]]:
        criterio = conquista.criterio_json or {}
        tipo = str(criterio.get('tipo', '')).lower()
        valor = criterio.get('valor')
        if valor in (None, ''):
            return None

        try:
            target_value = float(valor)
        except (TypeError, ValueError):
            return None

        if target_value <= 0:
            return None

        daily_stats = context.daily_stats
        daily_streak = context.daily_streak
        session_metrics = context.session_metrics or {}

        unit_label = 'progresso'
        if tipo == 'xp_total':
            current_value = profile.xp_total
            unit_label = 'XP'
        elif tipo == 'melhor_sequencia':
            current_value = profile.melhor_sequencia_geral
            unit_label = 'acertos'
        elif tipo == 'pontuacao_sessao':
            current_value = session_metrics.get('max_score') or 0
            unit_label = 'pontos'
        elif tipo == 'respostas_corretas_sessao':
            current_value = session_metrics.get('max_correct') or 0
            unit_label = 'acertos'
        elif tipo == 'dias_consecutivos':
            current_value = daily_streak
            unit_label = 'dias'
        elif tipo == 'quizzes_completos':
            current_value = session_metrics.get('total_sessions') or 0
            unit_label = 'quizzes'
        elif tipo == 'perguntas_diarias':
            current_value = daily_stats.perguntas_respondidas_dia if daily_stats else 0
            unit_label = 'perguntas'
        elif tipo == 'xp_diario':
            current_value = daily_stats.xp_ganho_dia if daily_stats else 0
            unit_label = 'XP'
        else:
            return None

        current_value = max(float(current_value), 0.0)
        percent = 0.0
        if target_value:
            percent = max(0.0, min((current_value / target_value) * 100, 100.0))

        current_int = int(round(current_value))
        target_int = int(round(target_value))
        remaining_int = max(target_int - current_int, 0)

        if remaining_int > 0:
            remaining_label = f"Faltam {remaining_int} {unit_label}"
        else:
            remaining_label = 'Meta alcançada'

        label = f"{current_int} / {target_int} {unit_label}"

        return {
            'metric': tipo,
            'current': current_int,
            'target': target_int,
            'percent': round(percent, 1),
            'label': label,
            'remaining_label': remaining_label,
            'unit': unit_label,
        }

    def _serialize_challenges(
        self,
        *,
        profile: PerfilGamificacaoUsuario,
        context: GamificationContext,
        recently_updated: Optional[List[Tuple[ProgressoDesafioUsuario, bool]]],
    ) -> Dict[str, Any]:
        active_challenges = list(DesafioDinamico.objects.ativos(context.reference_time))
        if not active_challenges:
            return {'active': [], 'completed_now': [], 'total_active': 0}

        progress_map = {
            progress.desafio_id: progress
            for progress in ProgressoDesafioUsuario.objects.filter(
                perfil=profile,
                desafio__in=active_challenges,
            )
        }

        active_payload: List[Dict[str, Any]] = []
        for challenge in active_challenges:
            progress = progress_map.get(challenge.id)
            if not progress:
                progress = ProgressoDesafioUsuario(
                    desafio=challenge,
                    perfil=profile,
                    janela_inicio=challenge.data_inicio,
                    janela_fim=challenge.data_fim,
                )
            active_payload.append(
                self._serialize_single_challenge(
                    challenge=challenge,
                    progress=progress,
                    reference_time=context.reference_time,
                )
            )

        completed_payload: List[Dict[str, Any]] = []
        if recently_updated:
            seen_ids = set()
            for progress, completed_now in recently_updated:
                if completed_now and progress.desafio_id not in seen_ids:
                    completed_payload.append(
                        self._serialize_single_challenge(
                            challenge=progress.desafio,
                            progress=progress,
                            reference_time=context.reference_time,
                        )
                    )
                    seen_ids.add(progress.desafio_id)

        return {
            'active': active_payload,
            'completed_now': completed_payload,
            'total_active': len(active_payload),
        }

    def _serialize_single_challenge(
        self,
        *,
        challenge: DesafioDinamico,
        progress: ProgressoDesafioUsuario,
        reference_time: datetime,
    ) -> Dict[str, Any]:
        target_value = challenge.get_target_value()
        current_value = float(progress.valor_atual or 0.0)
        percent = progress.progress_percent(target_value) if target_value else 0.0
        remaining = None
        if target_value:
            remaining = max(int(round(target_value - current_value)), 0)

        label = f"{int(round(current_value))}"
        if target_value:
            label = f"{int(round(current_value))} / {int(round(target_value))}"

        time_remaining_seconds = None
        if challenge.data_fim:
            delta = challenge.data_fim - reference_time
            seconds = int(delta.total_seconds())
            time_remaining_seconds = max(seconds, 0)

        return {
            'slug': challenge.slug,
            'nome': challenge.nome,
            'descricao': challenge.descricao,
            'tipo': challenge.tipo,
            'start': challenge.data_inicio.isoformat() if challenge.data_inicio else None,
            'end': challenge.data_fim.isoformat() if challenge.data_fim else None,
            'target': int(round(target_value)) if target_value else None,
            'progress': {
                'current': int(round(current_value)),
                'percent': round(percent, 1) if target_value else 0.0,
                'label': label,
                'remaining': remaining,
            },
            'reward': challenge.recompensa_json or {},
            'is_completed': bool(progress.concluido),
            'completed_at': progress.data_conclusao.isoformat() if progress.data_conclusao else None,
            'time_remaining_seconds': time_remaining_seconds,
            'metadata': progress.metadata or {},
        }

    def _serialize_rewards(
        self,
        *,
        profile: PerfilGamificacaoUsuario,
        current_level: Optional[NivelGamificacao],
    ) -> Dict[str, Any]:
        claimed_qs = RecompensaNivelResgatada.objects.filter(perfil=profile)
        claimed_map = {
            (claim.nivel_id, claim.recompensa_id): claim
            for claim in claimed_qs
        }

        eligible_levels = NivelGamificacao.objects.filter(
            xp_minimo__lte=profile.xp_total,
        ).order_by('ordem', 'xp_minimo')

        all_rewards: List[Dict[str, Any]] = []
        available_to_claim: List[Dict[str, Any]] = []
        claimed_list: List[Dict[str, Any]] = []

        for level in eligible_levels:
            for reward in level.get_reward_definitions():
                reward_id = str(reward.get('id'))
                payload = {
                    'level_id': level.id,
                    'level_name': level.nome,
                    'level_identifier': level.identificador,
                    'reward_id': reward_id,
                    'name': reward.get('nome'),
                    'description': reward.get('descricao'),
                    'type': reward.get('tipo'),
                    'value': reward.get('valor'),
                    'metadata': reward.get('metadata') or {},
                    'is_claimed': False,
                    'claimed_at': None,
                }
                claim = claimed_map.get((level.id, reward_id))
                if claim:
                    payload['is_claimed'] = True
                    payload['claimed_at'] = claim.data_resgate.isoformat()
                    payload['claimed_metadata'] = claim.dados_recompensa or {}
                    claimed_list.append(payload)
                else:
                    available_to_claim.append(payload)
                all_rewards.append(payload)

        next_level = None
        if current_level:
            next_level = (
                NivelGamificacao.objects.filter(xp_minimo__gt=current_level.xp_minimo)
                .order_by('ordem', 'xp_minimo')
                .first()
            )
        if not next_level:
            next_level = (
                NivelGamificacao.objects.filter(xp_minimo__gt=profile.xp_total)
                .order_by('ordem', 'xp_minimo')
                .first()
            )

        upcoming_rewards: List[Dict[str, Any]] = []
        if next_level:
            for reward in next_level.get_reward_definitions():
                upcoming_rewards.append(
                    {
                        'level_id': next_level.id,
                        'level_name': next_level.nome,
                        'level_identifier': next_level.identificador,
                        'reward_id': str(reward.get('id')),
                        'name': reward.get('nome'),
                        'description': reward.get('descricao'),
                        'type': reward.get('tipo'),
                        'value': reward.get('valor'),
                        'metadata': reward.get('metadata') or {},
                    }
                )

        return {
            'available_to_claim': available_to_claim,
            'claimed': claimed_list,
            'all': all_rewards,
            'upcoming': upcoming_rewards,
        }

    def claim_level_reward(
        self,
        user,
        *,
        level_id: int,
        reward_id: str,
    ) -> Dict[str, Any]:
        profile = self.ensure_profile(user)
        profile.atualizar_nivel()

        try:
            level = NivelGamificacao.objects.get(pk=level_id)
        except NivelGamificacao.DoesNotExist as exc:
            raise ValidationError({'level_id': 'Nível informado é inválido.'}) from exc

        if profile.xp_total < level.xp_minimo:
            raise ValidationError('O usuário ainda não alcançou este nível.')

        reward_identifier = str(reward_id)
        reward_definition = None
        for reward in level.get_reward_definitions():
            if str(reward.get('id')) == reward_identifier:
                reward_definition = reward
                break

        if not reward_definition:
            raise ValidationError({'reward_id': 'Recompensa não encontrada para este nível.'})

        claim, created = RecompensaNivelResgatada.objects.get_or_create(
            perfil=profile,
            nivel=level,
            recompensa_id=reward_identifier,
            defaults={'dados_recompensa': reward_definition},
        )

        if not created:
            raise ValidationError('Esta recompensa já foi resgatada anteriormente.')

        reward_payload = {
            'level_id': level.id,
            'level_name': level.nome,
            'reward_id': reward_identifier,
            'name': reward_definition.get('nome'),
            'description': reward_definition.get('descricao'),
            'type': reward_definition.get('tipo'),
            'value': reward_definition.get('valor'),
            'metadata': reward_definition.get('metadata') or {},
            'claimed_at': claim.data_resgate.isoformat(),
        }

        rewards_state = self._serialize_rewards(profile=profile, current_level=profile.nivel_atual)

        return {'reward': reward_payload, 'rewards_state': rewards_state}
