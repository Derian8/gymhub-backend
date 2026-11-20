import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import apiClient from '@/shared/api/client'
import { EstadoCorreos } from './EstadoCorreos'

vi.mock('@/shared/api/client', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

describe('EstadoCorreos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deshabilita el envío si falta configurar Resend', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: {
      configurado: false, modo_demo: true, cantidades: {},
    } })
    renderWithProviders(<EstadoCorreos />)
    expect(await screen.findByText(/pendiente de configurar Resend/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Procesar correos pendientes' })).toBeDisabled()
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  it('procesa pendientes solo al pulsar y actualiza el resultado', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: {
      configurado: true, modo_demo: true, cantidades: { pendiente: 1 },
    } })
    vi.mocked(apiClient.post).mockResolvedValue({ data: {
      configurado: true, modo_demo: true, cantidades: { aceptado: 1 }, aceptados: 1,
    } })
    renderWithProviders(<EstadoCorreos />)
    await screen.findByText(/1 pendientes/)
    expect(apiClient.post).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Procesar correos pendientes' }))
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/admin/correos/'))
    expect(await screen.findByText(/0 pendientes · 1 aceptados/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Procesar correos pendientes' })).toBeDisabled()
  })
})
