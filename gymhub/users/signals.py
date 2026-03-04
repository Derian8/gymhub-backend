from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import User, MemberProfile, TrainerProfile


@receiver(post_save, sender=User)
def create_profile_for_new_user(sender, instance, created, **kwargs):
    """Crea MemberProfile o TrainerProfile según el rol al crear un User."""
    if created:
        if instance.role == 'member':
            MemberProfile.objects.get_or_create(user=instance)
        elif instance.role == 'trainer':
            TrainerProfile.objects.get_or_create(user=instance)
