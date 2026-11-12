from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import User, MemberProfile


@receiver(post_save, sender=User)
def create_profile_for_new_user(sender, instance, created, **kwargs):
    """Crea el perfil operativo necesario para una cuenta."""
    if created:
        if instance.role == 'member':
            MemberProfile.objects.get_or_create(user=instance)
