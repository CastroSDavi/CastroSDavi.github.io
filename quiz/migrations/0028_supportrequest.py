from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('quiz', '0027_questionissuereport'),
    ]

    operations = [
        migrations.CreateModel(
            name='SupportRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nome', models.CharField(blank=True, max_length=150, verbose_name='Nome de contato')),
                ('email', models.EmailField(blank=True, max_length=254, verbose_name='E-mail de contato')),
                ('mensagem', models.TextField(verbose_name='Mensagem')),
                ('origem', models.CharField(choices=[('general', 'Formulário geral'), ('inline_message', 'Ação do sistema')], default='general', max_length=32, verbose_name='Origem do relato')),
                ('contexto', models.JSONField(blank=True, help_text='Informações auxiliares como página, rota ou mensagem que gerou o contato.', null=True, verbose_name='Contexto adicional')),
                ('criado_em', models.DateTimeField(auto_now_add=True, verbose_name='Criado em')),
                ('usuario', models.ForeignKey(blank=True, null=True, on_delete=models.SET_NULL, related_name='support_requests', to=settings.AUTH_USER_MODEL, verbose_name='Usuário')),
            ],
            options={
                'verbose_name': 'Contato de Suporte',
                'verbose_name_plural': 'Contatos de Suporte',
                'ordering': ['-criado_em'],
            },
        ),
    ]
