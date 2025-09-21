"""Utilities for updating gamification profiles and achievements."""
"""Utilities for updating gamification profiles and achievements."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from django.db import transaction

from quiz.models import (
    Conquista,
    ConquistaUsuario,
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

        conquistas_novas = self._unlock_achievements(profile, sessao, score_result)

        snapshot = self._serialize_profile(
            profile=profile,
            xp_ganho=score_result.total_xp,
            conquistas_novas=conquistas_novas,
            nivel_anterior=nivel_anterior,
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
        return self._serialize_profile(
            profile=profile,
            xp_ganho=0,
            conquistas_novas=None,
            nivel_anterior=None,
            include_catalog=include_catalog,
        )

    def _unlock_achievements(
        self,
        profile: PerfilGamificacaoUsuario,
        sessao: SessoesQuizUsuario,
        score_result: SessionScoreResult,
    ) -> List[ConquistaUsuario]:
        conquistas_disponiveis = Conquista.objects.all()
        ja_desbloqueadas = set(profile.conquistas.values_list('id', flat=True))
        a_criar: List[Dict[str, Any]] = []

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
    ) -> Dict[str, Any]:
        """Transforma o perfil em um payload amigável para o frontend."""

        xp_ganho_int = int(max(xp_ganho or 0, 0))

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

        catalogo_conquistas: Optional[List[Dict[str, Any]]] = None
        if include_catalog:
            relacoes_por_conquista = {rel.conquista_id: rel for rel in conquistas_relacoes}
            catalogo_conquistas = []
            for conquista in Conquista.objects.all().order_by('ordem_exibicao', 'nome'):
                rel = relacoes_por_conquista.get(conquista.id)
                catalogo_conquistas.append(
                    {
                        'slug': conquista.slug,
                        'nome': conquista.nome,
                        'descricao': conquista.descricao,
                        'icone': conquista.icone,
                        'is_unlocked': rel is not None,
                        'data_conquista': rel.data_conquista.isoformat() if rel and rel.data_conquista else None,
                        'metadata': rel.metadata if rel else {},
                    }
                )

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
            'achievements': {
                'total_unlocked': total_desbloqueadas,
                'total_available': total_disponiveis,
                'newly_unlocked': conquistas_recentemente,
                'recent': conquistas_recentes,
                'catalog': catalogo_conquistas,
            },
        }
