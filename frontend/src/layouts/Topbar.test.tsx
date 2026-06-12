import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { useAuthStore } from '@/shared/store/authStore'
import { Topbar } from './Topbar'

afterEach(() => {
  cleanup()
})

vi.mock('@/modules/alerts/hooks/useAlerts', () => ({
  useNotificationsQuery: () => ({
    data: { results: [] },
  }),
}))

describe('Topbar', () => {
  beforeEach(() => {
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

  it('uses the full viewport width on mobile and desktop offsets only on lg screens', () => {
    const expandedView = renderWithProviders(
      <Topbar onMenuClick={vi.fn()} sidebarCollapsed={false} />,
    )

    expect(expandedView.getByTestId('topbar')).toHaveClass('left-0')
    expect(expandedView.getByTestId('topbar')).toHaveClass('lg:left-64')

    expandedView.unmount()

    const collapsedView = renderWithProviders(
      <Topbar onMenuClick={vi.fn()} sidebarCollapsed={true} />,
    )

    expect(collapsedView.getByTestId('topbar')).toHaveClass('left-0')
    expect(collapsedView.getByTestId('topbar')).toHaveClass('lg:left-16')
  })
})
