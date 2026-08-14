from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = (
        'Elimina la actividad operativa de todos los miembros sin borrar cuentas, '
        'perfiles, asignaciones ni catálogos reutilizables.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Ejecuta el reinicio. Sin este flag solamente muestra el alcance.',
        )
        parser.add_argument(
            '--confirmar',
            help='Confirmación explícita: REINICIAR-DATOS.',
        )

    def handle(self, *args, **options):
        from ai_chat.models import AIChatConversation, AIChatMessage
        from alerts.models import (
            InactivityAlert,
            InactivityAlertContact,
            MemberJustifiedAbsence,
            Notification,
        )
        from attendance.models import Attendance
        from billing.models import (
            MemberSubscription,
            PaymentMethod,
            PaymentRecord,
            PaymentSchedule,
            SeguimientoCobro,
        )
        from classes.models import ClassEnrollment, GymClass
        from plans.models import TrainingPlan
        from progress.models import ExerciseLog, ProgressLog, WorkoutSession
        from users.models import AuditLog, MemberProfile, TrainerProfile, User

        operaciones = [
            ('mensajes del asistente', AIChatMessage.objects.all()),
            ('conversaciones del asistente', AIChatConversation.objects.all()),
            ('contactos de alertas', InactivityAlertContact.objects.all()),
            ('alertas de inactividad', InactivityAlert.objects.all()),
            ('ausencias justificadas', MemberJustifiedAbsence.objects.all()),
            ('notificaciones', Notification.objects.all()),
            ('inscripciones a clases', ClassEnrollment.objects.all()),
            ('registros de ejercicios', ExerciseLog.objects.all()),
            ('sesiones de entrenamiento', WorkoutSession.objects.all()),
            ('registros de progreso', ProgressLog.objects.all()),
            ('asistencias', Attendance.objects.all()),
            ('registros de pago', PaymentRecord.objects.all()),
            ('seguimientos de cobro', SeguimientoCobro.objects.all()),
            ('cobros programados', PaymentSchedule.objects.all()),
            ('suscripciones', MemberSubscription.objects.all()),
            ('métodos de pago', PaymentMethod.objects.all()),
            ('planes asignados', TrainingPlan.objects.all()),
            ('auditoría operativa', AuditLog.objects.all()),
        ]
        cantidades = [(nombre, queryset.count()) for nombre, queryset in operaciones]
        perfiles_con_plan = MemberProfile.objects.exclude(membership_plan=None).count()

        self.stdout.write('Reinicio operativo de miembros:')
        for nombre, cantidad in cantidades:
            self.stdout.write(f'  {nombre}: {cantidad}')
        self.stdout.write(f'  referencias antiguas de membresía: {perfiles_con_plan}')
        self.stdout.write('Datos protegidos:')
        self.stdout.write(f'  cuentas: {User.objects.count()}')
        self.stdout.write(f'  perfiles de miembro: {MemberProfile.objects.count()}')
        self.stdout.write(f'  perfiles de trainer: {TrainerProfile.objects.count()}')

        confirmed = options['confirm'] or options.get('confirmar') == 'REINICIAR-DATOS'
        if not confirmed:
            self.stdout.write(self.style.WARNING(
                'Dry-run: no se modificó ningún dato. Usa --confirmar REINICIAR-DATOS para ejecutar.'
            ))
            return

        with transaction.atomic():
            for _, queryset in operaciones:
                queryset.delete()
            MemberProfile.objects.exclude(membership_plan=None).update(membership_plan=None)
            GymClass.objects.exclude(current_enrolled=0).update(current_enrolled=0)

        self.stdout.write(self.style.SUCCESS(
            'Reinicio completado. Las cuentas, perfiles, asignaciones y catálogos se conservaron.'
        ))
