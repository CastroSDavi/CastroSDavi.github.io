"""ViewSets exposing the quiz API through a DRF-like interface."""

from __future__ import annotations

import json
from collections import defaultdict

from django.db.models import Case, Count, Q, When
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from quiz.models import (
    Categoria,
    OpcaoResposta,
    Pergunta,
    QuestaoFavorita,
    QuizDefinicao,
    RespostasUsuarioPorSessao,
    EstatisticasDiariasUsuario,
    SessoesQuizUsuario,
)
from quiz.services.quiz_service import QuizDataService
from quiz.services.statistics_service import StatisticsService
from quiz.views import (
    _get_category_performance_data,
    _get_difficulty_performance_data,
    _get_learning_progress_data,
    _get_overall_accuracy_data,
    _get_study_heatmap_data,
    _get_study_time_detail_data,
    get_quiz_config,
    get_or_create_daily_stats,
)

from .serializers import (
    EndQuizSessionSerializer,
    FilteredQuestionCountSerializer,
    QuizDataQuerySerializer,
    RegisterAnswerSerializer,
    StartQuizSessionSerializer,
    StatisticsQuerySerializer,
)


class QuizViewSet(viewsets.ViewSet):
    """Aggregates all quiz related endpoints used by the front-end."""

    def _parse_csv(self, value):
        if not value:
            return []
        return [item.strip() for item in str(value).split(',') if item.strip()]

    def _parse_json_body(self, request):
        try:
            return json.loads(request.body.decode('utf-8') or '{}')
        except json.JSONDecodeError:
            raise serializers.ValidationError({'detail': 'Corpo da requisição JSON inválido.'})

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        try:
            perguntas_ativas = Pergunta.objects.filter(ativa=True)
            total_questions = perguntas_ativas.count()

            categorias_qs = Categoria.objects.annotate(
                total_perguntas=Count(
                    'perguntas_associadas',
                    filter=Q(perguntas_associadas__ativa=True)
                )
            ).order_by('nome_categoria')

            quiz_config = get_quiz_config()
            quick_quiz_default = getattr(quiz_config, 'numero_perguntas_quiz_rapido', None)

            categorias_data = [
                {
                    'id_categoria': categoria.pk,
                    'nome_categoria': categoria.nome_categoria,
                    'id_categoria_pai': categoria.id_categoria_pai_id,
                    'total_perguntas': categoria.total_perguntas or 0,
                }
                for categoria in categorias_qs
            ]

            return Response({
                'status': 'success',
                'total_questions': total_questions,
                'total_categories': len(categorias_data),
                'quick_quiz_default_count': quick_quiz_default,
                'categories': categorias_data,
            })
        except Exception:
            return Response(
                {'status': 'error', 'message': 'Erro ao buscar resumo inicial.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=['get'], url_path='alldata')
    def alldata(self, request):
        serializer = QuizDataQuerySerializer(data=request.GET)
        try:
            serializer.is_valid(raise_exception=True)
        except serializers.ValidationError:
            return Response({'status': 'error', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        category_ids_filter = self._parse_csv(data.get('category_ids'))
        difficulty_levels_filter = self._parse_csv(data.get('difficulty_levels'))
        quiz_mode = data.get('mode')
        question_count_str = data.get('count')
        num_questions_custom_str = data.get('num_questions')
        quiz_definicao_id = data.get('quiz_definicao_id')
        search_query = data.get('search_query')

        if quiz_definicao_id:
            quiz_mode = SessoesQuizUsuario.ModoQuiz.DEFINIDO

        user_for_favorites = request.user if request.user.is_authenticated else None

        try:
            service = QuizDataService(quiz_config=get_quiz_config(), user=user_for_favorites)
            quiz_data = service.get_quiz_data_dict(
                category_ids_filter=category_ids_filter,
                difficulty_levels_filter=difficulty_levels_filter,
                quiz_mode=quiz_mode,
                question_count_str=question_count_str,
                num_questions_custom_str=num_questions_custom_str,
                quiz_definicao_id=quiz_definicao_id,
                search_query=search_query,
            )
            return Response(quiz_data)
        except Exception:
            return Response(
                {'status': 'error', 'message': 'Erro ao buscar dados do quiz.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=['get'], url_path='filtered-count')
    def filtered_count(self, request):
        serializer = FilteredQuestionCountSerializer(data=request.GET)
        try:
            serializer.is_valid(raise_exception=True)
        except serializers.ValidationError:
            return Response({'status': 'error', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        try:
            perguntas_qs = Pergunta.objects.filter(ativa=True)

            category_ids_str = serializer.validated_data.get('category_ids')
            if category_ids_str:
                category_ids_list = [cid.strip() for cid in category_ids_str.split(',') if cid.strip()]
                descendant_ids = QuizDataService.get_descendant_category_ids(category_ids_list)
                if descendant_ids:
                    perguntas_qs = perguntas_qs.filter(categorias__pk__in=descendant_ids).distinct()

            difficulty_levels_str = serializer.validated_data.get('difficulty_levels')
            if difficulty_levels_str and 'all' not in difficulty_levels_str:
                difficulty_levels = [level.strip() for level in difficulty_levels_str.split(',') if level.strip()]
                if difficulty_levels:
                    q_difficulty_objects = Q()
                    valid_model_difficulties = [choice[0] for choice in Pergunta.NivelDificuldade.choices]
                    for level_from_filter in difficulty_levels:
                        for model_level in valid_model_difficulties:
                            if level_from_filter.lower() == model_level.lower():
                                q_difficulty_objects |= Q(nivel_dificuldade=model_level)
                                break
                    if q_difficulty_objects:
                        perguntas_qs = perguntas_qs.filter(q_difficulty_objects)

            search_query = serializer.validated_data.get('search_query')
            if search_query and search_query.strip():
                search_term = search_query.strip()
                perguntas_qs = perguntas_qs.filter(
                    Q(texto_pergunta__icontains=search_term) |
                    Q(referencia_bibliografica__icontains=search_term) |
                    Q(categorias__nome_categoria__icontains=search_term)
                ).distinct()

            return Response({'count': perguntas_qs.count()})
        except Exception:
            return Response(
                {'status': 'error', 'message': 'Erro ao buscar contagem de questões.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=['post'], url_path='start-session')
    def start_session(self, request):
        if not request.user.is_authenticated:
            return Response(
                {'status': 'error', 'message': 'Autenticação necessária.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            payload = self._parse_json_body(request)
        except serializers.ValidationError as exc:
            detail = exc.args[0] if exc.args else {}
            message = detail.get('detail', 'Corpo da requisição JSON inválido.') if isinstance(detail, dict) else 'Corpo da requisição JSON inválido.'
            return Response({'status': 'error', 'message': message}, status=status.HTTP_400_BAD_REQUEST)

        serializer = StartQuizSessionSerializer(data=payload)
        try:
            serializer.is_valid(raise_exception=True)
        except serializers.ValidationError:
            return Response({'status': 'error', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        modo_quiz_frontend = data.get('modo_quiz')
        categoria_ids_str_list = data.get('categoria_ids', [])
        question_ids_in_session = data.get('question_ids_in_session')
        quiz_definicao_id = data.get('quiz_definicao_id')

        total_perguntas_sessao = len(question_ids_in_session)
        if not modo_quiz_frontend or total_perguntas_sessao <= 0:
            return Response(
                {'status': 'error', 'message': 'Dados inválidos para iniciar sessão (modo ou nº de perguntas).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if modo_quiz_frontend not in SessoesQuizUsuario.ModoQuiz.values:
            return Response(
                {'status': 'error', 'message': f"Modo de quiz '{modo_quiz_frontend}' inválido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        quiz_definicao_obj = None
        if modo_quiz_frontend == SessoesQuizUsuario.ModoQuiz.DEFINIDO:
            if not quiz_definicao_id:
                return Response(
                    {'status': 'error', 'message': 'ID da definição do quiz ausente para modo "Definido".'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                quiz_definicao_obj = QuizDefinicao.objects.get(pk=int(quiz_definicao_id), ativo=True)
            except (QuizDefinicao.DoesNotExist, ValueError):
                return Response(
                    {'status': 'error', 'message': 'Definição de quiz inválida ou inativa.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        nova_sessao = SessoesQuizUsuario.objects.create(
            id_usuario=request.user,
            modo_quiz=modo_quiz_frontend,
            id_quiz_definicao=quiz_definicao_obj,
            total_perguntas_sessao=total_perguntas_sessao,
            status_sessao=SessoesQuizUsuario.StatusSessao.EM_ANDAMENTO,
            data_inicio=timezone.now(),
            ids_perguntas_json=question_ids_in_session,
            indice_ultima_pergunta_vista=0 if total_perguntas_sessao > 0 else None,
            dificuldades_selecionadas_json=data.get('dificuldades_selecionadas'),
            num_questoes_solicitadas=data.get('num_questoes_solicitadas'),
        )

        if modo_quiz_frontend == SessoesQuizUsuario.ModoQuiz.POR_CATEGORIA and categoria_ids_str_list:
            try:
                categoria_ids_int = [int(cat_id) for cat_id in categoria_ids_str_list if str(cat_id).strip().isdigit()]
                if categoria_ids_int:
                    categorias_objs = Categoria.objects.filter(pk__in=categoria_ids_int)
                    nova_sessao.categorias_selecionadas.set(categorias_objs)
            except ValueError:
                pass

        return Response({'status': 'success', 'session_id': nova_sessao.pk})

    @action(detail=False, methods=['post'], url_path='register-answer')
    def register_answer(self, request):
        if not request.user.is_authenticated:
            return Response(
                {'status': 'error', 'message': 'Autenticação necessária.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            payload = self._parse_json_body(request)
        except serializers.ValidationError as exc:
            detail = exc.args[0] if exc.args else {}
            message = detail.get('detail', 'Corpo da requisição JSON inválido.') if isinstance(detail, dict) else 'Corpo da requisição JSON inválido.'
            return Response({'status': 'error', 'message': message}, status=status.HTTP_400_BAD_REQUEST)

        serializer = RegisterAnswerSerializer(data=payload)
        try:
            serializer.is_valid(raise_exception=True)
        except serializers.ValidationError:
            return Response({'status': 'error', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        quiz_config = get_quiz_config()

        session_id = data.get('session_id')
        pergunta_id = data.get('pergunta_id')
        opcao_id = data.get('opcao_id')
        current_question_index = data.get('current_question_index')

        try:
            sessao_quiz = get_object_or_404(SessoesQuizUsuario, pk=session_id, id_usuario=request.user)
            if sessao_quiz.status_sessao != SessoesQuizUsuario.StatusSessao.EM_ANDAMENTO:
                return Response(
                    {'status': 'error', 'message': 'Sessão de quiz não está em andamento.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            pergunta = get_object_or_404(Pergunta, pk=pergunta_id)
            opcao_selecionada = None
            foi_correta_calculada = None

            if opcao_id is not None:
                opcao_selecionada = get_object_or_404(OpcaoResposta, pk=int(opcao_id), pergunta=pergunta)
                foi_correta_calculada = opcao_selecionada.eh_correta

            RespostasUsuarioPorSessao.objects.update_or_create(
                id_sessao_quiz=sessao_quiz,
                id_pergunta=pergunta,
                defaults={
                    'id_opcao_resposta_selecionada': opcao_selecionada,
                    'foi_correta': foi_correta_calculada,
                    'data_resposta': timezone.now(),
                },
            )

            respostas_da_sessao = RespostasUsuarioPorSessao.objects.filter(id_sessao_quiz=sessao_quiz)
            sessao_quiz.total_acertos = respostas_da_sessao.filter(foi_correta=True).count()
            sessao_quiz.total_erros = respostas_da_sessao.filter(
                foi_correta=False,
                id_opcao_resposta_selecionada__isnull=False,
            ).count()
            sessao_quiz.pontuacao_final = max(
                0,
                (sessao_quiz.total_acertos * quiz_config.pontuacao_por_acerto)
                - (sessao_quiz.total_erros * quiz_config.penalidade_por_erro),
            )

            if current_question_index is not None:
                try:
                    idx = int(current_question_index)
                    if sessao_quiz.ids_perguntas_json and 0 <= idx < len(sessao_quiz.ids_perguntas_json):
                        sessao_quiz.indice_ultima_pergunta_vista = idx
                except ValueError:
                    pass

            sessao_quiz.save()

            return Response({
                'status': 'success',
                'message': 'Resposta registrada.',
                'foi_correta': foi_correta_calculada,
                'pontuacao_sessao': sessao_quiz.pontuacao_final,
                'total_acertos_sessao': sessao_quiz.total_acertos,
                'total_erros_sessao': sessao_quiz.total_erros,
            })
        except SessoesQuizUsuario.DoesNotExist:
            return Response(
                {'status': 'error', 'message': 'Sessão de quiz inválida ou não pertence ao usuário.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        except Pergunta.DoesNotExist:
            return Response(
                {'status': 'error', 'message': 'Pergunta inválida.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except OpcaoResposta.DoesNotExist:
            return Response(
                {'status': 'error', 'message': 'Opção de resposta inválida.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            return Response(
                {'status': 'error', 'message': 'Erro interno ao registrar resposta.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=['post'], url_path='end-session')
    def end_session(self, request):
        if not request.user.is_authenticated:
            return Response(
                {'status': 'error', 'message': 'Autenticação necessária.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            payload = self._parse_json_body(request)
        except serializers.ValidationError as exc:
            detail = exc.args[0] if exc.args else {}
            message = detail.get('detail', 'Corpo da requisição JSON inválido.') if isinstance(detail, dict) else 'Corpo da requisição JSON inválido.'
            return Response({'status': 'error', 'message': message}, status=status.HTTP_400_BAD_REQUEST)

        serializer = EndQuizSessionSerializer(data=payload)
        try:
            serializer.is_valid(raise_exception=True)
        except serializers.ValidationError:
            return Response({'status': 'error', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        session_id = data.get('session_id')
        tempo_total_segundos_frontend = int(data.get('tempo_total_segundos') or 0)

        try:
            sessao_quiz = get_object_or_404(SessoesQuizUsuario, pk=session_id, id_usuario=request.user)

            if sessao_quiz.status_sessao == SessoesQuizUsuario.StatusSessao.COMPLETA:
                return Response({
                    'status': 'info',
                    'message': 'Sessão já finalizada.',
                    'pontuacao_final': sessao_quiz.pontuacao_final,
                    'total_acertos': sessao_quiz.total_acertos,
                    'total_erros': sessao_quiz.total_erros,
                })

            sessao_quiz.data_fim = timezone.now()
            sessao_quiz.tempo_total_segundos = tempo_total_segundos_frontend
            sessao_quiz.status_sessao = SessoesQuizUsuario.StatusSessao.COMPLETA
            sessao_quiz.save()

            stats = get_or_create_daily_stats(request.user)
            perguntas_respondidas_na_sessao = RespostasUsuarioPorSessao.objects.filter(
                id_sessao_quiz=sessao_quiz,
                id_opcao_resposta_selecionada__isnull=False,
            ).count()

            stats.perguntas_respondidas_dia += perguntas_respondidas_na_sessao
            stats.acertos_dia += sessao_quiz.total_acertos
            stats.pontos_dia += sessao_quiz.pontuacao_final
            stats.tempo_estudo_segundos_dia += tempo_total_segundos_frontend
            stats.save()

            return Response({
                'status': 'success',
                'message': 'Sessão finalizada com sucesso.',
                'pontuacao_final': sessao_quiz.pontuacao_final,
                'total_acertos': sessao_quiz.total_acertos,
                'total_erros': sessao_quiz.total_erros,
            })
        except SessoesQuizUsuario.DoesNotExist:
            return Response(
                {'status': 'error', 'message': 'Sessão de quiz inválida ou não pertence ao usuário.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        except Exception:
            return Response(
                {'status': 'error', 'message': 'Erro interno ao finalizar sessão.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=['get'], url_path='resume-session')
    def resume_session(self, request):
        if not request.user.is_authenticated:
            return Response(
                {'status': 'error', 'message': 'Autenticação necessária.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            sessao_ativa = (
                SessoesQuizUsuario.objects.filter(
                    id_usuario=request.user,
                    status_sessao=SessoesQuizUsuario.StatusSessao.EM_ANDAMENTO,
                )
                .order_by('-data_inicio')
                .select_related('id_quiz_definicao')
                .first()
            )

            if not sessao_ativa:
                return Response(
                    {'status': 'not_found', 'message': 'Nenhuma sessão de quiz em andamento encontrada.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

            if not sessao_ativa.ids_perguntas_json:
                sessao_ativa.status_sessao = SessoesQuizUsuario.StatusSessao.ABANDONADA
                sessao_ativa.save()
                return Response(
                    {'status': 'error', 'message': 'Sessão corrompida, não foi possível retomar.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            ids_perguntas_ordenadas = sessao_ativa.ids_perguntas_json

            preserved_order = Case(
                *[When(pk=pk, then=pos) for pos, pk in enumerate(ids_perguntas_ordenadas)]
            )
            perguntas_qs = (
                Pergunta.objects.filter(pk__in=ids_perguntas_ordenadas, ativa=True)
                .order_by(preserved_order)
                .prefetch_related('categorias', 'opcoes')
            )

            if perguntas_qs.count() != len(ids_perguntas_ordenadas):
                sessao_ativa.status_sessao = SessoesQuizUsuario.StatusSessao.ABANDONADA
                sessao_ativa.save()
                return Response(
                    {
                        'status': 'error',
                        'message': 'Algumas perguntas da sessão não estão mais disponíveis. Sessão encerrada.',
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            user_favorite_ids = set(
                QuestaoFavorita.objects.filter(
                    usuario=request.user, pergunta_id__in=ids_perguntas_ordenadas
                ).values_list('pergunta_id', flat=True)
            )

            perguntas_data_list = []
            opcoes_dict_por_pergunta = defaultdict(list)

            for option in OpcaoResposta.objects.filter(pergunta_id__in=ids_perguntas_ordenadas):
                opcoes_dict_por_pergunta[option.pergunta_id].append(
                    {
                        'id_opcao_resposta': option.pk,
                        'id_pergunta': option.pergunta_id,
                        'texto_opcao': option.texto_opcao,
                        'eh_correta': option.eh_correta,
                        'ordem_exibicao': option.ordem_exibicao,
                        'feedback_opcao': option.feedback_opcao,
                    }
                )

            for pergunta in perguntas_qs:
                perguntas_data_list.append(
                    {
                        'id_pergunta': pergunta.pk,
                        'texto_pergunta': pergunta.texto_pergunta,
                        'url_imagem': pergunta.url_imagem,
                        'referencia_bibliografica': pergunta.referencia_bibliografica,
                        'categoria_ids': [cat.pk for cat in pergunta.categorias.all()],
                        'nivel_dificuldade': pergunta.nivel_dificuldade,
                        'explicacao_resposta': pergunta.explicacao_resposta,
                        'is_favorited': pergunta.pk in user_favorite_ids,
                        'opcoes': sorted(
                            opcoes_dict_por_pergunta.get(pergunta.pk, []),
                            key=lambda x: x.get('ordem_exibicao', 0),
                        ),
                    }
                )

            respostas_dadas_qs = RespostasUsuarioPorSessao.objects.filter(id_sessao_quiz=sessao_ativa)
            respostas_dadas_map = {
                resp.id_pergunta_id: {
                    'opcao_selecionada_id': resp.id_opcao_resposta_selecionada_id,
                    'foi_correta': resp.foi_correta,
                }
                for resp in respostas_dadas_qs
            }

            todas_categorias_qs = Categoria.objects.all().order_by('nome_categoria')
            categorias_data_list = [
                {
                    'id_categoria': c.pk,
                    'nome_categoria': c.nome_categoria,
                    'id_categoria_pai': c.id_categoria_pai_id,
                    'descricao_categoria': c.descricao_categoria,
                }
                for c in todas_categorias_qs
            ]

            quiz_definition_name = None
            if sessao_ativa.id_quiz_definicao:
                quiz_definition_name = sessao_ativa.id_quiz_definicao.nome_quiz

            return Response({
                'status': 'success',
                'session_id': sessao_ativa.pk,
                'modo_quiz': sessao_ativa.modo_quiz,
                'id_quiz_definicao': sessao_ativa.id_quiz_definicao_id,
                'quiz_definition_name': quiz_definition_name,
                'perguntas': perguntas_data_list,
                'categorias': categorias_data_list,
                'respostas_dadas': respostas_dadas_map,
                'indice_ultima_pergunta_vista': sessao_ativa.indice_ultima_pergunta_vista,
                'pontuacao_atual': sessao_ativa.pontuacao_final,
                'total_acertos_atual': sessao_ativa.total_acertos,
                'total_erros_atual': sessao_ativa.total_erros,
                'data_inicio_sessao_iso': sessao_ativa.data_inicio.isoformat(),
            })
        except Exception:
            return Response(
                {'status': 'error', 'message': 'Erro interno ao tentar retomar sessão.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class FavoriteQuestionViewSet(viewsets.ViewSet):
    """Manages favorite questions for authenticated users."""

    def list(self, request):
        if not request.user.is_authenticated:
            return Response(
                {'status': 'error', 'message': 'Autenticação necessária.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        favoritos_qs = (
            QuestaoFavorita.objects.filter(usuario=request.user)
            .select_related('pergunta')
            .prefetch_related('pergunta__categorias', 'pergunta__opcoes')
            .order_by('-data_favoritada')
        )

        perguntas_favoritas_data = []
        for fav in favoritos_qs:
            pergunta = fav.pergunta
            opcoes_data = [
                {
                    'id_opcao_resposta': o.pk,
                    'id_pergunta': o.pergunta_id,
                    'texto_opcao': o.texto_opcao,
                    'eh_correta': o.eh_correta,
                    'ordem_exibicao': o.ordem_exibicao,
                    'feedback_opcao': o.feedback_opcao,
                }
                for o in pergunta.opcoes.all()
            ]

            categorias_relacionadas = list(pergunta.categorias.all())

            perguntas_favoritas_data.append(
                {
                    'id_pergunta': pergunta.pk,
                    'texto_pergunta': pergunta.texto_pergunta,
                    'url_imagem': pergunta.url_imagem,
                    'referencia_bibliografica': pergunta.referencia_bibliografica,
                    'categoria_ids': [cat.pk for cat in categorias_relacionadas],
                    'categorias': [
                        {
                            'id_categoria': cat.pk,
                            'nome_categoria': cat.nome_categoria,
                        }
                        for cat in categorias_relacionadas
                    ],
                    'nivel_dificuldade': pergunta.nivel_dificuldade,
                    'explicacao_resposta': pergunta.explicacao_resposta,
                    'opcoes': opcoes_data,
                    'esta_ativa': pergunta.ativa,
                    'data_favoritada': fav.data_favoritada.isoformat(),
                }
            )

        all_categories_list_for_mapping = [
            {
                'id_categoria': c.pk,
                'nome_categoria': c.nome_categoria,
                'id_categoria_pai': c.id_categoria_pai_id,
                'descricao_categoria': c.descricao_categoria,
            }
            for c in Categoria.objects.all().order_by('nome_categoria')
        ]

        return Response({
            'status': 'success',
            'favorite_questions': perguntas_favoritas_data,
            'all_categories_for_mapping': all_categories_list_for_mapping,
        })


class QuestionViewSet(viewsets.ViewSet):
    """Handles question specific endpoints such as toggling favorites."""

    lookup_field = 'pergunta_id'
    lookup_value_regex = r'\d+'

    def retrieve(self, request, pergunta_id=None):
        if not request.user.is_authenticated:
            return Response(
                {'status': 'error', 'message': 'Autenticação necessária.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        pergunta = get_object_or_404(Pergunta, pk=pergunta_id)

        is_favorited = QuestaoFavorita.objects.filter(usuario=request.user, pergunta=pergunta).exists()

        if not pergunta.ativa and not is_favorited:
            return Response(
                {
                    'status': 'error',
                    'message': 'Esta questão não está mais disponível no banco de questões.',
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        warning_message = None
        warning_type = 'info'
        if not pergunta.ativa and is_favorited:
            warning_message = (
                'Esta questão não está mais disponível no banco atual. Exibindo a versão salva '
                'na sua lista de favoritos.'
            )
            warning_type = 'warning'

        opcoes_data = [
            {
                'id_opcao_resposta': opcao.pk,
                'id_pergunta': opcao.pergunta_id,
                'texto_opcao': opcao.texto_opcao,
                'eh_correta': opcao.eh_correta,
                'ordem_exibicao': opcao.ordem_exibicao,
                'feedback_opcao': opcao.feedback_opcao,
            }
            for opcao in pergunta.opcoes.order_by('ordem_exibicao', 'pk')
        ]

        question_payload = {
            'id_pergunta': pergunta.pk,
            'texto_pergunta': pergunta.texto_pergunta,
            'url_imagem': pergunta.url_imagem,
            'referencia_bibliografica': pergunta.referencia_bibliografica,
            'categoria_ids': list(pergunta.categorias.values_list('pk', flat=True)),
            'nivel_dificuldade': pergunta.nivel_dificuldade,
            'explicacao_resposta': pergunta.explicacao_resposta,
            'opcoes': opcoes_data,
            'is_favorited': is_favorited,
            'esta_ativa': pergunta.ativa,
        }

        response_payload = {'status': 'success', 'question': question_payload}
        if warning_message:
            response_payload['message'] = warning_message
            response_payload['message_type'] = warning_type

        return Response(response_payload)

    @action(detail=True, methods=['post'], url_path='toggle_favorite')
    def toggle_favorite(self, request, pergunta_id=None):
        if not request.user.is_authenticated:
            return Response(
                {'status': 'error', 'message': 'Autenticação necessária.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        pergunta = get_object_or_404(Pergunta, pk=pergunta_id)
        favorito, created = QuestaoFavorita.objects.get_or_create(usuario=request.user, pergunta=pergunta)

        if not created:
            favorito.delete()
            is_favorited_now = False
            message = 'Questão removida dos favoritos.'
        else:
            is_favorited_now = True
            message = 'Questão adicionada aos favoritos.'

        return Response({'status': 'success', 'is_favorited': is_favorited_now, 'message': message})


class UserStatisticsViewSet(viewsets.ViewSet):
    """Exposes aggregated statistics for authenticated users."""

    def list(self, request):
        if not request.user.is_authenticated:
            return Response(
                {'status': 'error', 'message': 'Autenticação necessária.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = StatisticsQuerySerializer(data=request.GET)
        try:
            serializer.is_valid(raise_exception=True)
        except serializers.ValidationError:
            return Response({'status': 'error', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        period = serializer.validated_data.get('period', '30d')

        try:
            daily_stats_queryset = getattr(request.user, "estatisticas_diarias", None)
            if daily_stats_queryset is None:
                daily_stats_queryset = EstatisticasDiariasUsuario.objects.filter(id_usuario=request.user)
            else:
                daily_stats_queryset = daily_stats_queryset.all()

            daily_stats_period_qs = StatisticsService.filter_queryset_by_period(
                daily_stats_queryset, period, 'data_estatistica'
            )
            user_sessions_period_qs = StatisticsService.filter_queryset_by_period(
                SessoesQuizUsuario.objects.filter(
                    id_usuario=request.user,
                    status_sessao=SessoesQuizUsuario.StatusSessao.COMPLETA,
                ),
                period,
                'data_inicio',
            )

            key_metrics = StatisticsService.get_key_metrics(request.user, daily_stats_period_qs)
            overall_accuracy_data = _get_overall_accuracy_data(daily_stats_period_qs)
            category_performance_list = _get_category_performance_data(user_sessions_period_qs)
            learning_progress_data = _get_learning_progress_data(daily_stats_period_qs)
            study_heatmap_data = _get_study_heatmap_data(daily_stats_period_qs)
            study_time_chart_data = _get_study_time_detail_data(request.user)
            difficulty_performance_list = _get_difficulty_performance_data(user_sessions_period_qs)

            return Response({
                'status': 'success',
                'period_applied': period,
                'key_metrics': key_metrics,
                'overall_accuracy': overall_accuracy_data,
                'category_performance': category_performance_list,
                'learning_progress': learning_progress_data,
                'study_heatmap': study_heatmap_data,
                'study_time_detail': study_time_chart_data,
                'difficulty_performance': difficulty_performance_list,
            })
        except Exception:
            return Response(
                {'status': 'error', 'message': 'Erro ao buscar estatísticas do usuário.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
