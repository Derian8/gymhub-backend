import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AdminQrScanner } from './AdminQrScanner'

const { decodificar, detenerLector } = vi.hoisted(() => ({ decodificar: vi.fn(), detenerLector: vi.fn() }))
vi.mock('@zxing/browser', () => ({
  BrowserQRCodeReader: class { decodeFromStream = decodificar },
}))

const obtenerCamara = vi.fn()
const detenerPista = vi.fn()
const flujo = { getTracks: () => [{ stop: detenerPista }], getVideoTracks: () => [{ getSettings: () => ({}) }] }

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.stubGlobal('isSecureContext', true)
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: obtenerCamara } })
  obtenerCamara.mockReset().mockResolvedValue(flujo)
  decodificar.mockResolvedValue({ stop: detenerLector })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('registra varios clientes sin reabrir la cámara ni duplicar el QR', async () => {
  let completar!: () => void
  const enviar = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { completar = resolve })).mockResolvedValue(undefined)
  render(<AdminQrScanner isSubmitting={false} onSubmit={enviar} />)
  await waitFor(() => expect(decodificar).toHaveBeenCalledTimes(1))
  const leer = decodificar.mock.calls[0][2]
  act(() => { leer({ getText: () => 'cliente-a' }); leer({ getText: () => 'cliente-a' }) })
  expect(enviar).toHaveBeenCalledTimes(1)
  await act(async () => { completar() })
  await act(async () => { leer({ getText: () => 'cliente-a' }); leer({ getText: () => 'cliente-b' }) })
  expect(enviar).toHaveBeenCalledTimes(2)
  expect(obtenerCamara).toHaveBeenCalledTimes(1)
  expect(detenerPista).not.toHaveBeenCalled()
})

it('libera la cámara al cambiar y vuelve a la trasera al abrir el escáner', async () => {
  localStorage.setItem('pulso-camara-asistencia', 'user')
  const vista = render(<AdminQrScanner isSubmitting={false} onSubmit={vi.fn()} />)
  const cambiar = await screen.findByRole('button', { name: 'Usar cámara frontal' })
  await waitFor(() => expect(cambiar).toBeEnabled())
  expect(obtenerCamara.mock.calls[0][0].video.facingMode.exact).toBe('environment')
  fireEvent.click(cambiar)
  await waitFor(() => expect(obtenerCamara).toHaveBeenCalledTimes(2))
  expect(detenerPista).toHaveBeenCalled()
  expect(obtenerCamara.mock.calls[1][0].video.facingMode.exact).toBe('user')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Usar cámara trasera' })).toBeEnabled())
  vista.unmount()
  render(<AdminQrScanner isSubmitting={false} onSubmit={vi.fn()} />)
  await waitFor(() => expect(obtenerCamara).toHaveBeenCalledTimes(3))
  expect(obtenerCamara.mock.calls[2][0].video.facingMode.exact).toBe('environment')
})

it.each(['OverconstrainedError', 'NotFoundError', 'NotReadableError', 'AbortError'])('usa la frontal si la trasera falla con %s', async (nombre) => {
  obtenerCamara.mockRejectedValueOnce(new DOMException('trasera no disponible', nombre))
  render(<AdminQrScanner isSubmitting={false} onSubmit={vi.fn()} />)
  const cambiar = await screen.findByRole('button', { name: 'Usar cámara trasera' })
  await waitFor(() => expect(cambiar).toBeEnabled())
  expect(obtenerCamara).toHaveBeenCalledTimes(2)
  expect(obtenerCamara.mock.calls[0][0].video.facingMode.exact).toBe('environment')
  expect(obtenerCamara.mock.calls[1][0].video.facingMode.ideal).toBe('user')
  expect(decodificar).toHaveBeenCalledTimes(1)
  fireEvent.click(cambiar)
  await waitFor(() => expect(obtenerCamara).toHaveBeenCalledTimes(3))
  expect(obtenerCamara.mock.calls[2][0].video.facingMode.exact).toBe('environment')
})

it('muestra el error sin entrar en bucle si ninguna cámara está disponible', async () => {
  obtenerCamara.mockRejectedValue(new DOMException('sin cámaras', 'NotFoundError'))
  render(<AdminQrScanner isSubmitting={false} onSubmit={vi.fn()} />)
  await screen.findByRole('button', { name: 'Reintentar cámara' })
  expect(obtenerCamara).toHaveBeenCalledTimes(2)
  expect(decodificar).not.toHaveBeenCalled()
})

it('usa la orientación real para el botón cuando el navegador elige otra cámara', async () => {
  obtenerCamara.mockRejectedValueOnce(new DOMException('restricción no admitida', 'OverconstrainedError'))
  obtenerCamara.mockResolvedValueOnce({ ...flujo, getVideoTracks: () => [{ getSettings: () => ({ facingMode: 'environment' }) }] })
  render(<AdminQrScanner isSubmitting={false} onSubmit={vi.fn()} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Usar cámara frontal' })).toBeEnabled())
})

it('permite reintentar tras denegar el permiso sin solicitarlo en bucle', async () => {
  obtenerCamara.mockRejectedValueOnce(new DOMException('denegado', 'NotAllowedError'))
  render(<AdminQrScanner isSubmitting={false} onSubmit={vi.fn()} />)
  const reintentar = await screen.findByRole('button', { name: 'Reintentar cámara' })
  expect(obtenerCamara).toHaveBeenCalledTimes(1)
  fireEvent.click(reintentar)
  await waitFor(() => expect(decodificar).toHaveBeenCalledTimes(1))
})

it('libera un permiso resuelto después de salir de la vista', async () => {
  let conceder!: (valor: typeof flujo) => void
  obtenerCamara.mockImplementationOnce(() => new Promise((resolve) => { conceder = resolve }))
  const vista = render(<AdminQrScanner isSubmitting={false} onSubmit={vi.fn()} />)
  await waitFor(() => expect(obtenerCamara).toHaveBeenCalledTimes(1))
  vista.unmount()
  await act(async () => { conceder(flujo) })
  expect(detenerPista).toHaveBeenCalled()
  expect(decodificar).not.toHaveBeenCalled()
})
