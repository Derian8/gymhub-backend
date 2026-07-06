import hashlib
import io
import logging
import time

from django.conf import settings
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied

from .services import build_member_charts, build_trainer_charts

logger = logging.getLogger(__name__)

CHART_CACHE_TIMEOUT = 6 * 3600  # 6 horas

VALID_CHART_TYPES = [
    'attendance_monthly',
    'retention_rate',
    'payment_status',
    'physical_progress',
    'exercise_progression',
]


def _load_matplotlib():
    import matplotlib

    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates

    return plt, mdates


def _save_chart(fig, chart_type, cache_key_hash):
    """Guarda la figura con el storage configurado y retorna su nombre."""
    plt, _ = _load_matplotlib()
    filename = f"{chart_type}_{cache_key_hash}_{int(time.time())}.png"
    buffer = io.BytesIO()
    fig.savefig(buffer, format='png', dpi=100, bbox_inches='tight')
    plt.close(fig)
    buffer.seek(0)
    return default_storage.save(
        f"charts/{filename}", ContentFile(buffer.getvalue())
    )


def generate_attendance_monthly(member):
    """Asistencias mensuales del miembro (últimos 6 meses)."""
    plt, _ = _load_matplotlib()
    from attendance.models import Attendance
    from datetime import date
    from collections import defaultdict

    attendances = Attendance.objects.filter(
        member=member
    ).order_by('check_in_time')

    monthly = defaultdict(int)
    for att in attendances:
        key = att.check_in_time.strftime('%Y-%m')
        monthly[key] += 1

    if not monthly:
        # Datos vacíos
        months = ['Sin datos']
        counts = [0]
    else:
        sorted_months = sorted(monthly.keys())[-6:]
        months = sorted_months
        counts = [monthly[m] for m in months]

    fig, ax = plt.subplots(figsize=(8, 5))
    ax.bar(months, counts, color='#4A90D9')
    ax.set_title(f'Asistencias Mensuales — {member.user.get_full_name() or member.user.email}')
    ax.set_xlabel('Mes')
    ax.set_ylabel('Asistencias')
    ax.tick_params(axis='x', rotation=45)
    fig.tight_layout()
    return fig


def generate_retention_rate():
    """Tasa de retención: miembros activos vs inactivos (últimos 6 meses)."""
    plt, _ = _load_matplotlib()
    from users.models import MemberProfile
    from attendance.models import Attendance
    from datetime import date, timedelta
    from collections import defaultdict

    monthly_active = defaultdict(set)
    monthly_total = defaultdict(set)

    for member in MemberProfile.objects.filter(is_active=True):
        for att in Attendance.objects.filter(member=member):
            month = att.check_in_time.strftime('%Y-%m')
            monthly_active[month].add(member.id)
            monthly_total[month].add(member.id)

    months = sorted(monthly_total.keys())[-6:] if monthly_total else ['Sin datos']
    rates = [
        round(len(monthly_active[m]) / len(monthly_total[m]) * 100, 1) if monthly_total.get(m) else 0
        for m in months
    ]

    fig, ax = plt.subplots(figsize=(8, 5))
    ax.plot(months, rates, marker='o', color='#2ECC71', linewidth=2)
    ax.set_title('Tasa de Retención Mensual (%)')
    ax.set_xlabel('Mes')
    ax.set_ylabel('Retención (%)')
    ax.set_ylim(0, 110)
    ax.tick_params(axis='x', rotation=45)
    fig.tight_layout()
    return fig


def generate_payment_status():
    """Distribución del estado de pagos (pie chart)."""
    plt, _ = _load_matplotlib()
    from billing.models import PaymentRecord
    from collections import Counter

    statuses = list(PaymentRecord.objects.values_list('status', flat=True))
    counts = Counter(statuses)

    labels = [s.capitalize() for s in counts.keys()]
    values = list(counts.values())
    colors = {'paid': '#2ECC71', 'pending': '#F39C12', 'late': '#E74C3C'}
    chart_colors = [colors.get(s, '#95A5A6') for s in counts.keys()]

    fig, ax = plt.subplots(figsize=(7, 7))
    if values:
        ax.pie(values, labels=labels, colors=chart_colors, autopct='%1.1f%%', startangle=140)
    else:
        ax.text(0.5, 0.5, 'Sin datos', ha='center', va='center', transform=ax.transAxes)
    ax.set_title('Estado de Pagos')
    fig.tight_layout()
    return fig


def generate_physical_progress(member):
    """Progresión física: peso, grasa corporal, masa muscular."""
    plt, _ = _load_matplotlib()
    from progress.models import ProgressLog

    logs = ProgressLog.objects.filter(member=member).order_by('recorded_at')

    if not logs.exists():
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.text(0.5, 0.5, 'Sin datos de progreso', ha='center', va='center', transform=ax.transAxes)
        ax.set_title('Progreso Físico')
        return fig

    dates = [log.recorded_at.date() for log in logs]
    weights = [log.weight_kg for log in logs]
    body_fat = [log.body_fat_pct for log in logs]

    fig, ax1 = plt.subplots(figsize=(10, 6))
    ax1.plot(dates, weights, marker='o', color='#3498DB', label='Peso (kg)', linewidth=2)
    ax1.set_xlabel('Fecha')
    ax1.set_ylabel('Peso (kg)', color='#3498DB')
    ax1.tick_params(axis='y', labelcolor='#3498DB')

    if any(b is not None for b in body_fat):
        ax2 = ax1.twinx()
        ax2.plot(dates, body_fat, marker='s', color='#E74C3C', label='Grasa (%)', linewidth=2)
        ax2.set_ylabel('Grasa corporal (%)', color='#E74C3C')
        ax2.tick_params(axis='y', labelcolor='#E74C3C')

    ax1.set_title(f'Progreso Físico — {member.user.get_full_name() or member.user.email}')
    ax1.tick_params(axis='x', rotation=45)
    fig.tight_layout()
    return fig


