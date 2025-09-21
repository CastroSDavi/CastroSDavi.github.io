from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import UserPreferences, PerfilGamificacaoUsuario


@receiver(post_save, sender=User)
def ensure_user_preferences(sender, instance, **kwargs):
    """Garante que todo usuário possua um registro de preferências associado."""
    if not instance:
        return

    UserPreferences.objects.get_or_create(user=instance)
    PerfilGamificacaoUsuario.objects.get_or_create(user=instance)
