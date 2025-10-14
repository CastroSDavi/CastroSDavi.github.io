from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('quiz', '0025_populate_slugs'),
    ]

    operations = [
        migrations.AlterField(
            model_name='pergunta',
            name='slug',
            field=models.SlugField(
                blank=True,
                null=False,
                unique=True,
                max_length=220,
                help_text='Identificador amigável usado nas URLs públicas da pergunta.',
                verbose_name='Slug legível',
            ),
        ),
        migrations.AlterField(
            model_name='quizdefinicao',
            name='slug',
            field=models.SlugField(
                blank=True,
                null=False,
                unique=True,
                max_length=180,
                help_text='Identificador amigável usado nas URLs públicas do desafio/quiz.',
                verbose_name='Slug legível',
            ),
        ),
    ]
