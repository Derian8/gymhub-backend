"""
Management command: python manage.py seed_data
Genera datos de prueba para el entorno de desarrollo/testing.
"""
import os
from datetime import date, timedelta
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from django.db import transaction


class Command(BaseCommand):
    help = 'Seed de datos para desarrollo: trainer1, member1 y datos mínimos de demo.'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='Limpiar datos existentes antes del seed.')
        parser.add_argument(
            '--trainer-password',
            default=os.environ.get('DEMO_TRAINER_PASSWORD'),
            help='Password de trainer1. Alternativa: DEMO_TRAINER_PASSWORD.',
        )
        parser.add_argument(
            '--member-password',
            default=os.environ.get('DEMO_MEMBER_PASSWORD'),
            help='Password de member1. Alternativa: DEMO_MEMBER_PASSWORD.',
        )

    def handle(self, *args, **options):
        self.trainer_password = options.get('trainer_password')
        self.member_password = options.get('member_password')
        if not self.trainer_password or not self.member_password:
            raise CommandError(
                'Define --trainer-password y --member-password, o las variables '
                'DEMO_TRAINER_PASSWORD y DEMO_MEMBER_PASSWORD.'
            )
        if options['clear']:
            self.stdout.write('Limpiando datos...')
            self._clear_data()

        self.stdout.write('Iniciando seed_data...')
        with transaction.atomic():
            plans_list = self._seed_membership_plans()
            trainers = self._seed_trainers()
            members = self._seed_members(plans_list, trainers)
            training_plans = self._seed_training_plans(members, trainers)
            self._seed_nutrition(training_plans)
            self._seed_attendance(members)
            self._seed_workout_sessions(members, training_plans)
            self._seed_payment_records(members, plans_list)
            self._seed_inactivity_alerts(members, trainers)
            self._seed_notifications(members, trainers)

        self.stdout.write(self.style.SUCCESS('seed_data completado exitosamente.'))

    def _get_or_create_demo_user(self, User, data, password, role):
        username = data['email'].split('@')[0]
        user = (
            User.objects.filter(email=data['email']).first()
            or User.objects.filter(username=username).first()
        )
        created = user is None

        if created:
            user = User(username=username, email=data['email'])

        user.username = username
        user.email = data['email']
        user.first_name = data['first_name']
        user.last_name = data['last_name']
        user.role = role
        user.set_password(password)
        user.save()
        return user, created

    def _clear_data(self):
        from users.models import User, MemberProfile, TrainerProfile, AuditLog
        from classes.models import GymClass, ClassEnrollment
        from plans.models import TrainingPlan, WorkoutDay, Exercise
        from attendance.models import Attendance
        from progress.models import ProgressLog, WorkoutSession, ExerciseLog
        from alerts.models import InactivityAlert, Notification
        from billing.models import MembershipPlan, PaymentSchedule, PaymentRecord, PaymentMethod
        from nutrition.models import NutritionProfile, NutritionGuideline, PlanNutritionLink
        from ai_chat.models import AIChatMessage

        User.objects.filter(is_superuser=False).delete()
        MembershipPlan.objects.all().delete()
        NutritionGuideline.objects.all().delete()
        self.stdout.write('Datos limpiados.')

    def _seed_membership_plans(self):
        from billing.models import MembershipPlan
        plans = []
        plan_data = [
            {'name': 'Básico', 'price': 30000.00, 'recurrence_type': 'monthly',
             'grace_period_days': 7,
             'features': 'Acceso sala de pesas, duchas', 'description': 'Plan básico mensual'},
            {'name': 'Estándar', 'price': 50000.00, 'recurrence_type': 'monthly',
             'grace_period_days': 7,
             'features': 'Básico + clases grupales + locker', 'description': 'Plan estándar con clases'},
            {'name': 'Premium', 'price': 80000.00, 'recurrence_type': 'monthly',
             'grace_period_days': 7,
             'features': 'Todo incluido + trainer personalizado + nutrición',
             'description': 'Plan premium todo incluido'},
        ]
        for pd in plan_data:
            plan, _ = MembershipPlan.objects.update_or_create(
                name=pd['name'], trainer=None, defaults=pd
            )
            plans.append(plan)
        self.stdout.write(f'  {len(plans)} MembershipPlans creados.')
        return plans

    def _seed_trainers(self):
        from django.contrib.auth import get_user_model
        from users.models import TrainerProfile
        User = get_user_model()
        trainers = []
        trainer_data = [
            {'email': 'trainer1@gymhub.com', 'first_name': 'Carlos', 'last_name': 'Mendoza',
             'specialization': 'Fuerza y Potencia', 'bio': 'Especialista en entrenamiento de fuerza con 10 años de experiencia.',
             'certification': 'NSCA-CSCS'},
        ]
        for td in trainer_data:
            user, _ = self._get_or_create_demo_user(
                User,
                td,
                self.trainer_password,
                'trainer',
            )
            profile, _ = TrainerProfile.objects.get_or_create(
                user=user,
                defaults={
                    'specialization': td['specialization'],
                    'bio': td['bio'],
                    'certification': td['certification'],
                }
            )
            trainers.append(profile)
        self.stdout.write(f'  {len(trainers)} Trainers creados.')
        return trainers

    def _seed_members(self, plans_list, trainers):
        from django.contrib.auth import get_user_model
        from users.models import MemberProfile
        User = get_user_model()
        members = []

        member_names = [
            ('Luis', 'Hernández'),
        ]

        for i, (first, last) in enumerate(member_names):
            email = f'member{i+1}@gymhub.com'
            user, _ = self._get_or_create_demo_user(
                User,
                {
                    'email': email,
                    'first_name': first,
                    'last_name': last,
                },
                self.member_password,
                'member',
            )

            plan = plans_list[i % len(plans_list)]
            profile, _ = MemberProfile.objects.get_or_create(
                user=user,
                defaults={
                    'trainer_asignado': trainers[i % len(trainers)],
                    'membership_plan': plan,
                    'phone': f'+5491100{i+1:04d}',
                    'join_date': date.today() - timedelta(days=90 + i * 5),
                    'is_active': True,
                }
            )
            profile.trainer_asignado = trainers[i % len(trainers)]
            profile.membership_plan = plan
            profile.save()
            members.append(profile)

        self.stdout.write(f'  {len(members)} Members creados.')
        return members

    def _seed_training_plans(self, members, trainers):
        from plans.models import TrainingPlan, WorkoutDay, Exercise

        training_plans = []
        weekday_codes = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
        today_index = date.today().weekday()
        goals = ['muscle_gain']
        # Ejercicios por día
        exercises_by_day = {
            'A': [  # Pecho + Tríceps
                {'name': 'Press de Banca', 'muscle_group': 'chest', 'sets': 4, 'reps_range': '6-10', 'weight_suggestion_kg': 60.0, 'rest_seconds': 120},
                {'name': 'Press Inclinado con Mancuernas', 'muscle_group': 'chest', 'sets': 3, 'reps_range': '8-12', 'weight_suggestion_kg': 22.5, 'rest_seconds': 90},
                {'name': 'Aperturas con Mancuernas', 'muscle_group': 'chest', 'sets': 3, 'reps_range': '10-15', 'weight_suggestion_kg': 15.0, 'rest_seconds': 60},
                {'name': 'Fondos en Paralelas', 'muscle_group': 'triceps', 'sets': 3, 'reps_range': '8-12', 'weight_suggestion_kg': None, 'rest_seconds': 90},
                {'name': 'Press Francés', 'muscle_group': 'triceps', 'sets': 3, 'reps_range': '10-12', 'weight_suggestion_kg': 20.0, 'rest_seconds': 60},
                {'name': 'Extensiones de Tríceps en Polea', 'muscle_group': 'triceps', 'sets': 3, 'reps_range': '12-15', 'weight_suggestion_kg': 15.0, 'rest_seconds': 60},
            ],
            'B': [  # Espalda + Bíceps
                {'name': 'Dominadas', 'muscle_group': 'back', 'sets': 4, 'reps_range': '6-10', 'weight_suggestion_kg': None, 'rest_seconds': 120},
                {'name': 'Remo con Barra', 'muscle_group': 'back', 'sets': 4, 'reps_range': '6-10', 'weight_suggestion_kg': 60.0, 'rest_seconds': 120},
                {'name': 'Jalón al Pecho', 'muscle_group': 'back', 'sets': 3, 'reps_range': '8-12', 'weight_suggestion_kg': 50.0, 'rest_seconds': 90},
                {'name': 'Curl con Barra', 'muscle_group': 'biceps', 'sets': 3, 'reps_range': '8-12', 'weight_suggestion_kg': 25.0, 'rest_seconds': 60},
                {'name': 'Curl Martillo', 'muscle_group': 'biceps', 'sets': 3, 'reps_range': '10-12', 'weight_suggestion_kg': 15.0, 'rest_seconds': 60},
                {'name': 'Curl Concentrado', 'muscle_group': 'biceps', 'sets': 2, 'reps_range': '12-15', 'weight_suggestion_kg': 12.5, 'rest_seconds': 60},
            ],
            'C': [  # Piernas
                {'name': 'Sentadilla con Barra', 'muscle_group': 'legs', 'sets': 4, 'reps_range': '6-10', 'weight_suggestion_kg': 80.0, 'rest_seconds': 150},
                {'name': 'Prensa de Piernas', 'muscle_group': 'legs', 'sets': 3, 'reps_range': '8-12', 'weight_suggestion_kg': 100.0, 'rest_seconds': 120},
                {'name': 'Extensiones de Cuádriceps', 'muscle_group': 'legs', 'sets': 3, 'reps_range': '10-15', 'weight_suggestion_kg': 35.0, 'rest_seconds': 60},
                {'name': 'Curl de Isquiotibiales', 'muscle_group': 'legs', 'sets': 3, 'reps_range': '10-15', 'weight_suggestion_kg': 25.0, 'rest_seconds': 60},
                {'name': 'Peso Muerto Rumano', 'muscle_group': 'glutes', 'sets': 3, 'reps_range': '8-12', 'weight_suggestion_kg': 60.0, 'rest_seconds': 120},
                {'name': 'Gemelos de Pie', 'muscle_group': 'legs', 'sets': 4, 'reps_range': '15-20', 'weight_suggestion_kg': 40.0, 'rest_seconds': 45},
                {'name': 'Hip Thrust', 'muscle_group': 'glutes', 'sets': 3, 'reps_range': '10-15', 'weight_suggestion_kg': 60.0, 'rest_seconds': 90},
            ],
        }

        for i, member in enumerate(members):
            trainer = member.trainer_asignado or trainers[0]
            goal = goals[i % len(goals)]
            plan, _ = TrainingPlan.objects.get_or_create(
                member=member,
                trainer=trainer,
                name=f'Plan {goal.replace("_", " ").title()} — {member.user.first_name}',
                defaults={
                    'goal': goal,
                    'start_date': date.today() - timedelta(days=60),
                    'end_date': date.today() + timedelta(days=60),
                    'weeks_duration': 12,
                    'days_per_week': 3,
                    'is_active': True,
                }
            )

            # Crear workout days
            days_config = [
                ('Pecho y Tríceps', 'A', 0, weekday_codes[today_index]),
                ('Espalda y Bíceps', 'B', 1, weekday_codes[(today_index + 1) % 7]),
                ('Piernas y Glúteos', 'C', 2, weekday_codes[(today_index + 2) % 7]),
            ]
            for day_name, day_label, order, day_of_week in days_config:
                wd, _ = WorkoutDay.objects.get_or_create(
                    plan=plan, day_label=day_label,
                    defaults={'name': day_name, 'order': order, 'day_of_week': day_of_week}
                )
                wd.name = day_name
                wd.order = order
                wd.day_of_week = day_of_week
                wd.save(update_fields=['name', 'order', 'day_of_week'])
                # Crear ejercicios
                for j, ex_data in enumerate(exercises_by_day[day_label]):
                    Exercise.objects.get_or_create(
                        workout_day=wd,
                        name=ex_data['name'],
                        defaults={
                            'muscle_group': ex_data['muscle_group'],
                            'sets': ex_data['sets'],
                            'reps_range': ex_data['reps_range'],
                            'weight_suggestion_kg': ex_data['weight_suggestion_kg'],
                            'rest_seconds': ex_data['rest_seconds'],
                            'order': j,
                        }
                    )

            training_plans.append(plan)

        self.stdout.write(f'  {len(training_plans)} TrainingPlans con WorkoutDays y Exercises creados.')
        return training_plans

    def _seed_nutrition(self, training_plans):
        from nutrition.models import NutritionProfile, NutritionGuideline, PlanNutritionLink

        guidelines_data = {
            'fat_loss': [
                {'title': 'Déficit Calórico Controlado', 'description': 'Mantén un déficit de 300-500 kcal/día.',
                 'recommended_foods': 'Pollo, pescado, verduras, legumbres, frutas de bajo índice glucémico',
                 'foods_to_limit': 'Azúcares refinados, harinas blancas, alcohol, frituras',
                 'timing_suggestions': 'Desayuno proteico, carbohidratos en pre-entreno, cena ligera'},
                {'title': 'Alta Proteína para Pérdida de Grasa', 'description': 'Ingesta proteica de 2-2.2g/kg de peso corporal.',
                 'recommended_foods': 'Claras de huevo, atún, pechuga, requesón, proteína whey',
                 'foods_to_limit': 'Carnes grasas, quesos enteros, salsas con azúcar',
                 'timing_suggestions': '30g proteína en cada comida, batido post-entreno'},
            ],
            'muscle_gain': [
                {'title': 'Superávit Calórico Limpio', 'description': 'Superávit de 200-400 kcal sobre mantenimiento.',
                 'recommended_foods': 'Carnes magras, huevos, avena, arroz, batata, frutas, frutos secos',
                 'foods_to_limit': 'Comida chatarra, azúcar excesiva, alcohol',
                 'timing_suggestions': 'Carbohidratos pre y post entreno, proteína distribuida en 5 comidas'},
                {'title': 'Timing Nutricional para Ganancia Muscular', 'description': 'Optimiza el consumo de nutrientes peri-entrenamiento.',
                 'recommended_foods': 'Plátano + proteína pre-entreno, arroz + pollo post-entreno',
                 'foods_to_limit': 'Grasas pre-entreno en exceso, fibra excesiva pre-entreno',
                 'timing_suggestions': '2h antes: comida completa. 30 min antes: batido rápido. Post: proteína + carbos'},
            ],
            'endurance': [
                {'title': 'Carga de Carbohidratos para Resistencia', 'description': 'Base de carbohidratos complejos para sostener entrenamientos largos.',
                 'recommended_foods': 'Pasta, arroz, pan integral, plátanos, dátiles, avena',
                 'foods_to_limit': 'Grasas en exceso antes del entreno, fibra alta pre-competencia',
                 'timing_suggestions': 'Carbohidratos 2-3h antes, geles durante esfuerzo >60 min'},
                {'title': 'Hidratación Deportiva', 'description': 'Estrategia de hidratación para deportes de resistencia.',
                 'recommended_foods': 'Agua, bebidas isotónicas, frutas hidratantes, pepino',
                 'foods_to_limit': 'Bebidas con cafeína excesiva, alcohol',
                 'timing_suggestions': '500ml 2h antes, 150-250ml cada 20 min durante, recuperación post-esfuerzo'},
            ],
            'maintenance': [
                {'title': 'Equilibrio Nutricional', 'description': 'Mantén tu peso con una dieta equilibrada.',
                 'recommended_foods': 'Variedad de proteínas, carbohidratos complejos, grasas saludables, frutas y verduras',
                 'foods_to_limit': 'Ultraprocesados, azúcares añadidos, alcohol en exceso',
                 'timing_suggestions': '3 comidas principales + 2 snacks saludables'},
                {'title': 'Micronutrientes para Mantenimiento', 'description': 'Asegura vitaminas y minerales para la salud general.',
                 'recommended_foods': 'Verduras de hoja verde, frutas variadas, legumbres, semillas',
                 'foods_to_limit': 'Comida procesada baja en nutrientes',
                 'timing_suggestions': 'Distribución uniforme a lo largo del día'},
            ],
        }

        nutrition_configs = {
            'fat_loss': {'calorie_range_min': 1600, 'calorie_range_max': 1800,
                         'protein_focus': '2.2g/kg peso corporal', 'carb_strategy': 'Carbohidratos solo pre y post entreno',
                         'hydration_recommendation': '2.5-3L de agua diarios'},
            'muscle_gain': {'calorie_range_min': 2800, 'calorie_range_max': 3200,
                            'protein_focus': '2g/kg peso corporal', 'carb_strategy': 'Carbohidratos complejos todo el día',
                            'hydration_recommendation': '3-4L de agua diarios'},
            'endurance': {'calorie_range_min': 2200, 'calorie_range_max': 2600,
                          'protein_focus': '1.6g/kg peso corporal', 'carb_strategy': 'Alta carga de carbohidratos',
                          'hydration_recommendation': '3L+ con electrolitos'},
            'maintenance': {'calorie_range_min': 2000, 'calorie_range_max': 2200,
                            'protein_focus': '1.5g/kg peso corporal', 'carb_strategy': 'Balance 40/30/30 carbs/prot/grasas',
                            'hydration_recommendation': '2L de agua diarios'},
        }

        # Crear guidelines
        guidelines_by_goal = {}
        for goal, guidelines in guidelines_data.items():
            guidelines_by_goal[goal] = []
            for gd in guidelines:
                gl, _ = NutritionGuideline.objects.get_or_create(
                    goal_type=goal, title=gd['title'], defaults=gd
                )
                guidelines_by_goal[goal].append(gl)

        # Crear NutritionProfile para cada training plan
        profiles_created = 0
        for plan in training_plans:
            goal = plan.goal if plan.goal in nutrition_configs else 'maintenance'
            config = nutrition_configs[goal]
            profile, created = NutritionProfile.objects.get_or_create(
                training_plan=plan,
                defaults={'goal_type': goal, **config}
            )
            if created:
                profiles_created += 1

            # Vincular guidelines
            for i, gl in enumerate(guidelines_by_goal.get(goal, [])):
                PlanNutritionLink.objects.get_or_create(
                    plan=plan, guideline=gl,
                    defaults={'priority_order': i}
                )

        self.stdout.write(f'  {profiles_created} NutritionProfiles y 8 NutritionGuidelines creados.')

    def _seed_attendance(self, members):
        from attendance.models import Attendance

        today = date.today()
        created_count = 0

        for member in members:
            for days_ago in (21, 14, 7, 1):
                check_time = timezone.now() - timedelta(days=days_ago)
                attendance_date = today - timedelta(days=days_ago)
                _, att_created = Attendance.objects.get_or_create(
                    member=member,
                    attendance_date=attendance_date,
                    defaults={'check_in_time': check_time},
                )
                if att_created:
                    created_count += 1

        self.stdout.write(f'  ~{created_count} Attendance records creados.')

    def _seed_workout_sessions(self, members, training_plans):
        from progress.models import WorkoutSession, ExerciseLog

        sessions_created = 0
        logs_created = 0

        for plan_idx, plan in enumerate(training_plans):
            member = plan.member
            workout_days = list(plan.workout_days.order_by('order'))
            if not workout_days:
                continue

            for week in range(8):
                for day_idx, workout_day in enumerate(workout_days):
                    days_ago = (7 - week) * 7 + day_idx * 2 + 1
                    if days_ago > 60:
                        continue

                    session_date = timezone.now() - timedelta(days=days_ago)
                    session = WorkoutSession.objects.create(
                        member=member,
                        workout_day=workout_day,
                        started_at=session_date,
                        completed_at=session_date + timedelta(hours=1),
                        is_completed=True,
                        overall_feeling=4,
                    )
                    sessions_created += 1

                    # Crear ExerciseLogs con progresión +2.5kg/semana
                    exercises = list(workout_day.exercises.order_by('order'))
                    for ex in exercises:
                        base_weight = ex.weight_suggestion_kg or 20.0
                        progression = week * 2.5  # +2.5kg por semana
                        actual_weight = base_weight + progression

                        # Press de banca específico: 40kg → 60kg
                        if ex.name == 'Press de Banca':
                            actual_weight = 40.0 + (week * 2.5)

                        ExerciseLog.objects.create(
                            session=session,
                            exercise=ex,
                            sets_completed=ex.sets,
                            reps_completed=int(ex.reps_range.split('-')[0]) if '-' in ex.reps_range else int(ex.reps_range),
                            weight_used_kg=actual_weight if ex.weight_suggestion_kg else None,
                            rpe=6 + (week % 3),
                        )
                        logs_created += 1

        self.stdout.write(f'  {sessions_created} WorkoutSessions y {logs_created} ExerciseLogs creados.')

    def _seed_payment_records(self, members, plans_list):
        from billing.models import PaymentSchedule, PaymentRecord

        today = date.today()
        records_created = 0

        payment_configs = [
            (today, 'paid', False),
        ]

        for i, member in enumerate(members):
            if i >= len(payment_configs):
                break

            due_date, initial_status, should_be_late = payment_configs[i]
            plan = member.membership_plan or plans_list[0]

            schedule, _ = PaymentSchedule.objects.get_or_create(
                member=member,
                plan=plan,
                is_active=True,
                defaults={
                    'due_date': due_date,
                    'grace_period_days': 7,
                    'recurrence_type': 'monthly',
                }
            )
            schedule.due_date = due_date
            schedule.save()

            # Status final
            final_status = 'late' if should_be_late else initial_status

            record, created = PaymentRecord.objects.get_or_create(
                schedule=schedule,
                defaults={
                    'amount': plan.price,
                    'status': final_status,
                    'paid_at': timezone.now() if final_status == 'paid' else None,
                }
            )
            if not created:
                record.status = final_status
                if final_status == 'paid':
                    record.paid_at = timezone.now()
                record.save()
            records_created += 1

        self.stdout.write(f'  {records_created} PaymentRecords creados.')

    def _seed_inactivity_alerts(self, members, trainers):
        alerts_created = 0

        self.stdout.write(f'  {alerts_created} InactivityAlerts creados.')

    def _seed_notifications(self, members, trainers):
        from alerts.models import Notification

        notifications_created = 0

        # Notificación mínima para el trainer demo.
        for trainer_profile in trainers:
            trainer_user = trainer_profile.user
            messages = [
                ('member1 tiene su plan activo y rutina lista para hoy.', 'system'),
            ]
            for msg, msg_type in messages:
                Notification.objects.get_or_create(
                    user=trainer_user,
                    message=msg,
                    defaults={'type': msg_type, 'read': False}
                )
                notifications_created += 1
            break  # Solo para el primer trainer

        for member in members:
            msgs = [
                ('Tu rutina de hoy ya está disponible para registrar.', 'system'),
            ]
            for msg, msg_type in msgs:
                Notification.objects.get_or_create(
                    user=member.user,
                    message=msg,
                    defaults={'type': msg_type, 'read': False}
                )
                notifications_created += 1

        self.stdout.write(f'  {notifications_created} Notifications creados.')
