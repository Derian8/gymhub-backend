import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { ProfilePage } from './ProfilePage'
import { useAuthStore } from '@/shared/store/authStore'

const updateMeMock = vi.fn()

vi.mock('@/modules/members/hooks/useMembers', () => ({
  useMemberDashboardQuery: () => ({ data: {
    membership_plan_name: 'Mensual', estado_cliente: 'membresia_activa',
    membership_access_allowed: true, membership_expires_at: '2026-12-11', days_until_due: 23,
  } }),
}))

vi.mock('@/modules/auth/hooks/useAuthMutations', () => ({
  useUpdateMeMutation: () => ({
    mutate: updateMeMock,
    isPending: false,
  }),
  useLogoutMutation: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/shared/api/client', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { nombre: '', telefono: '', correo: '', direccion: '' } }),
    patch: vi.fn().mockResolvedValue({ data: { nombre: '', telefono: '', correo: '', direccion: '' } }),
  },
}))

describe('ProfilePage', () => {
  beforeEach(() => {
    updateMeMock.mockReset()
    useAuthStore.setState({
      user: {
        id: 3,
        email: 'trainer1@gymhub.com',
        username: 'trainer1',
        first_name: 'Carlos',
        last_name: 'Mendoza',
        role: 'admin',
        is_staff: true,
        memberprofile_id: null,

      },
      isAuthenticated: true,
      authResolved: true,
      theme: 'dark',
    })
  })

  it('renders editable account information for the authenticated user', () => {
    const { getByTestId, getByDisplayValue, getByText, getAllByText } = renderWithProviders(<ProfilePage />)

    expect(getByTestId('profile-page')).toBeInTheDocument()
    expect(getByDisplayValue('Carlos')).toBeInTheDocument()
    expect(getByDisplayValue('Mendoza')).toBeInTheDocument()
    expect(getByDisplayValue('trainer1@gymhub.com')).toBeInTheDocument()
    expect(getByText('@trainer1')).toBeInTheDocument()
    expect(getAllByText('Administrador').length).toBeGreaterThan(0)
  })

  it('submits updated profile data without changing role', async () => {
    const user = userEvent.setup()
    const { getByTestId } = renderWithProviders(<ProfilePage />)

    await user.clear(getByTestId('profile-first-name-input'))
    await user.type(getByTestId('profile-first-name-input'), 'Carla')
    await user.clear(getByTestId('profile-email-input'))
    await user.type(getByTestId('profile-email-input'), 'Nueva.Cuenta@GMAIL.com')
    await user.click(getByTestId('profile-save-button'))

    expect(updateMeMock).toHaveBeenCalledWith({
      email: 'Nueva.Cuenta@GMAIL.com',
      first_name: 'Carla',
      last_name: 'Mendoza',
    })
  })

  it('shows the membership card and its link in the client profile', () => {
    useAuthStore.setState({
      user: { ...useAuthStore.getState().user!, role: 'member', is_staff: false, memberprofile_id: 12 },
      activeContext: 'cliente',
    })
    const { getByTestId } = renderWithProviders(<ProfilePage />)
    const tarjeta = getByTestId('profile-membership-spotlight')
    expect(tarjeta).toHaveTextContent('Mensual')
    expect(tarjeta).toHaveTextContent('Membresía activa')
    expect(tarjeta).toHaveTextContent('Acceso permitido')
    expect(tarjeta).toHaveTextContent('Vence el 11/12/2026')
    expect(tarjeta).toHaveTextContent('23 día(s) restantes')
    expect(getByTestId('profile-membership-link')).toHaveAttribute('href', '/membership')
  })
})
