from django.core.exceptions import ObjectDoesNotExist


def user_can_manage_member_progress(user, member):
    if not user.is_authenticated:
        return False
    if user.is_staff:
        return True
    try:
        trainer_profile = user.trainerprofile
    except ObjectDoesNotExist:
        return False
    return member.trainer_asignado_id == trainer_profile.id


def build_member_physical_summary(member):
    logs = list(member.progress_logs.order_by('-recorded_at', '-id')[:2])
    latest = logs[0] if logs else None
    previous = logs[1] if len(logs) > 1 else None

    current_weight = latest.weight_kg if latest else None
    previous_weight = previous.weight_kg if previous else None
    current_height = latest.height_cm if latest else None

    bmi = None
    if current_weight is not None and current_height not in (None, 0):
        height_m = current_height / 100
        bmi = round(current_weight / (height_m * height_m), 1)

    return {
        'latest_log_id': latest.id if latest else None,
        'latest_recorded_at': latest.recorded_at if latest else None,
        'current_weight_kg': current_weight,
        'previous_weight_kg': previous_weight,
        'weight_change_kg': round(current_weight - previous_weight, 1)
        if current_weight is not None and previous_weight is not None else None,
        'height_cm': current_height,
        'body_fat_pct': latest.body_fat_pct if latest else None,
        'muscle_mass_kg': latest.muscle_mass_kg if latest else None,
        'waist_cm': latest.waist_cm if latest else None,
        'bmi': bmi,
        'notes': latest.notes if latest else '',
    }
