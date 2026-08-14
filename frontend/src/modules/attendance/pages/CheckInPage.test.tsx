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
        trainerprofile_id: null,
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

  it('hides member action card for administrator and shows attendance overview copy', () => {
    useAuthStore.setState({
      user: {
        id: 2,
        email: 'trainer@test.com',
        username: 'trainer',
        first_name: 'Trainer',
        last_name: 'User',
        role: 'trainer',
        is_staff: true,
        memberprofile_id: null,
        trainerprofile_id: 4,
      },
      isAuthenticated: true,
      authResolved: true,
      theme: 'dark',
    })
    useAttendanceQuery.mockReturnValue({
      data: {
        results: [
          {
            id: 91,
            member: 15,
            member_name: 'Derian Salas',
            member_email: 'derian@test.com',
            attendance_date: '2026-07-14',
            check_in_time: '2026-07-14T15:30:00-06:00',
            check_out_time: null,
            duration_minutes: null,
            checked_in_by_name: 'Derian Salas',
            notes: 'Pierna',
          },
        ],
      },
      isLoading: false,
    })

    const { queryByTestId, getByTestId, getAllByText } = renderWithProviders(<CheckInPage />)

    expect(queryByTestId('checkin-submit')).not.toBeInTheDocument()
    expect(getAllByText('Registro de asistencia').length).toBeGreaterThan(0)
    expect(getAllByText('Derian Salas').length).toBeGreaterThan(0)
    expect(getAllByText('derian@test.com').length).toBeGreaterThan(0)
    expect(getAllByText('Pierna').length).toBeGreaterThan(0)
    expect(getByTestId('attendance-search')).toBeInTheDocument()
    expect(getByTestId('attendance-date-filter')).toBeInTheDocument()
  })

  it('sends administrator search and date filters to attendance query', async () => {
    useAuthStore.setState({
      user: {
        id: 2,
        email: 'trainer@test.com',
        username: 'trainer',
        first_name: 'Trainer',
        last_name: 'User',
        role: 'trainer',
        is_staff: true,
        memberprofile_id: null,
        trainerprofile_id: 4,
      },
      isAuthenticated: true,
      authResolved: true,
      theme: 'dark',
    })
    useAttendanceQuery.mockReturnValue({ data: { results: [] }, isLoading: false })

    const user = userEvent.setup()
    const { getByTestId } = renderWithProviders(<CheckInPage />)

    await user.clear(getByTestId('attendance-date-filter'))
    await user.type(getByTestId('attendance-date-filter'), '2026-07-14')
    await user.type(getByTestId('attendance-search'), 'Derian')

    await waitFor(() => {
      expect(useAttendanceQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ date: '2026-07-14', search: 'Derian' }),
      )
    })
  })
})
