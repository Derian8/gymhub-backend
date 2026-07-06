from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from django.middleware.csrf import get_token
from django.db.models import Q, Case, When, IntegerField
from django.utils import timezone
from rest_framework import status, viewsets, filters
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.authentication import SessionAuthentication
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from progress.services import build_member_physical_summary
from .models import MemberProfile, TrainerProfile
from .audit import registrar_auditoria
from .permissions import IsStaffOrTrainer, IsTrainer, IsMember
from .serializers import (
    UserSerializer, RegisterSerializer, LoginSerializer, MeUpdateSerializer,
    MemberProfileSerializer, TrainerProfileSerializer, AuditLogSerializer
)
from .prescription_services import get_member_prescription_summary
from .services import (
    annotate_member_metrics,
    get_active_prescription,
    get_member_dashboard_summary,
    get_member_prescription_status,
    get_member_risk_snapshot,
    get_trainer_overview,
)

User = get_user_model()


class LoginThrottle(AnonRateThrottle):
    rate = '10/min'
    scope = 'login'


class RegisterThrottle(AnonRateThrottle):
    scope = 'register'


class RefreshThrottle(AnonRateThrottle):
    scope = 'refresh'


def _enforce_csrf(request):
    if request.META.get('HTTP_AUTHORIZATION'):
        return
    SessionAuthentication().enforce_csrf(request)


def _get_trainer_profile(user):
    if getattr(user, 'role', None) != 'trainer' and not user.is_staff:
        raise PermissionDenied('Esta operación requiere un perfil de trainer.')
    try:
        return user.trainerprofile
    except ObjectDoesNotExist as exc:
        raise PermissionDenied('Perfil de trainer no encontrado.') from exc


def _set_auth_cookies(response, refresh_token):
    access_token = str(refresh_token.access_token)
    refresh_str = str(refresh_token)

    cookie_opts = {
        'httponly': True,
        'samesite': settings.AUTH_COOKIE_SAMESITE,
        'secure': settings.AUTH_COOKIE_SECURE,
        'path': settings.AUTH_COOKIE_PATH,
    }
    if settings.AUTH_COOKIE_DOMAIN:
        cookie_opts['domain'] = settings.AUTH_COOKIE_DOMAIN
    response.set_cookie(
        settings.ACCESS_TOKEN_COOKIE_NAME, access_token,
        max_age=int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
        **cookie_opts
    )
    response.set_cookie(
        settings.REFRESH_TOKEN_COOKIE_NAME, refresh_str,
        max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        **cookie_opts
    )


def _clear_auth_cookies(response):
    delete_opts = {
        'path': settings.AUTH_COOKIE_PATH,
        'samesite': settings.AUTH_COOKIE_SAMESITE,
    }
    if settings.AUTH_COOKIE_DOMAIN:
        delete_opts['domain'] = settings.AUTH_COOKIE_DOMAIN
    response.delete_cookie(settings.ACCESS_TOKEN_COOKIE_NAME, **delete_opts)
    response.delete_cookie(settings.REFRESH_TOKEN_COOKIE_NAME, **delete_opts)


