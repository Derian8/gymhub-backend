import { fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { BillingPage } from './BillingPage'

const createSubscriptionMock = vi.fn()
const updateSubscriptionMock = vi.fn()
const createMembershipMock = vi.fn()
const renewMembershipMock = vi.fn()
const suspendMembershipMock = vi.fn()
const cancelMembershipMock = vi.fn()
const markPaymentAsPaidMock = vi.fn()
let subscriptionsMock: Array<Record<string, unknown>> = []
let membershipsMock: Array<Record<string, unknown>> = []
let membersMock: Array<Record<string, unknown>> = []
let membersQueryParams: Array<Record<string, unknown> | undefined> = []

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
    data: { results: subscriptionsMock },
    isLoading: false,
  }),
  useMemberMembershipsQuery: () => ({
    data: { results: membershipsMock },
    isLoading: false,
  }),
  useMembershipPlansQuery: () => ({
    data: {
      results: [
        {
          id: 8,
          trainer: 3,
          name: 'Premium',
          description: 'Plan premium',
          price: '79000.00',
          recurrence_type: 'biweekly',
          grace_period_days: 2,
          features: '',
          is_active: true,
        },
      ],
    },
    isLoading: false,
  }),
  useCreateMemberSubscriptionMutation: () => ({ mutate: createSubscriptionMock, isPending: false }),
  useUpdateMemberSubscriptionMutation: () => ({ mutate: updateSubscriptionMock, isPending: false }),
  useCreateMemberMembershipMutation: () => ({ mutate: createMembershipMock, isPending: false }),
  useRenewMemberMembershipMutation: () => ({ mutate: renewMembershipMock, isPending: false }),
  useSuspendMemberMembershipMutation: () => ({ mutate: suspendMembershipMock, isPending: false }),
  useCancelMemberMembershipMutation: () => ({ mutate: cancelMembershipMock, isPending: false }),
  useMarkPaymentAsPaidMutation: () => ({ mutate: markPaymentAsPaidMock, isPending: false }),
}))

vi.mock('@/modules/members/hooks/useMembers', () => ({
  useMembersQuery: (params?: Record<string, unknown>) => {
    membersQueryParams.push(params)
    return {
    data: {
      count: membersMock.length,
      next: null,
      previous: null,
      results: membersMock,
    },
    isLoading: false,
  }},
}))

