import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { useAuthStore } from '@/shared/store/authStore'
import { Sidebar } from './Sidebar'

const logoutMock = vi.fn()
const closeMobileMock = vi.fn()

afterEach(() => {
  cleanup()
})

vi.mock('@/modules/auth/hooks/useAuthMutations', () => ({
  useLogoutMutation: () => ({
    mutate: logoutMock,
    isPending: false,
  }),
}))

describe('Sidebar', () => {
  beforeEach(() => {
    logoutMock.mockReset()
    closeMobileMock.mockReset()
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
      theme: 'dark',
    })
  })

  it('stays off canvas on mobile until the drawer is opened', () => {
    const closedView = renderWithProviders(
      <Sidebar collapsed={false} mobileOpen={false} onToggle={vi.fn()} onCloseMobile={closeMobileMock} />,
    )

    expect(closedView.getByTestId('sidebar')).toHaveClass('-translate-x-full')
    expect(closedView.getByTestId('sidebar')).toHaveClass('lg:translate-x-0')

    closedView.unmount()

    const openView = renderWithProviders(
      <Sidebar collapsed={false} mobileOpen={true} onToggle={vi.fn()} onCloseMobile={closeMobileMock} />,
    )

    expect(openView.getByTestId('sidebar')).toHaveClass('translate-x-0')
  })

  it('closes the mobile drawer when a navigation item is selected', () => {
    const { getByTestId } = renderWithProviders(
      <Sidebar collapsed={false} mobileOpen={true} onToggle={vi.fn()} onCloseMobile={closeMobileMock} />,
    )

    fireEvent.click(getByTestId('nav-today'))

    expect(closeMobileMock).toHaveBeenCalledTimes(1)
  })

  it('keeps desktop collapse behavior without compacting the mobile drawer', () => {
    const { getByTestId, getByText } = renderWithProviders(
      <Sidebar collapsed={true} mobileOpen={true} onToggle={vi.fn()} onCloseMobile={closeMobileMock} />,
    )

    expect(getByTestId('sidebar')).toHaveClass('lg:w-16')
    expect(getByText('Inicio')).toBeInTheDocument()
  })

  it('shows only the essential member destinations', () => {
    const { getByRole, queryByText } = renderWithProviders(
      <Sidebar collapsed={false} mobileOpen={true} onToggle={vi.fn()} onCloseMobile={closeMobileMock} />,
    )

    expect(getByRole('link', { name: /Inicio/ })).toHaveAttribute('href', '/today')
    expect(getByRole('link', { name: /Historial/ })).toHaveAttribute('href', '/history')
    expect(getByRole('link', { name: /Perfil/ })).toHaveAttribute('href', '/profile')
    expect(queryByText('Mi seguimiento')).not.toBeInTheDocument()
    expect(queryByText('Nutrición')).not.toBeInTheDocument()
    expect(queryByText('Chat IA')).not.toBeInTheDocument()
    expect(queryByText('Pagos')).not.toBeInTheDocument()
  })

  it('shows full administrator navigation for former trainer accounts', () => {
    useAuthStore.setState((state) => ({
      ...state,
      user: state.user ? { ...state.user, role: 'admin', is_staff: true,  memberprofile_id: null } : null,
    }))

    const view = renderWithProviders(
      <Sidebar collapsed={false} mobileOpen={true} onToggle={vi.fn()} onCloseMobile={closeMobileMock} />,
    )

    expect(view.getByRole('link', { name: /Clientes/ })).toHaveAttribute('href', '/members')
    expect(view.getByRole('link', { name: /Rutinas/ })).toHaveAttribute('href', '/routines')
    fireEvent.click(view.getByRole('button', { name: /M.s/ }))
    expect(view.getByRole('link', { name: /Planes t.cnicos/ })).toHaveAttribute('href', '/plans')
    expect(view.getByRole('link', { name: /Reportes/ })).toHaveAttribute('href', '/reports')
  })
  it('keeps the administrator focused and moves secondary tools under More', () => {
    useAuthStore.setState((state) => ({
      ...state,
      user: state.user ? { ...state.user, role: 'admin', is_staff: true,  memberprofile_id: null } : null,
    }))

    const view = renderWithProviders(
      <Sidebar collapsed={false} mobileOpen={true} onToggle={vi.fn()} onCloseMobile={closeMobileMock} />,
    )

    expect(view.getByRole('link', { name: /Pagos/ })).toHaveAttribute('href', '/billing')
    expect(view.getByRole('link', { name: /Clientes/ })).toHaveAttribute('href', '/members')
    expect(view.getByRole('link', { name: /Rutinas/ })).toHaveAttribute('href', '/routines')
    expect(view.queryByRole('link', { name: /Reportes/ })).not.toBeInTheDocument()
    fireEvent.click(view.getByRole('button', { name: /Más/ }))
    expect(view.getByRole('link', { name: /Asistencia/ })).toHaveAttribute('href', '/attendance')
    expect(view.getByRole('link', { name: /Reportes/ })).toHaveAttribute('href', '/reports')
  })
})
