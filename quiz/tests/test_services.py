from datetime import timedelta
from types import SimpleNamespace

from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from quiz.models import (
    Categoria,
    ConfiguracoesGeraisQuiz,
    Conquista,
    EstatisticasDiariasUsuario,
    NivelGamificacao,
    OpcaoResposta,
    Pergunta,
    QuestaoFavorita,
    QuizDefinicao,
    SessoesQuizUsuario,
    DesafioDinamico,
    RecompensaNivelResgatada,
)
from quiz.services.gamification_service import GamificationService
from quiz.services.quiz_service import QuizDataService
from quiz.services.scoring_service import ScoringService, SessionScoreResult
from quiz.services.statistics_service import StatisticsService
from quiz.views import get_quiz_config, invalidate_quiz_config_cache


class QuizDataServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('tester', 'tester@example.com', 'secret')
        invalidate_quiz_config_cache()
        ConfiguracoesGeraisQuiz.objects.all().delete()
        self.quiz_config = get_quiz_config()

        self.category = Categoria.objects.create(nome_categoria='Cardiologia')
        self.question = Pergunta.objects.create(
            texto_pergunta='Qual é a estrutura responsável por bombear sangue?',
            nivel_dificuldade=Pergunta.NivelDificuldade.MEDIO,
        )
        self.question.categorias.add(self.category)
        self.option_correct = OpcaoResposta.objects.create(
            pergunta=self.question,
            texto_opcao='Coração',
            eh_correta=True,
            ordem_exibicao=1,
        )
        OpcaoResposta.objects.create(
            pergunta=self.question,
            texto_opcao='Pulmão',
            eh_correta=False,
            ordem_exibicao=2,
        )
        QuestaoFavorita.objects.create(usuario=self.user, pergunta=self.question)

    def test_get_quiz_data_dict_returns_expected_structure(self):
        service = QuizDataService(quiz_config=self.quiz_config, user=self.user)
        data = service.get_quiz_data_dict()

        self.assertEqual(len(data['perguntas']), 1)
        question_payload = data['perguntas'][0]
        self.assertEqual(question_payload['id_pergunta'], self.question.pk)
        self.assertTrue(question_payload['is_favorited'])
        self.assertEqual(question_payload['opcoes'][0]['texto_opcao'], 'Coração')
        self.assertEqual(data['categorias'][0]['nome_categoria'], 'Cardiologia')

    def test_descendant_category_lookup_filters_questions(self):
        sub_category = Categoria.objects.create(nome_categoria='Pediatria', id_categoria_pai=self.category)
        self.question.categorias.add(sub_category)

        service = QuizDataService(quiz_config=self.quiz_config, user=self.user)
        descendant_ids = service.get_descendant_category_ids([str(self.category.pk)])
        self.assertIn(sub_category.pk, descendant_ids)

        data = service.get_quiz_data_dict(category_ids_filter=[str(self.category.pk)])
        self.assertEqual(len(data['perguntas']), 1)

    def test_search_query_filters_questions(self):
        other_category = Categoria.objects.create(nome_categoria='Neurologia')
        other_question = Pergunta.objects.create(
            texto_pergunta='Qual estrutura transmite impulsos nervosos?',
            nivel_dificuldade=Pergunta.NivelDificuldade.MEDIO,
            referencia_bibliografica='Manual de Neurociência',
        )
        other_question.categorias.add(other_category)

        service = QuizDataService(quiz_config=self.quiz_config, user=self.user)

        data_by_text = service.get_quiz_data_dict(search_query='bombear')
        self.assertEqual(len(data_by_text['perguntas']), 1)
        self.assertEqual(data_by_text['perguntas'][0]['id_pergunta'], self.question.pk)

        data_by_category = service.get_quiz_data_dict(search_query='Cardio')
        self.assertEqual(len(data_by_category['perguntas']), 1)
        self.assertEqual(data_by_category['perguntas'][0]['id_pergunta'], self.question.pk)

        data_by_reference = service.get_quiz_data_dict(search_query='NEURO')
        self.assertEqual(len(data_by_reference['perguntas']), 1)
        self.assertEqual(data_by_reference['perguntas'][0]['id_pergunta'], other_question.pk)

    def test_build_quiz_summary_includes_predefined_list(self):
        quiz_def = QuizDefinicao.objects.create(
            nome_quiz='Rotina Cardiologia',
            descricao='Lista de revisão',
            ativo=True,
        )
        quiz_def.perguntas.add(self.question, through_defaults={'ordem': 1})

        summary = QuizDataService.build_quiz_summary()

        self.assertEqual(summary['total_questions'], 1)
        self.assertEqual(summary['total_categories'], 1)
        self.assertIn('predefined_quizzes', summary)
        self.assertTrue(any(item['id'] == quiz_def.pk for item in summary['predefined_quizzes']))


class StatisticsServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('statuser', 'stats@example.com', 'secret')
        self.session_recent = SessoesQuizUsuario.objects.create(
            id_usuario=self.user,
            modo_quiz=SessoesQuizUsuario.ModoQuiz.RAPIDO,
            status_sessao=SessoesQuizUsuario.StatusSessao.COMPLETA,
            total_perguntas_sessao=5,
            total_acertos=3,
            total_erros=2,
            pontuacao_final=45,
            xp_total_sessao=36,
        )
        self.session_old = SessoesQuizUsuario.objects.create(
            id_usuario=self.user,
            modo_quiz=SessoesQuizUsuario.ModoQuiz.RAPIDO,
            status_sessao=SessoesQuizUsuario.StatusSessao.COMPLETA,
            total_perguntas_sessao=4,
            total_acertos=2,
            total_erros=2,
            pontuacao_final=30,
            xp_total_sessao=24,
            data_inicio=timezone.now() - timedelta(days=120),
        )
        self.stat_recent = EstatisticasDiariasUsuario.objects.create(
            id_usuario=self.user,
            data_estatistica=timezone.now().date(),
            perguntas_respondidas_dia=8,
            acertos_dia=6,
            pontos_dia=90,
            sequencia_dias_quiz=4,
            tempo_estudo_segundos_dia=1200,
            xp_ganho_dia=72,
        )
        self.stat_old = EstatisticasDiariasUsuario.objects.create(
            id_usuario=self.user,
            data_estatistica=timezone.now().date() - timedelta(days=40),
            perguntas_respondidas_dia=5,
            acertos_dia=2,
            pontos_dia=30,
            sequencia_dias_quiz=1,
            tempo_estudo_segundos_dia=600,
            xp_ganho_dia=18,
        )

    def test_filter_queryset_by_period_limits_records(self):
        qs = EstatisticasDiariasUsuario.objects.filter(id_usuario=self.user)
        filtered = StatisticsService.filter_queryset_by_period(qs, '30d')
        self.assertIn(self.stat_recent, filtered)
        self.assertNotIn(self.stat_old, filtered)

    def test_get_key_metrics_aggregates_information(self):
        qs = EstatisticasDiariasUsuario.objects.filter(id_usuario=self.user)
        metrics = StatisticsService.get_key_metrics(self.user, qs)
        self.assertEqual(metrics['total_questions_answered'], 13)
        self.assertEqual(metrics['max_streak'], self.stat_recent.sequencia_dias_quiz)
        self.assertEqual(metrics['total_score_all_time'], 75)
        self.assertEqual(metrics['total_xp_all_time'], 60)
        self.assertEqual(metrics['total_xp_period'], 90)
        self.assertGreater(metrics['total_study_time_seconds'], 0)

    def test_initialize_daily_streak_uses_previous_day(self):
        future_stat = EstatisticasDiariasUsuario.objects.create(
            id_usuario=self.user,
            data_estatistica=timezone.now().date() + timedelta(days=1),
            perguntas_respondidas_dia=0,
            acertos_dia=0,
            pontos_dia=0,
            xp_ganho_dia=0,
            sequencia_dias_quiz=0,
        )

        updated = StatisticsService.initialize_daily_streak(future_stat)
        self.assertTrue(updated)
        self.assertEqual(future_stat.sequencia_dias_quiz, self.stat_recent.sequencia_dias_quiz)

    def test_update_daily_streak_after_activity_increments(self):
        future_stat = EstatisticasDiariasUsuario.objects.create(
            id_usuario=self.user,
            data_estatistica=timezone.now().date() + timedelta(days=1),
            perguntas_respondidas_dia=0,
            acertos_dia=0,
            pontos_dia=0,
            xp_ganho_dia=0,
            sequencia_dias_quiz=0,
        )

        StatisticsService.initialize_daily_streak(future_stat)
        future_stat.perguntas_respondidas_dia = 7
        changed = StatisticsService.update_daily_streak_after_activity(
            future_stat,
            had_activity_before=False,
        )
        self.assertTrue(changed)
        self.assertEqual(
            future_stat.sequencia_dias_quiz,
            (self.stat_recent.sequencia_dias_quiz or 0) + 1,
        )

        # Calling again without new activity should not change the streak
        changed_again = StatisticsService.update_daily_streak_after_activity(
            future_stat,
            had_activity_before=True,
        )
        self.assertFalse(changed_again)


class GamificationServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('gamer', 'gamer@example.com', 'secret')
        self.service = GamificationService()

        self.level = NivelGamificacao.objects.create(
            identificador='iniciante',
            nome='Iniciante',
            descricao='Nível inicial',
            ordem=1,
            xp_minimo=0,
            xp_maximo=150,
        )
        self.level.recompensas_json = {
            'items': [
                {
                    'id': 'ebook',
                    'nome': 'Guia de Estudos',
                    'descricao': 'Material complementar exclusivo.',
                }
            ]
        }
        self.level.save()

        Conquista.objects.create(
            slug='xp-50',
            nome='Acumule 50 XP',
            criterio_json={'tipo': 'xp_total', 'valor': 50},
        )
        Conquista.objects.create(
            slug='streak-dias-2',
            nome='Dois dias seguidos',
            criterio_json={'tipo': 'dias_consecutivos', 'valor': 2},
        )
        Conquista.objects.create(
            slug='perguntas-dia',
            nome='Responder 10 perguntas no dia',
            criterio_json={'tipo': 'perguntas_diarias', 'valor': 10},
        )
        Conquista.objects.create(
            slug='xp-diario',
            nome='Ganhe 60 XP no dia',
            criterio_json={'tipo': 'xp_diario', 'valor': 60},
        )
        Conquista.objects.create(
            slug='xp-200',
            nome='Rumo aos 200 XP',
            criterio_json={'tipo': 'xp_total', 'valor': 200},
        )

        self.daily_stat = EstatisticasDiariasUsuario.objects.create(
            id_usuario=self.user,
            data_estatistica=timezone.now().date(),
            perguntas_respondidas_dia=12,
            acertos_dia=10,
            pontos_dia=180,
            xp_ganho_dia=75,
            sequencia_dias_quiz=3,
        )

        self.dynamic_challenge = DesafioDinamico.objects.create(
            slug='desafio-responda-15',
            nome='Responder 15 perguntas',
            tipo=DesafioDinamico.TipoDesafio.SEMANAL,
            criterio_json={'tipo': 'perguntas_diarias', 'valor': 15},
            recompensa_json={'xp_bonus': 20},
            data_inicio=timezone.now() - timedelta(days=1),
            data_fim=timezone.now() + timedelta(days=5),
        )

        self.previous_session = SessoesQuizUsuario.objects.create(
            id_usuario=self.user,
            modo_quiz=SessoesQuizUsuario.ModoQuiz.RAPIDO,
            status_sessao=SessoesQuizUsuario.StatusSessao.COMPLETA,
            total_perguntas_sessao=10,
            total_acertos=8,
            total_erros=2,
            pontuacao_final=160,
            xp_total_sessao=55,
        )

        self.session = SessoesQuizUsuario.objects.create(
            id_usuario=self.user,
            modo_quiz=SessoesQuizUsuario.ModoQuiz.RAPIDO,
            status_sessao=SessoesQuizUsuario.StatusSessao.COMPLETA,
            total_perguntas_sessao=12,
            total_acertos=11,
            total_erros=1,
            pontuacao_final=220,
            xp_total_sessao=80,
        )

        self.score_result = SessionScoreResult(
            total_points=220,
            total_xp=80,
            total_correct=11,
            total_incorrect=1,
            total_answered=12,
            current_streak=5,
            best_streak=6,
            response_scores=[],
        )

    def test_apply_session_result_returns_daily_and_upcoming(self):
        result = self.service.apply_session_result(
            self.user,
            self.session,
            self.score_result,
            daily_stats=self.daily_stat,
        )

        snapshot = result.snapshot
        self.assertIn('daily_engagement', snapshot)
        self.assertEqual(snapshot['daily_engagement']['streak_days'], self.daily_stat.sequencia_dias_quiz)
        self.assertGreaterEqual(snapshot['achievements']['total_unlocked'], 4)
        self.assertIsInstance(snapshot['achievements']['catalog'], list)
        self.assertGreater(len(snapshot['achievements']['catalog']), 0)

        upcoming = snapshot['achievements']['upcoming']
        self.assertIsInstance(upcoming, list)
        self.assertTrue(any(item.get('progress') for item in upcoming))
        self.assertTrue(any(item['progress']['metric'] == 'xp_total' for item in upcoming if item.get('progress')))

    def test_dynamic_challenge_progress_and_completion(self):
        first_result = self.service.apply_session_result(
            self.user,
            self.session,
            self.score_result,
            daily_stats=self.daily_stat,
        )

        challenges_snapshot = first_result.snapshot['challenges']
        self.assertGreater(challenges_snapshot['total_active'], 0)
        active_challenge = challenges_snapshot['active'][0]
        self.assertEqual(active_challenge['progress']['current'], 12)
        self.assertFalse(active_challenge['is_completed'])

        extra_session = SessoesQuizUsuario.objects.create(
            id_usuario=self.user,
            modo_quiz=SessoesQuizUsuario.ModoQuiz.RAPIDO,
            status_sessao=SessoesQuizUsuario.StatusSessao.COMPLETA,
            total_perguntas_sessao=5,
            total_acertos=4,
            total_erros=1,
            pontuacao_final=95,
            xp_total_sessao=45,
        )
        extra_score = SessionScoreResult(
            total_points=95,
            total_xp=45,
            total_correct=4,
            total_incorrect=1,
            total_answered=5,
            current_streak=3,
            best_streak=4,
            response_scores=[],
        )

        second_result = self.service.apply_session_result(
            self.user,
            extra_session,
            extra_score,
            daily_stats=self.daily_stat,
        )

        self.assertGreaterEqual(second_result.desafios_concluidos, 1)
        challenges_after = second_result.snapshot['challenges']
        self.assertTrue(any(item['is_completed'] for item in challenges_after['active']))
        self.assertTrue(len(challenges_after['completed_now']) >= 1)

    def test_rewards_available_and_claim_flow(self):
        result = self.service.apply_session_result(
            self.user,
            self.session,
            self.score_result,
            daily_stats=self.daily_stat,
        )

        rewards_snapshot = result.snapshot['rewards']
        self.assertTrue(rewards_snapshot['available_to_claim'])
        reward_payload = rewards_snapshot['available_to_claim'][0]

        claim_payload = self.service.claim_level_reward(
            self.user,
            level_id=self.level.id,
            reward_id=reward_payload['reward_id'],
        )

        self.assertEqual(RecompensaNivelResgatada.objects.filter(perfil__user=self.user).count(), 1)
        self.assertEqual(claim_payload['reward']['reward_id'], reward_payload['reward_id'])

        refreshed_snapshot = self.service.get_profile_snapshot(self.user)
        self.assertFalse(refreshed_snapshot['rewards']['available_to_claim'])
        self.assertTrue(refreshed_snapshot['rewards']['claimed'])
        self.assertIsInstance(refreshed_snapshot['achievements']['catalog'], list)
        self.assertGreater(len(refreshed_snapshot['achievements']['catalog']), 0)


