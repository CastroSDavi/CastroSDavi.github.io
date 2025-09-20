import json
from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
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
from quiz.views import get_quiz_config, invalidate_quiz_config_cache


class QuizApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('apiuser', 'api@example.com', 'testpass')
        invalidate_quiz_config_cache()
        ConfiguracoesGeraisQuiz.objects.all().delete()
        get_quiz_config()

        self.category = Categoria.objects.create(nome_categoria='Anatomia')
        self.question = Pergunta.objects.create(
            texto_pergunta='Quantos lobos tem o pulmão direito?',
            nivel_dificuldade=Pergunta.NivelDificuldade.MEDIO,
        )
        self.question.categorias.add(self.category)
        self.correct_option = OpcaoResposta.objects.create(
            pergunta=self.question,
            texto_opcao='Três',
            eh_correta=True,
            ordem_exibicao=1,
        )
        self.wrong_option = OpcaoResposta.objects.create(
            pergunta=self.question,
            texto_opcao='Dois',
            eh_correta=False,
            ordem_exibicao=2,
        )

    def _auth_client(self):
        self.client.login(username='apiuser', password='testpass')

    def test_quiz_summary_endpoint_returns_counts(self):
        url = reverse('quiz:quiz-summary')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['total_questions'], 1)
        self.assertEqual(payload['total_categories'], 1)

    def test_quiz_data_endpoint_returns_question_payload(self):
        url = reverse('quiz:quiz-alldata')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['perguntas']), 1)
        self.assertEqual(payload['perguntas'][0]['id_pergunta'], self.question.pk)
        self.assertEqual(payload['perguntas'][0]['opcoes'][0]['texto_opcao'], 'Três')

    def test_start_register_and_end_session_flow(self):
        self._auth_client()
        start_url = reverse('quiz:quiz-start-session')
        start_payload = {
            'modo_quiz': SessoesQuizUsuario.ModoQuiz.RAPIDO,
            'question_ids_in_session': [self.question.pk],
            'categoria_ids': [self.category.pk],
        }
        response = self.client.post(start_url, data=json.dumps(start_payload), content_type='application/json')
        self.assertEqual(response.status_code, 200)
        session_id = response.json()['session_id']

        register_url = reverse('quiz:quiz-register-answer')
        register_payload = {
            'session_id': session_id,
            'pergunta_id': self.question.pk,
            'opcao_id': self.correct_option.pk,
            'current_question_index': 0,
        }
        response = self.client.post(register_url, data=json.dumps(register_payload), content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['foi_correta'])

        resume_url = reverse('quiz:quiz-resume-session')
        response = self.client.get(resume_url)
        self.assertEqual(response.status_code, 200)
        resume_payload = response.json()
        self.assertEqual(resume_payload['session_id'], session_id)
        self.assertEqual(len(resume_payload['perguntas']), 1)

        end_url = reverse('quiz:quiz-end-session')
        end_payload = {'session_id': session_id, 'tempo_total_segundos': 90}
        response = self.client.post(end_url, data=json.dumps(end_payload), content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'success')

    def test_toggle_favorite_and_list(self):
        self._auth_client()
        toggle_url = reverse('quiz:question-toggle_favorite', kwargs={'pergunta_id': self.question.pk})
        response = self.client.post(toggle_url)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['is_favorited'])

        favorites_url = reverse('quiz:favorites-list')
        response = self.client.get(favorites_url)
        self.assertEqual(response.status_code, 200)
        favorites_payload = response.json()
        self.assertEqual(len(favorites_payload['favorite_questions']), 1)
        favorite_question = favorites_payload['favorite_questions'][0]
        self.assertIn('esta_ativa', favorite_question)
        self.assertTrue(favorite_question['esta_ativa'])

    def test_question_detail_requires_authentication(self):
        url = reverse('quiz:question-detail', kwargs={'pergunta_id': self.question.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 401)

    def test_question_detail_returns_payload(self):
        self._auth_client()
        QuestaoFavorita.objects.create(usuario=self.user, pergunta=self.question)

        url = reverse('quiz:question-detail', kwargs={'pergunta_id': self.question.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

        payload = response.json()
        self.assertEqual(payload['status'], 'success')
        self.assertEqual(payload['question']['id_pergunta'], self.question.pk)
        self.assertTrue(payload['question']['is_favorited'])

    def test_question_detail_returns_warning_for_inactive_favorite(self):
        self._auth_client()
        self.question.ativa = False
        self.question.save(update_fields=['ativa'])

        QuestaoFavorita.objects.create(usuario=self.user, pergunta=self.question)

        url = reverse('quiz:question-detail', kwargs={'pergunta_id': self.question.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['status'], 'success')
        self.assertEqual(payload['question']['id_pergunta'], self.question.pk)
        self.assertFalse(payload['question']['esta_ativa'])
        self.assertEqual(
            payload['message'],
            'Esta questão não está mais disponível no banco atual. Exibindo a versão salva na sua lista de favoritos.'
        )
        self.assertEqual(payload['message_type'], 'warning')

    def test_user_statistics_endpoint(self):
        self._auth_client()
        EstatisticasDiariasUsuario.objects.create(
            id_usuario=self.user,
            data_estatistica=timezone.now().date(),
            perguntas_respondidas_dia=10,
            acertos_dia=7,
            pontos_dia=100,
            tempo_estudo_segundos_dia=1500,
            sequencia_dias_quiz=3,
        )
        SessoesQuizUsuario.objects.create(
            id_usuario=self.user,
            modo_quiz=SessoesQuizUsuario.ModoQuiz.RAPIDO,
            status_sessao=SessoesQuizUsuario.StatusSessao.COMPLETA,
            total_perguntas_sessao=10,
            total_acertos=7,
            total_erros=3,
            pontuacao_final=100,
            data_inicio=timezone.now() - timedelta(days=1),
        )

        stats_url = reverse('quiz:user-statistics-list')
        response = self.client.get(stats_url)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['status'], 'success')
        self.assertEqual(payload['key_metrics']['total_questions_answered'], 10)
