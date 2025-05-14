# quiz/management/commands/load_quiz_data.py
import json
import os
from django.core.management.base import BaseCommand
from django.conf import settings
from quiz.models import Categoria, Pergunta, OpcaoResposta # Importe seus modelos

class Command(BaseCommand):
    help = 'Carrega dados do quiz a partir de arquivos JSON para o banco de dados'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Iniciando carregamento dos dados do quiz...'))

        # Caminhos para os arquivos JSON (assumindo que estão em assets/data/)
        base_data_path = os.path.join(settings.BASE_DIR, 'assets', 'data')
        categorias_path = os.path.join(base_data_path, 'categorias.json')
        perguntas_path = os.path.join(base_data_path, 'perguntas.json')
        opcoes_path = os.path.join(base_data_path, 'opcoes_resposta.json')

        # Limpar dados existentes (opcional, mas útil para re-execuções)
        # CUIDADO: Isso apagará todos os dados das tabelas!
        OpcaoResposta.objects.all().delete()
        Pergunta.objects.all().delete()
        Categoria.objects.all().delete()
        self.stdout.write(self.style.WARNING('Dados existentes das tabelas Categoria, Pergunta e OpcaoResposta foram apagados.'))

        # Carregar Categorias
        try:
            with open(categorias_path, 'r', encoding='utf-8') as f:
                categorias_json = json.load(f)
        except FileNotFoundError:
            self.stderr.write(self.style.ERROR(f'Arquivo de categorias não encontrado em: {categorias_path}'))
            return
        except json.JSONDecodeError:
            self.stderr.write(self.style.ERROR(f'Erro ao decodificar JSON de categorias em: {categorias_path}'))
            return

        categorias_criadas = {} # Para mapear id_json -> objeto Categoria
        categorias_pais_temp = {} # Para armazenar temporariamente os pais (id_json_filho -> id_json_pai)

        # Primeira passagem: criar todas as categorias sem definir os pais ainda
        for cat_data in categorias_json:
            try:
                categoria_obj = Categoria.objects.create(
                    # Django cria o ID automaticamente, então não usamos cat_data['id_categoria'] diretamente para o PK
                    nome_categoria=cat_data['nome_categoria'],
                    descricao_categoria=cat_data.get('descricao_categoria', '') # .get para campos opcionais
                )
                categorias_criadas[cat_data['id_categoria']] = categoria_obj
                if cat_data.get('id_categoria_pai') is not None:
                    categorias_pais_temp[cat_data['id_categoria']] = cat_data['id_categoria_pai']
                self.stdout.write(f"Categoria '{categoria_obj.nome_categoria}' criada.")
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"Erro ao criar categoria {cat_data.get('nome_categoria', 'DESCONHECIDA')}: {e}"))


        # Segunda passagem: definir os pais das categorias
        for cat_json_id, pai_json_id in categorias_pais_temp.items():
            try:
                categoria_filha_obj = categorias_criadas.get(cat_json_id)
                categoria_pai_obj = categorias_criadas.get(pai_json_id)
                if categoria_filha_obj and categoria_pai_obj:
                    categoria_filha_obj.id_categoria_pai = categoria_pai_obj
                    categoria_filha_obj.save()
                    self.stdout.write(f"Pai da categoria '{categoria_filha_obj.nome_categoria}' definido para '{categoria_pai_obj.nome_categoria}'.")
                elif categoria_filha_obj and pai_json_id is not None:
                    self.stderr.write(self.style.WARNING(f"Categoria pai com id_json {pai_json_id} não encontrada para a categoria '{categoria_filha_obj.nome_categoria}'."))
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"Erro ao definir pai para categoria JSON ID {cat_json_id}: {e}"))

        self.stdout.write(self.style.SUCCESS(f'{len(categorias_criadas)} categorias carregadas.'))


        # Carregar Perguntas
        try:
            with open(perguntas_path, 'r', encoding='utf-8') as f:
                perguntas_json = json.load(f)
        except FileNotFoundError:
            self.stderr.write(self.style.ERROR(f'Arquivo de perguntas não encontrado em: {perguntas_path}'))
            return
        except json.JSONDecodeError:
            self.stderr.write(self.style.ERROR(f'Erro ao decodificar JSON de perguntas em: {perguntas_path}'))
            return

        perguntas_criadas = {} # Para mapear id_json_pergunta -> objeto Pergunta

        for perg_data in perguntas_json:
            try:
                pergunta_obj = Pergunta.objects.create(
                    # Django cria o ID, então não usamos perg_data['id_pergunta'] para o PK
                    texto_pergunta=perg_data['texto_pergunta'],
                    url_imagem=perg_data.get('url_imagem'),
                    referencia_bibliografica=perg_data.get('referencia_bibliografica'),
                    nivel_dificuldade=perg_data.get('nivel_dificuldade', 'Fácil'), # Valor padrão se não existir
                    explicacao_resposta=perg_data.get('explicacao_resposta')
                )
                perguntas_criadas[perg_data['id_pergunta']] = pergunta_obj

                # Adicionar categorias à pergunta (relação ManyToMany)
                ids_categorias_json = perg_data.get('categoria_ids', [])
                for cat_json_id in ids_categorias_json:
                    categoria_obj = categorias_criadas.get(cat_json_id)
                    if categoria_obj:
                        pergunta_obj.categorias.add(categoria_obj)
                    else:
                        self.stderr.write(self.style.WARNING(f"Categoria com id_json {cat_json_id} não encontrada para a pergunta ID JSON {perg_data['id_pergunta']}."))
                pergunta_obj.save() # Salva as relações ManyToMany
                self.stdout.write(f"Pergunta ID JSON {perg_data['id_pergunta']} ('{pergunta_obj.texto_pergunta[:30]}...') criada.")
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"Erro ao criar pergunta ID JSON {perg_data.get('id_pergunta', 'DESCONHECIDA')}: {e}"))

        self.stdout.write(self.style.SUCCESS(f'{len(perguntas_criadas)} perguntas carregadas.'))

        # Carregar Opções de Resposta
        try:
            with open(opcoes_path, 'r', encoding='utf-8') as f:
                opcoes_json = json.load(f)
        except FileNotFoundError:
            self.stderr.write(self.style.ERROR(f'Arquivo de opções de resposta não encontrado em: {opcoes_path}'))
            return
        except json.JSONDecodeError:
            self.stderr.write(self.style.ERROR(f'Erro ao decodificar JSON de opções em: {opcoes_path}'))
            return

        opcoes_criadas_count = 0
        for op_data in opcoes_json:
            try:
                pergunta_obj = perguntas_criadas.get(op_data['id_pergunta'])
                if pergunta_obj:
                    OpcaoResposta.objects.create(
                        # Django cria o ID, então não usamos op_data['id_opcao_resposta'] para o PK
                        pergunta=pergunta_obj,
                        texto_opcao=op_data['texto_opcao'],
                        eh_correta=op_data.get('eh_correta', False),
                        ordem_exibicao=op_data.get('ordem_exibicao', 0),
                        feedback_opcao=op_data.get('feedback_opcao')
                    )
                    opcoes_criadas_count += 1
                    self.stdout.write(f"Opção '{op_data['texto_opcao'][:30]}...' para pergunta ID JSON {op_data['id_pergunta']} criada.")
                else:
                    self.stderr.write(self.style.WARNING(f"Pergunta com id_json {op_data['id_pergunta']} não encontrada para a opção ID JSON {op_data['id_opcao_resposta']}."))
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"Erro ao criar opção ID JSON {op_data.get('id_opcao_resposta', 'DESCONHECIDA')}: {e}"))


        self.stdout.write(self.style.SUCCESS(f'{opcoes_criadas_count} opções de resposta carregadas.'))
        self.stdout.write(self.style.SUCCESS('Carregamento de dados do quiz concluído!'))