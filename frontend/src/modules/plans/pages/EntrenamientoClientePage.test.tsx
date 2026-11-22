import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { EntrenamientoClientePage } from './EntrenamientoClientePage'
import { entrenamientoApi, type EntradaEntrenamiento } from '../api/entrenamientoApi'
import type { Exercise, WorkoutSession } from '@/shared/types'

vi.mock('../api/entrenamientoApi', () => ({ entrenamientoApi: { entrada: vi.fn(), iniciar: vi.fn(), accion: vi.fn() } }))
vi.mock('../components/ExerciseVideo', () => ({ ExerciseVideo: () => <div title="Video agregado" /> }))
vi.mock('@/shared/store/authStore', () => ({ useAuthStore: (selector: (estado: unknown) => unknown) => selector({ user: { id: 7 } }) }))

const ejercicio = {
  id: 11, name: 'Press de pecho', exercise_type: 'strength', sets: 3, reps_range: '10',
  rest_seconds: 60, imagen_visual_url: 'https://example.com/press.gif',
  video_url: 'https://youtu.be/abcdefghijk', technique_notes: 'Controla el movimiento.',
} as Exercise
const opcion = { id: 4, nombre: 'Fuerza', bloque: 'Pecho', ejercicios: [ejercicio] }
const entrada = (): EntradaEntrenamiento => ({ asistencia_activa: true, plan: opcion, rutinas: [opcion], sesion: null })
const sesion = (): WorkoutSession => ({
  id: 10, member: 7, workout_day: 4, attendance: 1, started_at: new Date().toISOString(),
  completed_at: null, is_completed: false, overall_feeling: null, trainer_notes: '', origen: 'plan',
  detalle_iniciado: { prescripcion: [ejercicio] },
  progreso_guiado: { revision: 0, indice: 0, fase: 'previa', registros: {}, restante: 0,
    fin_fase: null, pausado: false, ultima_accion: null },
})

function montar() {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={cache}><MemoryRouter><EntrenamientoClientePage /></MemoryRouter></QueryClientProvider>)
}

