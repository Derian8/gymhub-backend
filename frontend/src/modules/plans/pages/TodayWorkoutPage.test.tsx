import userEvent from '@testing-library/user-event'
import { waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { TodayWorkoutPage } from './TodayWorkoutPage'
import { useAuthStore } from '@/shared/store/authStore'
import type { TodayWorkout } from '@/shared/types'

const crearSesion = vi.fn()
const completarSesion = vi.fn()
const guardarLogs = vi.fn()
const registrarProgresoEjercicio = vi.fn()

const mockTodayWorkout: TodayWorkout = {
  id: 101,
  day_label: 'A',
  day_of_week: 'mon',
  name: 'Torso',
  today_session_id: null,
  today_session_completed: false,
  today_session_started: false,
  exercises: [
    {
      id: 501,
      workout_day: 101,
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
      previous_log: {
        session_id: 44,
        date: '2026-03-16',
        sets_completed: 4,
        reps_completed: 8,
        minutes_completed: null,
        weight_used_kg: 55,
        rpe: 7,
        weight_delta_kg: 5,
      },
    },
    {
      id: 502,
      workout_day: 101,
      name: 'Bici estatica',
      muscle_group: 'cardio',
      exercise_type: 'timed',
      sets: null,
      reps_range: '',
      target_minutes: 20,
      machine: null,
      weight_suggestion_kg: null,
      rest_seconds: 30,
      technique_notes: 'Mantén ritmo constante',
      order: 1,
      previous_log: null,
    },
  ],
}

let mockTodayWorkoutData: typeof mockTodayWorkout | null = mockTodayWorkout
let mockTodayWorkoutLoading = false
let mockPrescriptionError = false
let mockPrescriptionLoading = false
let mockWeeklyViewError = false

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')

  return {
    ...actual,
    useParams: () => ({ id: '12' }),
  }
})

vi.mock('../hooks/usePlans', () => ({
  useTodayWorkoutQuery: () => ({
    data: mockTodayWorkoutData,
    isLoading: mockTodayWorkoutLoading,
    isError: false,
  }),
  useWeeklyPlanQuery: () => ({
    data: {
      week_days: [
        { date: '2026-03-23', workout_day_name: 'Torso', workout_day_id: 101, day_of_week: 'mon', day_label: 'A', has_workout: true, is_rest_day: false, session_id: null, is_completed: false },
        { date: '2026-03-24', workout_day_name: null, workout_day_id: null, day_of_week: 'tue', day_label: null, has_workout: false, is_rest_day: true, session_id: null, is_completed: false },
        { date: '2026-03-25', workout_day_name: null, workout_day_id: null, day_of_week: 'wed', day_label: null, has_workout: false, is_rest_day: true, session_id: null, is_completed: false },
        { date: '2026-03-26', workout_day_name: null, workout_day_id: null, day_of_week: 'thu', day_label: null, has_workout: false, is_rest_day: true, session_id: null, is_completed: false },
        { date: '2026-03-27', workout_day_name: 'Pierna', workout_day_id: 102, day_of_week: 'fri', day_label: 'B', has_workout: true, is_rest_day: false, session_id: null, is_completed: false },
        { date: '2026-03-28', workout_day_name: null, workout_day_id: null, day_of_week: 'sat', day_label: null, has_workout: false, is_rest_day: true, session_id: null, is_completed: false },
        { date: '2026-03-29', workout_day_name: null, workout_day_id: null, day_of_week: 'sun', day_label: null, has_workout: false, is_rest_day: true, session_id: null, is_completed: false },
      ],
    },
    isLoading: false,
    isError: mockWeeklyViewError,
  }),
  useCreateSessionMutation: () => ({
    mutate: crearSesion,
    isPending: false,
  }),
  useCompleteSessionMutation: () => ({
    mutate: completarSesion,
    isPending: false,
  }),
  useBulkExerciseLogsMutation: () => ({
    mutate: guardarLogs,
    isPending: false,
  }),
  useRegisterExerciseProgressMutation: () => ({
    mutate: registrarProgresoEjercicio,
    isPending: false,
  }),
}))

vi.mock('@/modules/members/hooks/useMembers', () => ({
  useMemberActivePrescriptionQuery: () => ({
    data: {
      trainer: {
        id: 2,
        nombre: 'Carlos Mendoza',
        correo: 'trainer@gymhub.com',
      },
      plan_activo: {
        id: 12,
        name: 'Hipertrofia base',
      },
      dias: [
        {
          id: 101,
          plan: 12,
          day_label: 'A',
          day_of_week: 'mon',
          name: 'Torso',
          exercises: [{ id: 501, name: 'Press banca' }, { id: 502, name: 'Bici estatica' }],
        },
        {
          id: 102,
          plan: 12,
          day_label: 'B',
          day_of_week: 'fri',
          name: 'Pierna',
          exercises: [{ id: 503, name: 'Sentadilla' }],
        },
      ],
      perfil_nutricional: {
        goal_type: 'muscle_gain',
      },
    },
    isLoading: mockPrescriptionLoading,
    isError: mockPrescriptionError,
  }),
  useMemberDashboardQuery: () => ({
    data: {
      payment_status: 'pending',
      days_until_due: 2,
      days_overdue: null,
      membership_plan_name: 'Plan semanal',
      membership_expires_at: '2026-03-28',
      membership_agreed_price: '15000.00',
      membership_recurrence_type: 'weekly',
      membership_next_billing_date: '2026-03-29',
      membership_access_allowed: true,
      weekly_sessions_done: 2,
      cumplimiento_semanal: 50,
    },
    isLoading: false,
  }),
}))

