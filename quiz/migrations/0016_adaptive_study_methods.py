from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('quiz', '0015_quizdefinicao_score_panel_overrides'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='sessoesquizusuario',
            name='metodo_estudo',
            field=models.CharField(
                blank=True,
                null=True,
                default='random',
                max_length=100,
                verbose_name='Método de Estudo',
                help_text='Identificador do algoritmo utilizado para selecionar as perguntas da sessão.',
            ),
            preserve_default=False,
        ),
        migrations.CreateModel(
            name='UserQuestionStudyState',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('last_reviewed_at', models.DateTimeField(blank=True, null=True, verbose_name='Última Revisão')),
                ('due_at', models.DateTimeField(blank=True, null=True, verbose_name='Próxima Revisão')),
                ('repetitions', models.PositiveIntegerField(default=0, verbose_name='Repetições')),
                ('interval_days', models.PositiveIntegerField(default=1, verbose_name='Intervalo (dias)')),
                (
                    'easiness_factor',
                    models.FloatField(
                        default=2.5,
                        help_text='Parâmetro do algoritmo SM-2 usado para revisão espaçada.',
                        verbose_name='Fator de Facilidade',
                    ),
                ),
                ('correct_streak', models.PositiveIntegerField(default=0, verbose_name='Sequência de Acertos')),
                ('incorrect_streak', models.PositiveIntegerField(default=0, verbose_name='Sequência de Erros')),
                ('total_correct', models.PositiveIntegerField(default=0, verbose_name='Total de Acertos')),
                ('total_incorrect', models.PositiveIntegerField(default=0, verbose_name='Total de Erros')),
                (
                    'last_outcome',
                    models.BooleanField(
                        blank=True,
                        null=True,
                        help_text='True para acerto, False para erro, None para não respondida.',
                        verbose_name='Último Resultado',
                    ),
                ),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Criado em')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Atualizado em')),
                (
                    'last_session',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.SET_NULL,
                        related_name='study_state_entries',
                        to='quiz.sessoesquizusuario',
                        verbose_name='Última Sessão',
                    ),
                ),
                (
                    'pergunta',
                    models.ForeignKey(
                        on_delete=models.CASCADE,
                        related_name='study_states',
                        to='quiz.pergunta',
                        verbose_name='Pergunta',
                    ),
                ),
                (
                    'user',
                    models.ForeignKey(
                        on_delete=models.CASCADE,
                        related_name='question_study_states',
                        to=settings.AUTH_USER_MODEL,
                        verbose_name='Usuário',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Estado de Estudo da Pergunta',
                'verbose_name_plural': 'Estados de Estudo das Perguntas',
                'ordering': ['user', 'pergunta'],
                'unique_together': {('user', 'pergunta')},
            },
        ),
    ]
