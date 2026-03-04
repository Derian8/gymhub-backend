from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status, viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .models import MemberProfile, TrainerProfile, AuditLog
from .permissions import IsStaffOrTrainer, IsTrainer, IsMember
from .serializers import (
    UserSerializer, RegisterSerializer, LoginSerializer,
    MemberProfileSerializer, TrainerProfileSerializer, AuditLogSerializer
)

User = get_user_model()


class LoginThrottle(AnonRateThrottle):
    rate = '10/15min'
    scope = 'login'


def _set_auth_cookies(response, refresh_token):
    access_token = str(refresh_token.access_token)
    refresh_str = str(refresh_token)

    cookie_opts = {
        'httponly': True,
        'samesite': 'Lax',
        'secure': not settings.DEBUG,
        'path': '/',
    }
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
    response.delete_cookie(settings.ACCESS_TOKEN_COOKIE_NAME)
    response.delete_cookie(settings.REFRESH_TOKEN_COOKIE_NAME)


class RegisterView(APIView):
    """
    POST /auth/register/
    Registro público para miembros.
    Registro de trainers requiere IsStaffOrTrainer (protegido).
    """
    permission_classes = []
    throttle_classes = []

    def post(self, request):
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
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email']
        password = serializer.validated_data['password']

        try:
            user = User.objects.get(email=email)
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

    def post(self, request):
        refresh_token = request.COOKIES.get(settings.REFRESH_TOKEN_COOKIE_NAME)
        if not refresh_token:
            return Response(
                {'error': 'No refresh token found.'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        try:
            token = RefreshToken(refresh_token)
            new_access = str(token.access_token)
        except TokenError:
            return Response(
                {'error': 'Token inválido o expirado.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        response = Response({'message': 'Token renovado.'})
        response.set_cookie(
            settings.ACCESS_TOKEN_COOKIE_NAME, new_access,
            httponly=True, samesite='Lax',
            secure=not settings.DEBUG,
            max_age=int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
        )
        return response


class MeView(APIView):
    """GET /auth/me/ — Perfil del usuario autenticado."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


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
        qs = MemberProfile.objects.select_related('user', 'membership_plan')

        # Members solo ven su propio perfil
        if user.role == 'member':
            return qs.filter(user=user)

        # Filtros adicionales para trainers/staff
        payment_status = self.request.query_params.get('payment_status')
        inactivity = self.request.query_params.get('inactivity')

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

        return qs

    def get_permissions(self):
        if self.action in ('list', 'retrieve', 'dashboard_summary', 'progress_by_exercise'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsTrainer()]

    @action(detail=True, methods=['get'], url_path='dashboard-summary')
    def dashboard_summary(self, request, pk=None):
        """GET /api/members/{id}/dashboard-summary/"""
        member = self.get_object()
        from datetime import date
        from billing.models import PaymentRecord
        from attendance.models import Attendance
        from alerts.models import InactivityAlert, Notification
        from progress.models import WorkoutSession

        # Payment status
        last_record = PaymentRecord.objects.filter(
            schedule__member=member
        ).order_by('-schedule__due_date').first()

        payment_status = None
        days_until_due = None
        days_overdue = None

        if last_record:
            payment_status = last_record.status
            due = last_record.schedule.due_date
            today = date.today()
            delta = (due - today).days
            if delta >= 0:
                days_until_due = delta
            else:
                days_overdue = abs(delta)

        # Last check-in
        last_att = Attendance.objects.filter(member=member).first()
        last_checkin = last_att.check_in_time if last_att else None

        # Active plan
        active_plan_qs = member.plans.filter(is_active=True).first()
        active_plan = None
        if active_plan_qs:
            active_plan = {'id': active_plan_qs.id, 'name': active_plan_qs.name}

        # Nutrition goal
        nutrition_goal = None
        if active_plan_qs:
            try:
                nutrition_goal = active_plan_qs.nutrition_profile.goal_type
            except Exception:
                pass

        # Inactivity alert
        inactivity_alert = InactivityAlert.objects.filter(member=member, resolved=False).exists()

        # Unread notifications
        unread_notifications = Notification.objects.filter(user=member.user, read=False).count()

        # Today has workout
        today_has_workout = False
        if active_plan_qs:
            workout_days = list(active_plan_qs.workout_days.order_by('order'))
            if workout_days:
                today = date.today()
                days_elapsed = (today - active_plan_qs.start_date).days
                day_index = days_elapsed % len(workout_days)
                today_has_workout = True

        # Weekly sessions
        from datetime import timedelta
        week_start = date.today() - timedelta(days=date.today().weekday())
        weekly_sessions_done = WorkoutSession.objects.filter(
            member=member,
            is_completed=True,
            started_at__date__gte=week_start
        ).count()

        return Response({
            'payment_status': payment_status,
            'days_until_due': days_until_due,
            'days_overdue': days_overdue,
            'last_checkin': last_checkin,
            'active_plan': active_plan,
            'nutrition_goal': nutrition_goal,
            'inactivity_alert': inactivity_alert,
            'unread_notifications': unread_notifications,
            'today_has_workout': today_has_workout,
            'weekly_sessions_done': weekly_sessions_done,
        })

    @action(detail=True, methods=['post'], url_path='activate')
    def activate(self, request, pk=None):
        """POST /api/members/{id}/activate/ — Activa el perfil y genera PaymentSchedule."""
        member = self.get_object()
        from billing.models import MembershipPlan, PaymentSchedule, PaymentRecord
        from datetime import date

        member.is_active = True
        member.save()

        plan_id = request.data.get('membership_plan_id')
        if plan_id:
            try:
                plan = MembershipPlan.objects.get(id=plan_id)
                member.membership_plan = plan
                member.save()

                schedule, created = PaymentSchedule.objects.get_or_create(
                    member=member,
                    plan=plan,
                    is_active=True,
                    defaults={
                        'due_date': date.today(),
                        'grace_period_days': settings.PAYMENT_GRACE_DAYS,
                    }
                )
                if created:
                    PaymentRecord.objects.create(
                        schedule=schedule,
                        amount=plan.price_monthly,
                        status='pending',
                    )
            except MembershipPlan.DoesNotExist:
                pass

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
                'weight_used_kg': log.weight_used_kg,
                'sets': log.sets_completed,
                'reps_completed': log.reps_completed,
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
        from datetime import date, timedelta
        from users.models import MemberProfile
        from attendance.models import Attendance
        from billing.models import PaymentRecord
        from alerts.models import InactivityAlert
        from progress.models import WorkoutSession

        today = date.today()
        month_start = today.replace(day=1)
        week_start = today - timedelta(days=today.weekday())
        cutoff_30d = today - timedelta(days=30)
        grace = settings.PAYMENT_GRACE_DAYS

        total_active = MemberProfile.objects.filter(is_active=True).count()
        checked_in_today = Attendance.objects.filter(check_in_time__date=today).count()

        members_in_mora = PaymentRecord.objects.filter(
            status='late'
        ).values('schedule__member').distinct().count()

        inactive_ids = Attendance.objects.filter(
            check_in_time__date__gte=cutoff_30d
        ).values_list('member_id', flat=True).distinct()
        members_inactive_30d = MemberProfile.objects.filter(
            is_active=True
        ).exclude(id__in=inactive_ids).count()

        pending_alerts = InactivityAlert.objects.filter(resolved=False).count()

        paid_this_month = PaymentRecord.objects.filter(
            status='paid', paid_at__date__gte=month_start
        )
        revenue_this_month = sum(float(r.amount) for r in paid_this_month)

        new_members_this_month = MemberProfile.objects.filter(
            join_date__gte=month_start
        ).count()

        sessions_this_week = WorkoutSession.objects.filter(
            is_completed=True, started_at__date__gte=week_start
        ).count()

        return Response({
            'total_active_members': total_active,
            'checked_in_today': checked_in_today,
            'members_in_mora': members_in_mora,
            'members_inactive_30d': members_inactive_30d,
            'pending_alerts': pending_alerts,
            'revenue_this_month': revenue_this_month,
            'new_members_this_month': new_members_this_month,
            'sessions_completed_this_week': sessions_this_week,
        })
