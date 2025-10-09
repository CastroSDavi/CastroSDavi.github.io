from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("quiz", "0020_populate_home_challenge_defaults"),
    ]

    operations = [
        migrations.AddField(
            model_name="quizdefinicao",
            name="generation_type",
            field=models.CharField(
                choices=[
                    ("manual", "Lista fixa de perguntas"),
                    ("favorites", "Revisão de favoritos do usuário"),
                    ("repeat_last", "Repetir último modo executado"),
                    ("filters", "Gerado a partir de filtros dinâmicos"),
                ],
                default="manual",
                help_text="Define como as perguntas serão selecionadas ao iniciar este quiz.",
                max_length=40,
                verbose_name="Estratégia de geração",
            ),
        ),
        migrations.AddField(
            model_name="quizdefinicao",
            name="generation_config",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Parâmetros extras utilizados pelas estratégias dinâmicas (limites, filtros, ordenação, etc).",
                verbose_name="Configurações dinâmicas",
            ),
        ),
        migrations.AddField(
            model_name="quizdefinicao",
            name="study_method_override",
            field=models.CharField(
                blank=True,
                help_text="Se definido, aplica automaticamente este método de estudo ao iniciar o quiz.",
                max_length=100,
                null=True,
                verbose_name="Método de estudo preferencial",
            ),
        ),
    ]
