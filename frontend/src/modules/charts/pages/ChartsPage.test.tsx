import { fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { ChartsPage } from './ChartsPage'
import { chartsApi } from '../api/chartsApi'
import { useAuthStore } from '@/shared/store/authStore'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="recharts-container">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => <div />,
}))

vi.mock('../api/chartsApi', () => ({
  chartsApi: {
    get: vi.fn(),
    getOverview: vi.fn(),
  },
}))

describe('ChartsPage', () => {
  it('renders member analytics blocks', async () => {
    useAuthStore.setState({
      user: {
        id: 7,
        email: 'member@gymhub.com',
        username: 'member',
        first_name: 'Maria',
        last_name: 'Perez',
        role: 'member',
        is_staff: false,
        memberprofile_id: 7,
        trainerprofile_id: null,
      },
      isAuthenticated: true,
      authResolved: true,
      theme: 'dark',
    })

    vi.mocked(chartsApi.getOverview).mockResolvedValue({
      role: 'member',
      summary: {
        current_weight: 80,
        weight_change_30d: -1.2,
        current_height_cm: 176,
        current_bmi: 25.8,
        sessions_this_week: 3,
        streak_asistencia: 4,
        cumplimiento_semanal: 75,
        payment_status: 'pending',
        days_until_due: 2,
        days_overdue: null,
        riesgo_personal: { score: 42, level: 'medium', reasons: ['Acumula 8 días sin check-in'] },
        siguiente_accion: 'Completa tu sesión de hoy.',
        resumen_hoy: 'Hoy toca torso superior.',
        estado_prescripcion: {
          tiene_plan_activo: true,
          tiene_dias: true,
          tiene_ejercicios: true,
          tiene_nutricion: true,
          tiene_guias: false,
          esta_lista_para_member: false,
        },
      },
      physical_progress: [
        { date: '2026-03-01', label: '01 Mar', weight_kg: 81, height_cm: 176, body_fat_pct: 18, waist_cm: 83, muscle_mass_kg: 34 },
        { date: '2026-03-20', label: '20 Mar', weight_kg: 80, height_cm: 176, body_fat_pct: 17, waist_cm: 82, muscle_mass_kg: 34.5 },
      ],
      attendance_weekly: [{ label: '03 Mar', value: 2 }, { label: '10 Mar', value: 3 }],
      sessions_weekly: [{ label: '03 Mar', value: 1, goal: 3 }, { label: '10 Mar', value: 2, goal: 3 }],
      plan_completion: [{ label: 'A', name: 'Torso', completed: 1 }],
      exercise_progress: {
        exercise_name: 'Press de banca',
        series: [{ date: '2026-03-10', label: '10 Mar', weight_used_kg: 70, sets_completed: 4, reps_completed: 8 }],
      },
      insights: ['Tu próximo cobro vence en 2 días.'],
    })

    const { getByTestId, getByText } = renderWithProviders(<ChartsPage />)

    await waitFor(() => {
      expect(getByTestId('charts-page')).toBeInTheDocument()
      expect(getByText('Mis Gráficos')).toBeInTheDocument()
      expect(getByText('Progreso físico')).toBeInTheDocument()
      expect(getByText('Adherencia semanal')).toBeInTheDocument()
      expect(getByText('Progresión en Press de banca')).toBeInTheDocument()
    })
  })

  it('renders trainer analytics blocks', async () => {
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
        trainerprofile_id: 3,
      },
      isAuthenticated: true,
      authResolved: true,
      theme: 'dark',
    })

    vi.mocked(chartsApi.getOverview).mockResolvedValue({
      role: 'trainer',
      summary: {
        members_count: 12,
        active_attendance_count: 9,
        inactive_count: 3,
        expiring_membership_count: 2,
        expired_membership_count: 1,
        pending_payment_count: 3,
        late_payment_count: 2,
        urgent_followup_count: 2,
        attention_followup_count: 3,
        average_weekly_completion: 68,
      },
      risk_distribution: [{ label: 'low', value: 4 }, { label: 'medium', value: 5 }, { label: 'high', value: 3 }],
      payment_distribution: [{ label: 'paid', value: 7 }, { label: 'pending', value: 3 }, { label: 'late', value: 2 }],
      membership_distribution: [{ label: 'active', value: 8 }, { label: 'expiring', value: 2 }, { label: 'expired', value: 1 }, { label: 'suspended', value: 1 }],
      followup_distribution: [{ label: 'ok', value: 7 }, { label: 'attention', value: 3 }, { label: 'urgent', value: 2 }],
      prescription_distribution: [{ label: 'lista', value: 7 }, { label: 'incompleta', value: 4 }, { label: 'sin_plan', value: 1 }],
      inactivity_distribution: [{ label: '0-3', value: 6 }, { label: '4-7', value: 3 }, { label: '8-14', value: 2 }, { label: '15+', value: 1 }],
      attendance_trend: [{ label: '03 Mar', value: 10 }, { label: '10 Mar', value: 12 }],
      sessions_trend: [{ label: '03 Mar', value: 8 }, { label: '10 Mar', value: 9 }],
      revenue_monthly: [{ label: 'Feb', value: 350 }, { label: 'Mar', value: 540 }],
      plan_distribution: [{ label: 'Premium', value: 6 }, { label: 'Base', value: 4 }],
      top_risk_members: [
        {
          id: 15,
          full_name: 'Maria Perez',
          riesgo_adherencia: 82,
          nivel_riesgo: 'high',
          payment_status: 'late',
          days_since_last_checkin: 11,
          next_action: 'Contáctala hoy para retomar rutina y pago.',
        },
      ],
      members_needing_followup: [
        {
          id: 15,
          full_name: 'Maria Perez',
          email: 'maria@test.com',
          followup_status: 'urgent',
          membership_status: 'expired',
          membership_name: 'Premium',
          membership_end_date: '2026-03-10',
          payment_status: 'late',
          days_since_last_checkin: 11,
          weekly_completion: 25,
          reason: 'Lleva 11 días sin check-in',
          next_action: 'Contactar por inasistencia',
        },
      ],
      insights: ['3 members están en riesgo alto.'],
    })

    const { getByText, getByTestId, queryByText } = renderWithProviders(<ChartsPage />)

    await waitFor(() => {
      expect(getByTestId('charts-page')).toBeInTheDocument()
      expect(getByText('Resumen de tus miembros')).toBeInTheDocument()
      expect(getByText('Asistencia y rutinas')).toBeInTheDocument()
      expect(getByText('Estado de membresías')).toBeInTheDocument()
      expect(getByText('Pagos de miembros')).toBeInTheDocument()
      expect(getByText('Seguimiento necesario')).toBeInTheDocument()
      expect(getByText('Miembros que necesitan seguimiento')).toBeInTheDocument()
      expect(getByText('Maria Perez')).toBeInTheDocument()
      expect(queryByText('Riesgo de la cartera')).not.toBeInTheDocument()
      expect(queryByText('Ingresos y planes')).not.toBeInTheDocument()
    })
  })

  it('sends trainer chart filters to the overview API', async () => {
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
        trainerprofile_id: 3,
      },
      isAuthenticated: true,
      authResolved: true,
      theme: 'dark',
    })

    vi.mocked(chartsApi.getOverview).mockResolvedValue({
      role: 'trainer',
      summary: {
        members_count: 0,
        active_attendance_count: 0,
        inactive_count: 0,
        expiring_membership_count: 0,
        expired_membership_count: 0,
        pending_payment_count: 0,
        late_payment_count: 0,
        urgent_followup_count: 0,
        attention_followup_count: 0,
        average_weekly_completion: null,
      },
      risk_distribution: [],
      payment_distribution: [],
      membership_distribution: [],
      followup_distribution: [],
      prescription_distribution: [],
      inactivity_distribution: [],
      attendance_trend: [],
      sessions_trend: [],
      revenue_monthly: [],
      plan_distribution: [],
      top_risk_members: [],
      members_needing_followup: [],
      insights: [],
    })

    const user = userEvent.setup()
    const { getByTestId } = renderWithProviders(<ChartsPage />)

    await waitFor(() => expect(getByTestId('trainer-chart-period')).toBeInTheDocument())
    await user.selectOptions(getByTestId('trainer-chart-period'), '90')
    await user.selectOptions(getByTestId('trainer-chart-membership'), 'expired')
    await user.selectOptions(getByTestId('trainer-chart-followup'), 'urgent')
    fireEvent.change(getByTestId('trainer-chart-search'), { target: { value: 'Derian' } })

    await waitFor(() => {
      expect(chartsApi.getOverview).toHaveBeenCalledWith(
        expect.objectContaining({
          period: '90',
          membership_status: 'expired',
          followup_status: 'urgent',
          search: 'Derian',
        }),
      )
    })
  })
})
