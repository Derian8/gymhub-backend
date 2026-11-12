from rest_framework.permissions import BasePermission


def tiene_perfil_entrenador(user):
    return bool(user and user.is_authenticated and hasattr(user, 'trainerprofile'))


def tiene_perfil_cliente(user):
    return bool(
        user
        and user.is_authenticated
        and not user.is_staff
        and hasattr(user, 'memberprofile')
    )


def usa_contexto_cliente(request):
    """Indica si la petición debe limitarse al perfil personal del cliente.

    Las cuentas de cliente quedan limitadas a su perfil personal. Las cuentas
    administrativas nunca usan este alcance, aunque tengan perfiles legados.
    """

    user = getattr(request, 'user', None)
    if not tiene_perfil_cliente(user):
        return False
    if (
        request.query_params.get('scope') == 'self'
        or request.headers.get('X-GymHub-Context') == 'cliente'
    ):
        return True
    return not user.is_staff and not tiene_perfil_entrenador(user)


class IsAdministrator(BasePermission):
    """Permite operaciones administrativas únicamente a cuentas staff."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_staff
        )


class IsTechnicalTrainer(BasePermission):
    """Compatibilidad temporal: las operaciones técnicas son administrativas."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_staff
        )


class IsTrainer(BasePermission):
    """Permite acceso administrativo; TrainerProfile es solo un vínculo técnico."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.is_staff
        )


class IsMember(BasePermission):
    """Permite acceso a cualquier cuenta con perfil de cliente."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and tiene_perfil_cliente(request.user)
        )


class IsOwnerOrTrainer(BasePermission):
    """Permite acceso al dueño del recurso o a cualquier trainer."""

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True
        # Check if obj has a member or user attribute
        if hasattr(obj, 'user'):
            return obj.user == request.user
        if hasattr(obj, 'member'):
            member = obj.member
            if hasattr(member, 'user'):
                return member.user == request.user
        return False


class IsOwnerOnly(BasePermission):
    """Permite acceso solo al dueño del recurso."""

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if hasattr(obj, 'user'):
            return obj.user == request.user
        if hasattr(obj, 'member'):
            member = obj.member
            if hasattr(member, 'user'):
                return member.user == request.user
        return False


class IsStaffOrTrainer(BasePermission):
    """Compatibilidad temporal para endpoints que ahora administra el staff."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.is_staff
