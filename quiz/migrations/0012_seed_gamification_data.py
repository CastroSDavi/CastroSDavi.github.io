from __future__ import annotations

from django.db import migrations

from quiz.seeders.gamification import (
    get_achievement_seeds,
    get_challenge_seeds,
    get_level_seeds,
)


LEVEL_IDENTIFIERS = ['iniciante', 'aprendiz', 'especialista', 'mentor']
ACHIEVEMENT_SLUGS = [
    'primeiro-quiz',
    'xp-100',
    'streak-3-dias',
    'acertos-25',
    'pontuacao-500',
    'maratonista-diario',
]
CHALLENGE_SLUGS = [
    'desafio-diario-xp',
    'desafio-semanal-quizzes',
    'desafio-evento-streak',
]


def seed_gamification(apps, _):
    Level = apps.get_model('quiz', 'NivelGamificacao')
    Achievement = apps.get_model('quiz', 'Conquista')
    Challenge = apps.get_model('quiz', 'DesafioDinamico')

    for payload in get_level_seeds():
        Level.objects.update_or_create(
            identificador=payload['identificador'],
            defaults={
                'nome': payload['nome'],
                'descricao': payload['descricao'],
                'ordem': payload['ordem'],
                'xp_minimo': payload['xp_minimo'],
                'xp_maximo': payload['xp_maximo'],
                'recompensas_json': payload['recompensas_json'],
            },
        )

    for payload in get_achievement_seeds():
        Achievement.objects.update_or_create(
            slug=payload['slug'],
            defaults={
                'nome': payload['nome'],
                'descricao': payload['descricao'],
                'criterio_json': payload['criterio_json'],
                'icone': payload['icone'],
                'ordem_exibicao': payload['ordem_exibicao'],
            },
        )

    for payload in get_challenge_seeds():
        Challenge.objects.update_or_create(
            slug=payload['slug'],
            defaults={
                'nome': payload['nome'],
                'descricao': payload['descricao'],
                'tipo': payload['tipo'],
                'criterio_json': payload['criterio_json'],
                'recompensa_json': payload['recompensa_json'],
                'data_inicio': payload['data_inicio'],
                'data_fim': payload['data_fim'],
                'ativo': payload['ativo'],
            },
        )


def unseed_gamification(apps, _):
    Level = apps.get_model('quiz', 'NivelGamificacao')
    Achievement = apps.get_model('quiz', 'Conquista')
    Challenge = apps.get_model('quiz', 'DesafioDinamico')

    Level.objects.filter(identificador__in=LEVEL_IDENTIFIERS).delete()
    Achievement.objects.filter(slug__in=ACHIEVEMENT_SLUGS).delete()
    Challenge.objects.filter(slug__in=CHALLENGE_SLUGS).delete()


class Migration(migrations.Migration):

    dependencies = [
        (
            'quiz',
            '0011_remove_progressodesafiousuario_quiz_progresso_desafio_usuario_desafio_perfil_uniq_and_more',
        ),
    ]

    operations = [
        migrations.RunPython(seed_gamification, unseed_gamification),
    ]