class ScoringServiceTests(TestCase):
    def setUp(self):
        invalidate_quiz_config_cache()
        ConfiguracoesGeraisQuiz.objects.all().delete()
        self.config = ConfiguracoesGeraisQuiz.objects.create()
        self.service = ScoringService(self.config)
        self.user = User.objects.create_user('scorer', 'scorer@example.com', 'secret')
        self.question = Pergunta.objects.create(
            texto_pergunta='Pergunta difícil?',
            nivel_dificuldade=Pergunta.NivelDificuldade.DIFICIL,
        )
        self.option = OpcaoResposta.objects.create(
            pergunta=self.question,
            texto_opcao='Resposta correta',
            eh_correta=True,
        )

    def test_scoring_service_awards_distinct_xp(self):
        response = SimpleNamespace(
            pk=1,
            data_resposta=timezone.now(),
            id_pergunta=SimpleNamespace(nivel_dificuldade=self.question.nivel_dificuldade),
            id_opcao_resposta_selecionada_id=self.option.pk,
            foi_correta=True,
        )
        session = SimpleNamespace(tempo_total_segundos=90)

        result = self.service.compute_session_result([response], session=session)

        self.assertNotEqual(result.total_points, result.total_xp)
        self.assertGreater(result.secondary_xp_bonus, 0)
