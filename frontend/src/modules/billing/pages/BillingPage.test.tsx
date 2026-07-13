import { fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { BillingPage } from './BillingPage'

const createSubscriptionMock = vi.fn()
const updateSubscriptionMock = vi.fn()
const markPaymentAsPaidMock = vi.fn()

vi.mock('../hooks/useBilling', () => ({
  usePaymentRecordsQuery: () => ({
    data: {
      results: [
        { id: 1, schedule: 1, due_date: '2026-03-05', amount: '50.00', paid_at: '2026-03-05T12:00:00Z', status: 'paid', method_used: 1, payment_reference: 'TRX-001', receipt_issued_at: '2026-03-05T12:01:00Z', receipt_number: 'REC-20260305-1', notes: '', days_overdue: 0, plan_name: 'Premium' },
        { id: 2, schedule: 2, due_date: '2026-03-10', amount: '60.00', paid_at: null, status: 'pending', method_used: null, payment_reference: '', receipt_issued_at: null, receipt_number: null, notes: 'Pendiente', days_overdue: 0, plan_name: 'Premium' },
        { id: 3, schedule: 3, due_date: '2026-03-01', paid_at: null, amount: '70.00', status: 'late', method_used: null, payment_reference: '', receipt_issued_at: null, receipt_number: null, notes: '', days_overdue: 5, plan_name: 'Premium' },
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
  useCreateMemberSubscriptionMutation: () => ({ mutate: createSubscriptionMock, isPending: false }),
  useUpdateMemberSubscriptionMutation: () => ({ mutate: updateSubscriptionMock, isPending: false }),
  useMarkPaymentAsPaidMutation: () => ({ mutate: markPaymentAsPaidMock, isPending: false }),
}))

vi.mock('@/modules/members/hooks/useMembers', () => ({
  useMembersQuery: () => ({
    data: {
      count: 2,
      next: null,
      previous: null,
      results: [
        {
          id: 15,
          user: null,
          email: 'maria@test.com',
          full_name: 'Maria Perez',
          membership_plan: 8,
          phone: '8888-9999',
          birth_date: null,
          emergency_contact: '',
          join_date: '2026-03-01',
          is_active: true,
          photo: null,
          membresia_actual: {
            subscription_id: 55,
            plan_id: 8,
            plan_name: 'Premium',
            agreed_price: '79000.00',
            recurrence_type: 'biweekly',
            status: 'active',
            is_active: true,
            start_date: '2026-03-01',
            next_billing_date: '2026-03-15',
            renewal_date: '2026-03-14',
            current_period_start: '2026-03-01',
            current_period_end: '2026-03-14',
            grace_period_days: 2,
            payment_status: 'paid',
            days_until_due: 4,
            days_overdue: null,
            access_allowed: true,
            access_reason: null,
          },
        },
        {
          id: 16,
          user: null,
          email: 'plan-sin-cobro@test.com',
          full_name: 'Cliente Plan Sin Cobro',
          membership_plan: 8,
          membership_plan_nombre: 'Premium',
          phone: '8888-0000',
          birth_date: null,
          emergency_contact: '',
          join_date: '2026-03-02',
          is_active: true,
          photo: null,
          membresia_actual: null,
        },
      ],
    },
    isLoading: false,
  }),
}))

describe('BillingPage', () => {
  beforeEach(() => {
    createSubscriptionMock.mockReset()
    updateSubscriptionMock.mockReset()
    markPaymentAsPaidMock.mockReset()
  })

  it('renders billing summary, payment rows and membership portfolio without plan catalog', () => {
    const { getAllByText, getByTestId, getByText, queryByText } = renderWithProviders(<BillingPage />)

    expect(getByTestId('billing-page')).toBeInTheDocument()
    expect(getByText('Pendientes')).toBeInTheDocument()
    expect(getByText('Recibos emitidos')).toBeInTheDocument()
    expect(getAllByText('En mora')).toHaveLength(2)
    expect(getByTestId('payment-row-1')).toBeInTheDocument()
    expect(getByTestId('payment-row-2')).toBeInTheDocument()
    expect(getByTestId('payment-row-3')).toBeInTheDocument()
    expect(getAllByText('Premium').length).toBeGreaterThan(0)
    expect(queryByText('Planes de membresía configurables')).not.toBeInTheDocument()
    expect(getByTestId('membership-portfolio')).toHaveTextContent('Cartera de membresías')
    expect(getByTestId('membership-portfolio')).toHaveTextContent('Membresías por miembro')
    expect(getByTestId('portfolio-member-15')).toHaveTextContent('Maria Perez')
    expect(getByTestId('portfolio-member-15')).toHaveTextContent('#55')
    expect(getByTestId('portfolio-member-15')).toHaveTextContent('₡79 000')
    expect(getByTestId('portfolio-member-15')).toHaveTextContent('Vigente')
    expect(getByTestId('portfolio-member-16')).toHaveTextContent('Cliente Plan Sin Cobro')
    expect(getByTestId('portfolio-member-16')).toHaveTextContent('Sin membresía')
    expect(getByTestId('portfolio-member-16')).toHaveTextContent('Sin precio')
  })

  it('shows member-specific header when member filter is present', () => {
    const { getByTestId, getByText, queryByText } = renderWithProviders(<BillingPage />, { route: '/billing?member=15' })

    expect(getByText('Facturación del miembro')).toBeInTheDocument()
    expect(getByText('Cobros, recibos y estado comercial del miembro seleccionado')).toBeInTheDocument()
    expect(getByText('Membresía del miembro')).toBeInTheDocument()
    expect(queryByText(/Plan asignado:/)).not.toBeInTheDocument()
    expect(getByTestId('subscription-name-input')).toHaveValue('')
    expect(getByTestId('subscription-agreed-price-input')).toHaveValue(0)
  })

  it('creates a member subscription with an agreed price', () => {
    const { getAllByRole, getAllByTestId } = renderWithProviders(<BillingPage />, { route: '/billing?member=15' })

    fireEvent.change(getAllByTestId('subscription-name-input')[0], { target: { value: 'Mensual personalizada' } })
    fireEvent.change(getAllByTestId('subscription-agreed-price-input')[0], { target: { value: '72.00' } })
    fireEvent.change(getAllByTestId('subscription-recurrence-select')[0], { target: { value: 'biweekly' } })
    fireEvent.click(getAllByRole('button', { name: 'Crear suscripción y primer cobro' })[0])

    expect(createSubscriptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        member: 15,
        membership_name: 'Mensual personalizada',
        agreed_price: '72.00',
        recurrence_type: 'biweekly',
      }),
    )
  })

  it('offers short billing recurrences for direct memberships', () => {
    const { getByTestId } = renderWithProviders(<BillingPage />, { route: '/billing?member=15' })
    const recurrenceSelect = getByTestId('subscription-recurrence-select') as HTMLSelectElement
    const labels = Array.from(recurrenceSelect.options).map((option) => option.text)

    expect(labels).toEqual(expect.arrayContaining(['Diario', 'Semanal', 'Quincenal', 'Mensual', 'Trimestral', 'Anual']))
  })

  it('registers a payment from the billing table', () => {
    const { getByTestId } = renderWithProviders(<BillingPage />, { route: '/billing?member=15' })

    fireEvent.change(getByTestId('mark-paid-2').parentElement?.querySelector('input') as HTMLInputElement, {
      target: { value: 'REF-200' },
    })
    fireEvent.change(getByTestId('mark-paid-2').parentElement?.querySelector('textarea') as HTMLTextAreaElement, {
      target: { value: 'Transferencia verificada' },
    })
    fireEvent.click(getByTestId('mark-paid-2'))

    expect(markPaymentAsPaidMock).toHaveBeenCalledWith({
      id: 2,
      payload: {
        payment_reference: 'REF-200',
        notes: 'Transferencia verificada',
      },
    })
  })
})
