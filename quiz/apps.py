from django.apps import AppConfig


class QuizConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'quiz'

    def ready(self):
        # Importa sinais que garantem a criação de preferências padrão para cada usuário.
        from . import signals  # noqa: F401
