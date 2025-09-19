from django.test import TestCase

from quiz.models import (
    Categoria,
    CategoriaHierarquia,
    ConfiguracoesGeraisQuiz,
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
