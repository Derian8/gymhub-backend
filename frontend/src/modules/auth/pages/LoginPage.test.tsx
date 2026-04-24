import { cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { LoginPage } from './LoginPage'

const loginMock = vi.fn()

vi.mock('../hooks/useAuthMutations', () => ({
  useLoginMutation: () => ({
    mutate: loginMock,
    isPending: false,
  }),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    cleanup()
    loginMock.mockReset()
  })

  it('shows validation errors before submit', async () => {
    const user = userEvent.setup()
    const { getByTestId, findByTestId } = renderWithProviders(<LoginPage />)

    await user.click(getByTestId('login-submit'))

    expect(await findByTestId('email-error')).toHaveTextContent('Email inválido')
    expect(await findByTestId('password-error')).toHaveTextContent('La contraseña es requerida')
    expect(loginMock).not.toHaveBeenCalled()
  })

  it('submits credentials when form is valid', async () => {
    const user = userEvent.setup()
    const { getByTestId } = renderWithProviders(<LoginPage />)

    await user.type(getByTestId('email-input'), 'member@test.com')
    await user.type(getByTestId('password-input'), 'member123!')
    await user.click(getByTestId('login-submit'))

    expect(loginMock).toHaveBeenCalledWith(
      {
        email: 'member@test.com',
        password: 'member123!',
      },
    )
  })

  it('links to public registration', () => {
    const { getByRole } = renderWithProviders(<LoginPage />)

    expect(getByRole('link', { name: 'Regístrate' })).toHaveAttribute('href', '/register')
  })
})
