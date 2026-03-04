from datetime import date, timedelta

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import TrainingPlan, WorkoutDay, Exercise
from .serializers import (
    TrainingPlanSerializer, WorkoutDaySerializer,
    ExerciseSerializer, TodayWorkoutSerializer
)
from users.permissions import IsTrainer


def get_today_workout_day(plan):
    """Retorna el WorkoutDay correspondiente a hoy según la rotación del plan."""
    today = date.today()
    if plan.start_date > today:
        return None
    workout_days = list(plan.workout_days.order_by('order'))
    if not workout_days:
        return None
    days_elapsed = (today - plan.start_date).days
    day_index = days_elapsed % len(workout_days)
    return workout_days[day_index]


class TrainingPlanViewSet(viewsets.ModelViewSet):
    serializer_class = TrainingPlanSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'member':
            try:
                return TrainingPlan.objects.filter(member__user=user)
            except Exception:
                return TrainingPlan.objects.none()
        return TrainingPlan.objects.select_related('member__user', 'trainer__user').all()

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsTrainer()]
        return [IsAuthenticated()]

    @action(detail=True, methods=['get'], url_path='today-workout')
    def today_workout(self, request, pk=None):
        """GET /api/plans/{id}/today-workout/"""
        plan = self.get_object()
        workout_day = get_today_workout_day(plan)
        if not workout_day:
            return Response(
                {'message': 'No hay entrenamiento programado para hoy.'},
                status=status.HTTP_200_OK
            )
        serializer = TodayWorkoutSerializer(workout_day)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='weekly-view')
    def weekly_view(self, request, pk=None):
        """GET /api/plans/{id}/weekly-view/"""
        plan = self.get_object()
        workout_days = list(plan.workout_days.order_by('order'))

        if not workout_days:
            return Response({'week_days': []})

        from progress.models import WorkoutSession

        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        result = []

        for i in range(7):
            day_date = week_start + timedelta(days=i)
            days_elapsed = (day_date - plan.start_date).days if day_date >= plan.start_date else -1

            workout_day = None
            if days_elapsed >= 0:
                day_index = days_elapsed % len(workout_days)
                workout_day = workout_days[day_index]

            session = None
            is_completed = False
            if workout_day:
                session_qs = WorkoutSession.objects.filter(
                    member=plan.member,
                    workout_day=workout_day,
                    started_at__date=day_date
                ).first()
                if session_qs:
                    session = session_qs.id
                    is_completed = session_qs.is_completed

            result.append({
                'date': day_date,
                'workout_day_name': workout_day.name if workout_day else None,
                'session_id': session,
                'is_completed': is_completed,
            })

        return Response({'week_days': result})


class WorkoutDayViewSet(viewsets.ModelViewSet):
    serializer_class = WorkoutDaySerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'member':
            return WorkoutDay.objects.filter(plan__member__user=user)
        return WorkoutDay.objects.all()

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsTrainer()]
        return [IsAuthenticated()]


class ExerciseViewSet(viewsets.ModelViewSet):
    serializer_class = ExerciseSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'member':
            return Exercise.objects.filter(workout_day__plan__member__user=user)
        return Exercise.objects.all()

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsTrainer()]
        return [IsAuthenticated()]
