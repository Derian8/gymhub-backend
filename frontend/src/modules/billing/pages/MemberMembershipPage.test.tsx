import { renderWithProviders } from '@/test/utils'
import { useAuthStore } from '@/shared/store/authStore'
import { MemberMembershipPage } from './MemberMembershipPage'

const dashboardMock = vi.fn()

vi.mock('@/modules/members/hooks/useMembers', () => ({
  useMemberDashboardQuery: () => dashboardMock(),
}))

describe('MemberMembershipPage', () => {
  beforeEach(() => {
    localStorage.clear()
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

  it('renders an active membership with dates, price and access', () => {
    dashboardMock.mockReturnValue({
      data: {
        payment_status: 'paid',
        days_until_due: 9,
        days_overdue: null,
        membership_plan_name: 'Premium mensual',
        membership_expires_at: '2026-03-31',
        membership_agreed_price: '50000.00',
        membership_recurrence_type: 'monthly',
        membership_next_billing_date: '2026-04-01',
        membership_access_allowed: true,
      },
      isLoading: false,
    })

    const { getByTestId } = renderWithProviders(<MemberMembershipPage />)

    expect(getByTestId('member-membership-page')).toBeInTheDocument()
    expect(getByTestId('membership-hero')).toHaveTextContent('Premium mensual')
    expect(getByTestId('membership-hero')).toHaveTextContent('Membresía vigente')
    expect(getByTestId('membership-hero')).toHaveTextContent('₡50 000')
    expect(getByTestId('membership-hero')).toHaveTextContent('mes')
    expect(getByTestId('membership-hero')).toHaveTextContent('31/03/2026')
    expect(getByTestId('membership-hero')).toHaveTextContent('Acceso permitido')
  })

  it('renders the no-membership state clearly', () => {
    dashboardMock.mockReturnValue({
      data: {
        payment_status: null,
        days_until_due: null,
        days_overdue: null,
        membership_plan_name: null,
        membership_expires_at: null,
        membership_agreed_price: null,
        membership_recurrence_type: null,
        membership_next_billing_date: null,
        membership_access_allowed: false,
      },
      isLoading: false,
    })

    const { getByTestId } = renderWithProviders(<MemberMembershipPage />)

    expect(getByTestId('membership-hero')).toHaveTextContent('Aún no tienes una membresía asignada')
    expect(getByTestId('membership-hero')).toHaveTextContent('Sin membresía')
  })

  it('renders an assigned plan without billing as a pending activation', () => {
    dashboardMock.mockReturnValue({
      data: {
        payment_status: null,
        days_until_due: null,
        days_overdue: null,
        membership_plan_name: 'Ganancia de masa',
        membership_expires_at: null,
        membership_agreed_price: null,
        membership_recurrence_type: null,
        membership_next_billing_date: null,
        membership_access_allowed: false,
      },
      isLoading: false,
    })

    const { getByTestId } = renderWithProviders(<MemberMembershipPage />)

    expect(getByTestId('membership-hero')).toHaveTextContent('Ganancia de masa')
    expect(getByTestId('membership-hero')).toHaveTextContent('Sin membresía activa')
    expect(getByTestId('membership-hero')).toHaveTextContent('Aún no tienes una membresía activa')
  })
})
