from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('quiz', '0009_gamification_and_scoring'),
    ]

    operations = [
        migrations.CreateModel(
            name='DesafioDinamico',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slug', models.SlugField(max_length=150, unique=True, verbose_name='Slug do Desafio')),
                ('nome', models.CharField(max_length=200, verbose_name='Nome do Desafio')),
                ('descricao', models.TextField(blank=True, verbose_name='Descrição')),
                ('tipo', models.CharField(choices=[('daily', 'Diário'), ('weekly', 'Semanal'), ('event', 'Evento')], default='event', max_length=20, verbose_name='Tipo')),
                ('criterio_json', models.JSONField(blank=True, default=dict, help_text="Estrutura {'tipo': 'xp_total', 'valor': 500} ou similar.", verbose_name='Critério')),
                ('recompensa_json', models.JSONField(blank=True, default=dict, help_text='Metadados da recompensa entregue ao concluir o desafio.', verbose_name='Recompensa')),
                ('data_inicio', models.DateTimeField(blank=True, null=True, verbose_name='Início')),
                ('data_fim', models.DateTimeField(blank=True, null=True, verbose_name='Fim')),
                ('ativo', models.BooleanField(default=True, verbose_name='Ativo')),
                ('criado_em', models.DateTimeField(auto_now_add=True, verbose_name='Criado em')),
                ('atualizado_em', models.DateTimeField(auto_now=True, verbose_name='Atualizado em')),
            ],
            options={
                'ordering': ['-ativo', 'data_inicio', 'nome'],
                'verbose_name': 'Desafio Dinâmico',
                'verbose_name_plural': 'Desafios Dinâmicos',
            },
        ),
        migrations.CreateModel(
            name='RecompensaNivelResgatada',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('recompensa_id', models.CharField(max_length=150, verbose_name='Identificador da Recompensa')),
                ('dados_recompensa', models.JSONField(blank=True, default=dict, verbose_name='Dados da Recompensa')),
                ('data_resgate', models.DateTimeField(auto_now_add=True, verbose_name='Data de Resgate')),
                ('nivel', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='recompensas_resgatadas', to='quiz.nivelgamificacao', verbose_name='Nível')),
                ('perfil', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='recompensas_resgatadas', to='quiz.perfilgamificacaousuario', verbose_name='Perfil')),
            ],
            options={
                'verbose_name': 'Recompensa de Nível Resgatada',
                'verbose_name_plural': 'Recompensas de Nível Resgatadas',
                'indexes': [
                    models.Index(fields=['perfil', 'nivel'], name='idx_resgate_perfil_nivel'),
                ],
                'constraints': [
                    models.UniqueConstraint(fields=('perfil', 'nivel', 'recompensa_id'), name='quiz_recompensa_nivel_resgatada_unq'),
                ],
            },
        ),
        migrations.CreateModel(
            name='ProgressoDesafioUsuario',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('valor_atual', models.FloatField(default=0.0, verbose_name='Valor Atual')),
                ('concluido', models.BooleanField(default=False, verbose_name='Concluído')),
                ('data_conclusao', models.DateTimeField(blank=True, null=True, verbose_name='Concluído em')),
                ('janela_inicio', models.DateTimeField(blank=True, null=True, verbose_name='Início do Ciclo')),
                ('janela_fim', models.DateTimeField(blank=True, null=True, verbose_name='Fim do Ciclo')),
                ('metadata', models.JSONField(blank=True, default=dict, verbose_name='Metadados')),
                ('criado_em', models.DateTimeField(auto_now_add=True, verbose_name='Criado em')),
                ('atualizado_em', models.DateTimeField(auto_now=True, verbose_name='Atualizado em')),
                ('desafio', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='progresso_usuarios', to='quiz.desafiodinamico', verbose_name='Desafio')),
                ('perfil', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='progresso_desafios', to='quiz.perfilgamificacaousuario', verbose_name='Perfil')),
            ],
            options={
                'verbose_name': 'Progresso de Desafio do Usuário',
                'verbose_name_plural': 'Progressos de Desafios dos Usuários',
                'indexes': [
                    models.Index(fields=['perfil', 'desafio'], name='idx_desafio_perfil'),
                ],
                'constraints': [
                    models.UniqueConstraint(fields=('desafio', 'perfil'), name='quiz_progresso_desafio_usuario_desafio_perfil_uniq'),
                ],
            },
        ),
    ]