describe('BillingPage', () => {
  beforeEach(() => {
    createSubscriptionMock.mockReset()
    updateSubscriptionMock.mockReset()
    createMembershipMock.mockReset()
    renewMembershipMock.mockReset()
    suspendMembershipMock.mockReset()
    cancelMembershipMock.mockReset()
    markPaymentAsPaidMock.mockReset()
    subscriptionsMock = []
    membershipsMock = []
    membersQueryParams = []
    membersMock = [
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
    ]
  })

  it('renders billing summary, payment rows and membership portfolio without plan catalog', () => {
    const { getAllByText, getByTestId, getByText, queryByText } = renderWithProviders(<BillingPage />)

    expect(getByTestId('billing-page')).toBeInTheDocument()
    expect(getAllByText('Pendientes').length).toBeGreaterThan(0)
    expect(getByText('Recibos emitidos')).toBeInTheDocument()
    expect(getAllByText('En mora').length).toBeGreaterThan(0)
    expect(getByTestId('payment-row-1')).toBeInTheDocument()
    expect(getByTestId('payment-row-2')).toBeInTheDocument()
    expect(getByTestId('payment-row-3')).toBeInTheDocument()
    expect(getAllByText('Premium').length).toBeGreaterThan(0)
    expect(queryByText('Planes de membresía configurables')).not.toBeInTheDocument()
    expect(getByTestId('membership-portfolio')).toHaveTextContent('Cartera de membresías')
    expect(getByTestId('membership-portfolio')).toHaveTextContent('Membresías por miembro')
    expect(getByTestId('billing-member-search')).toBeInTheDocument()
    expect(getByTestId('membership-portfolio')).toHaveTextContent('2 resultado(s)')
    expect(getByTestId('portfolio-member-15')).toHaveTextContent('Maria Perez')
    expect(getByTestId('portfolio-member-15')).toHaveTextContent('#55')
    expect(getByTestId('portfolio-member-15')).toHaveTextContent('₡79 000')
    expect(getByTestId('portfolio-member-15')).toHaveTextContent('Vigente')
    expect(getByTestId('portfolio-member-16')).toHaveTextContent('Cliente Plan Sin Cobro')
    expect(getByTestId('portfolio-member-16')).toHaveTextContent('Sin membresía')
    expect(getByTestId('portfolio-member-16')).toHaveTextContent('Sin precio')
  })

  it('filters billing membership portfolio by search and unpaid status', () => {
    const { getByTestId } = renderWithProviders(<BillingPage />)

    fireEvent.change(getByTestId('billing-member-search'), { target: { value: 'Derian' } })
    expect(membersQueryParams.at(-1)).toEqual(expect.objectContaining({
      ordering: 'riesgo_desc',
      search: 'Derian',
      payment_status: undefined,
    }))

    fireEvent.click(getByTestId('billing-payment-filter-pending'))
    expect(membersQueryParams.at(-1)).toEqual(expect.objectContaining({
      ordering: 'riesgo_desc',
      search: 'Derian',
      payment_status: 'pending',
    }))

    fireEvent.click(getByTestId('billing-payment-filter-late'))
    expect(membersQueryParams.at(-1)).toEqual(expect.objectContaining({
      ordering: 'riesgo_desc',
      search: 'Derian',
      payment_status: 'late',
    }))
  })

  it('shows an empty state when billing portfolio filters have no matches', () => {
    membersMock = []
    const { getByTestId, getByText } = renderWithProviders(<BillingPage />)

    fireEvent.click(getByTestId('billing-payment-filter-pending'))

    expect(getByText('No hay miembros con ese filtro')).toBeInTheDocument()
  })

  it('shows member-specific header when member filter is present', () => {
    const { getByTestId, getByText, queryByText } = renderWithProviders(<BillingPage />, { route: '/billing?member=15' })

    expect(getByText('Facturación del miembro')).toBeInTheDocument()
    expect(getByText('Cobros, recibos y estado comercial del miembro seleccionado')).toBeInTheDocument()
    expect(getByText('Membresía del miembro')).toBeInTheDocument()
    expect(queryByText(/Plan asignado:/)).not.toBeInTheDocument()
    expect(getByTestId('membership-plan-select')).toHaveValue('8')
  })

  it('assigns a member membership from an existing plan', () => {
    const { getAllByRole, getAllByTestId } = renderWithProviders(<BillingPage />, { route: '/billing?member=15' })

    fireEvent.change(getAllByTestId('membership-plan-select')[0], { target: { value: '8' } })
    fireEvent.click(getAllByRole('button', { name: 'Asignar membresía y crear primer cobro' })[0])

    expect(createMembershipMock).toHaveBeenCalledWith(
      expect.objectContaining({
        member: 15,
        membership_plan: 8,
      }),
    )
  })

  it('creates a fresh membership when the member only has cancelled history', () => {
    membershipsMock = [
      {
        id: 9,
        member: 15,
        membership_plan: 8,
        plan_name: 'pérdida de peso',
        agreed_price: '12000.00',
        start_date: '2026-07-13',
        end_date: null,
        recurrence_type: 'weekly',
        grace_period_days: 7,
        auto_renew: false,
        status: 'cancelled',
        created_at: '2026-07-13T00:00:00Z',
        updated_at: '2026-07-13T00:00:00Z',
        cancelled_at: '2026-07-27',
        notes: '',
        days_remaining: null,
        can_check_in: false,
        next_payment: null,
        last_payment: null,
      },
    ]
    const { getAllByRole, getByTestId, getByText } = renderWithProviders(<BillingPage />, { route: '/billing?member=15' })

    expect(getByText('Último historial')).toBeInTheDocument()
    expect(getByTestId('membership-plan-select')).toHaveValue('8')

    fireEvent.click(getAllByRole('button', { name: 'Asignar membresía y crear primer cobro' })[0])

    expect(createMembershipMock).toHaveBeenCalledWith(expect.objectContaining({
      member: 15,
      membership_plan: 8,
    }))
    expect(updateSubscriptionMock).not.toHaveBeenCalled()
  })

  it('shows the configured plan recurrence when assigning memberships', () => {
    const { getByTestId } = renderWithProviders(<BillingPage />, { route: '/billing?member=15' })
    const planSelect = getByTestId('membership-plan-select') as HTMLSelectElement
    const labels = Array.from(planSelect.options).map((option) => option.text.replace(/\s+/g, ' '))

    expect(labels).toEqual(expect.arrayContaining(['Premium · ₡79 000 / quincena']))
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