def generate_exercise_progression(member, exercise):
    """Progresión de peso en un ejercicio específico."""
    plt, _ = _load_matplotlib()
    from progress.models import ExerciseLog

    logs = ExerciseLog.objects.filter(
        exercise=exercise,
        session__member=member,
        session__is_completed=True,
    ).select_related('session').order_by('session__started_at')

    if not logs.exists():
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.text(0.5, 0.5, 'Sin datos de progresión', ha='center', va='center', transform=ax.transAxes)
        ax.set_title(f'Progresión — {exercise.name}')
        return fig

    dates = [log.session.started_at.date() for log in logs]
    weights = [log.weight_used_kg or 0 for log in logs]

    fig, ax = plt.subplots(figsize=(10, 6))
    ax.plot(dates, weights, marker='o', color='#9B59B6', linewidth=2)
    ax.fill_between(range(len(dates)), weights, alpha=0.2, color='#9B59B6')
    ax.set_xticks(range(len(dates)))
    ax.set_xticklabels([str(d) for d in dates], rotation=45, ha='right')
    ax.set_xlabel('Fecha')
    ax.set_ylabel('Peso usado (kg)')
    ax.set_title(f'Progresión: {exercise.name} — {member.user.get_full_name() or member.user.email}')
    fig.tight_layout()
    return fig


class ChartView(APIView):
    """GET /api/charts/{chart_type}/?member_id={id}&exercise_id={id}"""
    permission_classes = [IsAuthenticated]

    def get(self, request, chart_type):
        if chart_type not in VALID_CHART_TYPES:
            return Response(
                {'error': f'Tipo de gráfica inválido. Opciones: {VALID_CHART_TYPES}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        member_id = request.query_params.get('member_id')
        exercise_id = request.query_params.get('exercise_id')

        # Validación específica por tipo
        if chart_type == 'exercise_progression' and not exercise_id:
            return Response(
                {'error': 'Se requiere exercise_id para exercise_progression.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Construir cache key
        cache_key = f"chart_{chart_type}_{member_id or 'all'}_{exercise_id or 'none'}"
        cache_hash = hashlib.md5(cache_key.encode()).hexdigest()[:12]
        full_cache_key = f"gymhub_chart_{cache_hash}"

        # Verificar cache
        cached_result = cache.get(full_cache_key)
        if cached_result:
            return Response({
                'chart_url': request.build_absolute_uri(default_storage.url(cached_result['path'])),
                'generated_at': cached_result['generated_at'],
                'cached': True,
            })

        # Generar gráfica
        try:
            member = None
            if member_id:
                from users.models import MemberProfile
                try:
                    member = MemberProfile.objects.get(id=member_id)
                except MemberProfile.DoesNotExist:
                    return Response({'error': 'Miembro no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

            if chart_type == 'attendance_monthly':
                if not member:
                    return Response({'error': 'Se requiere member_id.'}, status=status.HTTP_400_BAD_REQUEST)
                fig = generate_attendance_monthly(member)

            elif chart_type == 'retention_rate':
                fig = generate_retention_rate()

            elif chart_type == 'payment_status':
                fig = generate_payment_status()

            elif chart_type == 'physical_progress':
                if not member:
                    return Response({'error': 'Se requiere member_id.'}, status=status.HTTP_400_BAD_REQUEST)
                fig = generate_physical_progress(member)

            elif chart_type == 'exercise_progression':
                if not member:
                    return Response({'error': 'Se requiere member_id.'}, status=status.HTTP_400_BAD_REQUEST)
                from plans.models import Exercise
                try:
                    exercise = Exercise.objects.get(id=exercise_id)
                except Exercise.DoesNotExist:
                    return Response({'error': 'Ejercicio no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
                fig = generate_exercise_progression(member, exercise)

            # Guardar PNG
            from datetime import datetime
            generated_at = datetime.now().isoformat()
            chart_path = _save_chart(fig, chart_type, cache_hash)

            # Guardar en cache
            cache.set(full_cache_key, {
                'path': chart_path,
                'generated_at': generated_at,
            }, timeout=CHART_CACHE_TIMEOUT)

            return Response({
                'chart_url': request.build_absolute_uri(default_storage.url(chart_path)),
                'generated_at': generated_at,
                'cached': False,
            })

        except (OSError, RuntimeError, ValueError) as exc:
            logger.exception(
                'Fallo al generar chart_type=%s member_id=%s exercise_id=%s',
                chart_type,
                member_id,
                exercise_id,
            )
            return Response(
                {'error': 'Error al generar gráfica.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ChartOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from users.models import MemberProfile
        from users.views import _get_trainer_profile

        user = request.user
        if user.role == 'member':
            try:
                member = MemberProfile.objects.select_related(
                    'user', 'trainer_asignado__user', 'membership_plan'
                ).get(user=user)
            except MemberProfile.DoesNotExist:
                return Response({'error': 'Perfil de member no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
            return Response(build_member_charts(member))

        if user.role == 'trainer':
            trainer_profile = _get_trainer_profile(user)
            return Response(build_trainer_charts(trainer_profile, user))

        if user.is_staff:
            member_id = request.query_params.get('member_id')
            if not member_id:
                return Response({'error': 'Para staff se requiere member_id.'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                member = MemberProfile.objects.select_related(
                    'user', 'trainer_asignado__user', 'membership_plan'
                ).get(id=member_id)
            except MemberProfile.DoesNotExist:
                return Response({'error': 'Perfil de member no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
            return Response(build_member_charts(member))

        raise PermissionDenied('No tienes permisos para ver analytics.')
