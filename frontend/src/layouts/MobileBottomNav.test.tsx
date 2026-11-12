import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { useAuthStore } from '@/shared/store/authStore'
import { MobileBottomNav } from './MobileBottomNav'

const logoutMock = vi.fn()

vi.mock('@/modules/auth/hooks/useAuthMutations', () => ({
  useLogoutMutation: () => ({
    mutate: logoutMock,
    isPending: false,
  }),
}))

afterEach(() => {
  cleanup()
})

describe('MobileBottomNav', () => {
  beforeEach(() => {
    logoutMock.mockReset()
    useAuthStore.setState({
      user: {
        id: 1,
        email: 'member@test.com',
        username: 'member',
        first_name: 'Ana',
        last_name: 'Member',
        role: 'member',
        is_staff: false,
        memberprofile_id: 10,

      },
      isAuthenticated: true,
      authResolved: true,
      activeContext: 'cliente',
      theme: 'dark',
    })
  })

  it('shows the member primary destinations without administrator tools', () => {
    const view = renderWithProviders(<MobileBottomNav />, { route: '/today' })

    expect(view.getByTestId('mobile-bottom-nav')).toBeInTheDocument()
    expect(view.getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/today')
    expect(view.getByRole('link', { name: 'Perfil' })).toHaveAttribute('href', '/profile')
    expect(view.queryByRole('button', { name: 'Más opciones' })).not.toBeInTheDocument()
  })

  it('uses administrator destinations for the administrator account', () => {
    useAuthStore.setState((state) => ({
      ...state,
      activeContext: 'administrador',
      user: state.user ? { ...state.user, role: 'admin', is_staff: true,  memberprofile_id: null } : null,
    }))

    const view = renderWithProviders(<MobileBottomNav />)

    expect(view.getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/dashboard/admin')
    expect(view.getByRole('link', { name: 'Clientes' })).toHaveAttribute('href', '/members')
    expect(view.getByRole('link', { name: 'Rutinas' })).toHaveAttribute('href', '/routines')
  })
})