class RegisterView(APIView):
    """
    POST /auth/register/
    Registro público para miembros.
    Registro de trainers requiere IsStaffOrTrainer (protegido).
    """
    permission_classes = []
    throttle_classes = [RegisterThrottle]

    def post(self, request):
        _enforce_csrf(request)
        role = request.data.get('role', 'member')

        # Proteger asignación de role='trainer' con IsStaffOrTrainer
        if role == 'trainer':
            if not request.user or not request.user.is_authenticated:
                return Response(
                    {'error': 'Debes estar autenticado para registrar un trainer.'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            perm = IsStaffOrTrainer()
            if not perm.has_permission(request, self):
                return Response(
                    {'error': 'Solo staff o trainers pueden registrar otros trainers.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        response = Response(
            {'user': UserSerializer(user).data, 'message': 'Registro exitoso.'},
            status=status.HTTP_201_CREATED
        )
        _set_auth_cookies(response, refresh)
        return response


class LoginView(APIView):
    """POST /auth/login/ — Devuelve tokens en httpOnly cookies."""
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        _enforce_csrf(request)
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email']
        password = serializer.validated_data['password']

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response(
                {'error': 'Credenciales inválidas.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.check_password(password) or not user.is_active:
            return Response(
                {'error': 'Credenciales inválidas.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        refresh = RefreshToken.for_user(user)
        response = Response({
            'user': UserSerializer(user).data,
            'message': 'Login exitoso.',
        })
        _set_auth_cookies(response, refresh)
        return response


class LogoutView(APIView):
    """POST /auth/logout/ — Blacklist el refresh token y limpia cookies."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.COOKIES.get(settings.REFRESH_TOKEN_COOKIE_NAME)
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except (TokenError, Exception):
                pass

        response = Response({'message': 'Logout exitoso.'})
        _clear_auth_cookies(response)
        return response


class TokenRefreshCookieView(APIView):
    """POST /auth/token/refresh/ — Renueva access token desde cookie."""
    permission_classes = [AllowAny]
    throttle_classes = [RefreshThrottle]

    def post(self, request):
        _enforce_csrf(request)
        refresh_token = request.COOKIES.get(settings.REFRESH_TOKEN_COOKIE_NAME)
        if not refresh_token:
            return Response(
                {'error': 'No refresh token found.'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        try:
            token = RefreshToken(refresh_token)
            user = User.objects.get(id=token['user_id'], is_active=True)
            new_refresh = RefreshToken.for_user(user)
            token.blacklist()
        except TokenError:
            return Response(
                {'error': 'Token inválido o expirado.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        except User.DoesNotExist:
            return Response(
                {'error': 'Usuario inválido o inactivo.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        response = Response({'message': 'Token renovado.'})
        _set_auth_cookies(response, new_refresh)
        return response


class CsrfTokenView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = []

    def get(self, request):
        return Response({'csrf_token': get_token(request)})


class MeView(APIView):
    """GET /auth/me/ — Perfil del usuario autenticado."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        payload = {
            key: value
            for key, value in request.data.items()
            if key in {'email', 'username', 'first_name', 'last_name'}
        }
        serializer = MeUpdateSerializer(request.user, data=payload, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        user = serializer.save()
        return Response(UserSerializer(user).data)


class MemberViewSet(viewsets.ModelViewSet):
    """
    /api/members/ — CRUD de perfiles de miembros.
    Filtros: ?search= ?payment_status= ?inactivity=
    """
    serializer_class = MemberProfileSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['user__email', 'user__first_name', 'user__last_name', 'phone']

    def get_queryset(self):
        user = self.request.user
        qs = annotate_member_metrics(MemberProfile.objects.select_related(
            'user', 'membership_plan', 'trainer_asignado__user'
        ).order_by('id'))

        # Members solo ven su propio perfil
        if user.role == 'member' and not user.is_staff:
            return qs.filter(user=user)

        if user.role == 'trainer' and not user.is_staff:
            trainer_profile = _get_trainer_profile(user)
            if self.action == 'assign_trainer':
                qs = qs.filter(
                    Q(trainer_asignado=trainer_profile)
                    | Q(trainer_asignado__isnull=True)
                )
            else:
                qs = qs.filter(trainer_asignado=trainer_profile)

        # Filtros adicionales para trainers/staff
        payment_status = self.request.query_params.get('payment_status')
        inactivity = self.request.query_params.get('inactivity')
        risk_level = self.request.query_params.get('risk_level')
        prescription_status = self.request.query_params.get('prescription_status')
        ordering = self.request.query_params.get('ordering')

        if payment_status:
            from billing.models import PaymentRecord
            member_ids = PaymentRecord.objects.filter(
                status=payment_status
            ).values_list('schedule__member_id', flat=True).distinct()
            qs = qs.filter(id__in=member_ids)

        if inactivity == 'true':
            from attendance.models import Attendance
            from datetime import date, timedelta
            cutoff = date.today() - timedelta(days=settings.INACTIVITY_DAYS_THRESHOLD)
            active_member_ids = Attendance.objects.filter(
                check_in_time__date__gte=cutoff
            ).values_list('member_id', flat=True).distinct()
            qs = qs.exclude(id__in=active_member_ids)

        if risk_level in ('low', 'medium', 'high'):
            ids = [member.id for member in qs if get_member_risk_snapshot(member)['nivel_riesgo'] == risk_level]
            qs = qs.filter(id__in=ids)

        if prescription_status in ('sin_plan', 'incompleta', 'lista'):
            ids = [member.id for member in qs if get_member_prescription_status(member)['estado'] == prescription_status]
            qs = qs.filter(id__in=ids)

        if ordering in ('riesgo_desc', 'riesgo_asc', 'prescripcion'):
            if ordering == 'prescripcion':
                priority = {'sin_plan': 0, 'incompleta': 1, 'lista': 2}
                sorted_ids = [
                    member.id for member in sorted(
                        qs,
                        key=lambda member: (
                            priority[get_member_prescription_status(member)['estado']],
                            -(get_member_risk_snapshot(member)['riesgo_adherencia']),
                            member.id,
                        ),
                    )
                ]
            else:
                reverse = ordering == 'riesgo_desc'
                sorted_ids = [
                    member.id for member in sorted(
                        qs,
                        key=lambda member: get_member_risk_snapshot(member)['riesgo_adherencia'],
                        reverse=reverse,
                    )
                ]
            if sorted_ids:
                preserve_order = Case(
                    *[When(id=member_id, then=position) for position, member_id in enumerate(sorted_ids)],
                    output_field=IntegerField(),
                )
                qs = qs.filter(id__in=sorted_ids).order_by(preserve_order)

        return qs

    def get_permissions(self):
        if self.action in ('list', 'retrieve', 'dashboard_summary', 'active_prescription', 'progress_by_exercise', 'physical_summary'):
            return [IsAuthenticated()]
        if self.action == 'assign_trainer':
            return [IsAuthenticated(), IsTrainer()]
        return [IsAuthenticated(), IsTrainer()]

    @action(detail=True, methods=['get'], url_path='dashboard-summary')
    def dashboard_summary(self, request, pk=None):
        """GET /api/members/{id}/dashboard-summary/"""
        member = self.get_object()
        return Response(get_member_dashboard_summary(member))

    @action(detail=True, methods=['get'], url_path='prescription-summary')
    def prescription_summary(self, request, pk=None):
        member = self.get_object()
        return Response(get_member_prescription_summary(member))

    @action(detail=True, methods=['get'], url_path='active-prescription')
    def active_prescription(self, request, pk=None):
        member = self.get_object()
        return Response(get_active_prescription(member))

    @action(detail=True, methods=['get'], url_path='physical-summary')
    def physical_summary(self, request, pk=None):
        member = self.get_object()
        return Response(build_member_physical_summary(member))

    @action(detail=True, methods=['post'], url_path='assign-trainer')
    def assign_trainer(self, request, pk=None):
        member = self.get_object()

        if request.user.is_staff:
            trainer_id = request.data.get('trainer_id')
            if not trainer_id:
                raise ValidationError({'trainer_id': 'Este campo es requerido.'})
            try:
                trainer_profile = TrainerProfile.objects.get(id=trainer_id)
            except TrainerProfile.DoesNotExist as exc:
                raise ValidationError({'trainer_id': 'Trainer no encontrado.'}) from exc
        else:
            trainer_profile = _get_trainer_profile(request.user)
            if member.trainer_asignado and member.trainer_asignado_id != trainer_profile.id:
                raise PermissionDenied('El cliente ya está asignado a otro trainer.')

        member.trainer_asignado = trainer_profile
        member.save(update_fields=['trainer_asignado'])
        registrar_auditoria(
            request.user,
            'trainer_assigned',
            'MemberProfile',
            member.id,
            request=request,
            details={
                'member_id': member.id,
                'trainer_id': trainer_profile.id,
            },
        )
        return Response(MemberProfileSerializer(member, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='activate')
    def activate(self, request, pk=None):
        """POST /api/members/{id}/activate/ — Activa el perfil y genera PaymentSchedule."""
        member = self.get_object()
        from billing.models import MembershipPlan, MemberSubscription, PaymentSchedule
        from billing.services import initialize_subscription
        from datetime import date

        member.is_active = True
        member.save()

        plan_id = request.data.get('plan_id') or request.data.get('membership_plan_id')
        agreed_price = request.data.get('agreed_price')
        if plan_id:
            try:
                plan = MembershipPlan.objects.get(id=plan_id)
                if request.user.is_staff:
                    trainer_profile = member.trainer_asignado
                else:
                    trainer_profile = _get_trainer_profile(request.user)
                    if member.trainer_asignado_id != trainer_profile.id:
                        raise PermissionDenied('Solo puedes activar clientes asignados a ti.')

                MemberSubscription.objects.filter(member=member, is_active=True).update(is_active=False)
                subscription = MemberSubscription.objects.create(
                    member=member,
                    plan=plan,
                    trainer=trainer_profile,
                    agreed_price=agreed_price or plan.price,
                    start_date=date.today(),
                    next_billing_date=date.today(),
                    recurrence_type=plan.recurrence_type,
                    grace_period_days=plan.grace_period_days,
                    auto_generate_next=True,
                    is_active=True,
                    status='suspended',
                    renewal_date=None,
                )
                member.membership_plan = plan
                member.save(update_fields=['membership_plan', 'is_active'])

                initialize_subscription(subscription)
            except MembershipPlan.DoesNotExist:
                pass

        registrar_auditoria(
            request.user,
            'member_activated',
            'MemberProfile',
            member.id,
            request=request,
            details={
                'member_id': member.id,
                'plan_id': plan_id,
                'agreed_price': str(agreed_price) if agreed_price is not None else None,
            },
        )

        return Response({
            'message': 'Miembro activado.',
            'member': MemberProfileSerializer(member).data
        })

    @action(detail=True, methods=['get'], url_path=r'progress-by-exercise/(?P<exercise_id>\d+)')
    def progress_by_exercise(self, request, pk=None, exercise_id=None):
        """GET /api/members/{id}/progress-by-exercise/{exercise_id}/"""
        member = self.get_object()
        from progress.models import ExerciseLog
        from plans.models import Exercise

        try:
            exercise = Exercise.objects.get(id=exercise_id)
        except Exercise.DoesNotExist:
            return Response({'error': 'Ejercicio no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        logs = ExerciseLog.objects.filter(
            exercise=exercise,
            session__member=member
        ).select_related('session').order_by('session__started_at')

        data_points = [
            {
                'date': log.session.started_at.date(),
                'exercise_type': exercise.exercise_type,
                'weight_used_kg': log.weight_used_kg,
                'sets': log.sets_completed,
                'reps_completed': log.reps_completed,
                'minutes_completed': log.minutes_completed,
                'rpe': log.rpe,
            }
            for log in logs
        ]

        return Response({
            'exercise_name': exercise.name,
            'data_points': data_points
        })


class TrainerOverviewView(APIView):
    """GET /api/trainer/gym-overview/"""
    permission_classes = [IsAuthenticated, IsTrainer]

    def get(self, request):
        trainer_profile = _get_trainer_profile(request.user)
        return Response(get_trainer_overview(request.user, trainer_profile))
