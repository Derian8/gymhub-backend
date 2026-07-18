import { renderWithProviders } from '@/test/utils'
import { TrainerDashboard } from './TrainerDashboard'
import { useAuthStore } from '@/shared/store/authStore'

vi.mock('@/modules/members/hooks/useMembers', () => ({
  useMembersQuery: (params?: Record<string, unknown>) => ({
    data: params?.assignment === 'unassigned'
      ? {
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 44,
              email: 'derianisaac.ar@gmail.com',
              full_name: 'Derian Isaac',
              trainer_asignado: null,
              trainer_asignado_nombre: null,
              is_active: true,
              membresia_actual: null,
            },
          ],
        }
      : {
          count: 3,
          next: null,
          previous: null,
          results: [
            {
              id: 10,
              user: null,
              email: 'ana@test.com',
              full_name: 'Ana Perez',
              membership_plan: 3,
              phone: '8888-1111',
              birth_date: null,
              emergency_contact: '',
              join_date: '2026-03-01',
              is_active: true,
              photo: null,
              membresia_actual: {
                subscription_id: 90,
                plan_id: 3,
                plan_name: 'Premium mensual',
                agreed_price: '50000.00',
                recurrence_type: 'monthly',
                status: 'expired',
                is_active: true,
                start_date: '2026-03-01',
                next_billing_date: '2026-04-01',
                renewal_date: '2026-03-20',
                current_period_start: '2026-03-01',
                current_period_end: '2026-03-20',
                grace_period_days: 7,
                payment_status: 'late',
                days_until_due: null,
                days_overdue: 5,
                access_allowed: false,
                access_reason: 'payment_overdue',
              },
            },
            {
              id: 13,
              user: null,
              email: 'sin@test.com',
              full_name: 'Cliente Sin Membresia',
              membership_plan: null,
              phone: '',
              birth_date: null,
              emergency_contact: '',
              join_date: '2026-03-01',
              is_active: true,
              photo: null,
              membresia_actual: null,
            },
            {
              id: 14,
              user: null,
              email: 'plan@test.com',
              full_name: 'Cliente Con Plan Sin Cobro',
              membership_plan: 4,
              membership_plan_nombre: 'Básico mensual',
              phone: '',
              birth_date: null,
              emergency_contact: '',
              join_date: '2026-03-01',
              is_active: true,
              photo: null,
              membresia_actual: null,
            },
          ],
        },
    isLoading: false,
  }),
  useTrainerOverviewQuery: () => ({
    data: {
      total_active_members: 42,
      checked_in_today: 9,
      members_in_mora: 3,
      members_inactive_30d: 6,
      pending_alerts: 4,
      active_subscriptions_count: 21,
      payments_due_soon: 2,
      payments_overdue: 3,
      members_without_progress_recently: 5,
      members_without_active_plan: 4,
      incomplete_prescriptions: 6,
      miembros_sin_plan_activo: [
        {
          id: 11,
          full_name: 'Luis Sin Plan',
          riesgo_adherencia: 71,
          nivel_riesgo: 'high',
          motivos_riesgo: ['No tiene plan activo asignado'],
          next_action: 'Asigna un plan activo para iniciar su prescripción.',
          estado_prescripcion: 'sin_plan',
        },
      ],
      miembros_con_prescripcion_incompleta: [
        {
          id: 12,
          full_name: 'Marta Incompleta',
          riesgo_adherencia: 66,
          nivel_riesgo: 'medium',
          motivos_riesgo: ['Su prescripción activa está incompleta'],
          next_action: 'Completa días, ejercicios o nutrición para publicarla al member.',
          estado_prescripcion: 'incompleta',
        },
      ],
      revenue_this_month: 3250,
      estimated_mrr: 4120,
      expected_revenue_this_month: 3890,
      late_rate_pct: 14.3,
      new_members_this_month: 5,
      sessions_completed_this_week: 18,
      miembros_en_riesgo: [
        {
          id: 10,
          full_name: 'Ana Perez',
          payment_status: 'late',
          riesgo_adherencia: 82,
          nivel_riesgo: 'high',
          motivos_riesgo: ['Tiene pagos en mora', 'Lleva 12 días sin check-in'],
          days_since_last_checkin: 12,
          next_action: 'Regulariza su pago y contáctala hoy.',
          estado_prescripcion: 'incompleta',
        },
      ],
    },
    isLoading: false,
  }),
}))

