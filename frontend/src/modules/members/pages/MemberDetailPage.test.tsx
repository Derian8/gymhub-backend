import { waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { MemberDetailPage } from './MemberDetailPage'
import { useAuthStore } from '@/shared/store/authStore'

const activateMock = vi.fn()

vi.mock('../hooks/useMembers', () => ({
  useMemberDetailQuery: () => ({
    data: {
      id: 15,
      user: {
        id: 15,
        email: 'maria@gymhub.com',
        username: 'maria',
        first_name: 'Maria',
        last_name: 'Perez',
        role: 'member',
        is_staff: false,
        memberprofile_id: 15,
        trainerprofile_id: null,
      },
      email: 'maria@gymhub.com',
      full_name: 'Maria Perez',
      membership_plan: 2,
      phone: '+50688887777',
      birth_date: '1996-03-10',
      emergency_contact: 'Jose Perez',
      join_date: '2026-01-15',
      is_active: false,
      photo: null,
      trainer_asignado: null,
      trainer_asignado_nombre: null,
      riesgo_adherencia: 74,
      nivel_riesgo: 'high',
      motivos_riesgo: ['Tiene pagos en mora', 'No registra progreso hace 21 días'],
      days_since_last_checkin: 10,
      days_since_last_session: 12,
      days_since_last_progress: 21,
      suscripcion_activa_id: 33,
      precio_suscripcion_actual: '50000.00',
      membresia_actual: {
        subscription_id: 33,
        plan_id: 2,
        plan_name: 'Estandar',
        agreed_price: '50000.00',
        recurrence_type: 'monthly',
        status: 'expired',
        is_active: true,
        start_date: '2026-03-01',
        next_billing_date: '2026-04-01',
        renewal_date: '2026-03-18',
        current_period_start: '2026-03-01',
        current_period_end: '2026-03-18',
        grace_period_days: 7,
        payment_status: 'late',
        days_until_due: null,
        days_overdue: 8,
        access_allowed: false,
        access_reason: 'payment_overdue',
      },
    },
    isLoading: false,
  }),
  useMemberDashboardQuery: () => ({
    data: {
      payment_status: 'late',
      days_until_due: null,
      days_overdue: 8,
      membership_plan_name: 'Estandar',
      membership_expires_at: '2026-03-18',
      last_checkin: '2026-03-16T10:00:00Z',
      active_plan: { id: 4, name: 'Hipertrofia guiada' },
      nutrition_goal: 'muscle_gain',
      inactivity_alert: true,
      unread_notifications: 2,
      today_has_workout: true,
      weekly_sessions_done: 1,
      streak_asistencia: 0,
      cumplimiento_semanal: 25,
      siguiente_accion: 'Contáctala hoy y regulariza su pago.',
      resumen_hoy: 'Hoy debería retomar su sesión de torso superior.',
      riesgo_personal: {
        score: 74,
        level: 'high',
        reasons: ['Tiene pagos en mora', 'No registra progreso hace 21 días'],
      },
    },
    isLoading: false,
  }),
  useMemberPhysicalSummaryQuery: () => ({
    data: {
      latest_log_id: 81,
      latest_recorded_at: '2026-03-25T10:00:00Z',
      current_weight_kg: 68.2,
      previous_weight_kg: 69.4,
      weight_change_kg: -1.2,
      height_cm: 165,
      body_fat_pct: 24,
      muscle_mass_kg: 26,
      waist_cm: 77,
      bmi: 25,
      notes: 'Progreso sostenido',
    },
    isLoading: false,
  }),
  useMemberActivePrescriptionQuery: () => ({
    data: {
      trainer: null,
      plan_activo: null,
      estado_prescripcion: {
        tiene_plan_activo: false,
        tiene_dias: false,
        tiene_ejercicios: false,
        tiene_nutricion: false,
        tiene_guias: false,
        esta_lista_para_member: false,
      },
    },
    isLoading: false,
  }),
  useActivateMemberMutation: () => ({
    mutate: activateMock,
    isPending: false,
  }),
  useAssignTrainerMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}))

vi.mock('@/modules/progress/api/progressApi', () => ({
  progressApi: {
    logs: vi.fn().mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 81,
          member: 15,
          recorded_at: '2026-03-25T10:00:00Z',
          weight_kg: 68.2,
          height_cm: 165,
          body_fat_pct: 24,
          muscle_mass_kg: 26,
          waist_cm: 77,
          notes: 'Progreso sostenido',
          source: 'manual',
        },
      ],
    }),
    createLog: vi.fn(),
    updateLog: vi.fn(),
    memberSummary: vi.fn(),
  },
}))

