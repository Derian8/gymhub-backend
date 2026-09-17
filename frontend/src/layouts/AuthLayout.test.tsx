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

  it('uses the local gym image with a lateral PULSO banner', () => {
    const { getByTestId } = renderWithProviders(<AuthLayout />)

    expect(getByTestId('portada-gimnasio')).toHaveAttribute(
      'src',
      '/imagenes/portada-gimnasio.png',
    )
    expect(getByTestId('portada-gimnasio')).toHaveAttribute('aria-hidden', 'true')
    expect(getByTestId('banner-pulso-lateral')).toHaveClass('absolute', 'bottom-10', 'right-10')
  })
})
