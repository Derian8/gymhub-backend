import { cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@/test/utils'
import { CheckInPage } from './CheckInPage'
import { useAuthStore } from '@/shared/store/authStore'

const registrarCheckIn = vi.fn()
const registrarCheckOut = vi.fn()
const useAttendanceQuery = vi.fn()
const listarSesiones = vi.fn()

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

vi.mock('@/modules/progress/api/progressApi', () => ({
  progressApi: {
    sessions: () => listarSesiones(),
  },
}))

vi.mock('@/modules/members/hooks/useMembers', () => ({
  useMembersQuery: () => ({ data: { results: [] }, isLoading: false }),
}))

describe('CheckInPage', () => {
  beforeEach(() => {
    cleanup()
    registrarCheckIn.mockReset()
    registrarCheckOut.mockReset()
    useAttendanceQuery.mockReset()
    listarSesiones.mockReset()
    listarSesiones.mockResolvedValue({ results: [] })
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

    expect(getByTestId('open-routine-link')).toHaveAttribute('href', '/today')
    expect(getByText('Entrada desde tu rutina')).toBeInTheDocument()
    expect(getByText('Orden del día')).toBeInTheDocument()
    expect(getByText('Check-in confirmado')).toBeInTheDocument()
    expect(getByTestId('member-workout-records')).toBeInTheDocument()
  })

  it('allows the member to register checkout for today', async () => {
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

      },
      isAuthenticated: true,
      authResolved: true,
      theme: 'dark',
    })
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
    useAttendanceQuery.mockReturnValue({ data: { results: [{
      id: 22,
      member: 10,
      attendance_date: today,
      check_in_time: `${today}T08:00:00-06:00`,
      check_out_time: null,
      notes: '',
    }] }, isLoading: false })
    registrarCheckOut.mockImplementation((_id, options) => {
      options?.onSuccess?.()
    })

    const user = userEvent.setup()
    const { getByTestId } = renderWithProviders(<CheckInPage />)

    await user.click(getByTestId('checkout-submit'))

    await waitFor(() => {
      expect(registrarCheckOut).toHaveBeenCalledWith(22)
    })
  })

  it('shows the QR scanner for administrator attendance', () => {
    useAuthStore.setState({
      user: {
        id: 2,
        email: 'trainer@test.com',
        username: 'trainer',
        first_name: 'Trainer',
        last_name: 'User',
        role: 'admin',
        is_staff: true,
        memberprofile_id: null,

      },
      isAuthenticated: true,
      authResolved: true,
      theme: 'dark',
    })
    const { getByTestId, getAllByText } = renderWithProviders(<CheckInPage />)

    expect(getAllByText('Registrar asistencia').length).toBeGreaterThan(0)
    expect(getByTestId('admin-qr-scanner')).toBeInTheDocument()
  })

  it('does not load member attendance history in the administrator scanner', () => {
    useAuthStore.setState({
      user: {
        id: 2,
        email: 'trainer@test.com',
        username: 'trainer',
        first_name: 'Trainer',
        last_name: 'User',
        role: 'admin',
        is_staff: true,
        memberprofile_id: null,

      },
      isAuthenticated: true,
      authResolved: true,
      theme: 'dark',
    })
    useAttendanceQuery.mockReturnValue({ data: { results: [] }, isLoading: false })

    const { getByTestId } = renderWithProviders(<CheckInPage />)
    expect(getByTestId('admin-qr-scanner')).toBeInTheDocument()
    expect(useAttendanceQuery).not.toHaveBeenCalled()
  })
})
