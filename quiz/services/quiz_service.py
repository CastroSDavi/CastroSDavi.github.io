"""Services related to quiz data preparation and retrieval."""

from __future__ import annotations

import random
from collections import defaultdict
from typing import Iterable, List, Optional

from django.db.models import Case, Count, Prefetch, Q, When

from quiz.models import (
    Categoria,
    CategoriaHierarquia,
    ConfiguracoesGeraisQuiz,
    OpcaoResposta,
    Pergunta,
    QuestaoFavorita,
    QuizDefinicao,
    SessoesQuizUsuario,
)


def _normalize_int_list(values: Optional[Iterable[str]]) -> List[int]:
    if not values:
        return []
    normalized: List[int] = []
    for value in values:
        try:
            normalized.append(int(str(value).strip()))
        except (TypeError, ValueError):
            continue
    return normalized


class QuizDataService:
    """Builds the payload consumed by the quiz front-end."""

    def __init__(self, *, quiz_config, user=None) -> None:
        self.quiz_config = quiz_config
        self.user = user

    def _build_perguntas_queryset(
        self,
        category_ids_filter: Optional[Iterable[str]] = None,
        difficulty_levels_filter: Optional[Iterable[str]] = None,
        quiz_mode: Optional[str] = None,
        question_count_str: Optional[str] = None,
        num_questions_custom_str: Optional[str] = None,
        quiz_definicao_id: Optional[int] = None,
        search_query: Optional[str] = None,
    ):
        perguntas_qs = Pergunta.objects.filter(ativa=True)

        if quiz_definicao_id:
            try:
                quiz_def = QuizDefinicao.objects.get(pk=quiz_definicao_id, ativo=True)
            except QuizDefinicao.DoesNotExist:
                return Pergunta.objects.none(), None

            perguntas_ordenadas_ids = list(
                quiz_def.quizdefinicaopergunta_set.order_by("ordem").values_list("pergunta_id", flat=True)
            )
            if not perguntas_ordenadas_ids:
                return Pergunta.objects.none(), quiz_def.nome_quiz

            preserved_order = Case(
                *[When(pk=pk, then=pos) for pos, pk in enumerate(perguntas_ordenadas_ids)]
            )
            perguntas_qs = Pergunta.objects.filter(pk__in=perguntas_ordenadas_ids, ativa=True).order_by(preserved_order)
            return perguntas_qs, quiz_def.nome_quiz

        if search_query and str(search_query).strip():
            term = str(search_query).strip()
            perguntas_qs = perguntas_qs.filter(
                Q(texto_pergunta__icontains=term)
                | Q(referencia_bibliografica__icontains=term)
                | Q(categorias__nome_categoria__icontains=term)
            ).distinct()

        if difficulty_levels_filter and "all" not in (level.lower() for level in difficulty_levels_filter):
            normalized_difficulty_filter = [level.lower() for level in difficulty_levels_filter]
            q_difficulty_objects = Q()
            valid_model_difficulties = [choice[0] for choice in Pergunta.NivelDificuldade.choices]
            for level_from_filter in normalized_difficulty_filter:
                for model_level in valid_model_difficulties:
                    if level_from_filter == model_level.lower():
                        q_difficulty_objects |= Q(nivel_dificuldade=model_level)
                        break
            if q_difficulty_objects:
                perguntas_qs = perguntas_qs.filter(q_difficulty_objects)
            else:
                return Pergunta.objects.none(), None

        if category_ids_filter:
            valid_category_ids = [cid for cid in category_ids_filter if str(cid).strip().isdigit()]
            if valid_category_ids:
                descendant_ids = self.get_descendant_category_ids(valid_category_ids)
                if descendant_ids:
                    perguntas_qs = perguntas_qs.filter(categorias__pk__in=descendant_ids).distinct()
                else:
                    return Pergunta.objects.none(), None
            else:
                return Pergunta.objects.none(), None

        num_perguntas_a_selecionar = 0
        if quiz_mode == SessoesQuizUsuario.ModoQuiz.RAPIDO:
            try:
                if question_count_str and str(question_count_str).isdigit() and int(question_count_str) > 0:
                    num_perguntas_a_selecionar = int(question_count_str)
                else:
                    num_perguntas_a_selecionar = self.quiz_config.numero_perguntas_quiz_rapido
            except (ValueError, TypeError):
                num_perguntas_a_selecionar = self.quiz_config.numero_perguntas_quiz_rapido
        elif num_questions_custom_str:
            try:
                num_val = int(num_questions_custom_str)
                if num_val > 0:
                    num_perguntas_a_selecionar = num_val
            except (ValueError, TypeError):
                num_perguntas_a_selecionar = 0

        if num_perguntas_a_selecionar > 0:
            all_matching_question_ids = list(perguntas_qs.values_list("pk", flat=True))
            if len(all_matching_question_ids) > num_perguntas_a_selecionar:
                selected_ids = random.sample(all_matching_question_ids, num_perguntas_a_selecionar)
                perguntas_qs = Pergunta.objects.filter(pk__in=selected_ids).order_by("?")

        return perguntas_qs, None

    def get_quiz_data_dict(
        self,
        *,
        category_ids_filter: Optional[Iterable[str]] = None,
        difficulty_levels_filter: Optional[Iterable[str]] = None,
        quiz_mode: Optional[str] = None,
        question_count_str: Optional[str] = None,
        num_questions_custom_str: Optional[str] = None,
        quiz_definicao_id: Optional[int] = None,
        search_query: Optional[str] = None,
    ):
        perguntas_qs, quiz_definition_name = self._build_perguntas_queryset(
            category_ids_filter=category_ids_filter,
            difficulty_levels_filter=difficulty_levels_filter,
            quiz_mode=quiz_mode,
            question_count_str=question_count_str,
            num_questions_custom_str=num_questions_custom_str,
            quiz_definicao_id=quiz_definicao_id,
            search_query=search_query,
        )

        todas_categorias_qs = Categoria.objects.all().order_by("nome_categoria")

        perguntas_data_qs = perguntas_qs.prefetch_related(
            Prefetch("categorias", queryset=Categoria.objects.all().only("pk", "nome_categoria")),
            Prefetch(
                "opcoes",
                queryset=OpcaoResposta.objects.all().only(
                    "pk", "pergunta_id", "texto_opcao", "eh_correta", "ordem_exibicao", "feedback_opcao"
                ),
            ),
        ).distinct()

        filtered_pergunta_ids = [p.pk for p in perguntas_data_qs]

        user_favorite_ids = set()
        if self.user and self.user.is_authenticated and filtered_pergunta_ids:
            user_favorite_ids = set(
                QuestaoFavorita.objects.filter(
                    usuario=self.user,
                    pergunta_id__in=filtered_pergunta_ids,
                ).values_list("pergunta_id", flat=True)
            )

        categorias_data_list = [
            {
                "id_categoria": c.pk,
                "nome_categoria": c.nome_categoria,
                "id_categoria_pai": c.id_categoria_pai_id,
                "descricao_categoria": c.descricao_categoria,
            }
            for c in todas_categorias_qs
        ]

        opcoes_dict_por_pergunta = defaultdict(list)
        if filtered_pergunta_ids:
            for option in OpcaoResposta.objects.filter(pergunta_id__in=filtered_pergunta_ids):
                opcoes_dict_por_pergunta[option.pergunta_id].append(
                    {
                        "id_opcao_resposta": option.pk,
                        "id_pergunta": option.pergunta_id,
                        "texto_opcao": option.texto_opcao,
                        "eh_correta": option.eh_correta,
                        "ordem_exibicao": option.ordem_exibicao,
                        "feedback_opcao": option.feedback_opcao,
                    }
                )

        perguntas_data_list = []
        for pergunta in perguntas_data_qs:
            perguntas_data_list.append(
                {
                    "id_pergunta": pergunta.pk,
                    "texto_pergunta": pergunta.texto_pergunta,
                    "url_imagem": pergunta.url_imagem,
                    "referencia_bibliografica": pergunta.referencia_bibliografica,
                    "categoria_ids": [cat.pk for cat in pergunta.categorias.all()],
                    "nivel_dificuldade": pergunta.nivel_dificuldade,
                    "explicacao_resposta": pergunta.explicacao_resposta,
                    "is_favorited": bool(self.user and pergunta.pk in user_favorite_ids),
                    "opcoes": sorted(
                        opcoes_dict_por_pergunta.get(pergunta.pk, []),
                        key=lambda x: x.get("ordem_exibicao", 0),
                    ),
                }
            )

        return {
            "perguntas": perguntas_data_list,
            "categorias": categorias_data_list,
            "opcoesResposta": [opt for opts_list in opcoes_dict_por_pergunta.values() for opt in opts_list],
            "quiz_definition_name": quiz_definition_name,
        }

    @staticmethod
    def get_active_predefined_quizzes_summary():
        """Retorna metadados resumidos dos quizzes pré-definidos ativos."""

        quizzes_qs = (
            QuizDefinicao.objects.filter(ativo=True)
            .annotate(total_perguntas=Count('perguntas', distinct=True))
            .order_by('nome_quiz')
        )

        quizzes_summary = []
        for quiz in quizzes_qs:
            question_count = quiz.total_perguntas
            if question_count is None:
                # Fallback defensivo caso a anotação não esteja disponível
                question_count = quiz.perguntas.count()

            quizzes_summary.append(
                {
                    'id': quiz.pk,
                    'nome': quiz.nome_quiz,
                    'descricao': quiz.descricao or '',
                    'total_perguntas': question_count,
                }
            )

        return quizzes_summary

    @staticmethod
    def build_quiz_summary():
        """Constrói o payload usado para popular o Challenge Hub."""

        perguntas_ativas = Pergunta.objects.filter(ativa=True)
        total_questions = perguntas_ativas.count()

        categorias_qs = Categoria.objects.annotate(
            total_perguntas=Count(
                'perguntas_associadas',
                filter=Q(perguntas_associadas__ativa=True)
            )
        ).order_by('nome_categoria')

        quiz_config = ConfiguracoesGeraisQuiz.objects.first()
        quick_quiz_default = None
        if quiz_config and quiz_config.numero_perguntas_quiz_rapido is not None:
            quick_quiz_default = quiz_config.numero_perguntas_quiz_rapido

        categorias_data = [
            {
                'id_categoria': categoria.pk,
                'nome_categoria': categoria.nome_categoria,
                'id_categoria_pai': categoria.id_categoria_pai_id,
                'total_perguntas': categoria.total_perguntas or 0,
            }
            for categoria in categorias_qs
        ]

        predefined_quizzes = QuizDataService.get_active_predefined_quizzes_summary()

        return {
            'total_questions': total_questions,
            'total_categories': len(categorias_data),
            'quick_quiz_default_count': quick_quiz_default,
            'categories': categorias_data,
            'predefined_quizzes': predefined_quizzes,
        }

    @staticmethod
    def get_descendant_category_ids(category_ids_str_list: Iterable[str]):
        if not category_ids_str_list:
            return set()

        initial_ids = set(_normalize_int_list(category_ids_str_list))
        if not initial_ids:
            return set()

        descendant_ids = set(
            CategoriaHierarquia.objects.filter(ancestor_id__in=initial_ids).values_list("descendant_id", flat=True)
        )
        descendant_ids.update(initial_ids)
        return descendant_ids
