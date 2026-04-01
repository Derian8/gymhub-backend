"""
test_charts.py — Tests de generación de gráficas con Matplotlib.
"""
import os
import pytest
from rest_framework import status
from unittest.mock import patch


@pytest.mark.django_db
class TestCharts:
    def test_member_chart_overview_returns_personal_metrics(self, member_client, member_profile, payment_schedule_and_record, attendance_record, training_plan):
        from progress.models import ProgressLog, WorkoutSession

        ProgressLog.objects.create(member=member_profile, weight_kg=80, body_fat_pct=18, waist_cm=83)
        WorkoutSession.objects.create(member=member_profile, workout_day=training_plan.workout_days.first(), is_completed=True)

        resp = member_client.get('/api/charts/overview/')

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['role'] == 'member'
        assert 'physical_progress' in resp.data
        assert 'attendance_weekly' in resp.data
        assert 'insights' in resp.data

    def test_trainer_chart_overview_returns_assigned_members_aggregate(self, trainer_client, member_profile, payment_schedule_and_record):
        resp = trainer_client.get('/api/charts/overview/')

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['role'] == 'trainer'
        assert 'risk_distribution' in resp.data
        assert 'payment_distribution' in resp.data
        assert 'top_risk_members' in resp.data

    def test_exercise_progression_without_exercise_id_returns_400(
        self, trainer_client, member_profile
    ):
        """GET /api/charts/exercise_progression/ sin exercise_id → 400."""
        resp = trainer_client.get(
            f'/api/charts/exercise_progression/?member_id={member_profile.id}'
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert 'exercise_id' in str(resp.data).lower()

    def test_invalid_chart_type_returns_400(self, trainer_client):
        resp = trainer_client.get('/api/charts/invalid_type/')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_payment_status_chart_generates_png(self, trainer_client):
        """payment_status chart → genera PNG y retorna URL absoluta."""
        resp = trainer_client.get('/api/charts/payment_status/')
        assert resp.status_code == status.HTTP_200_OK
        assert 'chart_url' in resp.data
        assert 'generated_at' in resp.data
        # URL debe ser absoluta (empieza con http)
        assert resp.data['chart_url'].startswith('http')
        # Verificar que el archivo PNG existe
        from django.conf import settings
        chart_url = resp.data['chart_url']
        # Extraer la ruta del archivo
        media_url_prefix = settings.MEDIA_URL
        if media_url_prefix in chart_url:
            relative_path = chart_url.split(media_url_prefix)[1]
            filepath = os.path.join(settings.MEDIA_ROOT, relative_path)
            assert os.path.exists(filepath), f"PNG no encontrado en: {filepath}"

    def test_chart_cache_hit_on_second_request(self, trainer_client):
        """2da solicitud dentro de 6h retorna cached=True."""
        # Primera solicitud
        resp1 = trainer_client.get('/api/charts/payment_status/')
        assert resp1.status_code == status.HTTP_200_OK
        assert resp1.data.get('cached') is False

        # Segunda solicitud (misma)
        resp2 = trainer_client.get('/api/charts/payment_status/')
        assert resp2.status_code == status.HTTP_200_OK
        assert resp2.data.get('cached') is True
        # Misma URL
        assert resp1.data['chart_url'] == resp2.data['chart_url']

    def test_retention_rate_chart_accessible(self, trainer_client):
        resp = trainer_client.get('/api/charts/retention_rate/')
        assert resp.status_code == status.HTTP_200_OK
        assert 'chart_url' in resp.data

    def test_attendance_monthly_requires_member_id(self, trainer_client):
        resp = trainer_client.get('/api/charts/attendance_monthly/')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_physical_progress_with_member_id(self, trainer_client, member_profile):
        resp = trainer_client.get(
            f'/api/charts/physical_progress/?member_id={member_profile.id}'
        )
        assert resp.status_code == status.HTTP_200_OK

    def test_exercise_progression_full(
        self, trainer_client, member_profile, bench_exercise
    ):
        """exercise_progression con member_id y exercise_id → 200."""
        resp = trainer_client.get(
            f'/api/charts/exercise_progression/?member_id={member_profile.id}&exercise_id={bench_exercise.id}'
        )
        assert resp.status_code == status.HTTP_200_OK
        assert 'chart_url' in resp.data
