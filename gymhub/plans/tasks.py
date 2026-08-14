from celery import shared_task
from django.db import transaction
from django.utils import timezone

from .models import TrainingPlan


def activar_planes_programados(hoy=None):
    hoy = hoy or timezone.localdate()
    planes = TrainingPlan.objects.filter(
        status='scheduled',
        start_date__lte=hoy,
        publicado_en__isnull=False,
    ).order_by('start_date', 'id')
    activados = 0
    for plan_id in list(planes.values_list('id', flat=True)):
        with transaction.atomic():
            plan = TrainingPlan.objects.select_for_update().get(id=plan_id)
            if plan.status != 'scheduled' or plan.start_date > hoy:
                continue
            TrainingPlan.objects.filter(
                member=plan.member,
                status='active',
            ).exclude(id=plan.id).update(
                status='finished',
                is_active=False,
                finished_at=timezone.now(),
            )
            plan.status = 'active'
            plan.is_active = True
            plan.save(update_fields=['status', 'is_active'])
            activados += 1
    return {'activated': activados, 'date': hoy.isoformat()}


@shared_task(name='plans.tasks.activate_scheduled_plans')
def activate_scheduled_plans():
    return activar_planes_programados()
