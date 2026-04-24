from .models import AuditLog


def registrar_auditoria(usuario, action_type, target_model, target_id, request=None, details=None):
    ip_address = None
    if request is not None:
        forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if forwarded_for:
            ip_address = forwarded_for.split(',')[0].strip()
        else:
            ip_address = request.META.get('REMOTE_ADDR')

    return AuditLog.objects.create(
        user=usuario,
        action_type=action_type,
        target_model=target_model,
        target_id=str(target_id),
        ip_address=ip_address,
        details=details or {},
    )
