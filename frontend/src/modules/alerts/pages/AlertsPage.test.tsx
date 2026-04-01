import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { AlertsPage } from './AlertsPage'

const resolverAlerta = vi.fn()

vi.mock('../hooks/useAlerts', () => ({
  useAlertsQuery: () => ({
    data: {
      results: [
        { id: 1, created_at: '2026-03-18T10:00:00Z', resolved: false, resolved_at: null },
        { id: 2, created_at: '2026-03-15T10:00:00Z', resolved: true, resolved_at: '2026-03-19T09:00:00Z' },
      ],
    },
    isLoading: false,
  }),
  useResolveAlertMutation: () => ({
    mutate: resolverAlerta,
    isPending: false,
    variables: null,
  }),
}))

describe('AlertsPage', () => {
  it('renders alerts and filters resolved alerts', async () => {
    const user = userEvent.setup()
    const { getByTestId, getByText, queryByTestId } = renderWithProviders(<AlertsPage />)

    expect(getByTestId('alerts-page')).toBeInTheDocument()
    expect(getByText('1 alertas pendientes')).toBeInTheDocument()
    expect(getByTestId('alert-card-1')).toBeInTheDocument()
    expect(queryByTestId('alert-card-2')).not.toBeInTheDocument()

    await user.click(getByTestId('filter-resolved'))

    expect(getByTestId('alert-card-2')).toBeInTheDocument()
    expect(queryByTestId('alert-card-1')).not.toBeInTheDocument()
  })

  it('calls resolve mutation for pending alerts', async () => {
    const user = userEvent.setup()
    const { getByTestId } = renderWithProviders(<AlertsPage />)

    await user.click(getByTestId('resolve-alert-1'))

    expect(resolverAlerta).toHaveBeenCalledWith(1)
  })
})
