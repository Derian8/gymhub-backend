import { cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { RegisterPage } from './RegisterPage'

const registerMock = vi.fn()

vi.mock('../hooks/useAuthMutations', () => ({
  useRegisterMutation: () => ({
    mutate: registerMock,
    isPending: false,
  }),
}))

describe('RegisterPage', () => {
  beforeEach(() => {
    cleanup()
    registerMock.mockReset()
  })

  it('shows validation errors before submit', async () => {
    const user = userEvent.setup()
    const { getByTestId, findByTestId } = renderWithProviders(<RegisterPage />)

    await user.click(getByTestId('register-submit'))

    expect(await findByTestId('register-email-error')).toHaveTextContent('Email inválido')
    expect(await findByTestId('register-first-name-error')).toHaveTextContent('El nombre es requerido')
    expect(await findByTestId('register-last-name-error')).toHaveTextContent('El apellido es requerido')
    expect(await findByTestId('register-password-error')).toHaveTextContent('La contraseña debe tener al menos 8 caracteres')
    expect(registerMock).not.toHaveBeenCalled()
  })

  it('submits a member registration without username', async () => {
    const user = userEvent.setup()
    const { getByTestId } = renderWithProviders(<RegisterPage />)

    await user.type(getByTestId('register-email-input'), 'new.member@test.com')
    await user.type(getByTestId('register-first-name-input'), 'New')
    await user.type(getByTestId('register-last-name-input'), 'Member')
    await user.type(getByTestId('register-password-input'), 'pass123!ABC')
    await user.type(getByTestId('register-password2-input'), 'pass123!ABC')
    await user.click(getByTestId('register-submit'))

    expect(registerMock).toHaveBeenCalledWith({
      email: 'new.member@test.com',
      first_name: 'New',
      last_name: 'Member',
      password: 'pass123!ABC',
      password2: 'pass123!ABC',
      role: 'member',
    })
  })

  it('validates matching passwords and links back to login', async () => {
    const user = userEvent.setup()
    const { getByTestId, findByTestId, getByRole } = renderWithProviders(<RegisterPage />)

    await user.type(getByTestId('register-email-input'), 'new.member@test.com')
    await user.type(getByTestId('register-first-name-input'), 'New')
    await user.type(getByTestId('register-last-name-input'), 'Member')
    await user.type(getByTestId('register-password-input'), 'pass123!ABC')
    await user.type(getByTestId('register-password2-input'), 'different')
    await user.click(getByTestId('register-submit'))

    expect(await findByTestId('register-password2-error')).toHaveTextContent('Las contraseñas no coinciden')
    expect(getByRole('link', { name: 'Inicia sesión' })).toHaveAttribute('href', '/login')
    expect(registerMock).not.toHaveBeenCalled()
  })
})
