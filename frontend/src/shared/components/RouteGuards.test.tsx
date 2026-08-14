import { Routes, Route } from 'react-router-dom'
import { renderWithProviders } from '@/test/utils'
import { ProtectedRoute, PublicRoute } from './RouteGuards'
import { useAuthStore } from '@/shared/store/authStore'

describe('RouteGuards', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      authResolved: true,
      theme: 'dark',
    })
  })

  it('redirects unauthenticated users to login', () => {
    const { getByText } = renderWithProviders(
      <Routes>
        <Route
          path="/privado"
          element={(
            <ProtectedRoute>
              <div>Privado</div>
            </ProtectedRoute>
          )}
        />
        <Route path="/login" element={<div>Login</div>} />
      </Routes>,
      { route: '/privado' },
    )

    expect(getByText('Login')).toBeInTheDocument()
  })

  it('redirects member away from trainer-only route', () => {
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

    const { getByText } = renderWithProviders(
      <Routes>
        <Route
          path="/trainer"
          element={(
            <ProtectedRoute requiredRole="trainer">
              <div>Trainer Area</div>
            </ProtectedRoute>
          )}
        />
        <Route path="/dashboard/member" element={<div>Dashboard de cliente</div>} />
      </Routes>,
      { route: '/trainer' },
    )

    expect(getByText('Dashboard de cliente')).toBeInTheDocument()
  })

  it('redirects authenticated trainer away from public route', () => {
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

    const { getByText } = renderWithProviders(
      <Routes>
        <Route
          path="/login"
          element={(
            <PublicRoute>
              <div>Login</div>
            </PublicRoute>
          )}
        />
        <Route path="/dashboard/trainer" element={<div>Dashboard Trainer</div>} />
      </Routes>,
      { route: '/login' },
    )

    expect(getByText('Dashboard Trainer')).toBeInTheDocument()
  })

  it('shows loading screen while auth is resolving', () => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      authResolved: false,
      theme: 'dark',
    })

    const { getByTestId } = renderWithProviders(
      <Routes>
        <Route
          path="/privado"
          element={(
            <ProtectedRoute>
              <div>Privado</div>
            </ProtectedRoute>
          )}
        />
      </Routes>,
      { route: '/privado' },
    )

    expect(getByTestId('auth-loading')).toBeInTheDocument()
  })
})
