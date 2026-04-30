import { renderWithProviders } from '@/test/utils'
import { PlansPage } from './PlansPage'
import { useAuthStore } from '@/shared/store/authStore'

vi.mock('../hooks/usePlans', () => ({
  usePlansQuery: () => ({
    data: {
      count: 2,
      results: [
        {
          id: 12,
          name: 'Hipertrofia base',
          goal: 'hypertrophy',
          days_per_week: 4,
          weeks_duration: 8,
          start_date: '2026-03-01',
          end_date: '2026-04-26',
          is_active: true,
        },
        {
          id: 13,
          name: 'Definicion avanzada',
          goal: 'fat_loss',
          days_per_week: 5,
          weeks_duration: 6,
          start_date: '2026-03-10',
          end_date: null,
          is_active: false,
        },
      ],
    },
    isLoading: false,
  }),
}))

vi.mock('@/modules/members/hooks/useMembers', () => ({
  useMemberActivePrescriptionQuery: () => ({
    data: {
      trainer: {
        id: 2,
        nombre: 'Carlos Mendoza',
        correo: 'trainer@gymhub.com',
      },
      plan_activo: {
        id: 12,
        member: 10,
        trainer: 2,
        name: 'Hipertrofia base',
        goal: 'muscle_gain',
        days_per_week: 4,
        weeks_duration: 8,
        start_date: '2026-03-01',
        end_date: '2026-04-26',
        is_active: true,
      },
      dias: [
        {
          id: 101,
          plan: 12,
          day_label: 'A',
          day_of_week: 'mon',
          name: 'Torso',
          exercises: [
            { id: 1, name: 'Press banca' },
            { id: 2, name: 'Remo con barra' },
          ],
        },
      ],
      entrenamiento_hoy: {
        id: 101,
        day_label: 'A',
        name: 'Torso',
        day_of_week: 'mon',
        exercises: [{ id: 1, name: 'Press banca' }],
      },
      perfil_nutricional: { id: 21 },
      guias_vinculadas: [{ id: 31 }],
      estado_prescripcion: {
        tiene_plan_activo: true,
        tiene_dias: true,
        tiene_ejercicios: true,
        tiene_nutricion: true,
        tiene_guias: true,
        esta_lista_para_member: true,
      },
    },
    isLoading: false,
  }),
  useMemberDashboardQuery: () => ({
    data: {
      resumen_hoy: 'Hoy toca torso superior con foco en fuerza.',
      siguiente_accion: 'Empieza por el bloque del día y registra tu sesión.',
      payment_status: 'pending',
    },
    isLoading: false,
  }),
}))

describe('PlansPage', () => {
  beforeEach(() => {
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

  it('renders training plans with navigation to detail', () => {
    const { getByTestId, getByText } = renderWithProviders(<PlansPage />, { route: '/plans?member=15' })

    expect(getByTestId('plans-page')).toBeInTheDocument()
    expect(getByText('Hipertrofia base')).toBeInTheDocument()
    expect(getByText('Definicion avanzada')).toBeInTheDocument()
    expect(getByTestId('plan-card-12')).toHaveAttribute('href', '/plans/12')
    expect(getByTestId('plan-card-13')).toHaveAttribute('href', '/plans/13')
  })

  it('shows member-specific header when member filter is present', () => {
    const { getAllByTestId } = renderWithProviders(<PlansPage />, { route: '/plans?member=15' })
    const page = getAllByTestId('plans-page')[0]

    expect(page).toHaveTextContent('Planes Del Miembro')
    expect(page).toHaveTextContent('Mostrando 2 plan(es) del miembro seleccionado')
  })

  it('shows only the active prescription for members', () => {
    const { getByTestId, getByText } = renderWithProviders(<PlansPage />, { route: '/plans/my' })

    expect(getByText('Mi Programa')).toBeInTheDocument()
    expect(getByTestId('member-program-hero')).toBeInTheDocument()
    expect(getByTestId('member-program-hero')).toHaveTextContent('Carlos Mendoza')
    expect(getByTestId('active-prescription-status')).toBeInTheDocument()
    expect(getByTestId('program-week-overview')).toBeInTheDocument()
    expect(getByTestId('program-today-card')).toHaveTextContent('Día A: Torso')
    expect(getByTestId('active-plan-today-link')).toHaveAttribute('href', '/plans/12/today')
    expect(getByTestId('active-plan-detail-link')).toHaveAttribute('href', '/plans/12')
  })
})
