import userEvent from '@testing-library/user-event'
import { waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { TodayWorkoutPage } from './TodayWorkoutPage'

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
          name: 'Press banca',
          muscle_group: 'chest',
          sets: 4,
          reps_range: '8-10',
          weight_suggestion_kg: 60,
          rest_seconds: 90,
          technique_notes: '',
          order: 0,
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

describe('TodayWorkoutPage', () => {
  beforeEach(() => {
    crearSesion.mockReset()
    completarSesion.mockReset()
    guardarLogs.mockReset()
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

    const { getByTestId, queryByTestId, getByText } = renderWithProviders(<TodayWorkoutPage />)

    expect(getByTestId('today-workout-page')).toBeInTheDocument()
    expect(getByText('Press banca')).toBeInTheDocument()

    await user.click(getByTestId('start-session-btn'))

    await waitFor(() => {
      expect(crearSesion).toHaveBeenCalledWith(
        { workout_day_id: 101 },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      )
      expect(getByTestId('complete-session-btn')).toBeInTheDocument()
    })

    await user.click(getByTestId('complete-session-btn'))

    await waitFor(() => {
      expect(guardarLogs).toHaveBeenCalledWith(
        {
          session_id: 901,
          logs: [
            {
              exercise_id: 501,
              sets_completed: 4,
              reps_completed: 8,
              weight_used_kg: 60,
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
