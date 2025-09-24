from datetime import timedelta
from typing import Any, Dict

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from quiz.models import (
    Conquista,
    ConquistaUsuario,
    DesafioDinamico,
    EstatisticasDiariasUsuario,
    NivelGamificacao,
    PerfilGamificacaoUsuario,
    ProgressoDesafioUsuario,
    RecompensaNivelResgatada,
)


class Command(BaseCommand):
    help = "Cria dados de demonstracao para gamificacao: conquistas, progresso e recompensas."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Remove dados de demonstracao antes de recria-los.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options.get("reset"):
            self._purge_demo_data()
            self.stdout.write(self.style.WARNING("Registros de demonstracao anteriores removidos."))

        self.stdout.write(self.style.MIGRATE_HEADING("Gerando dados de gamificacao de demonstracao..."))

        levels = self._ensure_levels()
        achievements = self._ensure_achievements()
        user_context = self._ensure_users(levels=levels, achievements=achievements)
        challenges = self._ensure_challenges()
        self._ensure_progress(user_context=user_context, challenges=challenges)
        self._ensure_reward_claims(user_context=user_context, levels=levels)

        self.stdout.write(self.style.SUCCESS("Seed de gamificacao concluido com sucesso."))

    def _purge_demo_data(self) -> None:
        user_model = get_user_model()

        ProgressoDesafioUsuario.objects.filter(desafio__slug__startswith="demo-").delete()
        ProgressoDesafioUsuario.objects.filter(perfil__user__username__startswith="demo_").delete()
        ConquistaUsuario.objects.filter(perfil__user__username__startswith="demo_").delete()
        RecompensaNivelResgatada.objects.filter(perfil__user__username__startswith="demo_").delete()
        RecompensaNivelResgatada.objects.filter(nivel__identificador__startswith="demo-").delete()
        EstatisticasDiariasUsuario.objects.filter(id_usuario__username__startswith="demo_").delete()
        PerfilGamificacaoUsuario.objects.filter(user__username__startswith="demo_").delete()

        DesafioDinamico.objects.filter(slug__startswith="demo-").delete()
        Conquista.objects.filter(slug__startswith="demo-").delete()
        NivelGamificacao.objects.filter(identificador__startswith="demo-").delete()
        user_model.objects.filter(username__startswith="demo_").delete()

    def _ensure_levels(self) -> Dict[str, NivelGamificacao]:
        level_payload = [
            {
                "identificador": "demo-level-01",
                "nome": "Explorador Iniciante",
                "descricao": "Comece a acumular XP e desbloqueie seu primeiro badge.",
                "ordem": 1,
                "xp_minimo": 0,
                "xp_maximo": 499,
                "rewards": [
                    {
                        "id": "demo-welcome-pack",
                        "nome": "Kit de Boas-Vindas",
                        "descricao": "Checklist de revisao rapida para orientar os primeiros estudos.",
                        "tipo": "material",
                        "valor": "PDF introdutorio",
                        "metadata": {"tag": "starter"},
                    },
                ],
            },
            {
                "identificador": "demo-level-02",
                "nome": "Residente Dedicado",
                "descricao": "Mantenha o ritmo e desbloqueie materiais de revisao exclusivos.",
                "ordem": 2,
                "xp_minimo": 500,
                "xp_maximo": 1199,
                "rewards": [
                    {
                        "id": "demo-study-pack",
                        "nome": "Pacote de Revisao",
                        "descricao": "Colecao de mapas mentais para consolidar conteudos chaves.",
                        "tipo": "material",
                        "valor": "Mapas mentais premium",
                        "metadata": {"tag": "xp500"},
                    },
                    {
                        "id": "demo-discount-print",
                        "nome": "Voucher de Impressao",
                        "descricao": "Desconto para imprimir resumos preferidos.",
                        "tipo": "beneficio",
                        "valor": "Desconto de 15%",
                        "metadata": {"codigo": "PRINT15"},
                    },
                ],
            },
            {
                "identificador": "demo-level-03",
                "nome": "Especialista Clinico",
                "descricao": "Ganhe acesso a experiencias praticas e simulados avancados.",
                "ordem": 3,
                "xp_minimo": 1200,
                "xp_maximo": 1999,
                "rewards": [
                    {
                        "id": "demo-lab-pass",
                        "nome": "Passe de Simulados",
                        "descricao": "Entrada em um simulado tematico com relatorio detalhado.",
                        "tipo": "beneficio",
                        "valor": "Simulado premium",
                        "metadata": {"duracao_dias": 7},
                    },
                    {
                        "id": "demo-webinar-seat",
                        "nome": "Lugar no Webinar",
                        "descricao": "Convite para webinar com especialista convidado.",
                        "tipo": "mentoria",
                        "valor": "Webinar fechado",
                        "metadata": {"vaga": 1},
                    },
                ],
            },
            {
                "identificador": "demo-level-04",
                "nome": "Mentor da Comunidade",
                "descricao": "Compartilhe conhecimento e libere beneficios de mentor.",
                "ordem": 4,
                "xp_minimo": 2000,
                "xp_maximo": None,
                "rewards": [
                    {
                        "id": "demo-coaching",
                        "nome": "Sessao de Mentoria",
                        "descricao": "Mentoria individual com a equipe academica.",
                        "tipo": "mentoria",
                        "valor": "Mentoria 1:1",
                        "metadata": {"slots": 5},
                    },
                    {
                        "id": "demo-community-pin",
                        "nome": "Insignia da Comunidade",
                        "descricao": "Badge especial exibido no perfil publico.",
                        "tipo": "badge",
                        "valor": "Exibicao permanente",
                        "metadata": {"slug": "community-pin"},
                    },
                ],
            },
        ]

        levels: Dict[str, NivelGamificacao] = {}
        for entry in level_payload:
            defaults = {
                "nome": entry["nome"],
                "descricao": entry["descricao"],
                "ordem": entry["ordem"],
                "xp_minimo": entry["xp_minimo"],
                "xp_maximo": entry["xp_maximo"],
                "recompensas_json": {"items": entry["rewards"]},
            }
            level, _ = NivelGamificacao.objects.update_or_create(
                identificador=entry["identificador"],
                defaults=defaults,
            )
            levels[entry["identificador"]] = level
        return levels

    def _ensure_achievements(self) -> Dict[str, Conquista]:
        achievement_payload = [
            {
                "slug": "demo-primeiro-quiz",
                "nome": "Primeiro Plantao",
                "descricao": "Conclua seu primeiro quiz completo.",
                "criterio": {"tipo": "quizzes_completos", "valor": 1},
                "icone": "workspace_premium",
                "ordem": 1,
            },
            {
                "slug": "demo-xp-500",
                "nome": "Ritmo de Residencia",
                "descricao": "Alcance 500 pontos de XP acumulados.",
                "criterio": {"tipo": "xp_total", "valor": 500},
                "icone": "trending_up",
                "ordem": 2,
            },
            {
                "slug": "demo-streak-10",
                "nome": "Foco Maximo",
                "descricao": "Mantenha uma sequencia de 10 acertos em uma sessao.",
                "criterio": {"tipo": "melhor_sequencia", "valor": 10},
                "icone": "local_fire_department",
                "ordem": 3,
            },
            {
                "slug": "demo-pontuacao-900",
                "nome": "Resposta Perfeita",
                "descricao": "Some 900 pontos em uma unica sessao.",
                "criterio": {"tipo": "pontuacao_sessao", "valor": 900},
                "icone": "emoji_events",
                "ordem": 4,
            },
            {
                "slug": "demo-dia-intenso",
                "nome": "Dia Intenso",
                "descricao": "Resolva 50 perguntas em um unico dia.",
                "criterio": {"tipo": "perguntas_diarias", "valor": 50},
                "icone": "event_available",
                "ordem": 5,
            },
        ]

        achievements: Dict[str, Conquista] = {}
        for entry in achievement_payload:
            defaults = {
                "nome": entry["nome"],
                "descricao": entry["descricao"],
                "criterio_json": entry["criterio"],
                "icone": entry["icone"],
                "ordem_exibicao": entry["ordem"],
            }
            conquest, _ = Conquista.objects.update_or_create(
                slug=entry["slug"],
                defaults=defaults,
            )
            achievements[entry["slug"]] = conquest
        return achievements

    def _ensure_users(
        self,
        *,
        levels: Dict[str, NivelGamificacao],
        achievements: Dict[str, Conquista],
    ) -> Dict[str, Dict[str, Any]]:
        user_model = get_user_model()
        now = timezone.now()
        today = timezone.localdate()

        user_payload = [
            {
                "username": "demo_alice",
                "first_name": "Alice",
                "last_name": "Rocha",
                "email": "alice.demo@example.com",
                "password": "demo12345",
                "xp_total": 1860,
                "best_streak": 15,
                "current_streak": 6,
                "daily_stats": {
                    "questions": 42,
                    "correct": 38,
                    "points": 920,
                    "xp": 180,
                    "streak_days": 5,
                    "study_seconds": 3600,
                    "days_ago": 0,
                },
                "achievements": [
                    {
                        "slug": "demo-primeiro-quiz",
                        "metadata": {"quizzes_completos": 22},
                        "days_ago": 14,
                    },
                    {
                        "slug": "demo-xp-500",
                        "metadata": {"xp_total": 1860},
                        "days_ago": 9,
                    },
                    {
                        "slug": "demo-streak-10",
                        "metadata": {"melhor_sequencia": 15},
                        "days_ago": 3,
                    },
                    {
                        "slug": "demo-pontuacao-900",
                        "metadata": {"pontuacao": 940},
                        "days_ago": 1,
                    },
                ],
                "challenge_progress": {
                    "demo-desafio-xp-semanal": {
                        "valor_atual": 480,
                        "metadata": {"ultima_contribuicao": 120, "progress_label": "480/600"},
                        "concluido": False,
                        "days_ago": 0,
                    },
                    "demo-desafio-streak": {
                        "valor_atual": 10,
                        "metadata": {"ultima_contribuicao": 3, "progress_label": "Meta atingida"},
                        "concluido": True,
                        "days_ago": 5,
                    },
                    "demo-desafio-quiz-diario": {
                        "valor_atual": 58,
                        "metadata": {"ultima_contribuicao": 12, "progress_label": "58/60"},
                        "concluido": False,
                        "days_ago": 0,
                    },
                },
                "claimed_rewards": [
                    {"level": "demo-level-02", "reward_id": "demo-study-pack", "days_ago": 6},
                    {"level": "demo-level-03", "reward_id": "demo-lab-pass", "days_ago": 1},
                ],
            },
            {
                "username": "demo_bruno",
                "first_name": "Bruno",
                "last_name": "Silva",
                "email": "bruno.demo@example.com",
                "password": "demo12345",
                "xp_total": 960,
                "best_streak": 8,
                "current_streak": 2,
                "daily_stats": {
                    "questions": 55,
                    "correct": 48,
                    "points": 780,
                    "xp": 150,
                    "streak_days": 3,
                    "study_seconds": 2700,
                    "days_ago": 1,
                },
                "achievements": [
                    {
                        "slug": "demo-primeiro-quiz",
                        "metadata": {"quizzes_completos": 12},
                        "days_ago": 20,
                    },
                    {
                        "slug": "demo-xp-500",
                        "metadata": {"xp_total": 960},
                        "days_ago": 7,
                    },
                    {
                        "slug": "demo-dia-intenso",
                        "metadata": {"perguntas_diarias": 55},
                        "days_ago": 1,
                    },
                ],
                "challenge_progress": {
                    "demo-desafio-xp-semanal": {
                        "valor_atual": 600,
                        "metadata": {"ultima_contribuicao": 200, "progress_label": "600/600"},
                        "concluido": True,
                        "days_ago": 1,
                    },
                    "demo-desafio-quiz-diario": {
                        "valor_atual": 45,
                        "metadata": {"ultima_contribuicao": 15, "progress_label": "45/60"},
                        "concluido": False,
                        "days_ago": 0,
                    },
                },
                "claimed_rewards": [
                    {"level": "demo-level-02", "reward_id": "demo-study-pack", "days_ago": 2},
                ],
            },
            {
                "username": "demo_carla",
                "first_name": "Carla",
                "last_name": "Mendes",
                "email": "carla.demo@example.com",
                "password": "demo12345",
                "xp_total": 420,
                "best_streak": 5,
                "current_streak": 1,
                "daily_stats": {
                    "questions": 32,
                    "correct": 26,
                    "points": 540,
                    "xp": 120,
                    "streak_days": 2,
                    "study_seconds": 1800,
                    "days_ago": 0,
                },
                "achievements": [
                    {
                        "slug": "demo-primeiro-quiz",
                        "metadata": {"quizzes_completos": 5},
                        "days_ago": 11,
                    },
                ],
                "challenge_progress": {
                    "demo-desafio-xp-semanal": {
                        "valor_atual": 250,
                        "metadata": {"ultima_contribuicao": 80, "progress_label": "250/600"},
                        "concluido": False,
                        "days_ago": 0,
                    },
                    "demo-desafio-quiz-diario": {
                        "valor_atual": 60,
                        "metadata": {"ultima_contribuicao": 18, "progress_label": "Meta atingida"},
                        "concluido": True,
                        "days_ago": 0,
                    },
                },
                "claimed_rewards": [
                    {"level": "demo-level-01", "reward_id": "demo-welcome-pack", "days_ago": 10},
                ],
            },
        ]

        context: Dict[str, Dict[str, Any]] = {}
        for entry in user_payload:
            user_defaults = {
                "email": entry["email"],
                "first_name": entry["first_name"],
                "last_name": entry["last_name"],
            }
            user, created = user_model.objects.get_or_create(
                username=entry["username"],
                defaults=user_defaults,
            )
            if created:
                user.set_password(entry.get("password") or "demo12345")
                user.save()
            else:
                fields_to_update = []
                for field, value in user_defaults.items():
                    if getattr(user, field) != value:
                        setattr(user, field, value)
                        fields_to_update.append(field)
                if fields_to_update:
                    user.save(update_fields=fields_to_update)

            profile, _ = PerfilGamificacaoUsuario.objects.get_or_create(user=user)
            profile.xp_total = entry["xp_total"]
            profile.melhor_sequencia_geral = entry["best_streak"]
            profile.sequencia_atual = entry["current_streak"]
            profile.save()
            profile.atualizar_nivel()

            stats_payload = entry.get("daily_stats")
            if stats_payload:
                stat_date = today - timedelta(days=stats_payload.get("days_ago", 0))
                EstatisticasDiariasUsuario.objects.update_or_create(
                    id_usuario=user,
                    data_estatistica=stat_date,
                    defaults={
                        "perguntas_respondidas_dia": stats_payload["questions"],
                        "acertos_dia": stats_payload["correct"],
                        "pontos_dia": stats_payload["points"],
                        "xp_ganho_dia": stats_payload["xp"],
                        "sequencia_dias_quiz": stats_payload["streak_days"],
                        "tempo_estudo_segundos_dia": stats_payload["study_seconds"],
                    },
                )

            for achievement_payload in entry.get("achievements", []):
                conquest = achievements.get(achievement_payload["slug"])
                if not conquest:
                    continue
                unlocked_at = now - timedelta(days=achievement_payload.get("days_ago", 0))
                metadata = dict(achievement_payload.get("metadata") or {})
                ConquistaUsuario.objects.update_or_create(
                    perfil=profile,
                    conquista=conquest,
                    defaults={
                        "metadata": metadata,
                        "data_conquista": unlocked_at,
                    },
                )

            context[entry["username"]] = {
                "user": user,
                "profile": profile,
                "challenge_progress": entry.get("challenge_progress", {}),
                "claimed_rewards": entry.get("claimed_rewards", []),
            }

        return context

    def _ensure_challenges(self) -> Dict[str, DesafioDinamico]:
        now = timezone.now()
        challenge_payload = [
            {
                "slug": "demo-desafio-xp-semanal",
                "nome": "Semana Turbo de XP",
                "descricao": "Acumule XP participando de quizzes ao longo da semana.",
                "criterio": {"tipo": "xp_total", "valor": 600},
                "recompensa": {"nome": "Pacote de flashcards", "tipo": "material", "valor": "Flashcards digitais"},
                "start_offset": -3,
                "end_offset": 4,
                "ativo": True,
            },
            {
                "slug": "demo-desafio-streak",
                "nome": "Sequencia Imparavel",
                "descricao": "Mantenha uma sequencia alta de acertos em qualquer quiz.",
                "criterio": {"tipo": "melhor_sequencia", "valor": 10},
                "recompensa": {"nome": "Badge Sequencia Imparavel", "tipo": "badge", "valor": "Badge exclusivo"},
                "start_offset": -12,
                "end_offset": -2,
                "ativo": False,
            },
            {
                "slug": "demo-desafio-quiz-diario",
                "nome": "Quiz Diario",
                "descricao": "Resolva 60 perguntas nesta rodada de aquecimento.",
                "criterio": {"tipo": "perguntas_diarias", "valor": 60},
                "recompensa": {"nome": "Tema especial", "tipo": "cosmetico", "valor": "Tema escuro para o painel"},
                "start_offset": -1,
                "end_offset": 6,
                "ativo": True,
            },
        ]

        challenges: Dict[str, DesafioDinamico] = {}
        for entry in challenge_payload:
            start = now + timedelta(days=entry["start_offset"])
            end = now + timedelta(days=entry["end_offset"]) if entry.get("end_offset") is not None else None
            defaults = {
                "nome": entry["nome"],
                "descricao": entry["descricao"],
                "criterio_json": entry["criterio"],
                "recompensa_json": entry["recompensa"],
                "data_inicio": start,
                "data_fim": end,
                "ativo": entry["ativo"],
            }
            challenge, _ = DesafioDinamico.objects.update_or_create(
                slug=entry["slug"],
                defaults=defaults,
            )
            challenges[entry["slug"]] = challenge
        return challenges

    def _ensure_progress(
        self,
        *,
        user_context: Dict[str, Dict[str, Any]],
        challenges: Dict[str, DesafioDinamico],
    ) -> None:
        now = timezone.now()

        for context in user_context.values():
            profile = context.get("profile")
            if not isinstance(profile, PerfilGamificacaoUsuario):
                continue

            progress_payload = context.get("challenge_progress") or {}
            for slug, payload in progress_payload.items():
                challenge = challenges.get(slug)
                if not challenge:
                    continue

                target = challenge.get_target_value()
                current_value = float(payload.get("valor_atual", 0.0))
                if target and current_value > target:
                    current_value = float(target)

                concluido = bool(payload.get("concluido"))
                unlocked_at = now - timedelta(days=payload.get("days_ago", 0))
                metadata = dict(payload.get("metadata") or {})

                defaults = {
                    "valor_atual": current_value,
                    "concluido": concluido,
                    "data_conclusao": unlocked_at if concluido else None,
                    "janela_inicio": challenge.data_inicio,
                    "janela_fim": challenge.data_fim,
                    "metadata": metadata,
                }

                ProgressoDesafioUsuario.objects.update_or_create(
                    perfil=profile,
                    desafio=challenge,
                    defaults=defaults,
                )

    def _ensure_reward_claims(
        self,
        *,
        user_context: Dict[str, Dict[str, Any]],
        levels: Dict[str, NivelGamificacao],
    ) -> None:
        now = timezone.now()

        for context in user_context.values():
            profile = context.get("profile")
            if not isinstance(profile, PerfilGamificacaoUsuario):
                continue

            for claim in context.get("claimed_rewards", []):
                level_key = claim.get("level")
                reward_id = claim.get("reward_id")
                if not level_key or not reward_id:
                    continue

                level = levels.get(level_key)
                if not level:
                    continue

                reward_definition = None
                for reward in level.get_reward_definitions():
                    if str(reward.get("id")) == str(reward_id):
                        reward_definition = reward
                        break

                if not reward_definition:
                    continue

                claimed_at = now - timedelta(days=claim.get("days_ago", 0))
                defaults = {
                    "dados_recompensa": reward_definition,
                    "data_resgate": claimed_at,
                }

                RecompensaNivelResgatada.objects.update_or_create(
                    perfil=profile,
                    nivel=level,
                    recompensa_id=str(reward_id),
                    defaults=defaults,
                )
