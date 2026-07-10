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
        trainerprofile_id: null,
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
    expect(getByText('Entrenamiento')).toBeInTheDocument()
  })

  it('shows only the essential member destinations including membership', () => {
    const { getByRole, getByTestId, queryByText } = renderWithProviders(
      <Sidebar collapsed={false} mobileOpen={true} onToggle={vi.fn()} onCloseMobile={closeMobileMock} />,
    )

    expect(getByRole('link', { name: /Mi membresía/ })).toHaveAttribute('href', '/membership')
    expect(getByRole('link', { name: /Entrenamiento/ })).toHaveAttribute('href', '/today')
    expect(getByRole('link', { name: /Mi Plan/ })).toHaveAttribute('href', '/plans/my')
    expect(getByRole('link', { name: /Registros/ })).toHaveAttribute('href', '/records')
    expect(getByRole('link', { name: /Progreso/ })).toHaveAttribute('href', '/progress')
    expect(getByTestId('nav-membership').compareDocumentPosition(getByTestId('nav-today')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(queryByText('Nutrición')).not.toBeInTheDocument()
    expect(queryByText('Chat IA')).not.toBeInTheDocument()
    expect(queryByText('Pagos')).not.toBeInTheDocument()
  })
})
