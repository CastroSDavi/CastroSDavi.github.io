from django.test import TestCase, override_settings

from quiz.models import (
    Categoria,
    CategoriaHierarquia,
    ConfiguracoesGeraisQuiz,
    DEFAULT_SCORE_PANEL_SETTINGS,
    QuizDefinicao,
    SessoesQuizUsuario,
)
from quiz.views import (
    get_descendant_category_ids,
    get_quiz_config,
    invalidate_quiz_config_cache,
)


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

    def test_score_panel_settings_resolve_per_mode(self):
        config = get_quiz_config()
        overrides = config.score_panel_config
        overrides[SessoesQuizUsuario.ModoQuiz.RAPIDO]['show_timer'] = False
        overrides[SessoesQuizUsuario.ModoQuiz.POR_CATEGORIA]['allow_pause'] = False
        config.score_panel_config = overrides
        config.save(update_fields=['score_panel_config'])

        default_settings = config.get_score_panel_settings_for_mode()
        self.assertTrue(default_settings['show_timer'])
        self.assertTrue(default_settings['allow_pause'])

        fast_settings = config.get_score_panel_settings_for_mode(SessoesQuizUsuario.ModoQuiz.RAPIDO)
        self.assertFalse(fast_settings['show_timer'])

        category_settings = config.get_score_panel_settings_for_mode(SessoesQuizUsuario.ModoQuiz.POR_CATEGORIA)
        self.assertFalse(category_settings['allow_pause'])

    def test_score_panel_overrides_from_quiz_definition(self):
        config = get_quiz_config()
        quiz_def = QuizDefinicao.objects.create(nome_quiz='Simulado Especial', ativo=True)

        overrides = quiz_def.get_score_panel_overrides()
        overrides['default']['show_timer'] = False
        overrides[SessoesQuizUsuario.ModoQuiz.DEFINIDO]['show_points'] = False
        quiz_def.score_panel_overrides = overrides
        quiz_def.save(update_fields=['score_panel_overrides'])

        inherited = config.get_score_panel_settings_for_mode(quiz_definicao=quiz_def)
        self.assertFalse(inherited['show_timer'])

        definido_settings = config.get_score_panel_settings_for_mode(
            SessoesQuizUsuario.ModoQuiz.DEFINIDO,
            quiz_definicao=quiz_def,
        )
        self.assertFalse(definido_settings['show_points'])

    @override_settings(QUIZ_SCORE_PANEL_EXTRA_MODES=[('Revisão', 'Revisão de Favoritos')])
    def test_extra_modes_inherit_default_score_panel_flags(self):
        config = get_quiz_config()
        # O modo adicional deve estar presente no JSON sanitizado e carregar todas as flags.
        self.assertIn('Revisão', config.score_panel_config)

        revision_settings = config.get_score_panel_settings_for_mode('Revisão')
        for flag in DEFAULT_SCORE_PANEL_SETTINGS.keys():
            self.assertIn(flag, revision_settings)


class CategoriaHierarchyTests(TestCase):
    def test_closure_created_on_category_creation(self):
        root = Categoria.objects.create(nome_categoria="Raiz")
        child = Categoria.objects.create(
            nome_categoria="Filha",
            id_categoria_pai=root,
        )
        grandchild = Categoria.objects.create(
            nome_categoria="Neta",
            id_categoria_pai=child,
        )

        self.assertTrue(
            CategoriaHierarquia.objects.filter(
                ancestor=root, descendant=root, depth=0
            ).exists()
        )
        self.assertTrue(
            CategoriaHierarquia.objects.filter(
                ancestor=root, descendant=child, depth=1
            ).exists()
        )
        self.assertTrue(
            CategoriaHierarquia.objects.filter(
                ancestor=root, descendant=grandchild, depth=2
            ).exists()
        )

        descendants = get_descendant_category_ids([str(root.pk)])
        self.assertSetEqual(descendants, {root.pk, child.pk, grandchild.pk})

    def test_closure_updates_on_category_move(self):
        root_a = Categoria.objects.create(nome_categoria="Raiz A")
        root_b = Categoria.objects.create(nome_categoria="Raiz B")
        child = Categoria.objects.create(
            nome_categoria="Filha",
            id_categoria_pai=root_a,
        )
        grandchild = Categoria.objects.create(
            nome_categoria="Neta",
            id_categoria_pai=child,
        )

        child.id_categoria_pai = root_b
        child.save()

        self.assertFalse(
            CategoriaHierarquia.objects.filter(
                ancestor=root_a, descendant=child
            ).exists()
        )
        self.assertFalse(
            CategoriaHierarquia.objects.filter(
                ancestor=root_a, descendant=grandchild
            ).exists()
        )
        self.assertTrue(
            CategoriaHierarquia.objects.filter(
                ancestor=root_b, descendant=child, depth=1
            ).exists()
        )
        self.assertTrue(
            CategoriaHierarquia.objects.filter(
                ancestor=root_b, descendant=grandchild, depth=2
            ).exists()
        )

        descendants_root_b = get_descendant_category_ids([str(root_b.pk)])
        self.assertSetEqual(descendants_root_b, {root_b.pk, child.pk, grandchild.pk})

    def test_closure_updates_on_category_delete(self):
        root = Categoria.objects.create(nome_categoria="Raiz")
        child = Categoria.objects.create(
            nome_categoria="Filha",
            id_categoria_pai=root,
        )
        grandchild = Categoria.objects.create(
            nome_categoria="Neta",
            id_categoria_pai=child,
        )

        root.delete()

        self.assertFalse(
            CategoriaHierarquia.objects.filter(
                ancestor_id=root.pk
            ).exists()
        )
        child.refresh_from_db()
        grandchild.refresh_from_db()
        self.assertIsNone(child.id_categoria_pai)
        self.assertEqual(grandchild.id_categoria_pai_id, child.pk)

        child_descendants = get_descendant_category_ids([str(child.pk)])
        self.assertSetEqual(child_descendants, {child.pk, grandchild.pk})
