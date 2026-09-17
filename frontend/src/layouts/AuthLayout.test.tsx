import { renderWithProviders } from '@/test/utils'
import { AuthLayout } from './AuthLayout'
import { warmBackend } from '@/shared/api/backendWarmup'

vi.mock('@/shared/api/backendWarmup', () => ({
  warmBackend: vi.fn().mockResolvedValue(undefined),
}))

describe('AuthLayout', () => {
  beforeEach(() => {
    vi.mocked(warmBackend).mockClear()
  })

  it('uses the local gym image for the access cover', () => {
    const { getByTestId } = renderWithProviders(<AuthLayout />)

    expect(getByTestId('portada-gimnasio')).toHaveAttribute(
      'src',
      '/imagenes/portada-gimnasio.png',
    )
    expect(getByTestId('portada-gimnasio')).toHaveAttribute('aria-hidden', 'true')
  })
})
