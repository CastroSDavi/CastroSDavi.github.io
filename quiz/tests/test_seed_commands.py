from django.core.management import call_command
from django.test import TestCase

from quiz.models import Conquista, DesafioDinamico, NivelGamificacao
from quiz.seeders.gamification import (
    get_achievement_seeds,
    get_challenge_seeds,
    get_level_seeds,
)


class SeedGamificationDataCommandTests(TestCase):
    def test_command_populates_expected_records(self):
        call_command('seed_gamification_data', purge=True)

        expected_levels = {item['identificador'] for item in get_level_seeds()}
        expected_achievements = {item['slug'] for item in get_achievement_seeds()}
        expected_challenges = {item['slug'] for item in get_challenge_seeds()}

        self.assertSetEqual(
            set(NivelGamificacao.objects.values_list('identificador', flat=True)),
            expected_levels,
        )
        self.assertSetEqual(
            set(Conquista.objects.values_list('slug', flat=True)),
            expected_achievements,
        )
        self.assertSetEqual(
            set(DesafioDinamico.objects.values_list('slug', flat=True)),
            expected_challenges,
        )

    def test_command_is_idempotent(self):
        call_command('seed_gamification_data', purge=True)
        first_counts = (
            NivelGamificacao.objects.count(),
            Conquista.objects.count(),
            DesafioDinamico.objects.count(),
        )

        call_command('seed_gamification_data')
        second_counts = (
            NivelGamificacao.objects.count(),
            Conquista.objects.count(),
            DesafioDinamico.objects.count(),
        )

        self.assertEqual(first_counts, second_counts)
