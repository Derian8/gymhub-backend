import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { AlertsPage } from './AlertsPage'

const resolverAlerta = vi.fn()
const iniciarSeguimiento = vi.fn()
const registrarContacto = vi.fn()
const descartarAlerta = vi.fn()
const reabrirAlerta = vi.fn()

const alert = {
  id: 1,
  member: 7,
  created_at: '2026-03-18T10:00:00Z',
  last_checkin_date: '2026-03-05',
  days_inactive: 13,
  status: 'new',
  resolved: false,
  resolved_by: null,
  resolved_at: null,
  status_changed_by: null,
  status_changed_at: null,
  status_change_reason: '',
  reopened_at: null,
  member_name: 'Derian Vargas',
  member_email: 'derian@test.com',
  member_phone: '50688889999',
  member_photo: null,
  membership_status: 'active',
  membership_name: 'Mensual',
  membership_end_date: '2026-04-05',
  weekly_attendance_average: 3,
  priority: 'medium',
  last_contact: null,
  latest_note: '',
  recommended_action: 'Enviar mensaje de seguimiento.',
  whatsapp_url: 'https://wa.me/50688889999',
}

vi.mock('../hooks/useAlerts', () => ({
  useAlertsQuery: vi.fn(() => ({
    data: { results: [alert] },
    isLoading: false,
  })),
  useAlertsSummaryQuery: () => ({
    data: {
      new_alerts: 1,
      in_follow_up: 0,
      resolved_this_month: 2,
      recovered_this_month: 1,
      attention_message: '1 miembros necesitan atención esta semana.',
    },
  }),
  useMembersWithoutAlertsQuery: () => ({
    data: {
      results: [
        { id: 9, full_name: 'Ana Regular', email: 'ana@test.com', photo: null, message: 'Mantiene una asistencia regular.' },
      ],
    },
    isLoading: false,
  }),
  useStartFollowUpMutation: () => ({ mutate: iniciarSeguimiento, isPending: false }),
  useResolveAlertMutation: () => ({ mutate: resolverAlerta, isPending: false }),
  useDismissAlertMutation: () => ({ mutate: descartarAlerta, isPending: false }),
  useReopenAlertMutation: () => ({ mutate: reabrirAlerta, isPending: false }),
  useCreateAlertContactMutation: () => ({ mutate: registrarContacto, isPending: false }),
}))

describe('AlertsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders summary, filters and alert context', () => {
    const { getByTestId, getByText } = renderWithProviders(<AlertsPage />)

    expect(getByTestId('alerts-page')).toBeInTheDocument()
    expect(getByText('Alertas de inactividad')).toBeInTheDocument()
    expect(getByTestId('summary-new-alerts')).toHaveTextContent('1')
    expect(getByTestId('attention-message')).toHaveTextContent('1 miembros necesitan atención esta semana.')
    expect(getByText('Derian Vargas')).toBeInTheDocument()
    expect(getByText('13 días')).toBeInTheDocument()
    expect(getByText('Enviar mensaje de seguimiento.')).toBeInTheDocument()
  })

  it('calls alert actions and registers contact', async () => {
    const user = userEvent.setup()
    const { getByTestId } = renderWithProviders(<AlertsPage />)

    await user.click(getByTestId('follow-alert-1'))
    expect(iniciarSeguimiento).toHaveBeenCalledWith(1)

    await user.click(getByTestId('resolve-alert-1'))
    expect(resolverAlerta).toHaveBeenCalledWith(1)

    await user.click(getByTestId('contact-alert-1'))
    await user.type(getByTestId('contact-result'), 'Respondió')
    await user.click(getByTestId('submit-contact'))
    expect(registrarContacto).toHaveBeenCalled()
  })

  it('shows members without alerts view', async () => {
    const user = userEvent.setup()
    const { getByTestId, getByText } = renderWithProviders(<AlertsPage />)

    await user.selectOptions(getByTestId('filter-status'), 'without_alerts')

    expect(getByText('Estos miembros mantienen una asistencia regular.')).toBeInTheDocument()
    expect(getByTestId('regular-member-9')).toHaveTextContent('Ana Regular')
  })
})
