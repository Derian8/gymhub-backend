import { renderWithProviders } from '@/test/utils'
import { within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MembersPage } from './MembersPage'
import { useAuthStore } from '@/shared/store/authStore'

const assignTrainerMock = vi.fn()
const membersQueryParams: Array<Record<string, unknown> | undefined> = []

vi.mock('../hooks/useMembers', () => ({
  useMembersQuery: (params?: Record<string, unknown>) => {
    membersQueryParams.push(params)
    const unassigned = params?.assignment === 'unassigned'
    return {
      data: {
        count: unassigned ? 1 : 2,
        next: null,
        previous: null,
        results: unassigned
          ? [
              {
                id: 17,
                user: null,
                email: 'derianisaac.ar@gmail.com',
                full_name: 'Derian Isaac',
                membership_plan: null,
                phone: '',
                birth_date: null,
                emergency_contact: '',
                join_date: '2026-07-17',
                is_active: true,
                photo: null,
                trainer_asignado: null,
                trainer_asignado_nombre: null,
                riesgo_adherencia: 0,
                nivel_riesgo: 'low',
                motivos_riesgo: [],
                estado_prescripcion: 'sin_plan',
                tiene_plan_activo: false,
                prescripcion_lista_para_member: false,
                membresia_actual: null,
              },
            ]
          : [
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
                trainer_asignado: 9,
                trainer_asignado_nombre: 'Trainer Demo',
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
                estado_comercial: 'bloqueado',
              },
              {
                id: 16,
                user: null,
                email: 'sin-cobro@test.com',
                full_name: 'Cliente Falta Cobro',
                membership_plan: 2,
                membership_plan_nombre: 'Ganancia de masa',
                phone: '',
                birth_date: null,
                emergency_contact: '',
                join_date: '2026-03-02',
                is_active: true,
                photo: null,
                trainer_asignado: 9,
                trainer_asignado_nombre: 'Trainer Demo',
                riesgo_adherencia: 20,
                nivel_riesgo: 'low',
                motivos_riesgo: [],
                days_since_last_checkin: null,
                days_since_last_session: null,
                days_since_last_progress: null,
                estado_prescripcion: 'sin_plan',
                tiene_plan_activo: false,
                prescripcion_lista_para_member: false,
                membresia_actual: null,
                estado_comercial: 'al_dia',
              },
            ],
      },
      isLoading: false,
    }
  },
  useAssignTrainerMutation: () => ({
    mutate: assignTrainerMock,
    isPending: false,
  }),
}))

describe('MembersPage', () => {
  beforeEach(() => {
    assignTrainerMock.mockReset()
    membersQueryParams.length = 0
    useAuthStore.setState({
      user: { id: 9, email: 'trainer@test.com', username: 'trainer', first_name: 'Trainer', last_name: 'Demo', role: 'trainer', is_staff: false, memberprofile_id: null, trainerprofile_id: 9 },
      isAuthenticated: true,
      authResolved: true,
      theme: 'dark',
    })
  })

  it('renders member list with filters and detail action', () => {
    const { getByTestId } = renderWithProviders(<MembersPage />)
    const row = getByTestId('member-row-15')

    expect(getByTestId('members-page')).toBeInTheDocument()
    expect(getByTestId('members-search')).toBeInTheDocument()
    expect(() => getByTestId('view-unassigned-members')).toThrow()
    expect(() => getByTestId('payment-filter')).toThrow()
    expect(getByTestId('risk-filter')).toBeInTheDocument()
    expect(getByTestId('prescription-filter')).toBeInTheDocument()
    expect(getByTestId('members-ordering')).toBeInTheDocument()
    expect(row).toBeInTheDocument()
    expect(within(row).getByText('Maria Perez')).toBeInTheDocument()
    expect(within(row).getByText(/Alto/i)).toBeInTheDocument()
    expect(within(row).getByText(/Bloqueado · contactar admin/i)).toBeInTheDocument()
    expect(within(row).queryByText(/Tiene pagos en mora/i)).not.toBeInTheDocument()
    expect(within(row).getByText(/Prescripción incompleta/i)).toBeInTheDocument()
    expect(getByTestId('member-program-15')).toHaveAttribute('href', '/members/15/program')
    expect(getByTestId('member-detail-15')).toHaveAttribute('href', '/members/15')
  })

  it('keeps the trainer focused on assigned clients', () => {
    renderWithProviders(<MembersPage />)
    expect(membersQueryParams[0]).toEqual(expect.objectContaining({ assignment: 'mine' }))
    expect(assignTrainerMock).not.toHaveBeenCalled()
  })
})
