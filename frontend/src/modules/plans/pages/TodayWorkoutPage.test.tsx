import userEvent from '@testing-library/user-event'
import { waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { TodayWorkoutPage } from './TodayWorkoutPage'
import { useAuthStore } from '@/shared/store/authStore'

const crearSesion = vi.fn()
const completarSesion = vi.fn()
const guardarLogs = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')

  return {
    ...actual,
    useParams: () => ({ id: '12' }),
  }
})

vi.mock('../hooks/usePlans', () => ({
  useTodayWorkoutQuery: () => ({
    data: {
      id: 101,
      day_label: 'A',
      name: 'Torso',
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
    expect(getByText('Ver resumen completo')).toBeInTheDocument()
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
})