describe('TrainerDashboard', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({
      user: {
        id: 2,
        email: 'trainer@test.com',
        username: 'trainer',
        first_name: 'Carlos',
        last_name: 'Trainer',
        role: 'trainer',
        is_staff: false,
        memberprofile_id: null,
        trainerprofile_id: 7,
      },
      isAuthenticated: true,
      authResolved: true,
      theme: 'dark',
    })
  })

  it('renders trainer stats and quick actions', () => {
    const { getByTestId, getByText } = renderWithProviders(<TrainerDashboard />)

    expect(getByTestId('trainer-dashboard')).toBeInTheDocument()
    expect(getByText('Hola, Carlos')).toBeInTheDocument()
    expect(getByTestId('stat-total-members')).toHaveTextContent('42')
    expect(getByTestId('stat-alerts')).toHaveTextContent('4')
    expect(getByTestId('stat-due-soon')).toHaveTextContent('2')
    expect(getByTestId('stat-without-plan')).toHaveTextContent('4')
    expect(getByTestId('stat-without-plan')).toHaveTextContent('Sin entrenamiento publicado')
    expect(getByTestId('stat-incomplete-prescriptions')).toHaveTextContent('6')
    expect(getByTestId('stat-estimated-mrr')).toHaveTextContent('₡4 120')
    expect(getByTestId('stat-expected-revenue')).toHaveTextContent('₡3 890')
    expect(getByTestId('stat-late-rate')).toHaveTextContent('14.3%')
    expect(getByTestId('stat-active-subscriptions')).toHaveTextContent('21')
    expect(getByTestId('dashboard-unassigned-members-notice')).toHaveTextContent('Miembros nuevos sin asignar: 1')
    expect(getByTestId('dashboard-unassigned-members-link')).toHaveAttribute('href', '/members?assignment=unassigned')
    expect(getByTestId('membership-critical-panel')).toHaveTextContent('Membresías y cobros críticos')
    expect(getByTestId('membership-critical-panel')).toHaveTextContent('Vencidas')
    expect(getByTestId('membership-critical-member-10')).toHaveTextContent('Premium mensual')
    expect(getByTestId('membership-critical-member-10')).toHaveTextContent('#90')
    expect(getByTestId('membership-critical-member-10')).toHaveTextContent('₡50 000')
    expect(getByTestId('membership-critical-member-10')).toHaveTextContent('5 día(s) vencido(s)')
    expect(getByTestId('membership-critical-member-14')).toHaveTextContent('Sin membresía')
    expect(getByTestId('membership-critical-member-14')).toHaveTextContent('Crear membresía')
    expect(getByTestId('membership-critical-member-13')).toHaveTextContent('Sin membresía')
    expect(getByTestId('risk-panel')).toBeInTheDocument()
    expect(getByTestId('risk-member-10')).toBeInTheDocument()
    expect(getByTestId('prescribe-member-10')).toHaveAttribute('href', '/members/10/program')
    expect(getByTestId('queue-without-plan')).toBeInTheDocument()
    expect(getByTestId('queue-without-plan')).toHaveTextContent('Miembros sin entrenamiento publicado')
    expect(getByTestId('queue-without-plan-member-11')).toBeInTheDocument()
    expect(getByTestId('queue-without-plan-cta-11')).toHaveAttribute('href', '/members/11/program')
    expect(getByTestId('queue-incomplete-prescriptions')).toBeInTheDocument()
    expect(getByTestId('queue-incomplete-prescriptions-member-12')).toBeInTheDocument()
    expect(getByTestId('queue-incomplete-prescriptions-cta-12')).toHaveAttribute('href', '/members/12/program')
    expect(getByTestId('quick-members')).toBeInTheDocument()
    expect(getByTestId('quick-prescriptions')).toBeInTheDocument()
    expect(getByTestId('quick-alerts')).toBeInTheDocument()
    expect(getByTestId('quick-billing')).toBeInTheDocument()
  })
})
