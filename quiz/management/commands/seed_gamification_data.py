"""Comando utilitário para semear dados de gamificação de demonstração."""
from __future__ import annotations

from typing import Dict, Iterable, Sequence

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from quiz.models import Conquista, DesafioDinamico, NivelGamificacao
from quiz.seeders.gamification import (
    get_achievement_seeds,
    get_challenge_seeds,
    get_level_seeds,
)


class Command(BaseCommand):
    help = (
        "Cria ou atualiza níveis, conquistas e desafios dinâmicos com dados de exemplo. "
        "Use para ter conteúdo pronto ao explorar a área de gamificação."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--purge',
            action='store_true',
            help='Remove registros existentes antes de semear os dados de exemplo.',
        )

    def handle(self, *args, **options):
        purge = bool(options.get('purge'))

        with transaction.atomic():
            if purge:
                self._purge_existing()

            level_summary = self._seed_levels()
            achievement_summary = self._seed_achievements()
            challenge_summary = self._seed_challenges()

        self.stdout.write(self.style.SUCCESS('Dados de gamificação sincronizados com sucesso.'))
        self._print_summary('Níveis', level_summary)
        self._print_summary('Conquistas', achievement_summary)
        self._print_summary('Desafios dinâmicos', challenge_summary)

    def _purge_existing(self) -> None:
        NivelGamificacao.objects.all().delete()
        Conquista.objects.all().delete()
        DesafioDinamico.objects.all().delete()
        self.stdout.write(self.style.WARNING('Registros existentes removidos.'))

    def _seed_levels(self) -> Dict[str, int]:
        payloads = get_level_seeds()
        return self._sync_model(
            model=NivelGamificacao,
            unique_field='identificador',
            payloads=payloads,
            defaults_keys=['nome', 'descricao', 'ordem', 'xp_minimo', 'xp_maximo', 'recompensas_json'],
        )

    def _seed_achievements(self) -> Dict[str, int]:
        payloads = get_achievement_seeds()
        return self._sync_model(
            model=Conquista,
            unique_field='slug',
            payloads=payloads,
            defaults_keys=['nome', 'descricao', 'criterio_json', 'icone', 'ordem_exibicao'],
        )

    def _seed_challenges(self) -> Dict[str, int]:
        reference = timezone.now()
        payloads = get_challenge_seeds(reference)
        return self._sync_model(
            model=DesafioDinamico,
            unique_field='slug',
            payloads=payloads,
            defaults_keys=[
                'nome',
                'descricao',
                'tipo',
                'criterio_json',
                'recompensa_json',
                'data_inicio',
                'data_fim',
                'ativo',
            ],
        )

    def _sync_model(
        self,
        *,
        model,
        unique_field: str,
        payloads: Iterable[Dict[str, object]],
        defaults_keys: Sequence[str],
    ) -> Dict[str, int]:
        summary = {'created': 0, 'updated': 0, 'unchanged': 0}

        for data in payloads:
            lookup_value = data[unique_field]
            defaults = {key: data.get(key) for key in defaults_keys}

            existing = model.objects.filter(**{unique_field: lookup_value}).first()
            changed = False
            if existing:
                for field, value in defaults.items():
                    if getattr(existing, field) != value:
                        changed = True
                        break

            _, created = model.objects.update_or_create(
                defaults=defaults,
                **{unique_field: lookup_value},
            )

            if created:
                summary['created'] += 1
            elif changed:
                summary['updated'] += 1
            else:
                summary['unchanged'] += 1

        return summary

    def _print_summary(self, label: str, summary: Dict[str, int]) -> None:
        message = (
            f"{label}: {summary['created']} criados, "
            f"{summary['updated']} atualizados, {summary['unchanged']} inalterados."
        )
        self.stdout.write(message)
