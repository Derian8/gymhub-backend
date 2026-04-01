import { renderWithProviders } from '@/test/utils'
import { CheckInPage } from './CheckInPage'
import { useAuthStore } from '@/shared/store/authStore'

vi.mock('../hooks/useAttendance', () => ({
  useCheckInMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useAttendanceQuery: () => ({
    data: { results: [] },
    isLoading: false,
  }),
}))

describe('CheckInPage', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      authResolved: true,
      theme: 'dark',
    })
  })

  it('shows member check-in action card', () => {
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

    const { getByTestId, getByText } = renderWithProviders(<CheckInPage />)

    expect(getByTestId('checkin-submit')).toBeInTheDocument()
    expect(getByText('Registrar asistencia')).toBeInTheDocument()
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

    const { queryByTestId, getByText } = renderWithProviders(<CheckInPage />)

    expect(queryByTestId('checkin-submit')).not.toBeInTheDocument()
    expect(getByText('Registros recientes del gimnasio')).toBeInTheDocument()
  })

  it('shows member-specific attendance copy for trainer filtered by member', () => {
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

    const { getByText } = renderWithProviders(<CheckInPage />, { route: '/attendance?member=15' })

    expect(getByText('Asistencia Del Miembro')).toBeInTheDocument()
    expect(getByText('Registros recientes del miembro seleccionado')).toBeInTheDocument()
  })
})
