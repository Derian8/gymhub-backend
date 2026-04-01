import { waitFor } from '@testing-library/react'
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
        { date: '2026-03-01', label: '01 Mar', weight_kg: 81, body_fat_pct: 18, waist_cm: 83, muscle_mass_kg: 34 },
        { date: '2026-03-20', label: '20 Mar', weight_kg: 80, body_fat_pct: 17, waist_cm: 82, muscle_mass_kg: 34.5 },
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
        high_risk_count: 3,
        late_payment_count: 2,
        ready_prescriptions_count: 7,
        average_weekly_completion: 68,
      },
      risk_distribution: [{ label: 'low', value: 4 }, { label: 'medium', value: 5 }, { label: 'high', value: 3 }],
      payment_distribution: [{ label: 'paid', value: 7 }, { label: 'pending', value: 3 }, { label: 'late', value: 2 }],
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
      insights: ['3 members están en riesgo alto.'],
    })

    const { getByText, getByTestId } = renderWithProviders(<ChartsPage />)

    await waitFor(() => {
      expect(getByTestId('charts-page')).toBeInTheDocument()
      expect(getByText('Gráficos Del Trainer')).toBeInTheDocument()
      expect(getByText('Riesgo de la cartera')).toBeInTheDocument()
      expect(getByText('Ingresos y planes')).toBeInTheDocument()
      expect(getByText('Members prioritarios')).toBeInTheDocument()
      expect(getByText('Maria Perez')).toBeInTheDocument()
    })
  })
})
