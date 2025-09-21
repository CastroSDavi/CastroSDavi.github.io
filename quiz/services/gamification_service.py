"""Utilities for updating gamification profiles and achievements."""

from __future__ import annotations

from dataclasses import dataclass

from django.db import transaction

from quiz.models import (
    Conquista,
    ConquistaUsuario,
    PerfilGamificacaoUsuario,
    SessoesQuizUsuario,
)
from quiz.services.scoring_service import SessionScoreResult


@dataclass
class GamificationUpdateResult:
    """Resumo da atualização de gamificação."""

    profile: PerfilGamificacaoUsuario
    conquistas_desbloqueadas: int


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

        fields_to_update = ['xp_total', 'sequencia_atual', 'ultima_atualizacao']
        profile.xp_total += max(score_result.total_xp, 0)
        profile.sequencia_atual = score_result.current_streak
        if score_result.best_streak > profile.melhor_sequencia_geral:
            profile.melhor_sequencia_geral = score_result.best_streak
            fields_to_update.append('melhor_sequencia_geral')

        profile.save(update_fields=fields_to_update)
        profile.atualizar_nivel()

        conquistas_novas = self._unlock_achievements(profile, sessao, score_result)
        return GamificationUpdateResult(profile=profile, conquistas_desbloqueadas=conquistas_novas)

    def _unlock_achievements(
        self,
        profile: PerfilGamificacaoUsuario,
        sessao: SessoesQuizUsuario,
        score_result: SessionScoreResult,
    ) -> int:
        conquistas_disponiveis = Conquista.objects.all()
        ja_desbloqueadas = set(profile.conquistas.values_list('id', flat=True))
        a_criar = []

        for conquista in conquistas_disponiveis:
            if conquista.id in ja_desbloqueadas:
                continue

            criterio = conquista.criterio_json or {}
            tipo = str(criterio.get('tipo', '')).lower()
            valor = criterio.get('valor')
            if not valor:
                continue

            try:
                valor_num = float(valor)
            except (TypeError, ValueError):
                continue

            if tipo == 'xp_total' and profile.xp_total >= valor_num:
                a_criar.append((conquista, {'xp_total': profile.xp_total}))
            elif tipo == 'melhor_sequencia' and score_result.best_streak >= valor_num:
                a_criar.append((conquista, {'melhor_sequencia': score_result.best_streak}))
            elif tipo == 'pontuacao_sessao' and sessao.pontuacao_final >= valor_num:
                a_criar.append((conquista, {'pontuacao': sessao.pontuacao_final}))
            elif tipo == 'respostas_corretas_sessao' and score_result.total_correct >= valor_num:
                a_criar.append((conquista, {'acertos': score_result.total_correct}))

        criadas = 0
        for conquista, metadata in a_criar:
            ConquistaUsuario.objects.create(
                perfil=profile,
                conquista=conquista,
                metadata=metadata,
            )
            criadas += 1

        return criadas
