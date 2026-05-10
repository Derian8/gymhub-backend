import userEvent from '@testing-library/user-event'
import { waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { TodayWorkoutPage } from './TodayWorkoutPage'
import { useAuthStore } from '@/shared/store/authStore'
import type { TodayWorkout } from '@/shared/types'

const crearSesion = vi.fn()
const completarSesion = vi.fn()
const guardarLogs = vi.fn()

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
    },
  ],
}

let mockTodayWorkoutData: typeof mockTodayWorkout | null = mockTodayWorkout

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
    isLoading: false,
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
    isLoading: false,
  }),
  useMemberDashboardQuery: () => ({
    data: {
      payment_status: 'pending',
      days_until_due: 2,
    },
    isLoading: false,
  }),
  useMemberPhysicalSummaryQuery: () => ({
    data: {
      current_weight_kg: 72.5,
      height_cm: 170,
      bmi: 25.1,
    },
    isLoading: false,
  }),
}))

vi.mock('@/modules/alerts/hooks/useAlerts', () => ({
  useNotificationsQuery: () => ({
    data: {
      results: [
        { id: 1, type: 'trainer_message', read: false },
      ],
    },
    isLoading: false,
  }),
}))

describe('TodayWorkoutPage', () => {
  beforeEach(() => {
    mockTodayWorkoutData = mockTodayWorkout
    crearSesion.mockReset()
    completarSesion.mockReset()
    guardarLogs.mockReset()
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

  it('starts and completes a workout session', async () => {
    const user = userEvent.setup()
    crearSesion.mockImplementation((_payload, options) => {
      options?.onSuccess?.({ id: 901 })
    })
    guardarLogs.mockImplementation((_payload, options) => {
      options?.onSuccess?.([{ id: 1 }])
    })
    completarSesion.mockImplementation((_payload, options) => {
      options?.onSuccess?.({ id: 901, is_completed: true })
    })

    const { getAllByText, getByTestId, queryByTestId, getByText } = renderWithProviders(<TodayWorkoutPage />)

    expect(getByTestId('today-workout-page')).toBeInTheDocument()
    expect(getByText('Press banca')).toBeInTheDocument()
    expect(getByText('Bici estatica')).toBeInTheDocument()
    expect(getByText('Carlos Mendoza')).toBeInTheDocument()
    expect(getAllByText('Hipertrofia base').length).toBeGreaterThan(0)
    expect(getByTestId('workout-primary')).toBeInTheDocument()
    expect(getByTestId('toggle-day-selector-btn')).toBeInTheDocument()
    expect(getByTestId('exercise-checklist')).toBeInTheDocument()
    expect(getByTestId('weekly-program-section')).toBeInTheDocument()
    expect(getAllByText('Lunes · Torso').length).toBeGreaterThan(0)
    expect(getByText('Miércoles · Descanso')).toBeInTheDocument()
    expect(getByText('Checklist del entrenamiento')).toBeInTheDocument()
    expect(getByText('La semana completa de tu rutina')).toBeInTheDocument()
    expect(getAllByText('Ir al resumen').length).toBeGreaterThan(0)
    expect(getByTestId('card-messages')).toBeInTheDocument()
    expect(getByTestId('card-physical')).toBeInTheDocument()
    expect(getByTestId('card-nutrition')).toBeInTheDocument()
    expect(getByTestId('card-billing')).toBeInTheDocument()
    expect(getByTestId('card-ai')).toBeInTheDocument()

    await user.click(getByTestId('start-session-btn'))

    await waitFor(() => {
      expect(crearSesion).toHaveBeenCalledWith(
        { workout_day_id: 101 },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      )
      expect(getByTestId('complete-session-btn')).toBeInTheDocument()
      expect(getAllByText('Prescripción del trainer')).toHaveLength(2)
      expect(getByTestId('rpe-input-501')).toBeInTheDocument()
      expect(getByTestId('minutes-input-502')).toBeInTheDocument()
    })

    await user.click(getByTestId('complete-session-btn'))

    await waitFor(() => {
      expect(guardarLogs).toHaveBeenCalledWith(
        {
          session_id: 901,
          logs: [
            {
              exercise_id: 501,
              weight_used_kg: 60,
              rpe: 7,
            },
            {
              exercise_id: 502,
              minutes_completed: 20,
            },
          ],
        },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      )
      expect(completarSesion).toHaveBeenCalledWith(
        { sessionId: 901, payload: { overall_feeling: 4 } },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      )
    })

    expect(queryByTestId('complete-session-btn')).not.toBeInTheDocument()
  })

  it('allows opening another day while keeping today as the main workout', async () => {
    const user = userEvent.setup()

    const { getByTestId, getByText, queryByTestId } = renderWithProviders(<TodayWorkoutPage />)

    expect(queryByTestId('selected-day-detail')).not.toBeInTheDocument()

    await user.click(getByTestId('toggle-day-selector-btn'))

    expect(getByTestId('selected-day-detail')).toBeInTheDocument()
    expect(getByTestId('selected-day-detail')).toHaveTextContent('Viernes · Pierna')
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
    expect(getByText('Press banca')).toBeInTheDocument()
    expect(queryByTestId('start-session-btn')).not.toBeInTheDocument()

    await user.click(getByTestId('day-selector-fri'))

    expect(getByTestId('selected-day-detail')).toHaveTextContent('Viernes · Pierna')
    expect(getByText('Sentadilla')).toBeInTheDocument()
    expect(queryByTestId('start-session-btn')).not.toBeInTheDocument()
  })

  it('shows explicit rest state when selecting a day without workout', async () => {
    mockTodayWorkoutData = null
    const user = userEvent.setup()

    const { getByTestId } = renderWithProviders(<TodayWorkoutPage />)

    await user.click(getByTestId('day-selector-wed'))

    expect(getByTestId('selected-day-detail')).toHaveTextContent('Miércoles · Descanso')
    expect(getByTestId('selected-day-detail')).toHaveTextContent('No hay bloque asignado para este día')
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
})
