import json
import os
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from quiz.models import Categoria, Pergunta, OpcaoResposta


class Command(BaseCommand):
    help = 'Carrega os dados seed do quiz a partir dos arquivos JSON localizados em assets/data.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--flush',
            action='store_true',
            help='Remove os dados existentes antes de importar os arquivos JSON.'
        )

    def handle(self, *args, **options):
        flush = options.get('flush', False)

        base_data_path = os.path.join(settings.BASE_DIR, 'assets', 'data')
        categorias_path = os.path.join(base_data_path, 'categorias.json')
        perguntas_path = os.path.join(base_data_path, 'perguntas.json')
        opcoes_path = os.path.join(base_data_path, 'opcoes_resposta.json')

        try:
            with open(categorias_path, 'r', encoding='utf-8') as handler:
                categorias_json = json.load(handler)
            with open(perguntas_path, 'r', encoding='utf-8') as handler:
                perguntas_json = json.load(handler)
            with open(opcoes_path, 'r', encoding='utf-8') as handler:
                opcoes_json = json.load(handler)
        except FileNotFoundError as exc:
            raise CommandError(f'Arquivo obrigatorio nao encontrado: {exc.filename}') from exc
        except json.JSONDecodeError as exc:
            raise CommandError(f'Nao foi possivel interpretar o JSON: {exc}') from exc

        if not flush and (Categoria.objects.exists() or Pergunta.objects.exists() or OpcaoResposta.objects.exists()):
            raise CommandError('Dados existentes encontrados. Execute novamente com --flush para substituir.')

        with transaction.atomic():
            if flush:
                OpcaoResposta.objects.all().delete()
                Pergunta.objects.all().delete()
                Categoria.objects.all().delete()
                self.stdout.write(self.style.WARNING('Dados anteriores removidos com sucesso.'))

            categoria_objs = [
                Categoria(
                    nome_categoria=item['nome_categoria'],
                    descricao_categoria=item.get('descricao_categoria') or ''
                )
                for item in categorias_json
            ]
            created_categorias = Categoria.objects.bulk_create(categoria_objs)
            categoria_map = {
                item['id_categoria']: obj for item, obj in zip(categorias_json, created_categorias)
            }

            parent_updates = []
            for item in categorias_json:
                parent_id = item.get('id_categoria_pai')
                if parent_id is None:
                    continue
                categoria_obj = categoria_map.get(item['id_categoria'])
                parent_obj = categoria_map.get(parent_id)
                if categoria_obj and parent_obj:
                    categoria_obj.id_categoria_pai = parent_obj
                    parent_updates.append(categoria_obj)
            if parent_updates:
                Categoria.objects.bulk_update(parent_updates, ['id_categoria_pai'])

            pergunta_objs = []
            for item in perguntas_json:
                pergunta_objs.append(Pergunta(
                    texto_pergunta=item['texto_pergunta'],
                    url_imagem=item.get('url_imagem'),
                    referencia_bibliografica=item.get('referencia_bibliografica'),
                    nivel_dificuldade=item.get('nivel_dificuldade', Pergunta.NivelDificuldade.FACIL),
                    explicacao_resposta=item.get('explicacao_resposta'),
                ))
            created_perguntas = Pergunta.objects.bulk_create(pergunta_objs)
            pergunta_map = {
                item['id_pergunta']: obj for item, obj in zip(perguntas_json, created_perguntas)
            }

            through_model = Pergunta.categorias.through
            relacoes = []
            for item in perguntas_json:
                pergunta_obj = pergunta_map.get(item['id_pergunta'])
                if not pergunta_obj:
                    continue
                for cat_id in item.get('categoria_ids', []):
                    categoria_obj = categoria_map.get(cat_id)
                    if categoria_obj:
                        relacoes.append(
                            through_model(pergunta_id=pergunta_obj.pk, categoria_id=categoria_obj.pk)
                        )
            if relacoes:
                through_model.objects.bulk_create(relacoes, ignore_conflicts=True)

            opcoes_objs = []
            for item in opcoes_json:
                pergunta_obj = pergunta_map.get(item.get('id_pergunta'))
                if not pergunta_obj:
                    continue
                opcoes_objs.append(OpcaoResposta(
                    pergunta=pergunta_obj,
                    texto_opcao=item['texto_opcao'],
                    eh_correta=item.get('eh_correta', False),
                    ordem_exibicao=item.get('ordem_exibicao', 0),
                    feedback_opcao=item.get('feedback_opcao')
                ))
            OpcaoResposta.objects.bulk_create(opcoes_objs)

        self.stdout.write(self.style.SUCCESS(
            f'Importacao concluida: {len(created_categorias)} categorias, '
            f'{len(created_perguntas)} perguntas e {len(opcoes_objs)} opcoes carregadas.'
        ))
