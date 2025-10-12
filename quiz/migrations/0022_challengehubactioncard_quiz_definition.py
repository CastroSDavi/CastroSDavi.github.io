from django.db import migrations, models


def link_predefined_cards(apps, schema_editor):
    ChallengeHubActionCard = apps.get_model('quiz', 'ChallengeHubActionCard')
    QuizDefinicao = apps.get_model('quiz', 'QuizDefinicao')

    generation_map = {
        'favorite_review': 'favorites',
        'repeat_last': 'repeat_last',
    }

    for key, generation_type in generation_map.items():
        definition = (
            QuizDefinicao.objects.filter(
                generation_type=generation_type,
                ativo=True,
            )
            .order_by('pk')
            .first()
        )
        if not definition:
            continue

        cards = ChallengeHubActionCard.objects.filter(
            quiz_definition__isnull=True,
            key=key,
        )
        for card in cards:
            card.quiz_definition = definition
            card.save(update_fields=['quiz_definition'])


class Migration(migrations.Migration):

    dependencies = [
        ('quiz', '0021_quizdefinicao_dynamic_generation'),
    ]

    operations = [
        migrations.AddField(
            model_name='challengehubactioncard',
            name='quiz_definition',
            field=models.ForeignKey(
                blank=True,
                help_text=(
                    'Quando preenchido, este card inicia diretamente a definição selecionada, '
                    'permitindo acionar experiências personalizadas sem alterar o código.'
                ),
                null=True,
                on_delete=models.SET_NULL,
                related_name='linked_action_cards',
                to='quiz.quizdefinicao',
                verbose_name='Quiz definido vinculado',
            ),
        ),
        migrations.RunPython(link_predefined_cards, migrations.RunPython.noop),
    ]
