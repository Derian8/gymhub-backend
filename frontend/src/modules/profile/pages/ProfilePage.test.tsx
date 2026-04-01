import { renderWithProviders } from '@/test/utils'
import { ProfilePage } from './ProfilePage'
import { useAuthStore } from '@/shared/store/authStore'

describe('ProfilePage', () => {
  beforeEach(() => {
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

  it('renders account information for the authenticated user', () => {
    const { getByTestId, getByText } = renderWithProviders(<ProfilePage />)

    expect(getByTestId('profile-page')).toBeInTheDocument()
    expect(getByText('Carlos Mendoza')).toBeInTheDocument()
    expect(getByText('trainer1@gymhub.com')).toBeInTheDocument()
    expect(getByText('@trainer1')).toBeInTheDocument()
    expect(getByText('Entrenador')).toBeInTheDocument()
    expect(getByText('Staff')).toBeInTheDocument()
  })
})
