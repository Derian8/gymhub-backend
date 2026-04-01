from django.core.exceptions import ObjectDoesNotExist

from users.services import get_active_plan, get_member_dashboard_summary, get_member_risk_snapshot


def _situacion_prescriptiva(risk_level, payment_status, days_since_last_checkin):
    if payment_status == 'late':
        return 'recuperacion_operativa'
    if days_since_last_checkin is None or days_since_last_checkin >= 14:
        return 'retomar_habito'
    if risk_level == 'high':
        return 'adherencia_fragil'
    if risk_level == 'medium':
        return 'construccion_de_consistencia'
    return 'progresion_sostenida'


def _recommended_days_per_week(risk_level, days_since_last_checkin):
    if days_since_last_checkin is None or days_since_last_checkin >= 14:
        return 2
    if risk_level == 'high':
        return 2
    if risk_level == 'medium':
        return 3
    return 4


def _default_calories(goal_type):
    defaults = {
        'fat_loss': {'min': 1700, 'max': 2100},
        'muscle_gain': {'min': 2200, 'max': 2800},
        'endurance': {'min': 2100, 'max': 2600},
        'flexibility': {'min': 1800, 'max': 2200},
        'general': {'min': 1800, 'max': 2300},
        'maintenance': {'min': 1900, 'max': 2400},
    }
    return defaults.get(goal_type or 'general', defaults['general'])


def get_member_prescription_summary(member):
    dashboard = get_member_dashboard_summary(member)
    risk = get_member_risk_snapshot(member)
    active_plan = get_active_plan(member)
    nutrition_profile = None
    if active_plan:
        try:
            nutrition_profile = active_plan.nutrition_profile
        except ObjectDoesNotExist:
            nutrition_profile = None

    suggested_goal = dashboard['nutrition_goal'] or (active_plan.goal if active_plan else 'general')
    suggested_days_per_week = _recommended_days_per_week(
        risk['nivel_riesgo'],
        risk['days_since_last_checkin'],
    )
    suggested_calories = _default_calories(suggested_goal)

    recomendaciones = []
    advertencias = []

    if risk['nivel_riesgo'] == 'high':
        recomendaciones.append('Empieza con una estructura simple de 2-3 días para maximizar adherencia.')
        advertencias.append('El miembro presenta riesgo alto; evita planes complejos o con demasiados días.')
    elif risk['nivel_riesgo'] == 'medium':
        recomendaciones.append('Usa progresión moderada y mantén el plan fácil de seguir semana a semana.')
    else:
        recomendaciones.append('Puedes proponer una progresión más exigente si el objetivo físico lo requiere.')

    if risk['payment_status'] == 'late':
        advertencias.append('Tiene pagos en mora; conviene confirmar continuidad antes de aumentar complejidad.')
    if risk['days_since_last_progress'] is None or risk['days_since_last_progress'] >= 21:
        advertencias.append('Falta progreso reciente; registra mediciones antes de subir carga o calorías.')
    if nutrition_profile is None:
        recomendaciones.append('Asocia una base nutricional para acompañar el objetivo del plan.')
    if risk['days_since_last_checkin'] is None or risk['days_since_last_checkin'] >= 10:
        recomendaciones.append('Prioriza reactivar hábito de asistencia antes de volumen alto de entrenamiento.')

    return {
        'situacion_prescriptiva': _situacion_prescriptiva(
            risk['nivel_riesgo'],
            risk['payment_status'],
            risk['days_since_last_checkin'],
        ),
        'riesgo_adherencia': risk['riesgo_adherencia'],
        'nivel_riesgo': risk['nivel_riesgo'],
        'motivos_riesgo': risk['motivos_riesgo'],
        'recommended_goal': suggested_goal,
        'recommended_days_per_week': suggested_days_per_week,
        'recommended_calories': suggested_calories,
        'recomendaciones': recomendaciones,
        'advertencias': advertencias,
        'active_plan_id': active_plan.id if active_plan else None,
        'active_nutrition_profile_id': nutrition_profile.id if nutrition_profile else None,
    }
