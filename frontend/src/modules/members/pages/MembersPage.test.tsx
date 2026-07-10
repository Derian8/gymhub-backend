import { renderWithProviders } from '@/test/utils'
import { within } from '@testing-library/react'
import { MembersPage } from './MembersPage'

vi.mock('../hooks/useMembers', () => ({
  useMembersQuery: () => ({
    data: {
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 15,
          user: null,
          email: 'maria@test.com',
          full_name: 'Maria Perez',
          membership_plan: 2,
          phone: '8888-9999',
          birth_date: null,
          emergency_contact: '',
          join_date: '2026-03-01',
          is_active: true,
          photo: null,
          riesgo_adherencia: 82,
          nivel_riesgo: 'high',
          motivos_riesgo: ['Tiene pagos en mora', 'Lleva 12 días sin check-in'],
          days_since_last_checkin: 12,
          days_since_last_session: 9,
          days_since_last_progress: 26,
          estado_prescripcion: 'incompleta',
          tiene_plan_activo: true,
          prescripcion_lista_para_member: false,
          membresia_actual: {
            subscription_id: 44,
            plan_id: 2,
            plan_name: 'Premium mensual',
            agreed_price: '50000.00',
            recurrence_type: 'monthly',
            status: 'active',
            is_active: true,
            start_date: '2026-03-01',
            next_billing_date: '2026-04-01',
            renewal_date: '2026-03-31',
            current_period_start: '2026-03-01',
            current_period_end: '2026-03-31',
            grace_period_days: 7,
            payment_status: 'paid',
            days_until_due: 8,
            days_overdue: null,
            access_allowed: true,
            access_reason: null,
          },
        },
      ],
    },
    isLoading: false,
  }),
}))

describe('MembersPage', () => {
  it('renders member list with filters and detail action', () => {
    const { getByTestId } = renderWithProviders(<MembersPage />)
    const row = getByTestId('member-row-15')

    expect(getByTestId('members-page')).toBeInTheDocument()
    expect(getByTestId('members-search')).toBeInTheDocument()
    expect(getByTestId('payment-filter')).toBeInTheDocument()
    expect(getByTestId('risk-filter')).toBeInTheDocument()
    expect(getByTestId('prescription-filter')).toBeInTheDocument()
    expect(getByTestId('members-ordering')).toBeInTheDocument()
    expect(row).toBeInTheDocument()
    expect(within(row).getByText('Maria Perez')).toBeInTheDocument()
    expect(within(row).getByText(/Alto/i)).toBeInTheDocument()
    expect(getByTestId('member-membership-15')).toHaveTextContent('Premium mensual')
    expect(getByTestId('member-membership-15')).toHaveTextContent('Suscripción #44')
    expect(getByTestId('member-membership-15')).toHaveTextContent('₡50 000')
    expect(getByTestId('member-membership-15')).toHaveTextContent('Vigente')
    expect(within(row).getByText(/Tiene pagos en mora/i)).toBeInTheDocument()
    expect(within(row).getByText(/Prescripción incompleta/i)).toBeInTheDocument()
    expect(getByTestId('member-program-15')).toHaveAttribute('href', '/members/15/program')
    expect(getByTestId('member-detail-15')).toHaveAttribute('href', '/members/15')
  })
})
