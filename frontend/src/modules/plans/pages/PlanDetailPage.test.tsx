import { afterEach } from 'vitest'
import { cleanup, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { useAuthStore } from '@/shared/store/authStore'
import { PlanDetailPage } from './PlanDetailPage'

const deletePlanMutate = vi.fn()

afterEach(() => {
  cleanup()
})

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')

  return {
    ...actual,
    useParams: () => ({ id: '12' }),
  }
})

vi.mock('../hooks/usePlans', () => ({
  usePlanDetailQuery: () => ({
    data: {
      id: 12,
      member: 15,
      trainer: 9,
      name: 'Hipertrofia base',
      goal: 'muscle_gain',
      start_date: '2026-03-01',
      end_date: '2026-05-01',
      days_per_week: 4,
      weeks_duration: 8,
      is_active: true,
      workout_days: [],
    },
    isLoading: false,
  }),
  useWeeklyPlanQuery: () => ({
    data: {
      workout_days: [
        {
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
            },
          ],
        },
      ],
    },
  }),
  useTodayWorkoutQuery: () => ({
    data: {
      id: 101,
      day_label: 'A',
      name: 'Torso',
      exercises: [],
    },
  }),
  useDeletePlanMutation: () => ({
    mutate: deletePlanMutate,
    isPending: false,
    isSuccess: false,
  }),
}))

describe('PlanDetailPage', () => {
  beforeEach(() => {
    deletePlanMutate.mockReset()
    useAuthStore.setState({
      user: {
        id: 2,
        email: 'trainer@gymhub.com',
        username: 'trainer',
        first_name: 'Trainer',
        last_name: 'Demo',
        role: 'trainer',
        is_staff: false,
        memberprofile_id: null,
        trainerprofile_id: 9,
      },
      isAuthenticated: true,
      authResolved: true,
      theme: 'dark',
    })
  })

  it('renders weekly view and today workout action', () => {
    const { getByTestId, getByText } = renderWithProviders(<PlanDetailPage />)

    expect(getByTestId('plan-detail-page')).toBeInTheDocument()
    expect(getByText('Hipertrofia base')).toBeInTheDocument()
    expect(getByText('Hoy: Día A')).toBeInTheDocument()
    expect(getByTestId('today-workout-btn')).toHaveAttribute('href', '/plans/12/today')
    expect(getByTestId('workout-day-101')).toBeInTheDocument()
    expect(getByText('Press banca')).toBeInTheDocument()
  })

  it('lets a trainer confirm plan deletion from the detail page', () => {
    const { getAllByTestId, getAllByText, getByText } = renderWithProviders(<PlanDetailPage />)

    fireEvent.click(getAllByTestId('open-delete-plan-dialog')[0])

    expect(getAllByTestId('plan-detail-delete-dialog')[0]).toBeInTheDocument()
    expect(getByText(/Se eliminara el plan completo "Hipertrofia base"/)).toBeInTheDocument()

    fireEvent.click(getByText('Confirmar borrado'))

    expect(deletePlanMutate).toHaveBeenCalledWith({ id: 12, memberId: 15 })
  })
})
