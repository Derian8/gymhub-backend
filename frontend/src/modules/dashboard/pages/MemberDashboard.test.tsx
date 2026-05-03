import { renderWithProviders } from '@/test/utils'
import { MemberDashboard } from './MemberDashboard'
import { useAuthStore } from '@/shared/store/authStore'

const createSessionMutate = vi.fn()
const completeSessionMutate = vi.fn()
const bulkLogsMutate = vi.fn()

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
  useMemberPhysicalSummaryQuery: () => ({
    data: {
      latest_log_id: 90,
      latest_recorded_at: '2026-03-19T10:00:00Z',
      current_weight_kg: 67.5,
      previous_weight_kg: 68,
      weight_change_kg: -0.5,
      height_cm: 165,
      body_fat_pct: 22,
      muscle_mass_kg: 26,
      waist_cm: 76,
      bmi: 24.8,
      notes: '',
    },
    isLoading: false,
  }),
  useMemberActivePrescriptionQuery: () => ({
    data: {
      trainer: {
        id: 8,
        nombre: 'Carlos Mendoza',
        correo: 'trainer@gymhub.com',
      },
      plan_activo: { id: 11, member: 10, trainer: 8, name: 'Hipertrofia', goal: 'muscle_gain', days_per_week: 4, weeks_duration: 8, start_date: '2026-03-01', end_date: null, is_active: true, workout_days: [] },
      dias: [
        {
          id: 201,
          plan: 11,
          name: 'Torso superior',
          day_label: 'A',
          day_of_week: 'mon',
          order: 0,
          exercises: [
            {
              id: 301,
              workout_day: 201,
              name: 'Press banca',
              muscle_group: 'chest',
              exercise_type: 'strength',
              sets: 4,
              reps_range: '8-10',
              target_minutes: null,
              machine: 1,
              machine_detail: { id: 1, name: 'Smith', category: 'Pecho', notes: '', is_active: true },
              weight_suggestion_kg: 60,
              rest_seconds: 90,
              technique_notes: '',
              order: 0,
            },
          ],
        },
      ],
      entrenamiento_hoy: {
        id: 201,
        name: 'Torso superior',
        day_label: 'A',
        day_of_week: 'mon',
        today_session_id: null,
        today_session_completed: false,
        today_session_started: false,
        exercises: [
          {
            id: 301,
            workout_day: 201,
            name: 'Press banca',
            muscle_group: 'chest',
            exercise_type: 'strength',
            sets: 4,
            reps_range: '8-10',
            target_minutes: null,
            machine: 1,
            machine_detail: { id: 1, name: 'Smith', category: 'Pecho', notes: '', is_active: true },
            weight_suggestion_kg: 60,
            rest_seconds: 90,
            technique_notes: '',
            order: 0,
          },
        ],
      },
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
      guias_vinculadas: [],
      estado_prescripcion: {
        tiene_plan_activo: true,
        tiene_dias: true,
        tiene_ejercicios: true,
        tiene_nutricion: true,
        tiene_guias: false,
        esta_lista_para_member: false,
      },
    },
    isLoading: false,
  }),
}))

vi.mock('@/modules/alerts/hooks/useAlerts', () => ({
  useNotificationsQuery: () => ({
    data: {
      results: [
        { id: 51, user: 1, message: 'Tu trainer dejó una indicación.', type: 'trainer_message', read: false, created_at: '2026-03-20T08:00:00Z' },
      ],
    },
  }),
}))

vi.mock('@/modules/plans/hooks/usePlans', () => ({
  useWeeklyPlanQuery: () => ({
    data: {
      week_days: [
        { date: '2026-03-23', workout_day_name: 'Torso superior', workout_day_id: 201, day_of_week: 'mon', day_label: 'A', session_id: null, is_completed: false },
      ],
    },
  }),
  useCreateSessionMutation: () => ({ mutate: createSessionMutate, isPending: false }),
  useCompleteSessionMutation: () => ({ mutate: completeSessionMutate, isPending: false }),
  useBulkExerciseLogsMutation: () => ({ mutate: bulkLogsMutate, isPending: false }),
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

  it('renders the member training cabin', () => {
    const { getByTestId, getByText } = renderWithProviders(<MemberDashboard />)

    expect(getByTestId('member-dashboard')).toBeInTheDocument()
    expect(getByText('Hola, Ana')).toBeInTheDocument()
    expect(getByTestId('member-dashboard-header')).toBeInTheDocument()
    expect(getByText('Carlos Mendoza')).toBeInTheDocument()
    expect(getByTestId('member-week-plan')).toBeInTheDocument()
    expect(getByTestId('member-today-cabin')).toBeInTheDocument()
    expect(getByTestId('card-payment')).toBeInTheDocument()
    expect(getByTestId('card-messages')).toHaveAttribute('href', '/messages')
    expect(getByTestId('card-messages')).toHaveTextContent('1')
    expect(getByTestId('card-ai')).toHaveTextContent('3 notificación(es) sin leer')
    expect(getByText('Smith')).toBeInTheDocument()
    expect(getByTestId('member-plan-detail-link')).toHaveAttribute('href', '/plans/11')
  })
})
