from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('quiz', '0014_systemmessagebroadcast'),
    ]

    operations = [
        migrations.AddField(
            model_name='quizdefinicao',
            name='score_panel_overrides',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='Permite personalizar a visibilidade dos itens do painel lateral para cada modo de quiz suportado.',
                verbose_name='Ajustes do Painel de Pontuação',
            ),
        ),
    ]
