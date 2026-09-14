"""Conserva dos clientes demo completos sin restablecer otras cuentas."""
import os
import re
from datetime import date, timedelta

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone


PATRON_DEMO = re.compile(r'^(?:cliente\.demo|member)(\d+)@gymhub\.com$', re.I)
EXCLUIDO = 'cliente.demo03@gymhub.com'
MARCA = '[DEMO DOS CLIENTES]'


class Command(BaseCommand):
    help = 'Conserva dos clientes demo completos. Por defecto solo muestra la selección.'

    def add_arguments(self, parser):
        parser.add_argument('--yes', action='store_true')
        parser.add_argument('--respaldo', help='Archivo JSON nuevo para respaldo privado completo.')

    def handle(self, *args, **options):
        from users.models import MemberProfile, TrainerProfile, User

        with transaction.atomic():
            usuarios = list(User.objects.select_for_update().order_by('email'))
            candidatos = [u for u in usuarios if u.role == 'member'
                          and not u.is_staff and not u.is_superuser
                          and PATRON_DEMO.fullmatch(u.email)]
            elegibles = sorted(
                (u for u in candidatos if u.email.lower() != EXCLUIDO),
                key=lambda u: (int(PATRON_DEMO.fullmatch(u.email)[1]), u.email),
            )
            if len(elegibles) < 2:
                raise CommandError('Se necesitan dos clientes demo existentes distintos de Sofía.')
            conservados = elegibles[:2]
            ids = [u.pk for u in conservados]
            eliminados = [u.pk for u in candidatos if u.pk not in ids]
            for usuario in candidatos:
                accion = 'CONSERVAR' if usuario.pk in ids else 'ELIMINAR'
                self.stdout.write(f'{accion}: {usuario.get_full_name()} <{usuario.email}>')
            if not options['yes']:
                self.stdout.write('Vista previa: no se modificaron datos.')
                return
            if not options['respaldo']:
                raise CommandError('Es obligatorio indicar --respaldo al aplicar.')
            entrenador = TrainerProfile.objects.filter(user__role='trainer').order_by('pk').first()
            if entrenador is None:
                raise CommandError('No existe un instructor; no se modificó nada.')

            # Incluye relaciones CASCADE y SET_NULL para recuperar los datos originales.
            descriptor = os.open(options['respaldo'], os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, 'w') as archivo:
                if os.fstat(archivo.fileno()).st_mode & 0o077:
                    raise CommandError(
                        'La carpeta no respeta permisos privados. Usá una ruta '
                        'en el sistema de archivos de Linux para el respaldo.'
                    )
                call_command('dumpdata', use_base_manager=True, stdout=archivo)
                archivo.flush()
                os.fsync(archivo.fileno())

            protegidos = list(User.objects.exclude(pk__in=[u.pk for u in candidatos]).order_by('pk').values())
            perfiles_instructores = list(TrainerProfile.objects.order_by('pk').values())
            for indice, usuario in enumerate(conservados):
                perfil, _ = MemberProfile.objects.get_or_create(user=usuario)
                self.completar(perfil, perfil.trainer_asignado or entrenador, indice)
            User.objects.filter(pk__in=eliminados, role='member', is_staff=False,
                                is_superuser=False).delete()
            if protegidos != list(User.objects.exclude(pk__in=ids).order_by('pk').values()):
                raise CommandError('Cambió una cuenta protegida; se revierte la operación.')
            if perfiles_instructores != list(TrainerProfile.objects.order_by('pk').values()):
                raise CommandError('Cambió un instructor; se revierte la operación.')
            self.stdout.write(self.style.SUCCESS('Completado: exactamente dos clientes demo.'))

    def completar(self, perfil, entrenador, indice):
        from billing.models import MembershipPlan, MemberSubscription
        from billing.services import (
            create_pending_charge, mark_payment_paid, void_non_collectable_charges,
        )
        from nutrition.models import NutritionGuideline, NutritionProfile, PlanNutritionLink
        from plans.models import Exercise, TrainingPlan, WorkoutDay
        from progress.models import ExerciseLog, ProgressLog, WorkoutSession

        hoy = timezone.localdate()
        perfil.phone = f'+506 0000-000{indice + 1}'
        perfil.birth_date = date(1995 + indice * 3, 5, 15)
        perfil.emergency_contact = 'Contacto ficticio demo: +506 0000-0000'
        perfil.join_date = hoy - timedelta(days=30)
        perfil.is_active = True
        perfil.trainer_asignado = entrenador
        tarifa = MembershipPlan.objects.filter(
            trainer=entrenador, is_active=True, recurrence_type='monthly',
        ).order_by('pk').first()
        if tarifa is None:
            tarifa = MembershipPlan.objects.create(
                trainer=entrenador, name='Membresía mensual demo', price='20000.00',
                description='Ejemplo demo: acceso y seguimiento mensual.',
                features='Rutina guiada, orientación nutricional y seguimiento',
            )
        perfil.membership_plan = tarifa
        perfil.save()

        objetivo = 'maintenance' if indice == 0 else 'muscle_gain'
        nombre = f'{MARCA} ' + ('Inicio y bienestar' if indice == 0 else 'Fuerza e hipertrofia')
        plan = TrainingPlan.objects.filter(member=perfil, name=nombre).first()
        TrainingPlan.objects.filter(member=perfil, is_active=True).exclude(
            pk=plan.pk if plan else None,
        ).update(status='archived', is_active=False, archived_at=timezone.now())
        plan, _ = TrainingPlan.objects.update_or_create(
            member=perfil, name=nombre,
            defaults=dict(
                trainer=entrenador, goal=objetivo, start_date=hoy - timedelta(days=7),
                end_date=hoy + timedelta(days=49), weeks_duration=8, days_per_week=3,
                level='beginner' if indice == 0 else 'intermediate', status='active',
                is_active=True, publicado_en=timezone.now(), publicado_por=entrenador.user,
                notes='Ejemplo ficticio. Calentá 5 minutos y revisá la técnica con tu instructor. '
                      'Iniciá la rutina y marcá cada ejercicio como Realizado u Omitir. '
                      'Descansá entre series y dejá un día de recuperación entre rutinas.',
            ),
        )
        bloques = [
            ('Cuerpo completo A', [
                ('Sentadilla a banco', 'legs', 'Bajá con control hasta tocar el banco y volvé a subir.'),
                ('Remo con mancuerna', 'back', 'Apoyá una mano y llevá el codo hacia la cadera.'),
                ('Press de pecho con mancuernas', 'chest', 'Mantené los pies apoyados y bajá con control.'),
                ('Puente de glúteos', 'glutes', 'Elevá la cadera sin arquear la zona lumbar.'),
            ]),
            ('Cuerpo completo B', [
                ('Zancada asistida', 'legs', 'Usá un apoyo estable y bajá verticalmente.'),
                ('Jalón al pecho', 'back', 'Llevá la barra hacia el pecho sin balancear el tronco.'),
                ('Press de hombros', 'shoulders', 'Empujá hacia arriba con el abdomen firme.'),
                ('Dead bug', 'core', 'Extendé brazo y pierna opuestos sin despegar la espalda.'),
            ]),
            ('Cuerpo completo C', [
                ('Peso muerto con mancuernas', 'legs', 'Llevá la cadera atrás con la espalda neutra.'),
                ('Remo sentado', 'back', 'Tirá hacia el abdomen sin inclinar el torso hacia atrás.'),
                ('Flexiones inclinadas', 'chest', 'Apoyá las manos en un banco estable y mantené el cuerpo alineado.'),
                ('Elevación de talones', 'calves', 'Subí y bajá lentamente con apoyo para equilibrarte.'),
            ]),
        ]
        dias = []
        codigos = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
        for orden, (titulo, ejercicios) in enumerate(bloques):
            dia, _ = WorkoutDay.objects.update_or_create(
                plan=plan, day_label='ABC'[orden], defaults=dict(
                    name=titulo, order=orden,
                    day_of_week=codigos[(hoy.weekday() + orden * 2) % 7],
                ),
            )
            dias.append(dia)
            for posicion, (nombre_ejercicio, grupo, tecnica) in enumerate(ejercicios):
                Exercise.objects.update_or_create(
                    workout_day=dia, order=posicion, defaults=dict(
                        name=nombre_ejercicio, muscle_group=grupo, sets=2 if indice == 0 else 3,
                        reps_range='10-12' if indice == 0 else '8-12',
                        rest_seconds=60 if indice == 0 else 90, technique_notes=tecnica,
                    ),
                )
        NutritionProfile.objects.update_or_create(
            training_plan=plan, defaults=dict(
                goal_type=objetivo, calorie_range_min=1800 if indice == 0 else 2200,
                calorie_range_max=2200 if indice == 0 else 2600,
                protein_focus='Ejemplo demo: incluir una fuente de proteína en comidas principales.',
                carb_strategy='Combinar cereales, frutas y verduras según el plan del instructor.',
                hydration_recommendation='Tener agua disponible durante el entrenamiento.',
            ),
        )
        for orden, (titulo, descripcion) in enumerate([
            ('Alimentación', 'Ejemplo educativo: organizar comidas variadas con vegetales, cereales y proteína.'),
            ('Hidratación', 'Preparar una botella de agua antes de iniciar la rutina.'),
            ('Recuperación', 'Mantener horarios regulares de descanso y registrar cómo te sentís.'),
        ]):
            guia, _ = NutritionGuideline.objects.get_or_create(
                goal_type=objetivo, title=f'{MARCA} {titulo}',
                defaults=dict(description=descripcion, recommended_foods='Frutas, verduras, legumbres y cereales',
                              timing_suggestions='Organizar los hábitos según tu horario.'),
            )
            PlanNutritionLink.objects.get_or_create(plan=plan, guideline=guia,
                                                   defaults={'priority_order': orden})
        suscripcion = MemberSubscription.objects.filter(
            member=perfil, commercial_notes=MARCA,
        ).order_by('pk').first()
        anteriores = MemberSubscription.objects.filter(member=perfil, is_active=True).exclude(
            pk=suscripcion.pk if suscripcion else None,
        )
        for anterior in anteriores:
            void_non_collectable_charges(anterior, 'Reemplazo por membresía demo')
        anteriores.update(is_active=False, status='cancelled', cancellation_date=hoy,
                          cancellation_reason='Reemplazo por membresía demo')
        if suscripcion is None:
            suscripcion = MemberSubscription.objects.create(
                member=perfil, plan=tarifa, trainer=entrenador, membership_name=tarifa.name,
                agreed_price=tarifa.price, start_date=hoy, next_billing_date=hoy,
                commercial_notes=MARCA, auto_generate_next=False,
            )
        if not suscripcion.current_period_end or suscripcion.current_period_end < hoy:
            _, pago = create_pending_charge(suscripcion, hoy)
            mark_payment_paid(pago, reference=f'DEMO-SIMULADO-{perfil.pk}-{hoy}',
                              notes='Pago ficticio de demostración. No se realizó ningún cobro.',
                              method='other')
        for orden in range(2):
            momento = timezone.now() - timedelta(days=6 - orden * 4)
            ProgressLog.objects.get_or_create(
                member=perfil, notes=f'{MARCA} Medición ficticia {orden + 1}',
                defaults=dict(recorded_at=momento, weight_kg=65 + indice * 10 + orden * .2,
                              height_cm=168 + indice * 7),
            )
            sesion, creada = WorkoutSession.objects.get_or_create(
                member=perfil, workout_day=dias[orden], trainer_notes=f'{MARCA} Sesión ficticia',
                defaults=dict(is_completed=True, completed_at=momento + timedelta(minutes=35),
                              overall_feeling=4),
            )
            if creada:
                WorkoutSession.objects.filter(pk=sesion.pk).update(started_at=momento)
                for posicion, ejercicio in enumerate(dias[orden].exercises.all()):
                    ExerciseLog.objects.create(
                        session=sesion, exercise=ejercicio,
                        estado='omitido' if posicion == 3 and orden == 0 else 'realizado',
                        notes='Registro ficticio demo',
                    )
