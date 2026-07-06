import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { ProfilePage } from './ProfilePage'
import { useAuthStore } from '@/shared/store/authStore'

const updateMeMock = vi.fn()

vi.mock('@/modules/auth/hooks/useAuthMutations', () => ({
  useUpdateMeMutation: () => ({
    mutate: updateMeMock,
    isPending: false,
  }),
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
        role: 'trainer',
        is_staff: true,
        memberprofile_id: null,
        trainerprofile_id: 8,
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
    expect(getAllByText('Entrenador').length).toBeGreaterThan(0)
    expect(getByText('Staff')).toBeInTheDocument()
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
})
