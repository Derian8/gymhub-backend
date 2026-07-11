from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = (
        'Quita las membresías asignadas a clientes para reasignarlas desde cero. '
        'Conserva el catálogo de planes.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Ejecuta la limpieza. Sin este flag solo muestra un dry-run.',
        )

    def handle(self, *args, **options):
        from billing.models import MemberSubscription, PaymentRecord, PaymentSchedule
        from users.models import MemberProfile

        member_ids = list(
            MemberProfile.objects.filter(membership_plan__isnull=False)
            .values_list('id', flat=True)
        )
        subscription_ids = list(
            MemberSubscription.objects.values_list('id', flat=True)
        )
        schedule_ids = list(
            PaymentSchedule.objects.filter(subscription_id__in=subscription_ids)
            .values_list('id', flat=True)
        )
        orphan_schedule_ids = list(
            PaymentSchedule.objects.filter(subscription__isnull=True)
            .values_list('id', flat=True)
        )
        all_schedule_ids = schedule_ids + orphan_schedule_ids
        record_count = PaymentRecord.objects.filter(schedule_id__in=all_schedule_ids).count()

        self.stdout.write('Resumen de limpieza de membresías:')
        self.stdout.write(f'  Clientes con plan asignado: {len(member_ids)}')
        self.stdout.write(f'  Suscripciones a eliminar: {len(subscription_ids)}')
        self.stdout.write(f'  Cobros programados a eliminar: {len(all_schedule_ids)}')
        self.stdout.write(f'  Registros de pago a eliminar: {record_count}')
        self.stdout.write('  Planes comerciales: se conservan')

        if not options['confirm']:
            self.stdout.write(self.style.WARNING('Dry-run: ejecuta con --confirm para aplicar cambios.'))
            return

        with transaction.atomic():
            PaymentRecord.objects.filter(schedule_id__in=all_schedule_ids).delete()
            PaymentSchedule.objects.filter(id__in=all_schedule_ids).delete()
            MemberSubscription.objects.filter(id__in=subscription_ids).delete()
            MemberProfile.objects.filter(membership_plan__isnull=False).update(membership_plan=None)

        self.stdout.write(self.style.SUCCESS('Membresías existentes eliminadas. Clientes listos para asignación desde cero.'))
