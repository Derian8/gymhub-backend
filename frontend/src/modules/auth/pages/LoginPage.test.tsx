import { cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { LoginPage } from './LoginPage'

const loginMock = vi.fn()
let loginPending = false

vi.mock('../hooks/useAuthMutations', () => ({
  useLoginMutation: () => ({
    mutate: loginMock,
    isPending: loginPending,
  }),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    cleanup()
    loginMock.mockReset()
    loginPending = false
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

  it('explains that accounts are created by the trainer', () => {
    const { getByText, queryByRole } = renderWithProviders(<LoginPage />)

    expect(getByText('Las cuentas de miembros son creadas por la administración del gimnasio.')).toBeInTheDocument()
    expect(queryByRole('link', { name: 'Regístrate' })).not.toBeInTheDocument()
  })

  it('shows backend preparation while login is pending', () => {
    loginPending = true

    const { getByTestId } = renderWithProviders(<LoginPage />)

    expect(getByTestId('login-submit')).toHaveTextContent(
      'Preparando servidor e ingresando...',
    )
    expect(getByTestId('login-submit')).toBeDisabled()
  })

  it('prepara el acceso demo sin iniciar sesión automáticamente', async () => {
    const user = userEvent.setup()
    const { getByRole, getByTestId } = renderWithProviders(<LoginPage />)
    await user.click(getByRole('button', { name: /Accesos demo/ }))
    await user.click(getByRole('button', { name: 'Usar acceso de administrador' }))
    expect(getByTestId('email-input')).toHaveValue('admin@gymhub.com')
    expect(getByTestId('password-input')).toHaveValue('PulsoAdmin2026!')
    expect(getByTestId('login-submit')).toHaveFocus()
    expect(loginMock).not.toHaveBeenCalled()
    await user.click(getByTestId('login-submit'))
    expect(loginMock).toHaveBeenCalledWith({ email: 'admin@gymhub.com', password: 'PulsoAdmin2026!' })
  })

  it('prepara las credenciales vigentes del cliente demo', async () => {
    const user = userEvent.setup()
    const { getByRole, getByTestId } = renderWithProviders(<LoginPage />)
    await user.click(getByRole('button', { name: /Accesos demo/ }))
    await user.click(getByRole('button', { name: 'Usar acceso de cliente' }))
    expect(getByTestId('email-input')).toHaveValue('member1@gymhub.com')
    expect(getByTestId('password-input')).toHaveValue('PulsoCliente2026!')
  })

  it('copia las credenciales demo y confirma la acción', async () => {
    const user = userEvent.setup()
    const copiar = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    const { getByRole } = renderWithProviders(<LoginPage />)
    await user.click(getByRole('button', { name: /Accesos demo/ }))
    await user.click(getByRole('button', { name: 'Copiar credenciales de administrador' }))
    expect(copiar).toHaveBeenCalledWith('Correo: admin@gymhub.com\nContraseña: PulsoAdmin2026!')
    expect(getByRole('status')).toHaveTextContent('Credenciales de administrador copiadas.')
  })

  it('permite usar el formulario cuando el navegador rechaza copiar', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('sin permiso'))
    const { getByRole, getByTestId } = renderWithProviders(<LoginPage />)
    await user.click(getByRole('button', { name: /Accesos demo/ }))
    await user.click(getByRole('button', { name: 'Copiar credenciales de administrador' }))
    expect(getByRole('status')).toHaveTextContent('No se pudo copiar.')
    await user.click(getByRole('button', { name: 'Usar acceso de administrador' }))
    expect(getByTestId('email-input')).toHaveValue('admin@gymhub.com')
  })

  it('mantiene los accesos demo colapsados inicialmente', () => {
    const { getByRole, queryByRole } = renderWithProviders(<LoginPage />)
    expect(getByRole('button', { name: /Accesos demo/ })).toHaveAttribute('aria-expanded', 'false')
    expect(queryByRole('article', { name: 'Acceso demo de administrador' })).not.toBeInTheDocument()
  })
})
