"""Coleções de dados de exemplo para recursos de gamificação."""
from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from django.utils import timezone


@dataclass(frozen=True)
class LevelRewardSeed:
    identificador: str
    nome: str
    descricao: str
    ordem: int
    xp_minimo: int
    xp_maximo: Optional[int]
    recompensas_json: Dict[str, Any]


@dataclass(frozen=True)
class AchievementSeed:
    slug: str
    nome: str
    descricao: str
    criterio_json: Dict[str, Any]
    icone: str
    ordem_exibicao: int


@dataclass(frozen=True)
class ChallengeSeed:
    slug: str
    nome: str
    descricao: str
    tipo: str
    criterio_json: Dict[str, Any]
    recompensa_json: Dict[str, Any]
    delta_inicio: Optional[timedelta]
    delta_fim: Optional[timedelta]


_BASE_LEVELS: List[LevelRewardSeed] = [
    LevelRewardSeed(
        identificador='iniciante',
        nome='Iniciante',
        descricao='Primeiros passos na jornada de estudos com desafios acessíveis.',
        ordem=1,
        xp_minimo=0,
        xp_maximo=149,
        recompensas_json={
            'items': [
                {
                    'id': 'badge_iniciante',
                    'nome': 'Emblema Iniciante',
                    'descricao': 'Emblema digital para celebrar sua primeira etapa.',
                    'tipo': 'badge',
                },
                {
                    'id': 'dica-extra',
                    'nome': 'Dica Extra',
                    'descricao': 'Receba uma dica exclusiva para aprimorar seus estudos.',
                    'tipo': 'content_unlock',
                    'valor': 1,
                },
            ]
        },
    ),
    LevelRewardSeed(
        identificador='aprendiz',
        nome='Aprendiz Dedicado',
        descricao='Você já domina o básico e segue firme em novas missões.',
        ordem=2,
        xp_minimo=150,
        xp_maximo=399,
        recompensas_json={
            'items': [
                {
                    'id': 'bonus-xp-5',
                    'nome': 'Impulso de XP',
                    'descricao': 'Ganhe 5% a mais de XP nas próximas sessões concluídas hoje.',
                    'tipo': 'xp_boost',
                    'valor': 5,
                    'metadata': {'duracao_horas': 24},
                },
                {
                    'id': 'wallpaper-estudos',
                    'nome': 'Wallpaper Exclusivo',
                    'descricao': 'Material visual para deixar sua área de estudos inspiradora.',
                    'tipo': 'download',
                },
            ]
        },
    ),
    LevelRewardSeed(
        identificador='especialista',
        nome='Especialista',
        descricao='Constância e foco estão levando seus resultados a outro nível.',
        ordem=3,
        xp_minimo=400,
        xp_maximo=799,
        recompensas_json={
            'items': [
                {
                    'id': 'desconto-curso',
                    'nome': 'Desconto em Curso Parceiro',
                    'descricao': 'Desconto de 10% em um curso parceiro selecionado.',
                    'tipo': 'coupon',
                    'valor': 10,
                },
                {
                    'id': 'tema-especial',
                    'nome': 'Tema Especial do App',
                    'descricao': 'Tema visual alternativo liberado no painel.',
                    'tipo': 'theme',
                },
            ]
        },
    ),
    LevelRewardSeed(
        identificador='mentor',
        nome='Mentor da Comunidade',
        descricao='Seu empenho inspira outros estudantes. Continue liderando!',
        ordem=4,
        xp_minimo=800,
        xp_maximo=None,
        recompensas_json={
            'items': [
                {
                    'id': 'badge-mentor',
                    'nome': 'Emblema Mentor',
                    'descricao': 'Um emblema lendário visível para toda a comunidade.',
                    'tipo': 'badge',
                },
                {
                    'id': 'sessao-consultoria',
                    'nome': 'Sessão de Consultoria',
                    'descricao': 'Agende uma conversa rápida com um especialista convidado.',
                    'tipo': 'mentoring',
                },
            ]
        },
    ),
]


