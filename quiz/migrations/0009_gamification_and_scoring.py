from django.db import migrations, models
import django.core.validators
import quiz.models


class Migration(migrations.Migration):

    dependencies = [
        ('quiz', '0008_userpreferences'),
    ]

    operations = [
        migrations.AddField(
            model_name='configuracoesgeraisquiz',
            name='bonus_sequencia_acertos',
            field=models.JSONField(
                default=quiz.models.default_streak_bonus_rules,
                help_text="Lista ordenada de objetos contendo 'streak' e 'bonus_percent', representando o aumento percentual aplicado ao acerto conforme a sequência atual.",
                verbose_name='Bônus por Sequência de Acertos',
            ),
        ),
        migrations.AddField(
            model_name='configuracoesgeraisquiz',
            name='configuracao_pontuacao_dificuldade',
            field=models.JSONField(
                default=quiz.models.default_difficulty_rewards,
                help_text="Estrutura JSON com pontos, XP e penalidades por nível de dificuldade. Exemplo: {'Fácil': {'points': 10, 'xp': 5, 'penalty': 2}}",
                verbose_name='Regras de Pontuação por Dificuldade',
            ),
        ),
        migrations.AddField(
            model_name='configuracoesgeraisquiz',
            name='multiplicador_bonus_maximo',
            field=models.FloatField(
                default=2.0,
                help_text='Limita o multiplicador total aplicado por bônus de sequência para evitar valores extremos.',
                validators=[django.core.validators.MinValueValidator(1.0)],
                verbose_name='Multiplicador Máximo de Bônus',
            ),
        ),
        migrations.AddField(
            model_name='estatisticasdiariasusuario',
            name='xp_ganho_dia',
            field=models.IntegerField(default=0, validators=[django.core.validators.MinValueValidator(0)], verbose_name='XP Ganhado no Dia'),
        ),
        migrations.AddField(
            model_name='respostasusuarioporsessao',
            name='multiplicador_aplicado',
            field=models.FloatField(
                default=1.0,
                help_text='Fator de multiplicação aplicado em função de bônus de sequência.',
                verbose_name='Multiplicador Aplicado',
            ),
        ),
        migrations.AddField(
            model_name='respostasusuarioporsessao',
            name='pontos_obtidos',
            field=models.IntegerField(default=0, help_text='Pontuação líquida obtida nesta resposta específica.', verbose_name='Pontos da Resposta'),
        ),
        migrations.AddField(
            model_name='respostasusuarioporsessao',
            name='xp_obtido',
            field=models.IntegerField(default=0, help_text='Experiência concedida por esta resposta.', validators=[django.core.validators.MinValueValidator(0)], verbose_name='XP Obtido'),
        ),
        migrations.AddField(
            model_name='sessoesquizusuario',
            name='melhor_sequencia_acertos',
            field=models.IntegerField(
                default=0,
                help_text='Maior sequência contínua de acertos registrada na sessão.',
                validators=[django.core.validators.MinValueValidator(0)],
                verbose_name='Melhor Sequência de Acertos',
            ),
        ),
        migrations.AddField(
            model_name='sessoesquizusuario',
            name='sequencia_acertos_atual',
            field=models.IntegerField(
                default=0,
                validators=[django.core.validators.MinValueValidator(0)],
                verbose_name='Sequência Atual de Acertos',
            ),
        ),
        migrations.AddField(
            model_name='sessoesquizusuario',
            name='xp_total_sessao',
            field=models.IntegerField(
                default=0,
                help_text='Experiência total acumulada pelo usuário nesta sessão.',
                validators=[django.core.validators.MinValueValidator(0)],
                verbose_name='XP Ganha na Sessão',
            ),
        ),
        migrations.CreateModel(
            name='NivelGamificacao',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('identificador', models.CharField(help_text='Slug único para integrações ou referências em código.', max_length=100, unique=True, verbose_name='Identificador Interno')),
                ('nome', models.CharField(max_length=150, verbose_name='Nome do Nível')),
                ('descricao', models.TextField(blank=True, verbose_name='Descrição do Nível')),
                ('ordem', models.PositiveIntegerField(default=1, help_text='Determina a ordem dos níveis (menor valor aparece primeiro).', verbose_name='Ordem de Exibição')),
                ('xp_minimo', models.PositiveIntegerField(verbose_name='XP Mínimo')),
                ('xp_maximo', models.PositiveIntegerField(blank=True, help_text='Opcional. Se vazio, considera-se que o nível não possui limite superior.', null=True, verbose_name='XP Máximo')),
                ('recompensas_json', models.JSONField(blank=True, default=dict, help_text='Campo flexível para descrever benefícios concedidos ao alcançar o nível (ex: descontos, acesso antecipado).', verbose_name='Recompensas')),
            ],
            options={
                'ordering': ['ordem', 'xp_minimo'],
                'verbose_name': 'Nível de Gamificação',
                'verbose_name_plural': 'Níveis de Gamificação',
            },
        ),
        migrations.CreateModel(
            name='Conquista',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slug', models.SlugField(help_text='Identificador único usado para integrar regras de gamificação.', max_length=150, unique=True, verbose_name='Slug da Conquista')),
                ('nome', models.CharField(max_length=150, verbose_name='Nome da Conquista')),
                ('descricao', models.TextField(blank=True, verbose_name='Descrição')),
                ('criterio_json', models.JSONField(blank=True, default=dict, help_text="Estrutura flexível descrevendo a regra para desbloqueio (ex: {'tipo': 'xp_total', 'valor': 1000}).", verbose_name='Critério')),
                ('icone', models.CharField(blank=True, help_text='Nome de ícone ou caminho para imagem a ser exibida ao usuário.', max_length=255, verbose_name='Ícone')),
                ('ordem_exibicao', models.PositiveIntegerField(default=0, help_text='Permite priorizar a exibição de conquistas em coleções.', verbose_name='Ordem de Exibição')),
            ],
            options={
                'ordering': ['ordem_exibicao', 'nome'],
                'verbose_name': 'Conquista',
                'verbose_name_plural': 'Conquistas',
            },
        ),
        migrations.CreateModel(
            name='PerfilGamificacaoUsuario',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('xp_total', models.PositiveIntegerField(default=0, verbose_name='XP Total')),
                ('melhor_sequencia_geral', models.PositiveIntegerField(default=0, verbose_name='Melhor Sequência Geral')),
                ('sequencia_atual', models.PositiveIntegerField(default=0, verbose_name='Sequência Atual')),
                ('ultima_atualizacao', models.DateTimeField(auto_now=True, verbose_name='Última Atualização')),
                ('conquistas', models.ManyToManyField(blank=True, related_name='perfis_dos_usuarios', through='quiz.ConquistaUsuario', to='quiz.conquista', verbose_name='Conquistas Desbloqueadas')),
                ('nivel_atual', models.ForeignKey(blank=True, null=True, on_delete=models.deletion.SET_NULL, related_name='perfis_associados', to='quiz.nivelgamificacao', verbose_name='Nível Atual')),
                ('user', models.OneToOneField(on_delete=models.deletion.CASCADE, related_name='gamification_profile', to='auth.user', verbose_name='Usuário')),
            ],
            options={
                'verbose_name': 'Perfil de Gamificação do Usuário',
                'verbose_name_plural': 'Perfis de Gamificação dos Usuários',
            },
        ),
        migrations.CreateModel(
            name='ConquistaUsuario',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('data_conquista', models.DateTimeField(auto_now_add=True, verbose_name='Data da Conquista')),
                ('metadata', models.JSONField(blank=True, default=dict, help_text='Informações extras sobre o desbloqueio (ex: motivo, valores alcançados).', verbose_name='Metadados')),
                ('conquista', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='desbloqueios', to='quiz.conquista')),
                ('perfil', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='conquistas_usuarios', to='quiz.perfilgamificacaousuario')),
            ],
            options={
                'ordering': ['-data_conquista'],
                'verbose_name': 'Conquista do Usuário',
                'verbose_name_plural': 'Conquistas dos Usuários',
                'unique_together': {('perfil', 'conquista')},
            },
        ),
    ]
