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

it('libera la cámara anterior y recuerda la frontal al cambiar', async () => {
  const vista = render(<AdminQrScanner isSubmitting={false} onSubmit={vi.fn()} />)
  const cambiar = await screen.findByRole('button', { name: 'Usar cámara frontal' })
  await waitFor(() => expect(cambiar).toBeEnabled())
  fireEvent.click(cambiar)
  await waitFor(() => expect(obtenerCamara).toHaveBeenCalledTimes(2))
  expect(detenerPista).toHaveBeenCalled()
  expect(obtenerCamara.mock.calls[1][0].video.facingMode.exact).toBe('user')
  await waitFor(() => expect(localStorage.getItem('pulso-camara-asistencia')).toBe('user'))
  vista.unmount()
  render(<AdminQrScanner isSubmitting={false} onSubmit={vi.fn()} />)
  await waitFor(() => expect(obtenerCamara).toHaveBeenCalledTimes(3))
  expect(obtenerCamara.mock.calls[2][0].video.facingMode.exact).toBe('user')
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
