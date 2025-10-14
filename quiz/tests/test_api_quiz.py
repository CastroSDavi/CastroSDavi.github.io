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
    QuizDefinicao,
    QuestionIssueReport,
    SupportRequest,
    RespostasUsuarioPorSessao,
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

        self.quiz_definition = QuizDefinicao.objects.create(
            nome_quiz='Coleção Inicial',
            ativo=True,
        )
        self.quiz_definition.perguntas.add(self.question, through_defaults={'ordem': 1})

    def _auth_client(self):
        self.client.login(username='apiuser', password='testpass')

    def _create_session_with_responses(self, total_responses=3, days_offset=0):
        base_datetime = timezone.now() - timedelta(days=days_offset)
        session = SessoesQuizUsuario.objects.create(
            id_usuario=self.user,
            modo_quiz=SessoesQuizUsuario.ModoQuiz.RAPIDO,
            status_sessao=SessoesQuizUsuario.StatusSessao.COMPLETA,
            total_perguntas_sessao=total_responses,
            total_acertos=0,
            total_erros=0,
            pontuacao_final=total_responses * 10,
            data_inicio=base_datetime - timedelta(minutes=total_responses),
            data_fim=base_datetime,
            tempo_total_segundos=total_responses * 60,
        )

        correct_answers = 0
        for index in range(total_responses):
            question = Pergunta.objects.create(
                texto_pergunta=f'Pergunta {session.pk}-{index}',
                nivel_dificuldade=Pergunta.NivelDificuldade.MEDIO,
            )
            question.categorias.add(self.category)

            correct_option = OpcaoResposta.objects.create(
                pergunta=question,
                texto_opcao=f'Correta {index}',
                eh_correta=True,
                ordem_exibicao=1,
            )
            wrong_option = OpcaoResposta.objects.create(
                pergunta=question,
                texto_opcao=f'Errada {index}',
                eh_correta=False,
                ordem_exibicao=2,
            )

            selected_option = correct_option if index % 2 == 0 else wrong_option
            RespostasUsuarioPorSessao.objects.create(
                id_sessao_quiz=session,
                id_pergunta=question,
                id_opcao_resposta_selecionada=selected_option,
                foi_correta=selected_option.eh_correta,
                data_resposta=session.data_inicio + timedelta(minutes=index + 1),
            )

            if selected_option.eh_correta:
                correct_answers += 1

        session.total_acertos = correct_answers
        session.total_erros = total_responses - correct_answers
        session.save(update_fields=['total_acertos', 'total_erros'])

        return session

    def test_quiz_summary_endpoint_returns_counts(self):
        url = reverse('quiz:quiz-summary')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['total_questions'], 1)
        self.assertEqual(payload['total_categories'], 1)
        self.assertIn('predefined_quizzes', payload)
        self.assertIsInstance(payload['predefined_quizzes'], list)
        if payload['predefined_quizzes']:
            self.assertEqual(payload['predefined_quizzes'][0]['slug'], self.quiz_definition.slug)

    def test_quiz_data_endpoint_returns_question_payload(self):
        url = reverse('quiz:quiz-alldata')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['perguntas']), 1)
        self.assertEqual(payload['perguntas'][0]['id_pergunta'], self.question.pk)
        self.assertEqual(payload['perguntas'][0]['opcoes'][0]['texto_opcao'], 'Três')
        self.assertEqual(payload['perguntas'][0]['slug'], self.question.slug)

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
        start_response = response.json()
        session_id = start_response['session_id']
        self.assertIn('score_panel_settings', start_response)
        self.assertTrue(start_response['score_panel_settings']['show_points'])

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
        self.assertIn('score_panel_settings', resume_payload)

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
        self.assertIn('categorias', favorite_question)
        self.assertIsInstance(favorite_question['categorias'], list)
        self.assertTrue(
            any(cat.get('nome_categoria') == self.category.nome_categoria for cat in favorite_question['categorias'])
        )

    def test_report_question_issue_requires_description(self):
        url = reverse('quiz:question-report-issue', kwargs={'pergunta_id': self.question.pk})
        payload = {'descricao': 'curta'}
        response = self.client.post(url, data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(QuestionIssueReport.objects.count(), 0)

    def test_report_question_issue_creates_record(self):
        url = reverse('quiz:question-report-issue', kwargs={'pergunta_id': self.question.pk})
        payload = {
            'descricao': 'Texto detalhando o problema encontrado na questao.',
            'categoria': QuestionIssueReport.Categoria.GABARITO,
        }
        response = self.client.post(url, data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(QuestionIssueReport.objects.count(), 1)
        self.assertEqual(SupportRequest.objects.count(), 1)
        report = QuestionIssueReport.objects.first()
        self.assertEqual(report.pergunta_id, self.question.pk)
        self.assertIsNone(report.usuario)
        self.assertEqual(report.descricao, payload['descricao'])
        self.assertEqual(report.categoria, QuestionIssueReport.Categoria.GABARITO)
        support_ticket = SupportRequest.objects.first()
        self.assertIsNone(support_ticket.usuario)
        self.assertEqual(support_ticket.mensagem, payload['descricao'])
        self.assertEqual(support_ticket.tipo_contato, SupportRequest.TipoContato.CONTEUDO)
        self.assertEqual(support_ticket.origem, SupportRequest.ORIGEM_MENSAGEM)
        self.assertEqual(
            support_ticket.contexto.get('question_issue_report_id'),
            report.pk,
        )
        self.assertEqual(
            support_ticket.contexto.get('question_id'),
            self.question.pk,
        )
        self.assertEqual(
            support_ticket.contexto.get('report_origin'),
            QuestionIssueReport.ORIGEM_SESSAO,
        )
        self.assertEqual(
            support_ticket.contexto.get('issue_category'),
            QuestionIssueReport.Categoria.GABARITO,
        )
        self.assertEqual(
            support_ticket.contexto.get('issue_category_display'),
            dict(QuestionIssueReport.Categoria.choices)[QuestionIssueReport.Categoria.GABARITO],
        )

    def test_report_question_issue_invalid_category_defaults(self):
        url = reverse('quiz:question-report-issue', kwargs={'pergunta_id': self.question.pk})
        payload = {
            'descricao': 'Outra descricao para validar categoria padrao.',
            'categoria': 'categoria-inexistente',
        }
        response = self.client.post(url, data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 201)
        report = QuestionIssueReport.objects.first()
        self.assertEqual(report.categoria, QuestionIssueReport.Categoria.GABARITO)
        support_ticket = SupportRequest.objects.first()
        self.assertEqual(
            support_ticket.contexto.get('issue_category'),
            QuestionIssueReport.Categoria.GABARITO,
        )

    def test_support_request_requires_message(self):
        url = reverse('quiz:support-request')
        payload = {'mensagem': 'Curta'}
        response = self.client.post(url, data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(SupportRequest.objects.count(), 0)

    def test_support_request_creates_record(self):
        url = reverse('quiz:support-request')
        payload = {
            'mensagem': 'Estou enfrentando lentidão ao carregar o painel de desafios.',
            'email': 'visitante@example.com',
            'contexto': {'page_id': 'questions', 'message_key': 'quiz.startSessionFailed'},
        }
        response = self.client.post(url, data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(SupportRequest.objects.count(), 1)
        ticket = SupportRequest.objects.first()
        self.assertIsNone(ticket.usuario)
        self.assertEqual(ticket.mensagem, payload['mensagem'])
        self.assertEqual(ticket.email, payload['email'])
        self.assertEqual(ticket.contexto.get('page_id'), 'questions')
        self.assertEqual(ticket.origem, SupportRequest.ORIGEM_GERAL)
        self.assertEqual(ticket.tipo_contato, SupportRequest.TipoContato.SUPORTE_GERAL)
        self.assertEqual(ticket.status, SupportRequest.Status.ABERTO)

    def test_support_request_accepts_tipo(self):
        url = reverse('quiz:support-request')
        payload = {
            'mensagem': 'A plataforma travou durante a correção.',
            'tipo': SupportRequest.TipoContato.PROBLEMA_TECNICO,
        }
        response = self.client.post(url, data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(SupportRequest.objects.count(), 1)
        ticket = SupportRequest.objects.first()
        self.assertEqual(ticket.tipo_contato, SupportRequest.TipoContato.PROBLEMA_TECNICO)
        self.assertEqual(ticket.status, SupportRequest.Status.ABERTO)

    def test_support_request_invalid_tipo_defaults_to_general(self):
        url = reverse('quiz:support-request')
        payload = {
            'mensagem': 'Texto longo o bastante para registro.',
            'tipo': 'tipo_inexistente',
        }
        response = self.client.post(url, data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 201)
        ticket = SupportRequest.objects.first()
        self.assertEqual(ticket.tipo_contato, SupportRequest.TipoContato.SUPORTE_GERAL)

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

    def test_question_history_requires_authentication(self):
        url = reverse('quiz:user-question-history-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 401)

    def test_question_history_paginates_results(self):
        self._auth_client()
        self._create_session_with_responses(total_responses=12)

        url = reverse('quiz:user-question-history-list')
        response = self.client.get(url, {'page_size': 5})
        self.assertEqual(response.status_code, 200)

        payload = response.json()
        self.assertEqual(payload['status'], 'success')
        self.assertEqual(payload['count'], 12)
        self.assertEqual(len(payload['results']), 5)
        self.assertIsNotNone(payload['next'])

        first_result = payload['results'][0]
        self.assertIn('question', first_result)
        self.assertIn('session', first_result)
        self.assertIn('selected_option_id', first_result)

    def test_question_history_filters_by_session_and_date(self):
        self._auth_client()
        recent_session = self._create_session_with_responses(total_responses=3, days_offset=0)
        old_session = self._create_session_with_responses(total_responses=2, days_offset=10)

        url = reverse('quiz:user-question-history-list')

        response = self.client.get(url, {'session_id': recent_session.pk})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['count'], 3)
        self.assertTrue(all(item['session']['id_sessao'] == recent_session.pk for item in payload['results']))

        start_date = (timezone.now().date() - timedelta(days=1)).isoformat()
        response = self.client.get(url, {'start_date': start_date})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['count'], 3)
        self.assertTrue(all(item['session']['id_sessao'] == recent_session.pk for item in payload['results']))

        end_date = (timezone.now().date() - timedelta(days=5)).isoformat()
        response = self.client.get(url, {'end_date': end_date})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['count'], 2)
        self.assertTrue(all(item['session']['id_sessao'] == old_session.pk for item in payload['results']))
