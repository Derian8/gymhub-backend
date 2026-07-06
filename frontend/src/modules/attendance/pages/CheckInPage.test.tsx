import { cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@/test/utils'
import { CheckInPage } from './CheckInPage'
import { useAuthStore } from '@/shared/store/authStore'

const registrarCheckIn = vi.fn()
const registrarCheckOut = vi.fn()
const useAttendanceQuery = vi.fn()

vi.mock('../hooks/useAttendance', () => ({
  useCheckInMutation: () => ({
    mutate: registrarCheckIn,
    isPending: false,
  }),
  useCheckOutMutation: () => ({
    mutate: registrarCheckOut,
    isPending: false,
  }),
  useAttendanceQuery: (...args: unknown[]) => useAttendanceQuery(...args),
}))

describe('CheckInPage', () => {
  beforeEach(() => {
    cleanup()
    registrarCheckIn.mockReset()
    registrarCheckOut.mockReset()
    useAttendanceQuery.mockReset()
    useAttendanceQuery.mockReturnValue({ data: { results: [] }, isLoading: false })
    localStorage.clear()
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      authResolved: true,
      theme: 'dark',
    })
  })

  it('shows member check-in action card with timeline layout', () => {
    useAuthStore.setState({
      user: {
        id: 1,
        email: 'member@test.com',
        username: 'member',
        first_name: 'Member',
        last_name: 'User',
        role: 'member',
        is_staff: false,
        memberprofile_id: 10,
        trainerprofile_id: null,
      },
      isAuthenticated: true,
      authResolved: true,
      theme: 'dark',
    })
    useAttendanceQuery.mockReturnValue({
      data: {
        results: [
          {
            id: 15,
            member: 10,
            check_in_time: '2026-04-01T10:00:00Z',
            notes: 'Torso',
          },
        ],
      },
      isLoading: false,
    })

    const { getByTestId, getByText } = renderWithProviders(<CheckInPage />)

    expect(getByTestId('checkin-submit')).toBeInTheDocument()
    expect(getByText('Registrar asistencia')).toBeInTheDocument()
    expect(getByText('Orden del día')).toBeInTheDocument()
    expect(getByText('Check-in confirmado')).toBeInTheDocument()
  })

  it('shows blocked state when backend rejects check-in by mora', async () => {
    useAuthStore.setState({
      user: {
        id: 1,
        email: 'member@test.com',
        username: 'member',
        first_name: 'Member',
        last_name: 'User',
        role: 'member',
        is_staff: false,
        memberprofile_id: 10,
        trainerprofile_id: null,
      },
      isAuthenticated: true,
      authResolved: true,
      theme: 'dark',
    })
    useAttendanceQuery.mockReturnValue({ data: { results: [] }, isLoading: false })
    registrarCheckIn.mockImplementation((_notes, options) => {
      options?.onError?.({
        response: {
          data: {
            blocked: true,
            reason: 'payment_overdue',
            days_overdue: 18,
          },
        },
      })
    })

    const user = userEvent.setup()
    const { getByTestId, getByText } = renderWithProviders(<CheckInPage />)

    await user.click(getByTestId('checkin-submit'))

    await waitFor(() => {
      expect(getByText('Check-in bloqueado')).toBeInTheDocument()
      expect(getByText(/18 días/)).toBeInTheDocument()
    })
  })

  it('hides member check-in action card for trainer and shows attendance overview copy', () => {
    useAuthStore.setState({
      user: {
        id: 2,
        email: 'trainer@test.com',
        username: 'trainer',
        first_name: 'Trainer',
        last_name: 'User',
        role: 'trainer',
        is_staff: false,
        memberprofile_id: null,
        trainerprofile_id: 4,
      },
      isAuthenticated: true,
      authResolved: true,
      theme: 'dark',
    })
    useAttendanceQuery.mockReturnValue({ data: { results: [] }, isLoading: false })

    const { queryByTestId, getAllByText } = renderWithProviders(<CheckInPage />)

    expect(queryByTestId('checkin-submit')).not.toBeInTheDocument()
    expect(getAllByText('Registros recientes del gimnasio').length).toBeGreaterThan(0)
  })
})
