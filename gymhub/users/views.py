from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.middleware.csrf import get_token
from django.db.models import Q, Case, When, IntegerField, Prefetch
from django.utils import timezone
from django.utils.text import slugify
import secrets
import string
from rest_framework import status, viewsets, filters
from rest_framework.decorators import action
from rest_framework.exceptions import MethodNotAllowed, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.authentication import SessionAuthentication
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from progress.services import build_member_physical_summary
from billing.models import MemberSubscription
from billing.serializers import MemberMembershipSerializer, PaymentRecordSerializer
from billing.services import default_grace_days, initialize_subscription, mark_payment_paid
from .models import MemberProfile, TrainerProfile, PerfilGimnasio
from .audit import registrar_auditoria
from .permissions import (
    IsAdministrator,
    IsStaffOrTrainer,
    IsTrainer,
    IsMember,
    tiene_perfil_entrenador,
    usa_contexto_cliente,
)
from .serializers import (
    UserSerializer, RegisterSerializer, LoginSerializer, MeUpdateSerializer,
    MemberProfileSerializer, TrainerProfileSerializer, PerfilGimnasioSerializer,
    AltaMiembroSerializer, RegistroClientePagoSerializer,
    HabilitarInstructorClienteSerializer,
    CambioContrasenaSerializer, AuditLogSerializer,
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
    Alta administrativa de cuentas. No inicia sesión como la cuenta creada.
    """
    permission_classes = []
    throttle_classes = [RegisterThrottle]

    def post(self, request):
        _enforce_csrf(request)
        role = request.data.get('role', 'member')

        if not request.user or not request.user.is_authenticated:
            return Response(
                {'error': 'El alta de cuentas se realiza desde el panel administrativo.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not request.user.is_staff:
            return Response(
                {'error': 'Solo el administrador puede crear cuentas.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # La creación de trainers también es una operación administrativa.
        if role == 'trainer':
            if not request.user or not request.user.is_authenticated:
                return Response(
                    {'error': 'Debes estar autenticado para registrar un trainer.'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            perm = IsAdministrator()
            if not perm.has_permission(request, self):
                return Response(
                    {'error': 'Solo el administrador puede registrar entrenadores.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.save()
        return Response(
            {'user': UserSerializer(user).data, 'message': 'Registro exitoso.'},
            status=status.HTTP_201_CREATED
        )


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


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CambioContrasenaSerializer(
            data=request.data,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data['contrasena_nueva'])
        user.requiere_cambio_contrasena = False
        user.save(update_fields=['password', 'requiere_cambio_contrasena'])
        registrar_auditoria(
            user,
            'password_changed',
            'User',
            user.id,
            request=request,
        )
        return Response({'message': 'Contraseña actualizada correctamente.'})


def _temporary_password():
    alphabet = string.ascii_letters + string.digits + '!@#$%&*'
    while True:
        value = ''.join(secrets.choice(alphabet) for _ in range(16))
        if any(c.islower() for c in value) and any(c.isupper() for c in value) and any(c.isdigit() for c in value):
            return value


def _unique_username(email):
    base = slugify(email.split('@', 1)[0])[:140] or 'miembro'
    candidate = base
    suffix = 1
    while User.objects.filter(username=candidate).exists():
        text = f'-{suffix}'
        candidate = f'{base[:150-len(text)]}{text}'
        suffix += 1
    return candidate


class MemberViewSet(viewsets.ModelViewSet):
    """
    /api/members/ — CRUD de perfiles de miembros.
    Filtros: ?search= ?payment_status= ?inactivity=
    """
    serializer_class = MemberProfileSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['user__email', 'user__first_name', 'user__last_name', 'phone']

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        raise MethodNotAllowed(
            'POST',
            detail='Usa registro-con-pago para crear clientes con membresía activa.',
        )

    @action(detail=False, methods=['post'], url_path='registro-con-pago')
    @transaction.atomic
    def registro_con_pago(self, request):
        serializer = RegistroClientePagoSerializer(
            data=request.data,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        trainer = data['entrenador']
        plan = data.get('plan_membresia')

        password = _temporary_password()
        user = User.objects.create_user(
            email=data['correo_electronico'],
            username=_unique_username(data['correo_electronico']),
            first_name=data['nombres'].strip(),
            last_name=data['apellidos'].strip(),
            role='member',
            password=password,
            requiere_cambio_contrasena=True,
        )
        member = user.memberprofile
        member.trainer_asignado = trainer
        member.phone = data['telefono'].strip()
        member.birth_date = data.get('fecha_nacimiento')
        member.emergency_contact = data.get('contacto_emergencia', '').strip()
        member.is_active = True
        member.save(update_fields=[
            'trainer_asignado', 'phone', 'birth_date',
            'emergency_contact', 'is_active',
        ])

        recurrence_type = (
            plan.recurrence_type
            if plan
            else data.get('tipo_recurrencia', 'monthly')
        )
        grace_period_days = (
            plan.grace_period_days
            if plan
            else data.get('dias_gracia', default_grace_days(recurrence_type))
        )
        agreed_price = data.get('precio_acordado') or plan.price
        today = timezone.localdate()
        subscription = MemberSubscription.objects.create(
            member=member,
            plan=plan,
            membership_name=(
                plan.name if plan else data['nombre_membresia'].strip()
            ),
            description=plan.description if plan else 'Membresía comercial personalizada.',
            trainer=trainer,
            agreed_price=agreed_price,
            start_date=today,
            next_billing_date=today,
            recurrence_type=recurrence_type,
            grace_period_days=grace_period_days,
            auto_generate_next=data['renovacion_automatica'],
            status='pending',
            is_active=True,
            commercial_notes=data.get('notas_comerciales', '').strip(),
            motivo_ajuste_precio=data.get('motivo_ajuste_precio', '').strip(),
        )
        _, payment = initialize_subscription(subscription)
        try:
            payment, _ = mark_payment_paid(
                payment,
                reference=data.get('referencia_pago', '').strip(),
                notes=data.get('notas_pago', '').strip(),
                method=data['metodo_pago'],
                recorded_by=request.user,
            )
        except ValueError as exc:
            raise ValidationError({'pago': str(exc)}) from exc

        subscription.refresh_from_db()
        registrar_auditoria(
            request.user,
            'client_registered_with_payment',
            'MemberProfile',
            member.id,
            request=request,
            details={
                'member_id': member.id,
                'subscription_id': subscription.id,
                'payment_id': payment.id,
                'amount': str(payment.amount),
                'method': payment.metodo_registrado,
                'payment_reference': payment.payment_reference,
            },
        )
        return Response({
            'member': MemberProfileSerializer(member, context={'request': request}).data,
            'membership': MemberMembershipSerializer(
                subscription,
                context={'request': request},
            ).data,
            'payment': PaymentRecordSerializer(payment).data,
            'contrasena_temporal': password,
            'receipt_url': f'/api/payment-records/{payment.id}/receipt/',
            'message': 'Cliente registrado, pago confirmado y acceso activado.',
        }, status=status.HTTP_201_CREATED)

    def get_queryset(self):
        user = self.request.user
        qs = annotate_member_metrics(MemberProfile.objects.select_related(
            'user', 'membership_plan', 'trainer_asignado__user'
        ).prefetch_related(
            Prefetch(
                'subscriptions',
                queryset=MemberSubscription.objects.select_related('plan').order_by('-is_active', '-start_date', '-id'),
            ),
        ).order_by('id'))

        # El contexto cliente siempre queda limitado al perfil personal.
        if usa_contexto_cliente(self.request):
            return qs.filter(user=user)

        if not user.is_staff and tiene_perfil_entrenador(user):
            trainer_profile = _get_trainer_profile(user)
            qs = qs.filter(trainer_asignado=trainer_profile)
        elif not user.is_staff:
            return qs.none()

        # Filtros adicionales para trainers/staff
        payment_status = self.request.query_params.get('payment_status')
        commercial_status = self.request.query_params.get('commercial_status')
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

        if commercial_status == 'al_dia':
            from billing.models import PaymentRecord
            from billing.services import membership_access
            overdue_ids = set(PaymentRecord.objects.filter(
                status__in=['pending', 'late'],
                schedule__due_date__lt=timezone.localdate(),
            ).values_list('schedule__member_id', flat=True))
            current_ids = [
                member.id for member in qs
                if member.id not in overdue_ids and membership_access(member)['allowed']
            ]
            qs = qs.filter(id__in=current_ids)
        elif commercial_status == 'sin_membresia':
            qs = qs.exclude(subscriptions__is_active=True).distinct()

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
        if self.action in ('list', 'retrieve', 'dashboard_summary', 'membership_summary', 'active_prescription', 'progress_by_exercise', 'physical_summary'):
            return [IsAuthenticated()]
        if self.action in {
            'create', 'registro_con_pago', 'assign_trainer', 'activate',
            'temporary_password', 'deactivate_member', 'reactivate_member',
            'update', 'partial_update', 'destroy',
        }:
            return [IsAuthenticated(), IsAdministrator()]
        return [IsAuthenticated()]

    @action(detail=True, methods=['get'], url_path='dashboard-summary')
    def dashboard_summary(self, request, pk=None):
        """GET /api/members/{id}/dashboard-summary/"""
        member = self.get_object()
        summary = get_member_dashboard_summary(member)
        if (
            tiene_perfil_entrenador(request.user)
            and not request.user.is_staff
            and not usa_contexto_cliente(request)
        ):
            for field in (
                'payment_status', 'days_until_due', 'days_overdue',
                'membership_plan_name', 'membership_expires_at',
                'membership_agreed_price', 'membership_recurrence_type',
                'membership_next_billing_date',
            ):
                summary.pop(field, None)
            from billing.services import membership_access
            summary['estado_comercial'] = (
                'al_dia' if membership_access(member)['allowed'] else 'bloqueado'
            )
        return Response(summary)

    @action(detail=True, methods=['get'], url_path='membership-summary')
    def membership_summary(self, request, pk=None):
        """GET /api/members/{id}/membership-summary/"""
        if (
            tiene_perfil_entrenador(request.user)
            and not request.user.is_staff
            and not usa_contexto_cliente(request)
        ):
            raise PermissionDenied('El entrenador no puede consultar información financiera.')
        from billing.services import membership_summary
        member = self.get_object()
        return Response(membership_summary(member))

    @action(detail=True, methods=['get'], url_path='prescription-summary')
    def prescription_summary(self, request, pk=None):
        member = self.get_object()
        return Response(get_member_prescription_summary(member))

    @action(detail=True, methods=['get'], url_path='active-prescription')
    def active_prescription(self, request, pk=None):
        member = self.get_object()
        if usa_contexto_cliente(request):
            from billing.services import membership_access
            from attendance.models import Attendance
            access = membership_access(member)
            if not access['allowed']:
                raise PermissionDenied({
                    'error': 'Tu acceso está bloqueado. Contacta al administrador.',
                    'reason': access['reason'],
                })
            if not Attendance.objects.filter(
                member=member,
                attendance_date=timezone.localdate(),
            ).exists():
                raise PermissionDenied({
                    'error': 'Pulsa “Ver rutina” para registrar tu entrada.',
                    'reason': 'entry_required',
                })
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
        """POST /api/members/{id}/activate/ — Activa el perfil sin crear membresía."""
        member = self.get_object()

        member.is_active = True
        member.user.is_active = True
        member.save(update_fields=['is_active'])
        member.user.save(update_fields=['is_active'])

        registrar_auditoria(
            request.user,
            'member_activated',
            'MemberProfile',
            member.id,
            request=request,
            details={
                'member_id': member.id,
            },
        )

        return Response({
            'message': 'Miembro activado.',
            'member': MemberProfileSerializer(member).data
        })

    @action(detail=True, methods=['post'], url_path='temporary-password')
    def temporary_password(self, request, pk=None):
        member = self.get_object()
        password = _temporary_password()
        member.user.set_password(password)
        member.user.requiere_cambio_contrasena = True
        member.user.is_active = True
        member.user.save(update_fields=['password', 'requiere_cambio_contrasena', 'is_active'])
        registrar_auditoria(
            request.user,
            'temporary_password_generated',
            'User',
            member.user_id,
            request=request,
            details={'member_id': member.id},
        )
        return Response({
            'contrasena_temporal': password,
            'message': 'Contraseña temporal generada. Solo se muestra una vez.',
        })

    @action(detail=True, methods=['post'], url_path='deactivate')
    @transaction.atomic
    def deactivate_member(self, request, pk=None):
        member = self.get_object()
        reason = (request.data.get('reason') or '').strip()
        if not reason:
            raise ValidationError({'reason': 'Indica el motivo de la baja.'})
        from billing.models import SeguimientoCobro
        from billing.services import cancel_membership, current_member_membership
        from plans.models import TrainingPlan
        subscription = current_member_membership(member)
        if subscription:
            cancel_membership(subscription, reason=reason)
        TrainingPlan.objects.filter(member=member, status='active').update(
            status='finished', is_active=False, finished_at=timezone.now(),
        )
        member.is_active = False
        member.user.is_active = False
        member.save(update_fields=['is_active'])
        member.user.save(update_fields=['is_active'])
        SeguimientoCobro.objects.filter(
            cliente=member,
            estado__in=['nuevo', 'en_seguimiento'],
        ).update(
            estado='baja',
            administrador=request.user,
            nota=reason,
            proxima_fecha=None,
        )
        registrar_auditoria(request.user, 'member_deactivated', 'MemberProfile', member.id, request=request, details={'reason': reason})
        return Response(MemberProfileSerializer(member, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='reactivate')
    def reactivate_member(self, request, pk=None):
        member = self.get_object()
        member.is_active = True
        member.user.is_active = True
        member.save(update_fields=['is_active'])
        member.user.save(update_fields=['is_active'])
        registrar_auditoria(request.user, 'member_reactivated', 'MemberProfile', member.id, request=request)
        return Response(MemberProfileSerializer(member, context={'request': request}).data)

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
        trainer_profile = (
            None if request.user.is_staff else _get_trainer_profile(request.user)
        )
        return Response(get_trainer_overview(request.user, trainer_profile))


class TrainerListView(APIView):
    """Catálogo mínimo de entrenadores para asignación administrativa."""

    permission_classes = [IsAuthenticated, IsAdministrator]

    def get(self, request):
        trainers = TrainerProfile.objects.select_related('user').filter(
            user__is_active=True,
            user__is_staff=False,
        ).order_by('user__first_name', 'user__last_name', 'id')
        return Response(TrainerProfileSerializer(trainers, many=True).data)


class AdminUserListView(APIView):
    """Lista de cuentas y capacidades para administración de perfiles."""

    permission_classes = [IsAuthenticated, IsAdministrator]

    def get(self, request):
        users = User.objects.select_related(
            'trainerprofile',
            'memberprofile',
        ).order_by('first_name', 'last_name', 'email')
        return Response(UserSerializer(users, many=True).data)


class HabilitarInstructorClienteView(APIView):
    """Agrega el perfil cliente a un instructor sin duplicar su cuenta."""

    permission_classes = [IsAuthenticated, IsAdministrator]

    @transaction.atomic
    def post(self, request, pk):
        try:
            instructor = TrainerProfile.objects.select_related('user').get(pk=pk)
        except TrainerProfile.DoesNotExist:
            return Response(
                {'error': 'Instructor no encontrado.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        if hasattr(instructor.user, 'memberprofile'):
            raise ValidationError({
                'instructor': 'Esta cuenta ya tiene perfil de cliente.',
            })

        serializer = HabilitarInstructorClienteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        plan = data.get('plan_membresia')
        trainer = data['entrenador_asignado']

        member = MemberProfile.objects.create(
            user=instructor.user,
            trainer_asignado=trainer,
            membership_plan=plan,
            phone=data.get('telefono', '').strip(),
            birth_date=data.get('fecha_nacimiento'),
            emergency_contact=data.get('contacto_emergencia', '').strip(),
            is_active=True,
        )
        recurrence_type = (
            plan.recurrence_type
            if plan
            else data.get('tipo_recurrencia', 'monthly')
        )
        grace_period_days = (
            plan.grace_period_days
            if plan
            else data.get('dias_gracia', default_grace_days(recurrence_type))
        )
        subscription = MemberSubscription.objects.create(
            member=member,
            plan=plan,
            membership_name=(
                plan.name if plan else data['nombre_membresia'].strip()
            ),
            description=(
                plan.description
                if plan
                else 'Membresía comercial personalizada.'
            ),
            trainer=trainer,
            agreed_price=data.get('precio_acordado') or plan.price,
            start_date=timezone.localdate(),
            next_billing_date=timezone.localdate(),
            recurrence_type=recurrence_type,
            grace_period_days=grace_period_days,
            auto_generate_next=data['renovacion_automatica'],
            status='pending',
            is_active=True,
            commercial_notes=data.get('notas_comerciales', '').strip(),
            motivo_ajuste_precio=data.get('motivo_ajuste_precio', '').strip(),
        )
        _, payment = initialize_subscription(subscription)
        try:
            payment, _ = mark_payment_paid(
                payment,
                reference=data.get('referencia_pago', '').strip(),
                notes=data.get('notas_pago', '').strip(),
                method=data['metodo_pago'],
                recorded_by=request.user,
            )
        except ValueError as exc:
            raise ValidationError({'pago': str(exc)}) from exc

        registrar_auditoria(
            request.user,
            'instructor_client_profile_enabled',
            'MemberProfile',
            member.id,
            request=request,
            details={
                'user_id': instructor.user_id,
                'trainer_profile_id': instructor.id,
                'member_profile_id': member.id,
                'subscription_id': subscription.id,
                'payment_id': payment.id,
            },
        )
        instructor.user.refresh_from_db()
        return Response({
            'user': UserSerializer(instructor.user).data,
            'member': MemberProfileSerializer(
                member,
                context={'request': request},
            ).data,
            'membership': MemberMembershipSerializer(
                subscription,
                context={'request': request},
            ).data,
            'payment': PaymentRecordSerializer(payment).data,
            'message': 'Perfil de cliente habilitado y primer pago registrado.',
        }, status=status.HTTP_201_CREATED)


class PerfilGimnasioView(APIView):
    permission_classes = [IsAuthenticated, IsTrainer]

    def get_object(self, user):
        trainer = _get_trainer_profile(user)
        profile, _ = PerfilGimnasio.objects.get_or_create(
            entrenador=trainer,
            defaults={
                'nombre': trainer.user.get_full_name() or 'Mi gimnasio',
                'correo': trainer.user.email,
            },
        )
        return profile

    def get(self, request):
        return Response(PerfilGimnasioSerializer(self.get_object(request.user)).data)

    def patch(self, request):
        profile = self.get_object(request.user)
        serializer = PerfilGimnasioSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        registrar_auditoria(request.user, 'gym_profile_updated', 'PerfilGimnasio', profile.id, request=request)
        return Response(serializer.data)
