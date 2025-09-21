# Generated manually to create the UserPreferences model.
from django.conf import settings
from django.db import migrations, models


def create_user_preferences(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    UserPreferences = apps.get_model('quiz', 'UserPreferences')
    for user in User.objects.all():
        UserPreferences.objects.get_or_create(user=user)


class Migration(migrations.Migration):

    dependencies = [
        ('quiz', '0007_populate_codigo_importacao'),
    ]

    operations = [
        migrations.CreateModel(
            name='UserPreferences',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('theme_preference', models.CharField(choices=[('light', 'Claro'), ('dark', 'Escuro')], default='light', help_text='Define a aparência padrão utilizada na interface.', max_length=20, verbose_name='Tema da Interface')),
                ('receive_product_updates', models.BooleanField(default=True, help_text='Recebe emails com atualizações importantes e comunicados.', verbose_name='Receber novidades do MedQuiz')),
                ('receive_progress_reports', models.BooleanField(default=False, help_text='Recebe um resumo periódico com seus indicadores de estudo.', verbose_name='Receber resumos de progresso')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Criado em')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Atualizado em')),
                ('user', models.OneToOneField(on_delete=models.CASCADE, related_name='preferences', to=settings.AUTH_USER_MODEL, verbose_name='Usuário')),
            ],
            options={
                'verbose_name': 'Preferência do Usuário',
                'verbose_name_plural': 'Preferências dos Usuários',
            },
        ),
        migrations.RunPython(create_user_preferences, migrations.RunPython.noop),
    ]