_BASE_ACHIEVEMENTS: List[AchievementSeed] = [
    AchievementSeed(
        slug='primeiro-quiz',
        nome='Primeiro Quiz Concluído',
        descricao='Finalize o seu primeiro quiz completo.',
        criterio_json={'tipo': 'quizzes_completos', 'valor': 1},
        icone='flag',
        ordem_exibicao=10,
    ),
    AchievementSeed(
        slug='xp-100',
        nome='Cem Pontos de Conhecimento',
        descricao='Acumule 100 pontos de XP totais.',
        criterio_json={'tipo': 'xp_total', 'valor': 100},
        icone='military_tech',
        ordem_exibicao=20,
    ),
    AchievementSeed(
        slug='streak-3-dias',
        nome='Três Dias Seguidos',
        descricao='Estude por 3 dias consecutivos.',
        criterio_json={'tipo': 'dias_consecutivos', 'valor': 3},
        icone='calendar_month',
        ordem_exibicao=30,
    ),
    AchievementSeed(
        slug='acertos-25',
        nome='Mestre dos Acertos',
        descricao='Acerte 25 questões corretas em uma única sessão.',
        criterio_json={'tipo': 'respostas_corretas_sessao', 'valor': 25},
        icone='check_circle',
        ordem_exibicao=40,
    ),
    AchievementSeed(
        slug='pontuacao-500',
        nome='Pontuação Imbatível',
        descricao='Alcance 500 pontos de pontuação em uma sessão.',
        criterio_json={'tipo': 'pontuacao_sessao', 'valor': 500},
        icone='stars',
        ordem_exibicao=50,
    ),
    AchievementSeed(
        slug='maratonista-diario',
        nome='Maratonista Diário',
        descricao='Responda 30 perguntas em um mesmo dia.',
        criterio_json={'tipo': 'perguntas_diarias', 'valor': 30},
        icone='directions_run',
        ordem_exibicao=60,
    ),
]


_BASE_CHALLENGES: List[ChallengeSeed] = [
    ChallengeSeed(
        slug='desafio-diario-xp',
        nome='XP em Dobro Hoje',
        descricao='Some 120 pontos de XP ao longo do dia para liberar um bônus.',
        tipo='daily',
        criterio_json={'tipo': 'xp_diario', 'valor': 120},
        recompensa_json={
            'nome': 'Pacote de Energia',
            'descricao': 'Bônus de 50 XP aplicado automaticamente ao concluir.',
            'tipo': 'xp_bonus',
            'valor': 50,
        },
        delta_inicio=timedelta(minutes=0),
        delta_fim=timedelta(days=1),
    ),
    ChallengeSeed(
        slug='desafio-semanal-quizzes',
        nome='Semana de Foco',
        descricao='Complete 5 quizzes completos durante a semana.',
        tipo='weekly',
        criterio_json={'tipo': 'quizzes_completos', 'valor': 5},
        recompensa_json={
            'nome': 'Título de Foco Total',
            'descricao': 'Título temporário exibido no seu perfil.',
            'tipo': 'title',
        },
        delta_inicio=timedelta(minutes=0),
        delta_fim=timedelta(days=7),
    ),
    ChallengeSeed(
        slug='desafio-evento-streak',
        nome='Evento Maratona de Estudos',
        descricao='Mantenha uma sequência de 5 dias seguidos respondendo quizzes.',
        tipo='event',
        criterio_json={'tipo': 'dias_consecutivos', 'valor': 5},
        recompensa_json={
            'nome': 'Skin Especial do Avatar',
            'descricao': 'Visual comemorativo disponível por tempo limitado.',
            'tipo': 'cosmetic',
        },
        delta_inicio=timedelta(minutes=0),
        delta_fim=timedelta(days=14),
    ),
]


def get_level_seeds() -> List[Dict[str, Any]]:
    """Retorna uma cópia independente das definições de níveis."""
    return [
        {
            'identificador': seed.identificador,
            'nome': seed.nome,
            'descricao': seed.descricao,
            'ordem': seed.ordem,
            'xp_minimo': seed.xp_minimo,
            'xp_maximo': seed.xp_maximo,
            'recompensas_json': deepcopy(seed.recompensas_json),
        }
        for seed in _BASE_LEVELS
    ]


def get_achievement_seeds() -> List[Dict[str, Any]]:
    """Retorna conquistas padrão usadas para demonstração."""
    return [
        {
            'slug': seed.slug,
            'nome': seed.nome,
            'descricao': seed.descricao,
            'criterio_json': deepcopy(seed.criterio_json),
            'icone': seed.icone,
            'ordem_exibicao': seed.ordem_exibicao,
        }
        for seed in _BASE_ACHIEVEMENTS
    ]


def get_challenge_seeds(reference: Optional[datetime] = None) -> List[Dict[str, Any]]:
    """Gera desafios com datas relativas à referência fornecida."""
    start_time = reference or timezone.now()

    items: List[Dict[str, Any]] = []
    for seed in _BASE_CHALLENGES:
        inicio = start_time + (seed.delta_inicio or timedelta()) if seed.delta_inicio else start_time
        fim = start_time + (seed.delta_fim or timedelta()) if seed.delta_fim else None
        items.append(
            {
                'slug': seed.slug,
                'nome': seed.nome,
                'descricao': seed.descricao,
                'tipo': seed.tipo,
                'criterio_json': deepcopy(seed.criterio_json),
                'recompensa_json': deepcopy(seed.recompensa_json),
                'data_inicio': inicio,
                'data_fim': fim,
                'ativo': True,
            }
        )
    return items



