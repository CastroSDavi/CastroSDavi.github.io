from django.test import TestCase

from quiz.models import ConfiguracoesGeraisQuiz
from quiz.views import get_quiz_config, invalidate_quiz_config_cache


class QuizConfigCacheTests(TestCase):
    def setUp(self):
        # Garante que cada teste começa sem cache e com o banco limpo
        invalidate_quiz_config_cache()
        ConfiguracoesGeraisQuiz.objects.all().delete()

    def test_quiz_config_reloads_after_save(self):
        cached_config = get_quiz_config()
        self.assertEqual(cached_config.pontuacao_por_acerto, 15)

        # Simula edição externa (como no admin) usando uma nova instância do modelo
        updated_config = ConfiguracoesGeraisQuiz.objects.get(pk=cached_config.pk)
        updated_config.pontuacao_por_acerto = 42
        updated_config.penalidade_por_erro = 3
        updated_config.save()

        # Deve recarregar os valores atualizados após o save invalidar o cache
        reloaded_config = get_quiz_config()
        self.assertEqual(reloaded_config.pontuacao_por_acerto, 42)
        self.assertEqual(reloaded_config.penalidade_por_erro, 3)
