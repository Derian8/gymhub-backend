import { fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { BillingPage } from './BillingPage'

const createPlanMock = vi.fn()
const updatePlanMock = vi.fn()
const createSubscriptionMock = vi.fn()
const updateSubscriptionMock = vi.fn()

vi.mock('../hooks/useBilling', () => ({
  usePaymentRecordsQuery: () => ({
    data: {
      results: [
        { id: 1, schedule: 1, due_date: '2026-03-05', amount: '50.00', paid_at: '2026-03-05T12:00:00Z', status: 'paid', method_used: 1, notes: '', days_overdue: 0 },
        { id: 2, schedule: 2, due_date: '2026-03-10', amount: '60.00', paid_at: null, status: 'pending', method_used: null, notes: 'Pendiente', days_overdue: 0 },
        { id: 3, schedule: 3, due_date: '2026-03-01', paid_at: null, amount: '70.00', status: 'late', method_used: null, notes: '', days_overdue: 5 },
      ],
    },
    isLoading: false,
  }),
  useMembershipPlansQuery: () => ({
    data: {
      results: [
        { id: 8, trainer: 9, trainer_nombre: 'Trainer Demo', name: 'Premium', description: 'Acceso total', price_monthly: '79.00', duration_months: 1, features: 'Todo incluido', is_active: true },
      ],
    },
    isLoading: false,
  }),
  usePaymentSchedulesQuery: () => ({
    data: { results: [] },
    isLoading: false,
  }),
  useMemberSubscriptionsQuery: () => ({
    data: { results: [] },
    isLoading: false,
  }),
  useCreateMembershipPlanMutation: () => ({ mutate: createPlanMock, isPending: false }),
  useUpdateMembershipPlanMutation: () => ({ mutate: updatePlanMock, isPending: false }),
  useCreateMemberSubscriptionMutation: () => ({ mutate: createSubscriptionMock, isPending: false }),
  useUpdateMemberSubscriptionMutation: () => ({ mutate: updateSubscriptionMock, isPending: false }),
}))

describe('BillingPage', () => {
  beforeEach(() => {
    createPlanMock.mockReset()
    updatePlanMock.mockReset()
    createSubscriptionMock.mockReset()
    updateSubscriptionMock.mockReset()
  })

  it('renders billing summary, payment rows and membership plans', () => {
    const { getAllByText, getByTestId, getByText } = renderWithProviders(<BillingPage />)

    expect(getByTestId('billing-page')).toBeInTheDocument()
    expect(getByText('Pendientes')).toBeInTheDocument()
    expect(getAllByText('En mora')).toHaveLength(2)
    expect(getByTestId('payment-row-1')).toBeInTheDocument()
    expect(getByTestId('payment-row-2')).toBeInTheDocument()
    expect(getByTestId('payment-row-3')).toBeInTheDocument()
    expect(getByTestId('plan-card-8')).toBeInTheDocument()
    expect(getByText('Premium')).toBeInTheDocument()
    expect(getByText('Planes configurables del trainer')).toBeInTheDocument()
  })

  it('shows member-specific header when member filter is present', () => {
    const { getByText } = renderWithProviders(<BillingPage />, { route: '/billing?member=15' })

    expect(getByText('Facturación Del Miembro')).toBeInTheDocument()
    expect(getByText('Pagos, estados y vencimientos del miembro seleccionado')).toBeInTheDocument()
    expect(getByText('Suscripción del member')).toBeInTheDocument()
  })

  it('creates a member subscription with an agreed price', () => {
    const { getAllByRole, getAllByTestId } = renderWithProviders(<BillingPage />, { route: '/billing?member=15' })

    fireEvent.change(getAllByTestId('subscription-plan-select')[0], { target: { value: '8' } })
    fireEvent.change(getAllByTestId('subscription-agreed-price-input')[0], { target: { value: '72.00' } })
    fireEvent.click(getAllByRole('button', { name: 'Crear suscripción' })[0])

    expect(createSubscriptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        member: 15,
        plan: 8,
        agreed_price: '72.00',
        recurrence_type: 'monthly',
      }),
    )
  })
})
