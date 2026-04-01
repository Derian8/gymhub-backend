import { renderWithProviders } from '@/test/utils'
import { MemberDashboard } from './MemberDashboard'
import { useAuthStore } from '@/shared/store/authStore'

vi.mock('@/modules/members/hooks/useMembers', () => ({
  useMemberDashboardQuery: () => ({
    data: {
      payment_status: 'pending',
      days_until_due: 2,
      days_overdue: null,
      last_checkin: '2026-03-19T10:00:00Z',
      active_plan: { id: 11, name: 'Hipertrofia' },
      nutrition_goal: 'muscle_gain',
      inactivity_alert: true,
      unread_notifications: 3,
      today_has_workout: true,
      weekly_sessions_done: 4,
      streak_asistencia: 5,
      cumplimiento_semanal: 80,
      siguiente_accion: 'Completa tu entrenamiento de hoy y registra tu sesión.',
      resumen_hoy: 'Hoy toca torso superior con foco en hipertrofia.',
      riesgo_personal: {
        score: 48,
        level: 'medium',
        reasons: ['Su pago vence en 2 días', 'No registra progreso hace 25 días'],
      },
    },
    isLoading: false,
  }),
  useMemberActivePrescriptionQuery: () => ({
    data: {
      plan_activo: { id: 11, name: 'Hipertrofia', goal: 'muscle_gain', days_per_week: 4, weeks_duration: 8, start_date: '2026-03-01', end_date: null, is_active: true },
      perfil_nutricional: {
        id: 21,
        training_plan: 11,
        goal_type: 'muscle_gain',
        calorie_range_min: 2300,
        calorie_range_max: 2800,
        protein_focus: '150g',
        carb_strategy: 'Alto',
        hydration_recommendation: '3 litros',
      },
    },
    isLoading: false,
  }),
}))

describe('MemberDashboard', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({
      user: {
        id: 1,
        email: 'member@test.com',
        username: 'member',
        first_name: 'Ana',
        last_name: 'Member',
        role: 'member',
        is_staff: false,
        memberprofile_id: 10,
        trainerprofile_id: null,
      },
      isAuthenticated: true,
      authResolved: true,
      theme: 'dark',
    })
  })

  it('renders member cards and inactivity banner', () => {
    const { getByTestId, getByText } = renderWithProviders(<MemberDashboard />)

    expect(getByTestId('member-dashboard')).toBeInTheDocument()
    expect(getByText('Hola, Ana')).toBeInTheDocument()
    expect(getByTestId('inactivity-banner')).toBeInTheDocument()
    expect(getByTestId('today-hero')).toBeInTheDocument()
    expect(getByTestId('card-payment')).toBeInTheDocument()
    expect(getByTestId('card-workout')).toHaveAttribute('href', '/plans/11/today')
    expect(getByTestId('card-notifications')).toHaveTextContent('3')
    expect(getByText('5 días de racha')).toBeInTheDocument()
  })
})
