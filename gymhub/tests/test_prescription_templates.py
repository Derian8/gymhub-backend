import pytest
from rest_framework import status


@pytest.mark.django_db
class TestPrescriptionTemplates:
    def test_member_prescription_summary_returns_recommendations(self, trainer_client, member_profile):
        response = trainer_client.get(f'/api/members/{member_profile.id}/prescription-summary/')

        assert response.status_code == status.HTTP_200_OK
        assert 'situacion_prescriptiva' in response.data
        assert 'recomendaciones' in response.data
        assert 'advertencias' in response.data
        assert 'recommended_days_per_week' in response.data

    def test_active_prescription_returns_only_active_plan_data(self, member_client, training_plan):
        from nutrition.models import NutritionGuideline, NutritionProfile, PlanNutritionLink

        profile = NutritionProfile.objects.create(
            training_plan=training_plan,
            goal_type='muscle_gain',
            calorie_range_min=2400,
            calorie_range_max=2800,
            protein_focus='160g diarios',
            carb_strategy='Alto',
            hydration_recommendation='3 litros',
        )
        guideline = NutritionGuideline.objects.create(
            goal_type='muscle_gain',
            title='Prioriza proteina',
            description='Incluye proteína magra en cada comida.',
        )
        PlanNutritionLink.objects.create(plan=training_plan, guideline=guideline, priority_order=1)

        response = member_client.get(f'/api/members/{training_plan.member_id}/active-prescription/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['plan_activo']['id'] == training_plan.id
        assert len(response.data['dias']) == training_plan.workout_days.count()
        assert response.data['perfil_nutricional']['id'] == profile.id
        assert len(response.data['guias_vinculadas']) == 1
        assert response.data['estado_prescripcion']['esta_lista_para_member'] is True

    def test_training_plan_is_ready_without_nutrition(self, member_client, training_plan):
        response = member_client.get(f'/api/members/{training_plan.member_id}/active-prescription/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['perfil_nutricional'] is None
        assert response.data['guias_vinculadas'] == []
        assert response.data['estado_prescripcion']['tiene_dias'] is True
        assert response.data['estado_prescripcion']['tiene_ejercicios'] is True
        assert response.data['estado_prescripcion']['esta_lista_para_member'] is True
        assert response.data['estado_prescripcion']['estado'] == 'lista'

    def test_training_plan_requires_days_and_exercises(self, training_plan):
        from users.services import get_member_prescription_status

        member = training_plan.member
        for day in training_plan.workout_days.all():
            day.exercises.all().delete()

        status_without_exercises = get_member_prescription_status(member)
        assert status_without_exercises['tiene_dias'] is True
        assert status_without_exercises['tiene_ejercicios'] is False
        assert status_without_exercises['esta_lista_para_member'] is False

        training_plan.workout_days.all().delete()
        status_without_days = get_member_prescription_status(member)
        assert status_without_days['tiene_dias'] is False
        assert status_without_days['esta_lista_para_member'] is False

    def test_missing_nutrition_does_not_increase_member_risk(self, training_plan):
        from users.services import get_member_risk_snapshot

        risk = get_member_risk_snapshot(training_plan.member)

        assert 'Su prescripción activa está incompleta' not in risk['motivos_riesgo']

    def test_trainer_can_save_training_plan_as_template(self, trainer_client, training_plan):
        response = trainer_client.post(
            f'/api/plans/{training_plan.id}/save-as-template/',
            {
                'nombre': 'Base recomposicion',
                'descripcion': 'Plantilla para miembros que retoman ritmo.',
                'nivel_adherencia_recomendado': 'medium',
            },
            format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['nombre'] == 'Base recomposicion'
        assert response.data['dias']
        assert response.data['dias'][0]['ejercicios']

    def test_trainer_can_apply_training_template_to_assigned_member(self, trainer_client, trainer_profile, member_profile):
        from plans.models import PlantillaDiaEntrenamiento, PlantillaEjercicio, PlantillaEntrenamiento, TrainingPlan

        plantilla = PlantillaEntrenamiento.objects.create(
            trainer=trainer_profile,
            nombre='Base consistencia',
            objetivo='fat_loss',
            nivel_adherencia_recomendado='medium',
            dias_por_semana_sugeridos=3,
        )
        dia = PlantillaDiaEntrenamiento.objects.create(
            plantilla=plantilla,
            nombre='Full body',
            etiqueta_dia='A',
            orden=0,
        )
        PlantillaEjercicio.objects.create(
            dia=dia,
            nombre='Sentadilla goblet',
            grupo_muscular='legs',
            series=3,
            rango_repeticiones='10-12',
            descanso_segundos=75,
            orden=0,
        )

        response = trainer_client.post(
            f'/api/plan-templates/{plantilla.id}/apply/',
            {'member_id': member_profile.id},
            format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED
        plan = TrainingPlan.objects.get(id=response.data['id'])
        assert plan.member == member_profile
        assert plan.workout_days.count() == 1
        assert plan.workout_days.first().exercises.count() == 1

    def test_trainer_can_update_own_training_template(self, trainer_client, trainer_profile):
        from plans.models import PlantillaEntrenamiento

        plantilla = PlantillaEntrenamiento.objects.create(
            trainer=trainer_profile,
            nombre='Base original',
            descripcion='Descripcion inicial',
            objetivo='general',
            nivel_adherencia_recomendado='low',
            dias_por_semana_sugeridos=2,
            esta_activa=True,
        )

        response = trainer_client.patch(
            f'/api/plan-templates/{plantilla.id}/',
            {
                'nombre': 'Base ajustada',
                'descripcion': 'Descripcion actualizada',
                'objetivo': 'fat_loss',
                'nivel_adherencia_recomendado': 'medium',
                'dias_por_semana_sugeridos': 3,
                'esta_activa': False,
            },
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        plantilla.refresh_from_db()
        assert plantilla.nombre == 'Base ajustada'
        assert plantilla.descripcion == 'Descripcion actualizada'
        assert plantilla.objetivo == 'fat_loss'
        assert plantilla.nivel_adherencia_recomendado == 'medium'
        assert plantilla.dias_por_semana_sugeridos == 3
        assert plantilla.esta_activa is False

    def test_trainer_can_delete_own_training_template(self, trainer_client, trainer_profile):
        from plans.models import PlantillaEntrenamiento

        plantilla = PlantillaEntrenamiento.objects.create(
            trainer=trainer_profile,
            nombre='Base para borrar',
            objetivo='general',
            nivel_adherencia_recomendado='medium',
            dias_por_semana_sugeridos=3,
        )

        response = trainer_client.delete(f'/api/plan-templates/{plantilla.id}/')

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert PlantillaEntrenamiento.objects.filter(id=plantilla.id).exists() is False

    def test_trainer_can_refresh_template_from_active_plan(self, trainer_client, trainer_profile, training_plan):
        from plans.models import PlantillaDiaEntrenamiento, PlantillaEjercicio, PlantillaEntrenamiento

        plantilla = PlantillaEntrenamiento.objects.create(
            trainer=trainer_profile,
            nombre='Base desactualizada',
            descripcion='Debe reemplazarse',
            objetivo='general',
            nivel_adherencia_recomendado='medium',
            dias_por_semana_sugeridos=2,
        )
        dia_plantilla = PlantillaDiaEntrenamiento.objects.create(
            plantilla=plantilla,
            nombre='Viejo dia',
            etiqueta_dia='A',
            orden=0,
        )
        PlantillaEjercicio.objects.create(
            dia=dia_plantilla,
            nombre='Ejercicio viejo',
            grupo_muscular='legs',
            series=2,
            rango_repeticiones='12-15',
            descanso_segundos=60,
            orden=0,
        )

        response = trainer_client.post(
            f'/api/plan-templates/{plantilla.id}/refresh-from-plan/',
            {'plan_id': training_plan.id},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        plantilla.refresh_from_db()
        assert plantilla.objetivo == training_plan.goal
        assert plantilla.dias_por_semana_sugeridos == training_plan.days_per_week
        assert plantilla.dias.count() == training_plan.workout_days.count()
        primer_dia = plantilla.dias.order_by('orden').first()
        primer_dia_plan = training_plan.workout_days.order_by('order').first()
        assert primer_dia.nombre == primer_dia_plan.name
        assert primer_dia.ejercicios.count() == primer_dia_plan.exercises.count()
        assert primer_dia.ejercicios.filter(nombre='Ejercicio viejo').exists() is False

    def test_trainer_can_save_nutrition_profile_as_template(self, trainer_client, training_plan):
        from nutrition.models import NutritionProfile

        profile = NutritionProfile.objects.create(
            training_plan=training_plan,
            goal_type='fat_loss',
            calorie_range_min=1700,
            calorie_range_max=2100,
            protein_focus='140g diarios',
            carb_strategy='Moderado',
            hydration_recommendation='3 litros',
        )

        response = trainer_client.post(
            f'/api/nutrition-profiles/{profile.id}/save-as-template/',
            {
                'nombre': 'Base nutricional deficit',
                'descripcion': 'Perfil para miembros con objetivo de perdida de grasa.',
                'nivel_adherencia_recomendado': 'medium',
            },
            format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['nombre'] == 'Base nutricional deficit'
        assert response.data['goal_type'] == 'fat_loss'

    def test_trainer_can_apply_nutrition_template_to_assigned_plan(self, trainer_client, trainer_profile, training_plan):
        from nutrition.models import NutritionProfile, PlantillaNutricion

        template = PlantillaNutricion.objects.create(
            trainer=trainer_profile,
            nombre='Base nutricional trainer',
            goal_type='fat_loss',
            nivel_adherencia_recomendado='medium',
            calorie_range_min=1700,
            calorie_range_max=2100,
            protein_focus='140g diarios',
            carb_strategy='Moderado',
            hydration_recommendation='3 litros',
        )

        response = trainer_client.post(
            f'/api/nutrition-templates/{template.id}/apply/',
            {'training_plan_id': training_plan.id},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        profile = NutritionProfile.objects.get(training_plan=training_plan)
        assert profile.goal_type == 'fat_loss'
        assert profile.calorie_range_min == 1700

    def test_trainer_can_delete_own_nutrition_template(self, trainer_client, trainer_profile):
        from nutrition.models import PlantillaNutricion

        template = PlantillaNutricion.objects.create(
            trainer=trainer_profile,
            nombre='Base nutricional para borrar',
            goal_type='fat_loss',
            nivel_adherencia_recomendado='medium',
            calorie_range_min=1700,
            calorie_range_max=2100,
        )

        response = trainer_client.delete(f'/api/nutrition-templates/{template.id}/')

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert PlantillaNutricion.objects.filter(id=template.id).exists() is False

    def test_trainer_cannot_apply_nutrition_template_to_foreign_member(self, trainer_client, trainer_profile, membership_plan):
        from datetime import date
        from django.contrib.auth import get_user_model
        from nutrition.models import PlantillaNutricion
        from plans.models import TrainingPlan
        from users.models import MemberProfile

        User = get_user_model()
        other_trainer_user = User.objects.create_user(
            username='other_trainer',
            email='other_trainer@test.com',
            password='trainer123!',
            role='trainer',
        )
        other_trainer = other_trainer_user.trainerprofile
        foreign_member_user = User.objects.create_user(
            username='foreign_member',
            email='foreign_member@test.com',
            password='member123!',
            role='member',
        )
        foreign_member = foreign_member_user.memberprofile
        foreign_member.trainer_asignado = other_trainer
        foreign_member.membership_plan = membership_plan
        foreign_member.join_date = date.today()
        foreign_member.is_active = True
        foreign_member.save()
        foreign_plan = TrainingPlan.objects.create(
            member=foreign_member,
            trainer=other_trainer,
            name='Plan externo',
            goal='general',
            start_date=date.today(),
            weeks_duration=8,
            days_per_week=3,
            is_active=True,
        )
        template = PlantillaNutricion.objects.create(
            trainer=trainer_profile,
            nombre='Base nutricional trainer',
            goal_type='fat_loss',
            nivel_adherencia_recomendado='medium',
            calorie_range_min=1700,
            calorie_range_max=2100,
        )

        response = trainer_client.post(
            f'/api/nutrition-templates/{template.id}/apply/',
            {'training_plan_id': foreign_plan.id},
            format='json',
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
