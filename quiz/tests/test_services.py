from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from quiz.models import (
    Categoria,
    ConfiguracoesGeraisQuiz,
    EstatisticasDiariasUsuario,
    OpcaoResposta,
    Pergunta,
    QuestaoFavorita,
    SessoesQuizUsuario,
)
from quiz.services.quiz_service import QuizDataService
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
        )
        self.session_old = SessoesQuizUsuario.objects.create(
            id_usuario=self.user,
            modo_quiz=SessoesQuizUsuario.ModoQuiz.RAPIDO,
            status_sessao=SessoesQuizUsuario.StatusSessao.COMPLETA,
            total_perguntas_sessao=4,
            total_acertos=2,
            total_erros=2,
            pontuacao_final=30,
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
        )
        self.stat_old = EstatisticasDiariasUsuario.objects.create(
            id_usuario=self.user,
            data_estatistica=timezone.now().date() - timedelta(days=40),
            perguntas_respondidas_dia=5,
            acertos_dia=2,
            pontos_dia=30,
            sequencia_dias_quiz=1,
            tempo_estudo_segundos_dia=600,
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
        self.assertGreater(metrics['total_study_time_seconds'], 0)
