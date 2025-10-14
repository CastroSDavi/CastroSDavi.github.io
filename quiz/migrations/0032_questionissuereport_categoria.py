from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('quiz', '0031_seed_training_modes'),
    ]

    operations = [
        migrations.AddField(
            model_name='questionissuereport',
            name='categoria',
            field=models.CharField(
                choices=[
                    ('answer_key', 'Gabarito incorreto'),
                    ('statement', 'Enunciado confuso ou incompleto'),
                    ('option_issue', 'Alternativa ambígua ou incorreta'),
                    ('reference_issue', 'Explicação ou referência desatualizada'),
                    ('other', 'Outro problema no conteúdo'),
                ],
                default='answer_key',
                help_text='Classificação rápida do tipo de problema apontado.',
                max_length=32,
                verbose_name='Categoria do relato',
            ),
        ),
    ]
