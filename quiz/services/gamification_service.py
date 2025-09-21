"""Utilities for updating gamification profiles and achievements."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from django.db import transaction
from django.db.models import Count, Max

from quiz.models import (
    Conquista,
    ConquistaUsuario,
    EstatisticasDiariasUsuario,
    NivelGamificacao,
    PerfilGamificacaoUsuario,
    SessoesQuizUsuario,
)
from quiz.services.scoring_service import SessionScoreResult


@dataclass
class GamificationUpdateResult:
    """Resumo da atualização de gamificação."""

    profile: PerfilGamificacaoUsuario
    conquistas_desbloqueadas: int
    snapshot: Dict[str, Any]


class GamificationService:
    """Aplica regras de gamificação ao final de uma sessão."""

    def ensure_profile(self, user) -> PerfilGamificacaoUsuario:
        profile, _ = PerfilGamificacaoUsuario.objects.get_or_create(user=user)
        return profile

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

        conquistas_novas = self._unlock_achievements(
            profile,
            sessao,
            score_result,
            daily_stats=daily_stats,
        )

        snapshot = self._serialize_profile(
            profile=profile,
            xp_ganho=score_result.total_xp,
            conquistas_novas=conquistas_novas,
            nivel_anterior=nivel_anterior,
            daily_stats=daily_stats,
        )

        return GamificationUpdateResult(
            profile=profile,
            conquistas_desbloqueadas=len(conquistas_novas),
            snapshot=snapshot,
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
        return self._serialize_profile(
            profile=profile,
            xp_ganho=0,
            conquistas_novas=None,
            nivel_anterior=None,
            include_catalog=include_catalog,
            daily_stats=daily_stats,
        )

    def _unlock_achievements(
        self,
        profile: PerfilGamificacaoUsuario,
        sessao: SessoesQuizUsuario,
        score_result: SessionScoreResult,
        daily_stats: Optional[EstatisticasDiariasUsuario] = None,
    ) -> List[ConquistaUsuario]:
        conquistas_disponiveis = Conquista.objects.all()
        ja_desbloqueadas = set(profile.conquistas.values_list('id', flat=True))
        a_criar: List[Dict[str, Any]] = []

        daily_stat_reference = daily_stats
        if not daily_stat_reference:
            daily_stat_reference = (
                EstatisticasDiariasUsuario.objects.filter(id_usuario=profile.user)
                .order_by('-data_estatistica')
                .first()
            )

        perguntas_dia = daily_stat_reference.perguntas_respondidas_dia if daily_stat_reference else 0
        xp_diario_val = daily_stat_reference.xp_ganho_dia if daily_stat_reference else 0

        if daily_stat_reference and perguntas_dia > 0:
            daily_streak = daily_stat_reference.sequencia_dias_quiz or 0
        else:
            daily_streak = 0

        sessions_qs = SessoesQuizUsuario.objects.filter(
            id_usuario=profile.user,
            status_sessao=SessoesQuizUsuario.StatusSessao.COMPLETA,
        )
        session_metrics = sessions_qs.aggregate(
            max_score=Max('pontuacao_final'),
            max_correct=Max('total_acertos'),
            total_sessions=Count('id'),
        )
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

    def _serialize_profile(
        self,
        *,
        profile: PerfilGamificacaoUsuario,
        xp_ganho: int,
        conquistas_novas: Optional[List[ConquistaUsuario]] = None,
        nivel_anterior: Optional[NivelGamificacao] = None,
        include_catalog: bool = False,
        daily_stats: Optional[EstatisticasDiariasUsuario] = None,
    ) -> Dict[str, Any]:
        """Transforma o perfil em um payload amigável para o frontend."""

        xp_ganho_int = int(max(xp_ganho or 0, 0))

        daily_stats_obj = daily_stats
        if daily_stats_obj is None:
            daily_stats_obj = (
                EstatisticasDiariasUsuario.objects.filter(id_usuario=profile.user)
                .order_by('-data_estatistica')
                .first()
            )

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

        sessions_qs = SessoesQuizUsuario.objects.filter(
            id_usuario=profile.user,
            status_sessao=SessoesQuizUsuario.StatusSessao.COMPLETA,
        )
        session_metrics = sessions_qs.aggregate(
            max_score=Max('pontuacao_final'),
            max_correct=Max('total_acertos'),
            total_sessions=Count('id'),
        )

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
                daily_stats=daily_stats_obj,
                daily_streak=daily_streak_value,
                session_metrics=session_metrics,
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
        }

    def _build_achievement_progress(
        self,
        *,
        conquista: Conquista,
        profile: PerfilGamificacaoUsuario,
        daily_stats: Optional[EstatisticasDiariasUsuario],
        daily_streak: int,
        session_metrics: Dict[str, Any],
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
