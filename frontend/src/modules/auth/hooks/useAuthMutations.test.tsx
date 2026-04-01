import { useEffect, type ReactElement } from 'react'
import { Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { useLoginMutation, useLogoutMutation } from './useAuthMutations'
import { useAuthStore } from '@/shared/store/authStore'
import { authApi } from '../api/authApi'

const navegarMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')

  return {
    ...actual,
    useNavigate: () => navegarMock,
  }
})

vi.mock('../api/authApi', () => ({
  authApi: {
    login: vi.fn(),
    logout: vi.fn(),
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

function renderMutation(ui: ReactElement, route = '/login') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[route]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/login" element={ui} />
          <Route path="/dashboard/member" element={<div>Dashboard Member</div>} />
          <Route path="/dashboard/trainer" element={<div>Dashboard Trainer</div>} />
          <Route path="/logout" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function LoginHarness() {
  const mutation = useLoginMutation()

  useEffect(() => {
    mutation.mutate({
      email: 'member@test.com',
      password: 'member123!',
    })
  }, [mutation])

  return <div>Login Trigger</div>
}

function LogoutHarness() {
  const mutation = useLogoutMutation()

  useEffect(() => {
    mutation.mutate()
  }, [mutation])

  return <div>Logout Trigger</div>
}

describe('useAuthMutations', () => {
  beforeEach(() => {
    localStorage.clear()
    navegarMock.mockReset()
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      authResolved: false,
      theme: 'dark',
    })
    vi.clearAllMocks()
  })

  it('stores authenticated member and redirects to member dashboard', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
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
      message: 'ok',
    })

    renderMutation(<LoginHarness />)

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true)
      expect(useAuthStore.getState().user?.role).toBe('member')
      expect(navegarMock).toHaveBeenCalledWith('/dashboard/member')
    })
  })

  it('clears state and redirects to login on logout success', async () => {
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
        trainerprofile_id: 5,
      },
      isAuthenticated: true,
      authResolved: true,
      theme: 'dark',
    })
    vi.mocked(authApi.logout).mockResolvedValue()

    renderMutation(<LogoutHarness />, '/logout')

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false)
      expect(useAuthStore.getState().user).toBeNull()
      expect(navegarMock).toHaveBeenCalledWith('/login', { replace: true })
    })
  })
})
