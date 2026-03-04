from rest_framework.permissions import BasePermission


class IsTrainer(BasePermission):
    """Permite acceso solo a usuarios con role=='trainer'."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', None) == 'trainer'
        )


class IsMember(BasePermission):
    """Permite acceso solo a usuarios con role=='member'."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', None) == 'member'
        )


class IsOwnerOrTrainer(BasePermission):
    """Permite acceso al dueño del recurso o a cualquier trainer."""

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == 'trainer':
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
        return request.user.is_staff or getattr(request.user, 'role', None) == 'trainer'
