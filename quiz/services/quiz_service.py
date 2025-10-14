"""Services related to quiz data preparation and retrieval."""

from __future__ import annotations

import random
from collections import defaultdict
from typing import Iterable, List, Optional, Tuple

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

from .study_methods import StudyMethodContext, StudyMethodRegistry


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

    def __init__(self, *, quiz_config, user=None, study_method_key: Optional[str] = None) -> None:
        self.quiz_config = quiz_config
        self.user = user
        self._study_method_key = StudyMethodRegistry.resolve_key(study_method_key)

    def _sanitize_id_sequence(self, raw_ids: Optional[Iterable]) -> List[int]:
        sanitized: List[int] = []
        seen: set[int] = set()
        if not raw_ids:
            return sanitized
        for value in raw_ids:
            try:
                normalized = int(str(value).strip())
            except (TypeError, ValueError):
                continue
            if normalized in seen:
                continue
            sanitized.append(normalized)
            seen.add(normalized)
        return sanitized

    def _build_queryset_from_ids(self, question_ids: List[int], *, include_inactive: bool = False) -> Iterable[Pergunta]:
        if not question_ids:
            return Pergunta.objects.none()

        base_qs = Pergunta.objects.all()
        if not include_inactive:
            base_qs = base_qs.filter(ativa=True)

        preserved_order = Case(
            *[When(pk=pk, then=pos) for pos, pk in enumerate(question_ids)]
        )
        return base_qs.filter(pk__in=question_ids).order_by(preserved_order)

    def _coerce_positive_int(self, value) -> Optional[int]:
        if isinstance(value, bool) or value is None:
            return None

        try:
            if isinstance(value, (int, float)):
                candidate = int(value)
            else:
                candidate = int(str(value).strip())
        except (TypeError, ValueError):
            return None

        return candidate if candidate > 0 else None

    def _coerce_bool_flag(self, value, *, default: bool = False) -> bool:
        if isinstance(value, bool):
            return value

        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return bool(value)

        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"true", "1", "sim", "yes", "on"}:
                return True
            if normalized in {"false", "0", "nao", "não", "no", "off"}:
                return False

        return default

    def _apply_filters(
        self,
        *,
        category_ids_filter: Optional[Iterable[str]] = None,
        difficulty_levels_filter: Optional[Iterable[str]] = None,
        quiz_mode: Optional[str] = None,
        question_count_str: Optional[str] = None,
        num_questions_custom_str: Optional[str] = None,
        search_query: Optional[str] = None,
        study_method_key: Optional[str] = None,
        include_inactive: bool = False,
        only_favorites: bool = False,
        limit_override: Optional[int] = None,
    ) -> Tuple[Iterable[Pergunta], str]:
        resolved_method = StudyMethodRegistry.resolve_key(study_method_key or self._study_method_key)

        perguntas_qs = Pergunta.objects.all()
        if not include_inactive:
            perguntas_qs = perguntas_qs.filter(ativa=True)

        if only_favorites:
            if not self.user or not getattr(self.user, "is_authenticated", False):
                return Pergunta.objects.none(), resolved_method
            favorite_ids = QuestaoFavorita.objects.filter(usuario=self.user).values_list("pergunta_id", flat=True)
            perguntas_qs = perguntas_qs.filter(pk__in=list(favorite_ids))

        if search_query and str(search_query).strip():
            term = str(search_query).strip()
            perguntas_qs = perguntas_qs.filter(
                Q(texto_pergunta__icontains=term)
                | Q(referencia_bibliografica__icontains=term)
                | Q(categorias__nome_categoria__icontains=term)
            ).distinct()

        if difficulty_levels_filter and "all" not in [str(level).lower() for level in difficulty_levels_filter]:
            normalized_difficulty_filter = [level.lower() for level in difficulty_levels_filter]
            q_difficulty_objects = Q()
            valid_model_difficulties = [choice[0] for choice in Pergunta.NivelDificuldade.choices]
            for level_from_filter in normalized_difficulty_filter:
                for model_level in valid_model_difficulties:
                    if level_from_filter == str(model_level).lower():
                        q_difficulty_objects |= Q(nivel_dificuldade=model_level)
                        break
            if q_difficulty_objects:
                perguntas_qs = perguntas_qs.filter(q_difficulty_objects)
            else:
                return Pergunta.objects.none(), resolved_method

        if category_ids_filter:
            valid_category_ids = [cid for cid in category_ids_filter if str(cid).strip().isdigit()]
            if valid_category_ids:
                descendant_ids = self.get_descendant_category_ids(valid_category_ids)
                if descendant_ids:
                    perguntas_qs = perguntas_qs.filter(categorias__pk__in=descendant_ids).distinct()
                else:
                    return Pergunta.objects.none(), resolved_method
            else:
                return Pergunta.objects.none(), resolved_method

        num_perguntas_a_selecionar = 0
        coerced_limit_override = self._coerce_positive_int(limit_override)
        if coerced_limit_override is not None:
            num_perguntas_a_selecionar = coerced_limit_override
        elif quiz_mode == SessoesQuizUsuario.ModoQuiz.RAPIDO:
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
            if all_matching_question_ids:
                method = StudyMethodRegistry.get_strategy(resolved_method)
                context = StudyMethodContext(
                    quiz_mode=quiz_mode,
                    category_ids=category_ids_filter,
                    difficulty_levels=difficulty_levels_filter,
                    search_query=search_query,
                )
                selected_ids = method.select_question_ids(
                    user=self.user,
                    base_queryset=Pergunta.objects.filter(pk__in=all_matching_question_ids),
                    limit=num_perguntas_a_selecionar,
                    context=context,
                )
                if selected_ids:
                    sanitized_ids = self._sanitize_id_sequence(selected_ids)
                    return self._build_queryset_from_ids(sanitized_ids, include_inactive=include_inactive), resolved_method
                base_queryset = Pergunta.objects.all()
                if not include_inactive:
                    base_queryset = base_queryset.filter(ativa=True)
                perguntas_qs = base_queryset.filter(pk__in=all_matching_question_ids)

        return perguntas_qs.distinct(), resolved_method

    def _build_predefined_quiz_queryset(
        self,
        quiz_def: QuizDefinicao,
        resolved_method: str,
    ) -> Tuple[Iterable[Pergunta], str]:
        generation_type = quiz_def.generation_type or QuizDefinicao.GenerationType.MANUAL
        config = quiz_def.get_generation_config()

        if quiz_def.study_method_override:
            resolved_method = StudyMethodRegistry.resolve_key(quiz_def.study_method_override)

        if generation_type == QuizDefinicao.GenerationType.MANUAL:
            question_ids = list(
                quiz_def.quizdefinicaopergunta_set.order_by("ordem").values_list("pergunta_id", flat=True)
            )
            question_ids = self._sanitize_id_sequence(question_ids)
            if not question_ids:
                return Pergunta.objects.none(), resolved_method

            if self._coerce_bool_flag(config.get("shuffle")):
                random.shuffle(question_ids)

            limit = self._coerce_positive_int(config.get("limit"))
            if limit:
                question_ids = question_ids[:limit]

            include_inactive = self._coerce_bool_flag(config.get("include_inactive"))
            return self._build_queryset_from_ids(question_ids, include_inactive=include_inactive), resolved_method

        if generation_type == QuizDefinicao.GenerationType.FAVORITES:
            if not self.user or not getattr(self.user, "is_authenticated", False):
                return Pergunta.objects.none(), resolved_method

            favorites_qs = QuestaoFavorita.objects.filter(usuario=self.user)
            sort_option = str(config.get("sort") or "recent").strip().lower()
            if sort_option == "oldest":
                favorites_qs = favorites_qs.order_by("data_favoritada")
            else:
                favorites_qs = favorites_qs.order_by("-data_favoritada")

            favorite_ids = self._sanitize_id_sequence(favorites_qs.values_list("pergunta_id", flat=True))
            if sort_option == "random":
                random.shuffle(favorite_ids)

            limit = self._coerce_positive_int(config.get("limit"))
            if limit:
                favorite_ids = favorite_ids[:limit]

            include_inactive = self._coerce_bool_flag(config.get("include_inactive"))
            return self._build_queryset_from_ids(favorite_ids, include_inactive=include_inactive), resolved_method

        if generation_type == QuizDefinicao.GenerationType.REPEAT_LAST:
            if not self.user or not getattr(self.user, "is_authenticated", False):
                return Pergunta.objects.none(), resolved_method

            sessions_qs = SessoesQuizUsuario.objects.filter(id_usuario=self.user).order_by("-data_inicio")
            if not self._coerce_bool_flag(config.get("include_incomplete")):
                sessions_qs = sessions_qs.exclude(status_sessao=SessoesQuizUsuario.StatusSessao.ABANDONADA)

            last_session = sessions_qs.first()
            if not last_session:
                return Pergunta.objects.none(), resolved_method

            question_ids = self._sanitize_id_sequence(last_session.ids_perguntas_json or [])
            use_same_questions = self._coerce_bool_flag(config.get("use_same_questions"), default=True)
            include_inactive = self._coerce_bool_flag(config.get("include_inactive"))
            limit = self._coerce_positive_int(config.get("limit"))

            if use_same_questions and question_ids:
                if self._coerce_bool_flag(config.get("shuffle")):
                    random.shuffle(question_ids)
                if limit:
                    question_ids = question_ids[:limit]
                return self._build_queryset_from_ids(question_ids, include_inactive=include_inactive), resolved_method

            fallback_limit = None
            if limit:
                fallback_limit = limit
            elif isinstance(last_session.num_questoes_solicitadas, int) and last_session.num_questoes_solicitadas > 0:
                fallback_limit = last_session.num_questoes_solicitadas

            categories_selected = list(last_session.categorias_selecionadas.values_list("pk", flat=True))
            difficulties_selected = last_session.dificuldades_selecionadas_json
            fallback_mode = last_session.modo_quiz
            fallback_method = (
                quiz_def.study_method_override
                or config.get("study_method")
                or last_session.metodo_estudo
                or resolved_method
            )

            fallback_questions, resolved_method = self._apply_filters(
                category_ids_filter=[str(pk) for pk in categories_selected] or None,
                difficulty_levels_filter=difficulties_selected,
                quiz_mode=fallback_mode,
                question_count_str=str(fallback_limit)
                if fallback_mode == SessoesQuizUsuario.ModoQuiz.RAPIDO and fallback_limit
                else None,
                num_questions_custom_str=str(fallback_limit)
                if fallback_mode != SessoesQuizUsuario.ModoQuiz.RAPIDO and fallback_limit
                else None,
                search_query=config.get("search_query"),
                study_method_key=fallback_method,
                include_inactive=include_inactive,
            )

            if self._coerce_bool_flag(config.get("shuffle")):
                fallback_ids = list(fallback_questions.values_list("pk", flat=True))
                random.shuffle(fallback_ids)
                if isinstance(fallback_limit, int) and fallback_limit > 0:
                    fallback_ids = fallback_ids[:fallback_limit]
                return self._build_queryset_from_ids(fallback_ids, include_inactive=include_inactive), resolved_method

            if isinstance(fallback_limit, int) and fallback_limit > 0:
                fallback_questions = fallback_questions[:fallback_limit]
            return fallback_questions, resolved_method

        categories_cfg = config.get("category_ids")
        difficulties_cfg = config.get("difficulty_levels")
        search_term = config.get("search_query")
        limit_cfg = self._coerce_positive_int(config.get("limit") or config.get("question_limit"))
        method_override = config.get("study_method") or quiz_def.study_method_override
        if isinstance(method_override, str):
            method_override = method_override.strip() or None
        include_inactive = self._coerce_bool_flag(config.get("include_inactive"))
        only_favorites = self._coerce_bool_flag(config.get("only_favorites"))
        configured_mode = config.get("mode") or SessoesQuizUsuario.ModoQuiz.POR_CATEGORIA

        questions, resolved_method = self._apply_filters(
            category_ids_filter=categories_cfg,
            difficulty_levels_filter=difficulties_cfg,
            quiz_mode=configured_mode,
            question_count_str=str(limit_cfg)
            if configured_mode == SessoesQuizUsuario.ModoQuiz.RAPIDO and limit_cfg
            else None,
            num_questions_custom_str=str(limit_cfg)
            if configured_mode != SessoesQuizUsuario.ModoQuiz.RAPIDO and limit_cfg
            else None,
            search_query=search_term,
            study_method_key=method_override,
            include_inactive=include_inactive,
            only_favorites=only_favorites,
            limit_override=None if configured_mode in SessoesQuizUsuario.ModoQuiz.values else limit_cfg,
        )

        if self._coerce_bool_flag(config.get("shuffle")):
            ids = list(questions.values_list("pk", flat=True))
            random.shuffle(ids)
            if isinstance(limit_cfg, int) and limit_cfg > 0:
                ids = ids[:limit_cfg]
            return self._build_queryset_from_ids(ids, include_inactive=include_inactive), resolved_method

        if isinstance(limit_cfg, int) and limit_cfg > 0:
            questions = questions[:limit_cfg]

        return questions, resolved_method

    def _build_perguntas_queryset(
        self,
        category_ids_filter: Optional[Iterable[str]] = None,
        difficulty_levels_filter: Optional[Iterable[str]] = None,
        quiz_mode: Optional[str] = None,
        question_count_str: Optional[str] = None,
        num_questions_custom_str: Optional[str] = None,
        quiz_definicao_id: Optional[int] = None,
        search_query: Optional[str] = None,
        study_method_key: Optional[str] = None,
    ) -> Tuple[Iterable[Pergunta], Optional[str], str]:
        resolved_method = StudyMethodRegistry.resolve_key(study_method_key or self._study_method_key)
        if quiz_definicao_id:
            try:
                quiz_def = QuizDefinicao.objects.get(pk=quiz_definicao_id, ativo=True)
            except QuizDefinicao.DoesNotExist:
                return Pergunta.objects.none(), None, resolved_method
            perguntas_qs, resolved_method = self._build_predefined_quiz_queryset(quiz_def, resolved_method)
            return perguntas_qs, quiz_def.nome_quiz, resolved_method

        perguntas_qs, resolved_method = self._apply_filters(
            category_ids_filter=category_ids_filter,
            difficulty_levels_filter=difficulty_levels_filter,
            quiz_mode=quiz_mode,
            question_count_str=question_count_str,
            num_questions_custom_str=num_questions_custom_str,
            search_query=search_query,
            study_method_key=study_method_key,
        )

        return perguntas_qs, None, resolved_method

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
        study_method_key: Optional[str] = None,
    ):
        perguntas_qs, quiz_definition_name, resolved_method = self._build_perguntas_queryset(
            category_ids_filter=category_ids_filter,
            difficulty_levels_filter=difficulty_levels_filter,
            quiz_mode=quiz_mode,
            question_count_str=question_count_str,
            num_questions_custom_str=num_questions_custom_str,
            quiz_definicao_id=quiz_definicao_id,
            search_query=search_query,
            study_method_key=study_method_key,
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
        )

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
                    "slug": pergunta.slug,
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
            "study_methods": StudyMethodRegistry.list_metadata(),
            "selected_study_method": resolved_method,
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
                question_count = quiz.perguntas.count()

            dynamic_estimate = quiz.get_estimated_question_count()
            if isinstance(dynamic_estimate, int) and dynamic_estimate > 0:
                question_count = dynamic_estimate

            study_method_key = quiz.study_method_override or None
            study_method_label = StudyMethodRegistry.get_display_name(study_method_key)

            quizzes_summary.append(
                {
                    'id': quiz.pk,
                    'slug': quiz.slug,
                    'nome': quiz.nome_quiz,
                    'descricao': quiz.descricao or '',
                    'total_perguntas': question_count,
                    'generation_type': quiz.generation_type,
                    'generation_label': quiz.get_generation_type_display(),
                    'study_method': study_method_key,
                    'study_method_label': study_method_label,
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
