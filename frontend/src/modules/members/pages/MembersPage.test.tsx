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
    expect(within(row).getByText(/Tiene pagos en mora/i)).toBeInTheDocument()
    expect(within(row).getByText(/Prescripción incompleta/i)).toBeInTheDocument()
    expect(getByTestId('member-program-15')).toHaveAttribute('href', '/members/15/program')
    expect(getByTestId('member-detail-15')).toHaveAttribute('href', '/members/15')
  })
})