vi.mock('@/modules/attendance/hooks/useAttendance', () => ({
  useMemberAttendanceToday: (enabled = true) => ({
    hasCheckedInToday: enabled && Object.keys(window.sessionStorage)
      .some((key) => key.startsWith('gymhub-routine-entry:') && window.sessionStorage.getItem(key) === 'granted'),
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}))

describe('TodayWorkoutPage', () => {
  beforeEach(() => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
    window.sessionStorage.setItem(`gymhub-routine-entry:${today}`, 'granted')
    mockTodayWorkoutData = mockTodayWorkout
    mockTodayWorkoutLoading = false
    mockPrescriptionError = false
    mockPrescriptionLoading = false
    mockWeeklyViewError = false
    crearSesion.mockReset()
    completarSesion.mockReset()
    guardarLogs.mockReset()
    registrarProgresoEjercicio.mockReset()
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

      },
      isAuthenticated: true,
      authResolved: true,
      theme: 'dark',
    })
  })

  it('blocks training details until attendance is confirmed', () => {
    window.sessionStorage.clear()
    const { getByTestId, getByText } = renderWithProviders(<TodayWorkoutPage />)

    expect(getByTestId('workout-attendance-required')).toBeInTheDocument()
    expect(getByText('Confirma tu entrada para abrir la rutina')).toBeInTheDocument()
  })

  it('starts and records client exercises one at a time', async () => {
    const user = userEvent.setup()
    crearSesion.mockImplementation((_payload, options) => {
      options?.onSuccess?.({ id: 901 })
    })
    let exerciseCount = 0
    registrarProgresoEjercicio.mockImplementation((_payload, options) => {
      exerciseCount += 1
      options?.onSuccess?.({ session_completed: exerciseCount === 2 })
    })

    const { getAllByText, getByTestId, queryByTestId, getByText } = renderWithProviders(<TodayWorkoutPage />)

    expect(getByTestId('today-workout-page')).toBeInTheDocument()
    expect(getAllByText('Carlos Mendoza').length).toBeGreaterThan(0)
    expect(getAllByText('Hipertrofia base').length).toBeGreaterThan(0)
    expect(getByTestId('workout-primary')).toBeInTheDocument()
    expect(getByTestId('workout-primary')).toHaveTextContent('Tu rutina de hoy')
    expect(getByTestId('today-workout-summary')).toHaveTextContent('Ejercicios')
    expect(getByTestId('today-workout-summary')).toHaveTextContent('Hipertrofia base')
    expect(getByTestId('start-session-btn')).toHaveTextContent('Iniciar rutina')
    expect(queryByTestId('exercise-checklist')).not.toBeInTheDocument()
    expect(getAllByText('Lunes · Torso').length).toBeGreaterThan(0)

    await user.click(getByTestId('start-session-btn'))

    await waitFor(() => {
      expect(crearSesion).toHaveBeenCalledWith(
        { workout_day_id: 101 },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      )
      expect(getByTestId('client-routine-flow')).toBeInTheDocument()
      expect(getByTestId('client-routine-flow')).toHaveTextContent('Press banca')
      expect(getByTestId('mark-exercise-done')).toBeInTheDocument()
      expect(getByTestId('skip-exercise')).toBeInTheDocument()
    })

    await user.click(getByTestId('mark-exercise-done'))
    await waitFor(() => expect(registrarProgresoEjercicio).toHaveBeenCalledWith(
      { sessionId: 901, payload: { exercise_id: 501, estado: 'realizado' } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    ))
    await user.click(getByTestId('skip-exercise'))
    await waitFor(() => expect(getByText('Rutina completada hoy')).toBeInTheDocument())

    expect(queryByTestId('complete-session-btn')).not.toBeInTheDocument()
  })

  it('shows the member membership summary after the workout action', () => {
    const { getByTestId } = renderWithProviders(<TodayWorkoutPage />)

    expect(getByTestId('today-membership-spotlight')).toHaveTextContent('Membresía actual')
    expect(getByTestId('today-membership-spotlight')).toHaveTextContent('Plan semanal')
    expect(getByTestId('today-membership-spotlight')).toHaveTextContent('Pendiente')
    expect(getByTestId('today-membership-spotlight')).toHaveTextContent('Acceso permitido')
    expect(getByTestId('today-membership-spotlight')).toHaveTextContent('Vence el 28/03/2026')
    expect(getByTestId('today-membership-spotlight')).toHaveTextContent('2 día(s) restantes')
    expect(getByTestId('today-membership-link')).toHaveAttribute('href', '/membership')
    expect(
      getByTestId('workout-primary').compareDocumentPosition(getByTestId('today-membership-spotlight'))
      & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('allows opening another day while keeping today as the main workout', async () => {
    const user = userEvent.setup()

    const { getByTestId, getByText, queryByTestId } = renderWithProviders(<TodayWorkoutPage />)

    expect(queryByTestId('selected-day-detail')).not.toBeInTheDocument()

    await user.click(getByTestId('toggle-day-selector-btn'))

    expect(getByTestId('selected-day-detail')).toBeInTheDocument()
    expect(getByTestId('selected-day-detail')).toHaveTextContent('Viernes · Pierna')
    expect(getByTestId('selected-day-detail-link')).toHaveAttribute('href', '/plans/12/days/102')
    expect(getByText('Sentadilla')).toBeInTheDocument()
    expect(getByTestId('start-session-btn')).toBeInTheDocument()
  })

  it('keeps training as home and shows weekly plan when there is no block today', () => {
    mockTodayWorkoutData = null

    const { getByTestId, getByText, queryByTestId } = renderWithProviders(<TodayWorkoutPage />)

    expect(getByTestId('today-workout-page')).toBeInTheDocument()
    expect(getByText('Hoy no tienes bloque puntual')).toBeInTheDocument()
    expect(getByTestId('day-selector-panel')).toBeInTheDocument()
    expect(getByTestId('toggle-day-selector-btn')).toHaveTextContent('Ocultar otros días')
    expect(getByTestId('weekly-program-section')).toBeInTheDocument()
    expect(getByTestId('weekly-status-mon')).toHaveTextContent('Lunes · Torso')
    expect(getByTestId('weekly-status-wed')).toHaveTextContent('Miércoles · Descanso')
    expect(queryByTestId('start-session-btn')).not.toBeInTheDocument()
    expect(queryByTestId('exercise-checklist')).not.toBeInTheDocument()
  })

  it('allows consulting a specific workout day when today has no assigned block', async () => {
    mockTodayWorkoutData = null
    const user = userEvent.setup()

    const { getByTestId, getByText, queryByTestId } = renderWithProviders(<TodayWorkoutPage />)

    expect(getByTestId('selected-day-detail')).toHaveTextContent('Lunes · Torso')
    expect(getByTestId('selected-day-detail-link')).toHaveAttribute('href', '/plans/12/days/101')
    expect(getByText('Press banca')).toBeInTheDocument()
    expect(queryByTestId('start-session-btn')).not.toBeInTheDocument()

    await user.click(getByTestId('day-selector-fri'))

    expect(getByTestId('selected-day-detail')).toHaveTextContent('Viernes · Pierna')
    expect(getByTestId('selected-day-detail-link')).toHaveAttribute('href', '/plans/12/days/102')
    expect(getByText('Sentadilla')).toBeInTheDocument()
    expect(queryByTestId('start-session-btn')).not.toBeInTheDocument()
  })

  it('shows explicit rest state when selecting a day without workout', async () => {
    mockTodayWorkoutData = null
    const user = userEvent.setup()

    const { getByTestId, queryByTestId } = renderWithProviders(<TodayWorkoutPage />)

    await user.click(getByTestId('day-selector-wed'))

    expect(getByTestId('selected-day-detail')).toHaveTextContent('Miércoles · Descanso')
    expect(getByTestId('selected-day-detail')).toHaveTextContent('No hay bloque asignado para este día')
    expect(queryByTestId('selected-day-detail-link')).not.toBeInTheDocument()
    expect(queryByTestId('weekly-day-detail-link-wed')).not.toBeInTheDocument()
  })

  it('hides the start button when today workout was already completed', () => {
    mockTodayWorkoutData = {
      ...mockTodayWorkout,
      today_session_id: 901,
      today_session_completed: true,
      today_session_started: false,
    }

    const { getByText, queryByTestId } = renderWithProviders(<TodayWorkoutPage />)

    expect(getByText('Rutina completada hoy')).toBeInTheDocument()
    expect(queryByTestId('start-session-btn')).not.toBeInTheDocument()
    expect(queryByTestId('complete-session-btn')).not.toBeInTheDocument()
  })

  it('shows a fallback instead of leaving the page blank when critical data fails', () => {
    mockPrescriptionError = true

    const { getByTestId, getByText } = renderWithProviders(<TodayWorkoutPage />)

    expect(getByTestId('training-fallback')).toBeInTheDocument()
    expect(getByText('No se pudo cargar esta vista')).toBeInTheDocument()
  })

  it('survives the loading-to-ready transition without crashing the training screen', () => {
    mockTodayWorkoutLoading = true

    const loadingView = renderWithProviders(<TodayWorkoutPage />)

    expect(loadingView.getByText('Cargando vista de entrenamiento')).toBeInTheDocument()

    mockTodayWorkoutLoading = false
    loadingView.unmount()

    const readyView = renderWithProviders(<TodayWorkoutPage />)

    expect(readyView.getByTestId('today-workout-page')).toBeInTheDocument()
    expect(readyView.getByTestId('start-session-btn')).toBeInTheDocument()
  })
})
