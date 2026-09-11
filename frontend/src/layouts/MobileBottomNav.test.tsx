import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent } from '@testing-library/react'
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
        trainerprofile_id: null,
      },
      isAuthenticated: true,
      authResolved: true,
      activeContext: 'cliente',
      theme: 'dark',
    })
  })

  it('shows the member primary destinations and secondary sheet', () => {
    const view = renderWithProviders(<MobileBottomNav />, { route: '/today' })

    expect(view.getByTestId('mobile-bottom-nav')).toBeInTheDocument()
    expect(view.getByRole('link', { name: 'Hoy' })).toHaveAttribute('href', '/today')
    expect(view.getByRole('button', { name: 'Más opciones' })).toBeInTheDocument()

    fireEvent.click(view.getByRole('button', { name: 'Más opciones' }))

    expect(view.getByTestId('mobile-more-sheet')).toBeInTheDocument()
    expect(view.getByRole('link', { name: 'Progreso' })).toHaveAttribute('href', '/progress')
    expect(view.getByRole('link', { name: 'Perfil' })).toHaveAttribute('href', '/profile')
    fireEvent.click(view.getByTestId('mobile-logout-button'))
    expect(logoutMock).toHaveBeenCalledTimes(1)
  })

  it('uses the active instructor context destinations', () => {
    useAuthStore.setState((state) => ({
      ...state,
      activeContext: 'instructor',
      user: state.user ? { ...state.user, role: 'trainer', trainerprofile_id: 7, memberprofile_id: null } : null,
    }))

    const view = renderWithProviders(<MobileBottomNav />)

    expect(view.getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/dashboard/trainer')
    expect(view.getByRole('link', { name: 'Clientes' })).toHaveAttribute('href', '/members')
    expect(view.getByRole('link', { name: 'Planes' })).toHaveAttribute('href', '/plans')
  })
})