describe('MemberDetailPage', () => {
  beforeEach(() => {
    activateMock.mockReset()
    localStorage.clear()
    localStorage.setItem(
      'gymhub:prescription-publication:15',
      JSON.stringify({ memberId: 15, tipo: 'nutricion', fechaIso: '2026-03-26T12:30:00.000Z' }),
    )
    useAuthStore.setState({
      user: {
        id: 2,
        email: 'trainer@gymhub.com',
        username: 'trainer',
        first_name: 'Trainer',
        last_name: 'Demo',
        role: 'trainer',
        is_staff: false,
        memberprofile_id: null,
        trainerprofile_id: 9,
      },
      isAuthenticated: true,
      authResolved: true,
      theme: 'dark',
    })
  })

  it('renders inactive member detail with activation and quick links', async () => {
    const { getAllByText, getByTestId, queryByTestId, queryByText } = renderWithProviders(<MemberDetailPage />, {
      route: '/members/15',
      path: '/members/:id',
    })

    await waitFor(() => expect(getByTestId('measurement-row-81')).toBeInTheDocument())

    expect(getByTestId('member-detail-page')).toBeInTheDocument()
    expect(getByTestId('member-profile-card')).toBeInTheDocument()
    expect(getByTestId('member-membership-panel')).toHaveTextContent('Membresía y cobro')
    expect(getByTestId('member-membership-panel')).toHaveTextContent('Estandar')
    expect(getByTestId('member-membership-panel')).toHaveTextContent('Membresía vencida')
    expect(getByTestId('member-membership-panel')).toHaveTextContent('₡50 000')
    expect(getByTestId('member-membership-panel')).toHaveTextContent('mes')
    expect(getByTestId('member-membership-panel')).toHaveTextContent('Requiere revisión')
    expect(getByTestId('member-membership-panel')).toHaveTextContent('8 vencido')
    expect(getByTestId('member-membership-billing-link')).toHaveAttribute('href', '/billing?member=15')
    expect(getByTestId('member-prescription-panel')).toBeInTheDocument()
    expect(queryByTestId('member-last-publication')).not.toBeInTheDocument()
    expect(getByTestId('member-risk-panel')).toBeInTheDocument()
    expect(getByTestId('member-physical-panel')).toBeInTheDocument()
    expect(getByTestId('member-physical-weight-change')).toHaveTextContent('-1.2 kg')
    expect(getAllByText('Maria Perez').length).toBeGreaterThan(1)
    expect(getByTestId('activation-panel')).toBeInTheDocument()
    expect(getByTestId('activate-member-btn')).toBeInTheDocument()
    expect(getByTestId('activation-panel')).toHaveTextContent('La membresía, el precio acordado y el primer cobro se crean después desde facturación.')
    expect(getByTestId('assign-trainer-btn')).toBeInTheDocument()
    expect(getByTestId('unassigned-member-banner')).toHaveTextContent('Este miembro todavía no está asignado a ningún trainer')
    expect(getByTestId('banner-assign-trainer-btn')).toHaveTextContent('Asignar a mí')
    expect(getByTestId('prescription-assign-trainer-btn')).toBeInTheDocument()
    expect(getAllByText('Sin trainer asignado').length).toBeGreaterThan(0)
    expect(getByTestId('member-program-link')).toHaveAttribute('href', '/members/15/program')
    expect(getByTestId('member-billing-link')).toHaveAttribute('href', '/billing?member=15')
    expect(getByTestId('member-attendance-link')).toHaveAttribute('href', '/attendance?member=15')
    expect(queryByText('Nutrición')).not.toBeInTheDocument()
    expect(queryByText('Alertas')).not.toBeInTheDocument()
    expect(queryByTestId('open-ai-copilot-btn')).not.toBeInTheDocument()
    expect(getAllByText(/Tiene pagos en mora/i).length).toBeGreaterThan(0)
  })
})
