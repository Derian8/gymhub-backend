import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@/test/utils'
import { MessagesPage } from './MessagesPage'

const marcarLeido = vi.fn()
const useNotificationsQuery = vi.fn()

vi.mock('../hooks/useAlerts', () => ({
  useNotificationsQuery: (...args: unknown[]) => useNotificationsQuery(...args),
  useMarkReadMutation: () => ({
    mutate: marcarLeido,
  }),
}))

describe('MessagesPage', () => {
  beforeEach(() => {
    marcarLeido.mockReset()
    useNotificationsQuery.mockReset()
  })

  it('renders trainer messages and marks unread items as read', async () => {
    useNotificationsQuery.mockReturnValue({
      data: {
        results: [
          {
            id: 71,
            user: 1,
            message: 'Hoy prioriza tu cardio y regístralo al terminar.',
            type: 'trainer_message',
            read: false,
            created_at: '2026-03-20T10:00:00Z',
          },
          {
            id: 72,
            user: 1,
            message: 'Buen trabajo con la sesión anterior.',
            type: 'trainer_message',
            read: true,
            created_at: '2026-03-19T09:00:00Z',
          },
        ],
      },
      isLoading: false,
    })

    const user = userEvent.setup()
    const { getByRole, getByTestId, getByText } = renderWithProviders(<MessagesPage />)

    expect(getByTestId('messages-page')).toBeInTheDocument()
    expect(getByRole('heading', { name: 'Mensajes del trainer' })).toBeInTheDocument()
    expect(getByText('Hoy prioriza tu cardio y regístralo al terminar.')).toBeInTheDocument()

    await user.click(getByTestId('trainer-message-71'))

    expect(marcarLeido).toHaveBeenCalledWith(71)
  })

  it('shows an empty state when there are no trainer messages', () => {
    useNotificationsQuery.mockReturnValue({
      data: { results: [] },
      isLoading: false,
    })

    const { getByText } = renderWithProviders(<MessagesPage />)

    expect(getByText('Sin mensajes del trainer')).toBeInTheDocument()
  })
})
