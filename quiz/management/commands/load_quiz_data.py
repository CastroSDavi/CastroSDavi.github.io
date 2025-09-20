# quiz/management/commands/load_quiz_data.py
import json
import os
from collections import Counter

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from quiz.models import Categoria, OpcaoResposta, Pergunta


class Command(BaseCommand):
    help = 'Carrega dados do quiz a partir de arquivos JSON para o banco de dados'

    def add_arguments(self, parser):
        parser.add_argument(
            '--purge',
            action='store_true',
            help='Remove todos os registros antes da importação.',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Iniciando carregamento dos dados do quiz...'))

        base_data_path = os.path.join(settings.BASE_DIR, 'assets', 'data')
        categorias_path = os.path.join(base_data_path, 'categorias.json')
        perguntas_path = os.path.join(base_data_path, 'perguntas.json')
        opcoes_path = os.path.join(base_data_path, 'opcoes_resposta.json')

        categorias_json = self._load_json(categorias_path, 'categorias')
        perguntas_json = self._load_json(perguntas_path, 'perguntas')
        opcoes_json = self._load_json(opcoes_path, 'opções de resposta')

        with transaction.atomic():
            if options.get('purge'):
                OpcaoResposta.objects.all().delete()
                Pergunta.objects.all().delete()
                Categoria.objects.all().delete()
                self.stdout.write(self.style.WARNING('Dados existentes foram removidos antes da importação.'))

            categorias_status, categorias_por_codigo = self._importar_categorias(categorias_json)
            perguntas_status, perguntas_por_codigo = self._importar_perguntas(perguntas_json, categorias_por_codigo)
            opcoes_status = self._importar_opcoes(opcoes_json, perguntas_por_codigo)

        self.stdout.write(self.style.SUCCESS('Resumo da importação:'))
        self._exibir_resumo('Categorias', categorias_status)
        self._exibir_resumo('Perguntas', perguntas_status)
        self._exibir_resumo('Opções de resposta', opcoes_status)
        self.stdout.write(self.style.SUCCESS('Carregamento de dados do quiz concluído!'))

    def _load_json(self, caminho, rotulo):
        try:
            with open(caminho, 'r', encoding='utf-8') as handler:
                return json.load(handler)
        except FileNotFoundError as exc:
            raise CommandError(f"Arquivo de {rotulo} não encontrado em: {caminho}") from exc
        except json.JSONDecodeError as exc:
            raise CommandError(f"Erro ao decodificar JSON de {rotulo} em: {caminho}") from exc

    def _importar_categorias(self, categorias_json):
        status = {}
        categorias_por_codigo = {}
        relacoes_pai = {}

        for cat_data in categorias_json:
            codigo = self._obter_codigo(cat_data, 'id_categoria', 'categoria')
            nome = cat_data.get('nome_categoria')
            if not nome:
                raise CommandError(f"Categoria com código {codigo} está sem 'nome_categoria'.")

            defaults = {
                'nome_categoria': nome,
                'descricao_categoria': cat_data.get('descricao_categoria'),
            }

            categoria_existente = Categoria.objects.filter(codigo_importacao=codigo).first()
            valores_anteriores = {}
            if categoria_existente:
                valores_anteriores = {
                    campo: getattr(categoria_existente, campo)
                    for campo in defaults
                }

            categoria_obj, criado = Categoria.objects.update_or_create(
                codigo_importacao=codigo,
                defaults=defaults,
            )
            categorias_por_codigo[codigo] = categoria_obj

            if criado:
                status[codigo] = 'created'
            else:
                alterado = any(
                    valores_anteriores.get(campo) != defaults[campo]
                    for campo in defaults
                )
                status[codigo] = 'updated' if alterado else 'ignored'

            pai_codigo = cat_data.get('id_categoria_pai')
            relacoes_pai[codigo] = str(pai_codigo) if pai_codigo is not None else None

        for codigo, pai_codigo in relacoes_pai.items():
            categoria_obj = categorias_por_codigo[codigo]
            if pai_codigo is None:
                desired_parent = None
            else:
                desired_parent = categorias_por_codigo.get(pai_codigo)
                if not desired_parent:
                    desired_parent = Categoria.objects.filter(codigo_importacao=pai_codigo).first()
                if not desired_parent:
                    raise CommandError(
                        f"Categoria '{codigo}' referencia categoria pai inexistente '{pai_codigo}'."
                    )

            parent_id = desired_parent.pk if desired_parent else None
            if categoria_obj.id_categoria_pai_id != parent_id:
                categoria_obj.id_categoria_pai = desired_parent
                categoria_obj.save()
                if status[codigo] != 'created':
                    status[codigo] = 'updated'

        contador = Counter(status.values())
        return contador, categorias_por_codigo

    def _importar_perguntas(self, perguntas_json, categorias_por_codigo):
        status = {}
        perguntas_por_codigo = {}

        for perg_data in perguntas_json:
            codigo = self._obter_codigo(perg_data, 'id_pergunta', 'pergunta')
            texto = perg_data.get('texto_pergunta')
            if not texto:
                raise CommandError(f"Pergunta com código {codigo} está sem 'texto_pergunta'.")

            categoria_codigos = [str(c) for c in (perg_data.get('categoria_ids') or [])]
            categorias_destino = []
            categorias_inexistentes = []
            for cat_codigo in categoria_codigos:
                categoria_obj = categorias_por_codigo.get(cat_codigo)
                if not categoria_obj:
                    categoria_obj = Categoria.objects.filter(codigo_importacao=cat_codigo).first()
                    if categoria_obj:
                        categorias_por_codigo[cat_codigo] = categoria_obj
                if not categoria_obj:
                    categorias_inexistentes.append(cat_codigo)
                else:
                    categorias_destino.append(categoria_obj)

            if categorias_inexistentes:
                raise CommandError(
                    f"Pergunta '{codigo}' referencia categorias inexistentes: {', '.join(categorias_inexistentes)}."
                )

            defaults = {
                'texto_pergunta': texto,
                'url_imagem': perg_data.get('url_imagem'),
                'referencia_bibliografica': perg_data.get('referencia_bibliografica'),
                'nivel_dificuldade': perg_data.get('nivel_dificuldade', Pergunta.NivelDificuldade.MEDIO),
                'explicacao_resposta': perg_data.get('explicacao_resposta'),
                'ativa': perg_data.get('ativa', True),
            }

            pergunta_existente = Pergunta.objects.filter(codigo_importacao=codigo).first()
            valores_anteriores = {}
            categorias_anteriores = set()
            if pergunta_existente:
                valores_anteriores = {
                    campo: getattr(pergunta_existente, campo)
                    for campo in defaults
                }
                categorias_anteriores = set(
                    pergunta_existente.categorias.values_list('codigo_importacao', flat=True)
                )

            pergunta_obj, criado = Pergunta.objects.update_or_create(
                codigo_importacao=codigo,
                defaults=defaults,
            )
            perguntas_por_codigo[codigo] = pergunta_obj

            pergunta_obj.categorias.set(categorias_destino)
            categorias_atual = {cat.codigo_importacao for cat in categorias_destino}

            if criado:
                status[codigo] = 'created'
            else:
                alterado = any(
                    valores_anteriores.get(campo) != defaults[campo]
                    for campo in defaults
                )
                if categorias_anteriores != categorias_atual:
                    alterado = True
                status[codigo] = 'updated' if alterado else 'ignored'

        contador = Counter(status.values())
        return contador, perguntas_por_codigo

    def _importar_opcoes(self, opcoes_json, perguntas_por_codigo):
        status = {}

        for opcao_data in opcoes_json:
            codigo = self._obter_codigo(opcao_data, 'id_opcao_resposta', 'opção de resposta')
            pergunta_codigo = self._obter_codigo(opcao_data, 'id_pergunta', 'opção de resposta')

            pergunta_obj = perguntas_por_codigo.get(pergunta_codigo)
            if not pergunta_obj:
                pergunta_obj = Pergunta.objects.filter(codigo_importacao=pergunta_codigo).first()
                if pergunta_obj:
                    perguntas_por_codigo[pergunta_codigo] = pergunta_obj
            if not pergunta_obj:
                raise CommandError(
                    f"Opção de resposta '{codigo}' referencia pergunta inexistente '{pergunta_codigo}'."
                )

            ordem_exibicao = opcao_data.get('ordem_exibicao')
            defaults = {
                'pergunta': pergunta_obj,
                'texto_opcao': opcao_data.get('texto_opcao'),
                'eh_correta': opcao_data.get('eh_correta', False),
                'ordem_exibicao': 0 if ordem_exibicao is None else ordem_exibicao,
                'feedback_opcao': opcao_data.get('feedback_opcao'),
            }

            if defaults['texto_opcao'] in (None, ''):
                raise CommandError(f"Opção de resposta '{codigo}' está sem 'texto_opcao'.")

            opcao_existente = OpcaoResposta.objects.filter(codigo_importacao=codigo).first()
            valores_anteriores = {}
            if opcao_existente:
                valores_anteriores = {
                    campo: getattr(opcao_existente, campo if campo != 'pergunta' else 'pergunta_id')
                    for campo in ['pergunta', 'texto_opcao', 'eh_correta', 'ordem_exibicao', 'feedback_opcao']
                }

            _, criado = OpcaoResposta.objects.update_or_create(
                codigo_importacao=codigo,
                defaults=defaults,
            )

            if criado:
                status[codigo] = 'created'
            else:
                alterado = (
                    valores_anteriores.get('pergunta') != pergunta_obj.pk
                    or valores_anteriores.get('texto_opcao') != defaults['texto_opcao']
                    or valores_anteriores.get('eh_correta') != defaults['eh_correta']
                    or valores_anteriores.get('ordem_exibicao') != defaults['ordem_exibicao']
                    or valores_anteriores.get('feedback_opcao') != defaults['feedback_opcao']
                )
                status[codigo] = 'updated' if alterado else 'ignored'

        return Counter(status.values())

    def _exibir_resumo(self, rotulo, contador):
        criados = contador.get('created', 0)
        atualizados = contador.get('updated', 0)
        ignorados = contador.get('ignored', 0)
        self.stdout.write(
            f"- {rotulo}: {criados} criados, {atualizados} atualizados, {ignorados} ignorados"
        )

    def _obter_codigo(self, dados, campo, rotulo):
        if campo not in dados:
            raise CommandError(f"Entrada de {rotulo} está sem o campo obrigatório '{campo}'.")
        valor = dados[campo]
        if valor in (None, ''):
            raise CommandError(f"Entrada de {rotulo} possui '{campo}' vazio.")
        return str(valor)