async function abrirPlan() {
  montar()
  fireEvent.click(await screen.findByRole('button', { name: /Seguir mi plan/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar rutina' }))
  await screen.findByRole('button', { name: 'Comenzar ejercicio' })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(entrenamientoApi.entrada).mockResolvedValue(entrada())
  vi.mocked(entrenamientoApi.iniciar).mockResolvedValue(sesion())
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('Ejecución del cliente', () => {
  it.each([false, true])('abre una modal y conserva el estado de pausa al elegir no (pausado: %s)', async (pausado) => {
    const activa = sesion()
    activa.progreso_guiado = { ...activa.progreso_guiado!, fase: 'trabajo', pausado }
    vi.mocked(entrenamientoApi.entrada).mockResolvedValue({ ...entrada(), sesion: activa })
    vi.mocked(entrenamientoApi.iniciar).mockResolvedValue(activa)
    vi.mocked(entrenamientoApi.accion).mockImplementation(async (_id, datos) => ({
      ...activa, progreso_guiado: { ...activa.progreso_guiado!, pausado: datos.accion === 'pausar', revision: datos.revision + 1 },
    }))
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar entrenamiento' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Finalizar entrenamiento' }))
    const modal = await screen.findByRole('dialog', { name: '¿Seguro que quieres cancelar el entrenamiento?' })
    expect(modal).toHaveAttribute('aria-modal', 'true')
    await waitFor(() => expect(screen.getByRole('button', { name: 'No, continuar' })).toBeEnabled())
    expect(screen.getByRole('button', { name: 'No, continuar' })).toHaveFocus()
    expect(entrenamientoApi.accion).not.toHaveBeenCalledWith(10, expect.objectContaining({ accion: 'finalizar' }))
    fireEvent.click(screen.getByRole('button', { name: 'No, continuar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    if (pausado) expect(entrenamientoApi.accion).not.toHaveBeenCalled()
    else await waitFor(() => expect(entrenamientoApi.accion).toHaveBeenLastCalledWith(10, expect.objectContaining({ accion: 'reanudar' })))
  })

  it('solo finaliza al confirmar sí dentro de la modal', async () => {
    const activa = sesion()
    activa.progreso_guiado = { ...activa.progreso_guiado!, pausado: true }
    vi.mocked(entrenamientoApi.iniciar).mockResolvedValue(activa)
    await abrirPlan()
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar entrenamiento' }))
    await screen.findByRole('dialog')
    expect(entrenamientoApi.accion).not.toHaveBeenCalled()
    vi.mocked(entrenamientoApi.accion).mockResolvedValue({ ...activa, is_completed: true, completed_at: new Date().toISOString() })
    fireEvent.click(screen.getByRole('button', { name: 'Sí, finalizar' }))
    expect(await screen.findByText('Entrenamiento finalizado')).toBeInTheDocument()
    expect(entrenamientoApi.accion).toHaveBeenCalledTimes(1)
    expect(entrenamientoApi.accion).toHaveBeenCalledWith(10, expect.objectContaining({ accion: 'finalizar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('mantiene la imagen visible durante el trabajo y usa otra referencia si falla', async () => {
    const activa = sesion()
    activa.detalle_iniciado = { prescripcion: [{ ...ejercicio, imagen_referencia_url: 'https://example.com/respaldo.png' }] }
    activa.progreso_guiado = { ...activa.progreso_guiado!, fase: 'trabajo' }
    vi.mocked(entrenamientoApi.entrada).mockResolvedValue({ ...entrada(), sesion: activa })
    vi.mocked(entrenamientoApi.iniciar).mockResolvedValue(activa)
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar entrenamiento' }))
    const imagen = await screen.findByAltText('Demostración de Press de pecho')
    expect(screen.getByRole('button', { name: 'Serie completada' })).toBeInTheDocument()
    expect(imagen).toHaveAttribute('src', 'https://example.com/press.gif')
    fireEvent.error(imagen)
    expect(imagen).toHaveAttribute('src', 'https://example.com/respaldo.png')
    fireEvent.error(imagen)
    expect(imagen).toHaveAttribute('src', 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg')
    expect(screen.getByText('Vista previa del video de demostración')).toBeInTheDocument()
    fireEvent.error(imagen)
    expect(screen.getByText('Imagen no disponible para este ejercicio.')).toBeInTheDocument()
  })

  it('pide confirmar antes de omitir y conserva el estado si se cancela', async () => {
    await abrirPlan()
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('region', { name: 'Confirmar salto de ejercicio' })).toBeInTheDocument()
    expect(entrenamientoApi.accion).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Quedarme aquí' }))
    expect(screen.queryByRole('region', { name: 'Confirmar salto de ejercicio' })).not.toBeInTheDocument()
    expect(entrenamientoApi.accion).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    const finalizada = { ...sesion(), is_completed: true, completed_at: new Date().toISOString() }
    finalizada.progreso_guiado = { ...finalizada.progreso_guiado!, fase: 'terminado', indice: 1, registros: { '11': ['omitido', 'omitido', 'omitido'] } }
    vi.mocked(entrenamientoApi.accion).mockResolvedValue(finalizada)
    fireEvent.click(screen.getByRole('button', { name: 'Omitir pendientes y finalizar' }))
    expect(await screen.findByText('Entrenamiento finalizado')).toBeInTheDocument()
    expect(entrenamientoApi.accion).toHaveBeenCalledWith(10, expect.objectContaining({ accion: 'omitir_ejercicio' }))
    expect(screen.getByText('0 series realizadas · 3 omitidas')).toBeInTheDocument()
  })

  it('revisa el ejercicio anterior sin alterar series y permite regresar al actual', async () => {
    const activa = sesion()
    activa.detalle_iniciado = { prescripcion: [ejercicio, { ...ejercicio, id: 12, name: 'Remo' }] }
    activa.progreso_guiado = { ...activa.progreso_guiado!, indice: 1, registros: { '11': ['realizado', 'omitido', 'omitido'] } }
    vi.mocked(entrenamientoApi.entrada).mockResolvedValue({ ...entrada(), sesion: activa })
    vi.mocked(entrenamientoApi.iniciar).mockResolvedValue(activa)
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar entrenamiento' }))
    await screen.findByRole('heading', { name: 'Remo' })
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(screen.getByRole('heading', { name: 'Press de pecho' })).toBeInTheDocument()
    expect(screen.getByText('Parcial · 1 series realizadas · 2 omitidas')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Serie completada' })).not.toBeInTheDocument()
    expect(entrenamientoApi.accion).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Volver al ejercicio actual' }))
    expect(screen.getByRole('heading', { name: 'Remo' })).toBeInTheDocument()
  })

  it('recupera la duración desde el inicio y fija el tiempo al finalizar', async () => {
    const finalizada = sesion()
    finalizada.started_at = '2026-11-21T18:00:00Z'
    finalizada.completed_at = '2026-11-21T19:02:03Z'
    finalizada.is_completed = true
    vi.mocked(entrenamientoApi.iniciar).mockResolvedValue(finalizada)
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /Seguir mi plan/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar rutina' }))
    expect(await screen.findByLabelText('Tiempo total transcurrido')).toHaveTextContent('01:02:03')
    expect(screen.getByText('Incluye descansos y pausas')).toBeInTheDocument()
  })

  it('bloquea el inicio cuando no hay asistencia abierta', async () => {
    vi.mocked(entrenamientoApi.entrada).mockResolvedValue({ ...entrada(), asistencia_activa: false })
    montar()
    expect(await screen.findByText('Confirma tu entrada para entrenar')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Iniciar rutina' })).not.toBeInTheDocument()
    expect(entrenamientoApi.iniciar).not.toHaveBeenCalled()
  })

  it('permite elegir rutina libre sin plan y muestra la demostración antes de comenzar', async () => {
    vi.mocked(entrenamientoApi.entrada).mockResolvedValue({ ...entrada(), plan: null })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /Realizar rutina libre/ }))
    fireEvent.click(screen.getByRole('button', { name: /Fuerza/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar rutina' }))
    await screen.findByRole('button', { name: 'Comenzar ejercicio' })
    expect(entrenamientoApi.iniciar).toHaveBeenCalledWith({ plantilla_dia_id: 4 })
    expect(screen.getByAltText('Demostración de Press de pecho')).toBeInTheDocument()
    expect(screen.getByTitle('Video agregado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Serie completada' })).not.toBeInTheDocument()
  })

  it('confirma una serie de fuerza y muestra el descanso prescrito', async () => {
    const trabajo = sesion()
    trabajo.progreso_guiado = { ...trabajo.progreso_guiado!, revision: 1, fase: 'trabajo' }
    const descanso = sesion()
    descanso.progreso_guiado = { ...descanso.progreso_guiado!, revision: 2, fase: 'descanso',
      registros: { '11': ['realizado'] }, restante: 60, fin_fase: new Date(Date.now() + 60_000).toISOString() }
    vi.mocked(entrenamientoApi.accion).mockResolvedValueOnce(trabajo).mockResolvedValue(descanso)
    await abrirPlan()
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar ejercicio' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Serie completada' }))
    expect(await screen.findByText('Descansa')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('01:00')
    expect(entrenamientoApi.accion).toHaveBeenLastCalledWith(10, expect.objectContaining({ accion: 'confirmar_serie', revision: 1 }))
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  it('guía la serie de fuerza con una cuenta regresiva y permite silenciar la voz', async () => {
    const preparacion = sesion()
    preparacion.progreso_guiado = {
      ...preparacion.progreso_guiado!, revision: 1, fase: 'preparacion', restante: 3,
      fin_fase: new Date(Date.now() + 3_000).toISOString(),
    }
    vi.mocked(entrenamientoApi.accion).mockResolvedValue(preparacion)
    await abrirPlan()
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar ejercicio' }))
    expect(await screen.findByText('Cuenta regresiva')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('3')
    expect(screen.getByText('3 · 2 · 1 · Iniciar')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Serie completada' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar guía por voz' }))
    expect(screen.getByRole('button', { name: 'Activar guía por voz' })).toBeInTheDocument()
  })

  it('reintenta una respuesta perdida con el mismo identificador', async () => {
    vi.mocked(entrenamientoApi.accion).mockRejectedValueOnce(new Error('Conexión interrumpida'))
      .mockResolvedValue({ ...sesion(), progreso_guiado: { ...sesion().progreso_guiado!, revision: 1, fase: 'trabajo' } })
    await abrirPlan()
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar ejercicio' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar guardar' }))
    await screen.findByRole('button', { name: 'Serie completada' })
    const llamadas = vi.mocked(entrenamientoApi.accion).mock.calls
    expect(llamadas[1][1]).toEqual(llamadas[0][1])
  })

  it('al recuperar una sesión con reloj la pausa antes de mostrarla', async () => {
    const activa = sesion()
    activa.progreso_guiado = { ...activa.progreso_guiado!, fase: 'descanso', restante: 40,
      fin_fase: new Date(Date.now() + 40_000).toISOString() }
    vi.mocked(entrenamientoApi.entrada).mockResolvedValue({ ...entrada(), sesion: activa })
    vi.mocked(entrenamientoApi.iniciar).mockResolvedValue(activa)
    vi.mocked(entrenamientoApi.accion).mockResolvedValue({ ...activa, progreso_guiado: {
      ...activa.progreso_guiado!, pausado: true, fin_fase: null, revision: 1,
    } })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar entrenamiento' }))
    expect(await screen.findByRole('button', { name: 'Reanudar' })).toBeInTheDocument()
    expect(entrenamientoApi.accion).toHaveBeenCalledWith(10, expect.objectContaining({ accion: 'pausar' }))
  })

  it('el reloj termina una sola fase y espera la respuesta antes de avanzar', async () => {
    const tiempo = sesion()
    tiempo.detalle_iniciado = { prescripcion: [{ ...ejercicio, exercise_type: 'timed', duracion_trabajo_segundos: 20 }] }
    vi.mocked(entrenamientoApi.iniciar).mockResolvedValue(tiempo)
    await abrirPlan()
    const trabajo = { ...tiempo, progreso_guiado: { ...tiempo.progreso_guiado!, fase: 'trabajo' as const,
      revision: 1, fin_fase: new Date(Date.now() - 1000).toISOString(), restante: 0 } }
    vi.mocked(entrenamientoApi.accion).mockResolvedValueOnce(trabajo)
      .mockImplementation(() => new Promise(() => {}))
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar ejercicio' }))
    await waitFor(() => expect(screen.getByRole('timer')).toBeInTheDocument())
    await waitFor(() => expect(entrenamientoApi.accion).toHaveBeenCalledTimes(2))
    expect(entrenamientoApi.accion).toHaveBeenLastCalledWith(10, expect.objectContaining({ accion: 'intervalo_terminado' }))
  })

  it('pausa el entrenamiento al ocultar la página', async () => {
    const trabajo = sesion()
    trabajo.progreso_guiado = { ...trabajo.progreso_guiado!, fase: 'trabajo', revision: 1 }
    vi.mocked(entrenamientoApi.accion).mockResolvedValueOnce(trabajo).mockResolvedValue({
      ...trabajo, progreso_guiado: { ...trabajo.progreso_guiado!, pausado: true, revision: 2 },
    })
    await abrirPlan()
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar ejercicio' }))
    await screen.findByRole('button', { name: 'Serie completada' })
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    fireEvent(document, new Event('visibilitychange'))
    await screen.findByRole('button', { name: 'Reanudar' })
    expect(entrenamientoApi.accion).toHaveBeenLastCalledWith(10, expect.objectContaining({ accion: 'pausar' }))
  })
})
