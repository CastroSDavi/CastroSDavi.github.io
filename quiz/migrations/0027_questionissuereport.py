from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('quiz', '0026_enforce_slug_constraints'),
    ]

    operations = [
        migrations.CreateModel(
            name='QuestionIssueReport',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('descricao', models.TextField(verbose_name='Descrição do problema')),
                ('origem', models.CharField(choices=[('quiz_session', 'Sessão de Quiz'), ('review', 'Revisão de Questões'), ('other', 'Outra')], default='quiz_session', max_length=24, verbose_name='Origem do relato')),
                ('criado_em', models.DateTimeField(auto_now_add=True, verbose_name='Data de criação')),
                ('pergunta', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='issue_reports', to='quiz.pergunta', verbose_name='Pergunta relatada')),
                ('usuario', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='question_issue_reports', to=settings.AUTH_USER_MODEL, verbose_name='Usuário (opcional)')),
            ],
            options={
                'verbose_name': 'Relato de Problema da Questão',
                'verbose_name_plural': 'Relatos de Problemas das Questões',
                'ordering': ['-criado_em'],
            },
        ),
    ]

