from rest_framework.permissions import BasePermission


def tiene_perfil_entrenador(user):
    return bool(user and user.is_authenticated and hasattr(user, 'trainerprofile'))


def tiene_perfil_cliente(user):
    return bool(user and user.is_authenticated and hasattr(user, 'memberprofile'))


def usa_contexto_cliente(request):
    """Indica si la petición debe limitarse al perfil personal del cliente.

    Las cuentas con varios perfiles envían ``scope=self`` desde el dashboard
    de cliente. Para una cuenta que solo es cliente, ese alcance es el valor
    seguro por defecto aunque el parámetro no esté presente.
    """

    user = getattr(request, 'user', None)
    if not tiene_perfil_cliente(user):
        return False
    if request.query_params.get('scope') == 'self':
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
    """Permite operaciones técnicas a trainers, sin incluir administradores."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and not request.user.is_staff
            and tiene_perfil_entrenador(request.user)
        )


class IsTrainer(BasePermission):
    """Permite acceso a trainers y personal administrativo."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and (
                request.user.is_staff
                or tiene_perfil_entrenador(request.user)
            )
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
        if request.user.is_staff or tiene_perfil_entrenador(request.user):
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
    """Permite acceso a staff (is_staff) o trainers. Usado en /auth/register/
    para proteger la asignación de role='trainer'."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.is_staff or tiene_perfil_entrenador(request.user)
