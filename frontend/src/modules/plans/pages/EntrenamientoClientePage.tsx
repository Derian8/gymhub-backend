import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle, Clock3, Dumbbell, ImageOff, Loader2, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { entrenamientoApi, type AccionEntrenamiento, type OpcionEntrenamiento } from '../api/entrenamientoApi'
import { ExerciseVideo } from '../components/ExerciseVideo'
import { extractApiError, formatPesoSugerido } from '@/shared/lib/utils'
import { useAuthStore } from '@/shared/store/authStore'
import type { Exercise, WorkoutSession } from '@/shared/types'

function prescripcion(ejercicio: Exercise) {
  return ejercicio.exercise_type === 'timed'
    ? `${ejercicio.sets ?? 1} series · ${ejercicio.duracion_trabajo_segundos ?? (ejercicio.target_minutes ?? 0) * 60} s de trabajo`
    : `${ejercicio.sets} series · ${ejercicio.reps_range} repeticiones`
}

function CronometroRutina({ sesion }: { sesion: WorkoutSession }) {
  const [ahora, establecerAhora] = useState(Date.now)
  useEffect(() => {
    if (sesion.is_completed) return
    const intervalo = window.setInterval(() => establecerAhora(Date.now()), 1000)
    return () => window.clearInterval(intervalo)
  }, [sesion.id, sesion.is_completed])
  const fin = sesion.completed_at ? Date.parse(sesion.completed_at) : ahora
  const segundos = Math.max(0, Math.floor((fin - Date.parse(sesion.started_at)) / 1000)) || 0
  const horas = Math.floor(segundos / 3600)
  const tiempo = [ ...(horas ? [horas] : []), Math.floor(segundos / 60) % 60, segundos % 60 ]
    .map((valor) => String(valor).padStart(2, '0')).join(':')
  return <section aria-label="Tiempo de la rutina" className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-100 px-4 py-3 dark:bg-neutral-900">
    <div><p className="flex items-center gap-2 text-sm font-semibold"><Clock3 size={17} />Tiempo total de rutina</p><p className="mt-1 text-xs text-neutral-500">Incluye descansos y pausas</p></div>
    <span aria-label="Tiempo total transcurrido" className="text-2xl font-bold tabular-nums">{tiempo}</span>
  </section>
}

function ImagenEjercicio({ ejercicio }: { ejercicio: Exercise }) {
  const miniaturas = [ejercicio.catalogo_detalle?.video_url, ejercicio.video_url].flatMap((url) => {
    const identificador = url?.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)?.[1]
    return identificador ? [`https://i.ytimg.com/vi/${identificador}/hqdefault.jpg`] : []
  })
  const imagenes = [...new Set([
    ejercicio.imagen_visual_url, ejercicio.imagen_referencia_url,
    ejercicio.catalogo_detalle?.animacion_url, ejercicio.catalogo_detalle?.imagen_url,
    ...miniaturas,
  ].filter((imagen): imagen is string => Boolean(imagen)))]
  const [indice, establecerIndice] = useState(0)
  const imagen = imagenes[indice]
  return <figure className="overflow-hidden rounded-2xl bg-neutral-50 dark:bg-neutral-900">
    {imagen ? <img src={imagen} alt={`Demostración de ${ejercicio.name}`} className="h-44 w-full object-contain sm:h-60" onError={() => establecerIndice((actual) => actual + 1)} />
      : <div className="flex min-h-32 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-neutral-500"><ImageOff aria-hidden="true" size={28} /><p>Imagen no disponible para este ejercicio.</p><p>Consulta la técnica y el video de demostración.</p></div>}
    {imagen && miniaturas.includes(imagen) && <figcaption className="px-3 pb-2 text-center text-xs text-neutral-500">Vista previa del video de demostración</figcaption>}
  </figure>
}

function fraseCorta(texto?: string | null) {
  if (!texto) return ''
  return texto.split(/(?<=[.!?])\s/)[0].slice(0, 160)
}

function detenerGuiaVoz() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
}

function hablar(texto: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return
  try {
    window.speechSynthesis.cancel()
    const mensaje = new SpeechSynthesisUtterance(texto)
    mensaje.lang = 'es-CR'
    mensaje.rate = 0.95
    window.speechSynthesis.speak(mensaje)
  } catch {
    // La guía visual funciona aun cuando el navegador no permite síntesis de voz.
  }
}

type DatosGuia = {
  titulo: string
  mensaje: string
  consejo: string
  voz: string
}

function datosGuia(
  ejercicio: Exercise,
  fase: string,
  serie: number,
  pausado: boolean,
  siguiente?: Exercise,
): DatosGuia {
  const tecnica = fraseCorta(ejercicio.technique_notes || ejercicio.catalogo_detalle?.instrucciones_es)
  const objetivo = ejercicio.exercise_type === 'timed'
    ? `${ejercicio.duracion_trabajo_segundos ?? (ejercicio.target_minutes ?? 0) * 60} segundos de trabajo`
    : `${ejercicio.reps_range} repeticiones`

  if (pausado) return {
    titulo: 'Pausa activa',
    mensaje: 'El cronómetro está detenido. Respira, toma agua si la necesitas y continúa cuando estés listo.',
    consejo: 'Al reanudar, vuelve a colocarte antes de hacer la siguiente repetición.',
    voz: 'Entrenamiento en pausa.',
  }
  if (fase === 'previa') return {
    titulo: 'Antes de empezar',
    mensaje: `Revisa la demostración y prepara tu espacio. Objetivo: ${objetivo}.`,
    consejo: tecnica || 'Prioriza la técnica y un rango de movimiento que puedas controlar.',
    voz: `Siguiente ejercicio: ${ejercicio.name}. ${objetivo}. Revisa la demostración antes de comenzar.`,
  }
  if (fase === 'preparacion') return {
    titulo: 'Cuenta regresiva',
    mensaje: 'Colócate en posición. Iniciamos en tres, dos, uno.',
    consejo: tecnica || 'Activa el abdomen, respira y comienza con movimiento controlado.',
    voz: 'Prepárate.',
  }
  if (fase === 'descanso_ejercicio') return {
    titulo: 'Transición al siguiente ejercicio',
    mensaje: siguiente ? `Recupera el aire. Después sigue ${siguiente.name}.` : 'Recupera el aire antes del siguiente ejercicio.',
    consejo: 'Aprovecha este tiempo para ajustar el equipo y confirmar el peso.',
    voz: siguiente ? `Buen trabajo. Descansa. Después sigue ${siguiente.name}.` : 'Buen trabajo. Descansa antes del siguiente ejercicio.',
  }
  if (fase === 'descanso') return {
    titulo: 'Descanso entre series',
    mensaje: `Serie completada. Recupera el aire para la serie ${serie}.`,
    consejo: 'No sacrifiques la técnica por empezar antes: vuelve cuando te sientas listo.',
    voz: `Serie completada. Descansa antes de la serie ${serie}.`,
  }
  if (ejercicio.exercise_type === 'timed') return {
    titulo: 'Trabajo en curso',
    mensaje: `Mantén el ritmo durante ${objetivo}.`,
    consejo: tecnica || 'Respira de forma constante y conserva el control durante todo el intervalo.',
    voz: `Inicia. ${ejercicio.name}.`,
  }
  return {
    titulo: `Serie ${serie} en curso`,
    mensaje: `Completa ${objetivo} con una técnica consistente.`,
    consejo: tecnica || 'Controla la subida y la bajada; la calidad de cada repetición es la prioridad.',
    voz: `Inicia la serie ${serie}. ${objetivo}.`,
  }
}

function GuiaEntrenamiento({
  ejercicio,
  siguiente,
  fase,
  serie,
  restante,
  pausado,
  revision,
  vozActiva,
  alCambiarVoz,
}: {
  ejercicio: Exercise
  siguiente?: Exercise
  fase: string
  serie: number
  restante: number
  pausado: boolean
  revision: number
  vozActiva: boolean
  alCambiarVoz: () => void
}) {
  const anunciados = useRef(new Set<string>())
  const guia = datosGuia(ejercicio, fase, serie, pausado, siguiente)

  useEffect(() => {
    if (!vozActiva) return
    // La propia cuenta anuncia 3, 2 y 1; evitar una frase que se cancelaría
    // de inmediato al comenzar esa secuencia.
    if (fase === 'preparacion' && !pausado) return
    const clave = `${ejercicio.id}:${revision}:${fase}:${pausado}`
    if (anunciados.current.has(clave)) return
    anunciados.current.add(clave)
    hablar(guia.voz)
  }, [ejercicio.id, fase, guia.voz, pausado, revision, vozActiva])

  useEffect(() => {
    if (!vozActiva || pausado || fase !== 'preparacion' || restante < 1 || restante > 3) return
    const clave = `${ejercicio.id}:${revision}:cuenta:${restante}`
    if (anunciados.current.has(clave)) return
    anunciados.current.add(clave)
    hablar(String(restante))
  }, [ejercicio.id, fase, pausado, restante, revision, vozActiva])

  return <section aria-label="Guía del entrenamiento" className="rounded-2xl border border-primary/20 bg-primary/5 p-4 dark:bg-primary/10">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Guía del entrenador</p>
        <h2 className="mt-1 text-lg font-bold">{guia.titulo}</h2>
      </div>
      <button
        type="button"
        className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-primary/10"
        aria-pressed={vozActiva}
        aria-label={vozActiva ? 'Desactivar guía por voz' : 'Activar guía por voz'}
        onClick={alCambiarVoz}
      >
        {vozActiva ? <Volume2 size={19} /> : <VolumeX size={19} />}
        {vozActiva ? 'Voz activa' : 'Voz apagada'}
      </button>
    </div>
    <p className="mt-3 text-sm leading-relaxed" aria-live="polite">{guia.mensaje}</p>
    {fase === 'preparacion' && !pausado && <p className="mt-3 text-center font-heading text-5xl font-black tabular-nums text-primary" aria-label={`Iniciamos en ${restante}`}>{restante || '¡Ya!'}</p>}
    <p className="mt-3 border-t border-primary/15 pt-3 text-sm text-neutral-600 dark:text-neutral-300"><strong>Consejo:</strong> {guia.consejo}</p>
  </section>
}

export function EntrenamientoClientePage() {
  const usuarioId = useAuthStore((estado) => estado.user?.id)
  const cache = useQueryClient()
  const consulta = useQuery({ queryKey: ['entrenamiento-cliente', usuarioId], queryFn: entrenamientoApi.entrada,
    refetchOnWindowFocus: false, staleTime: 0 })
  const [sesion, establecerSesion] = useState<WorkoutSession | null>(null)
  const sesionRef = useRef<WorkoutSession | null>(null)
  const [modo, establecerModo] = useState<'plan' | 'libre' | null>(null)
  const [seleccion, establecerSeleccion] = useState<OpcionEntrenamiento | null>(null)
  const [busqueda, establecerBusqueda] = useState('')
  const [guardando, establecerGuardando] = useState(false)
  const ocupado = useRef(false)
  const [error, establecerError] = useState('')
  const errorRef = useRef(false)
  const fallida = useRef<{ id: number; payload: { accion: AccionEntrenamiento; revision: number; identificador: string } } | null>(null)
  const [restante, establecerRestante] = useState(0)
  const [confirmarFin, establecerConfirmarFin] = useState(false)
  const [verAyuda, establecerVerAyuda] = useState(false)
  const [confirmarSalto, establecerConfirmarSalto] = useState(false)
  const [indiceRevisado, establecerIndiceRevisado] = useState<number | null>(null)
  const [guiaVozActiva, establecerGuiaVozActiva] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.localStorage.getItem('pulso-guia-voz') !== 'false'
  })
  const pausarPendiente = useRef(false)
  const enviarRef = useRef<(accion: AccionEntrenamiento) => Promise<void>>(async () => {})
  const cierreAnunciado = useRef<number | null>(null)

  const alternarGuiaVoz = () => {
    establecerGuiaVozActiva((activa) => {
      const siguiente = !activa
      try {
        window.localStorage.setItem('pulso-guia-voz', String(siguiente))
      } catch {
        // La preferencia seguirá activa en esta sesión si el navegador bloquea almacenamiento.
      }
      if (siguiente) hablar('Guía por voz activada.')
      else detenerGuiaVoz()
      return siguiente
    })
  }

  const actualizar = useCallback((nueva: WorkoutSession) => {
    if (sesionRef.current?.progreso_guiado?.indice !== nueva.progreso_guiado?.indice || nueva.is_completed) {
      establecerIndiceRevisado(null)
      establecerConfirmarSalto(false)
    }
    sesionRef.current = nueva
    establecerSesion(nueva)
    establecerRestante(nueva.progreso_guiado?.restante ?? 0)
    if (nueva.is_completed) {
      void cache.invalidateQueries({ queryKey: ['workout-sessions'] })
      void cache.invalidateQueries({ queryKey: ['entrenamiento-cliente'] })
      void cache.invalidateQueries({ queryKey: ['plans'] })
      void cache.invalidateQueries({ queryKey: ['members'] })
    }
  }, [cache])

  const enviar = useCallback(async (accion: AccionEntrenamiento) => {
    const actual = sesionRef.current
    if (!actual?.progreso_guiado || ocupado.current || actual.is_completed) return
    ocupado.current = true
    establecerGuardando(true)
    establecerError('')
    errorRef.current = false
    const peticion = fallida.current ?? { id: actual.id, payload: {
      accion, revision: actual.progreso_guiado.revision, identificador: crypto.randomUUID(),
    } }
    try {
      const resultado = await entrenamientoApi.accion(peticion.id, peticion.payload)
      fallida.current = null
      actualizar(resultado)
      if (resultado.progreso_guiado?.fase === 'previa') establecerVerAyuda(false)
    } catch (problema) {
      const conflicto = problema as { response?: { status: number; data?: { sesion?: WorkoutSession } } }
      if (conflicto.response?.status === 409 && conflicto.response.data?.sesion) {
        actualizar(conflicto.response.data.sesion)
        fallida.current = null
      } else if (!conflicto.response || conflicto.response.status >= 500) {
        // Reintentar conserva el identificador: nunca confirma dos series por una respuesta perdida.
        fallida.current = peticion
      } else {
        fallida.current = null
      }
      errorRef.current = true
      establecerError(extractApiError(problema))
    } finally {
      ocupado.current = false
      establecerGuardando(false)
      if (pausarPendiente.current && !errorRef.current) {
        pausarPendiente.current = false
        void enviarRef.current('pausar')
      }
    }
  }, [actualizar])
  enviarRef.current = enviar

  const iniciar = async (opcion?: OpcionEntrenamiento, libre = false) => {
    if (ocupado.current) return
    ocupado.current = true
    establecerGuardando(true)
    establecerError('')
    try {
      const existente = consulta.data?.sesion
      let nueva = await entrenamientoApi.iniciar(opcion
        ? libre ? { plantilla_dia_id: opcion.id } : { workout_day_id: opcion.id }
        : { workout_day_id: existente?.workout_day ?? 0 })
      if (nueva.progreso_guiado?.fin_fase) {
        nueva = await entrenamientoApi.accion(nueva.id, { accion: 'pausar', revision: nueva.progreso_guiado.revision, identificador: crypto.randomUUID() })
      }
      actualizar(nueva)
    } catch (problema) {
      establecerError(extractApiError(problema))
    } finally {
      ocupado.current = false
      establecerGuardando(false)
    }
  }

  useEffect(() => {
    const intervalo = window.setInterval(() => {
      const progreso = sesionRef.current?.progreso_guiado
      if (!progreso?.fin_fase || progreso.pausado) return
      const segundos = Math.max(0, Math.ceil((Date.parse(progreso.fin_fase) - Date.now()) / 1000))
      establecerRestante(segundos)
      if (segundos === 0 && document.visibilityState === 'visible' && !errorRef.current) void enviarRef.current('intervalo_terminado')
    }, 200)
    const pausar = () => {
      const actual = sesionRef.current
      if (!actual || actual.is_completed || actual.progreso_guiado?.pausado || actual.progreso_guiado?.fase === 'previa') return
      if (ocupado.current) pausarPendiente.current = true
      else void enviarRef.current('pausar')
    }
    const visibilidad = () => { if (document.visibilityState === 'hidden') pausar() }
    document.addEventListener('visibilitychange', visibilidad)
    window.addEventListener('pagehide', pausar)
    return () => {
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', visibilidad)
      window.removeEventListener('pagehide', pausar)
      pausar()
    }
  }, [])

  useEffect(() => {
    if (!sesion?.is_completed || !guiaVozActiva || cierreAnunciado.current === sesion.id) return
    cierreAnunciado.current = sesion.id
    hablar('Entrenamiento completado. Tu progreso quedó guardado. Buen trabajo.')
  }, [guiaVozActiva, sesion?.id, sesion?.is_completed])

  const mensajeError = error ? <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"><p>{error}</p>{fallida.current && <button className="btn-secondary mt-3" disabled={guardando} onClick={() => void enviar(fallida.current!.payload.accion)}>Reintentar guardar</button>}</div> : null

  if (consulta.isLoading) return <p role="status" className="p-6">Cargando tu entrenamiento…</p>
  if (consulta.isError) return <section className="card p-6"><p role="alert">No pudimos cargar tus entrenamientos.</p><button className="btn-primary mt-4" onClick={() => void consulta.refetch()}>Reintentar</button></section>
  if (!consulta.data?.asistencia_activa) return <section className="card mx-auto max-w-2xl space-y-4 p-6"><h1 className="text-2xl font-bold">Confirma tu entrada para entrenar</h1><p>Muestra tu QR en recepción. Necesitas una entrada de hoy sin salida registrada.</p><Link className="btn-primary inline-flex" to="/today">Mostrar mi QR</Link><button className="btn-secondary ml-3" onClick={() => void consulta.refetch()}>Revisar entrada</button></section>

  if (!sesion) return <div className="page-enter mx-auto max-w-4xl space-y-5">
    <h1 className="font-heading text-3xl font-black">Mi entrenamiento</h1>
    {mensajeError}
    {consulta.data.sesion ? <section className="card space-y-4 p-6"><h2 className="text-xl font-bold">Tienes un entrenamiento iniciado</h2><p>{consulta.data.sesion.workout_day_name}</p><button className="btn-primary min-h-14 w-full" disabled={guardando} onClick={() => void iniciar()}>{guardando ? 'Recuperando…' : 'Continuar entrenamiento'}</button></section> : <>
      <div className="grid gap-4 sm:grid-cols-2">
        <button className={`card min-h-36 p-6 text-left ${modo === 'plan' ? 'ring-2 ring-primary' : ''}`} aria-pressed={modo === 'plan'} onClick={() => { establecerModo('plan'); establecerSeleccion(consulta.data.plan) }}><Dumbbell className="mb-3 text-primary" /><strong className="block text-xl">Seguir mi plan</strong><span className="mt-2 block text-sm text-neutral-500">{consulta.data.plan ? `${consulta.data.plan.nombre} · ${consulta.data.plan.bloque}` : 'Aún no tienes un plan asignado.'}</span></button>
        <button className={`card min-h-36 p-6 text-left ${modo === 'libre' ? 'ring-2 ring-primary' : ''}`} aria-pressed={modo === 'libre'} onClick={() => { establecerModo('libre'); establecerSeleccion(null) }}><Play className="mb-3 text-primary" /><strong className="block text-xl">Realizar rutina libre</strong><span className="mt-2 block text-sm text-neutral-500">Elige una rutina disponible. Tu plan conserva su siguiente bloque.</span></button>
      </div>
      {modo === 'libre' && <section className="space-y-3"><label className="block text-sm font-semibold">Buscar rutina<input className="input mt-2" value={busqueda} onChange={(evento) => establecerBusqueda(evento.target.value)} placeholder="Nombre de la rutina o bloque" /></label>{!consulta.data.rutinas.length && <p className="card p-5">El administrador aún no ha habilitado rutinas libres.</p>}{consulta.data.rutinas.length > 0 && !consulta.data.rutinas.some((rutina) => `${rutina.nombre} ${rutina.bloque}`.toLocaleLowerCase().includes(busqueda.toLocaleLowerCase())) && <p>No hay rutinas que coincidan.</p>}<div className="grid gap-3 sm:grid-cols-2">{consulta.data.rutinas.filter((rutina) => `${rutina.nombre} ${rutina.bloque}`.toLocaleLowerCase().includes(busqueda.toLocaleLowerCase())).map((rutina) => <button key={rutina.id} className={`card p-5 text-left ${seleccion?.id === rutina.id ? 'ring-2 ring-primary' : ''}`} onClick={() => establecerSeleccion(rutina)}><strong>{rutina.nombre}</strong><span className="mt-1 block text-sm">{rutina.bloque} · {rutina.ejercicios.length} ejercicios</span></button>)}</div></section>}
      {seleccion && <section className="card space-y-4 p-6"><h2 className="text-2xl font-bold">{seleccion.bloque}</h2>{seleccion.descripcion && <p>{seleccion.descripcion}</p>}<ol className="space-y-3">{seleccion.ejercicios.map((ejercicio) => <li key={ejercicio.id}><strong>{ejercicio.name}</strong><p className="text-sm text-neutral-500">{prescripcion(ejercicio)} · {ejercicio.rest_seconds} s de descanso</p></li>)}</ol><button className="btn-primary min-h-14 w-full" disabled={guardando || !seleccion.ejercicios.length} onClick={() => void iniciar(seleccion, modo === 'libre')}>{guardando ? 'Iniciando…' : 'Iniciar rutina'}</button></section>}
    </>}
  </div>

  const progreso = sesion.progreso_guiado!
  const ejercicios = sesion.detalle_iniciado?.prescripcion ?? []
  const resumen = ejercicios.map((ejercicio) => {
    const series = progreso.registros[String(ejercicio.id)] ?? []
    const realizadas = series.filter((estado) => estado === 'realizado').length
    const omitidas = series.filter((estado) => estado === 'omitido').length
    return { ejercicio, realizadas, omitidas, estado: realizadas === (ejercicio.sets ?? 1) ? 'Realizado' : realizadas ? 'Parcial' : omitidas ? 'Omitido' : 'Pendiente' }
  })
  if (sesion.is_completed) return <section className="card mx-auto max-w-2xl space-y-5 p-6 text-center"><CheckCircle className="mx-auto text-emerald-500" size={48} /><h1 className="text-3xl font-bold">Entrenamiento finalizado</h1><p>Tu progreso quedó guardado.{sesion.origen === 'libre' ? ' Tu plan conserva el siguiente bloque pendiente.' : ''}</p><CronometroRutina sesion={sesion} /><ul className="space-y-2 text-left">{resumen.map((item) => <li key={item.ejercicio.id} className="rounded-xl bg-neutral-100 p-3 dark:bg-neutral-900"><strong>{item.ejercicio.name}</strong> · {item.estado}<span className="block text-sm">{item.realizadas} series realizadas · {item.omitidas} omitidas</span></li>)}</ul><Link className="btn-secondary inline-flex" to="/today">Volver a Inicio</Link><button className="btn-primary ml-3" onClick={() => { sesionRef.current = null; establecerSesion(null); establecerSeleccion(null); establecerModo(null); establecerConfirmarFin(false); void consulta.refetch() }}>Elegir otro entrenamiento</button></section>

  const ejercicio = ejercicios[progreso.indice]
  if (!ejercicio) return <p role="alert">No pudimos recuperar el ejercicio. Vuelve a abrir el entrenamiento.</p>
  const siguienteEjercicio = ejercicios[progreso.indice + 1]
  const serie = (progreso.registros[String(ejercicio.id)] ?? []).length + 1
  const esTiempo = ejercicio.exercise_type === 'timed'
  const previa = progreso.fase === 'previa'
  const enDescanso = progreso.fase === 'descanso' || progreso.fase === 'descanso_ejercicio'
  const cuenta = progreso.fase === 'preparacion' || enDescanso || (progreso.fase === 'trabajo' && esTiempo)
  const bloquear = guardando || Boolean(fallida.current)
  const segundos = progreso.fin_fase ? restante : progreso.restante
  const pausarParaRevisar = () => {
    if (!progreso.pausado && !previa) void enviar('pausar')
  }
  if (indiceRevisado !== null && ejercicios[indiceRevisado]) {
    const revisado = resumen[indiceRevisado]
    return <div className="page-enter mx-auto max-w-2xl space-y-4 pb-8">
      <CronometroRutina sesion={sesion} />
      {mensajeError}
      <article className="card space-y-5 p-5 sm:p-7">
        <p className="text-sm font-semibold text-primary">Revisando ejercicio {indiceRevisado + 1} de {ejercicios.length}</p>
        <h1 className="font-heading text-3xl font-black">{revisado.ejercicio.name}</h1>
        <p>{revisado.estado} · {revisado.realizadas} series realizadas · {revisado.omitidas} omitidas</p>
        <p className="text-sm text-neutral-500">Esta vista conserva tu registro. El entrenamiento actual queda en pausa.</p>
        <Demostracion key={revisado.ejercicio.id} ejercicio={revisado.ejercicio} />
        <div className="grid grid-cols-2 gap-3">
          <button className="btn-secondary inline-flex min-h-12 items-center justify-center gap-2" disabled={bloquear || indiceRevisado === 0} onClick={() => establecerIndiceRevisado(indiceRevisado - 1)}><ArrowLeft size={18} />Anterior</button>
          <button className="btn-secondary inline-flex min-h-12 items-center justify-center gap-2" disabled={bloquear} onClick={() => establecerIndiceRevisado(indiceRevisado + 1 < progreso.indice ? indiceRevisado + 1 : null)}>Siguiente<ArrowRight size={18} /></button>
        </div>
        <button className="btn-primary min-h-14 w-full" disabled={bloquear} onClick={() => establecerIndiceRevisado(null)}>Volver al ejercicio actual</button>
      </article>
    </div>
  }
  return <div className="page-enter mx-auto max-w-2xl space-y-4 pb-8">
    <CronometroRutina sesion={sesion} />
    <div className="flex items-center justify-between text-sm"><span>Ejercicio {progreso.indice + 1} de {ejercicios.length}</span><span>{sesion.origen === 'libre' ? 'Rutina libre' : 'Mi plan'}</span></div>
    <progress aria-label="Ejercicios resueltos" className="h-2 w-full accent-primary" value={progreso.indice} max={ejercicios.length} />
    {mensajeError}
    <article className="card space-y-5 p-5 sm:p-7">
      <h1 className="font-heading text-3xl font-black">{ejercicio.name}</h1>
      <p className="text-sm text-neutral-500">{prescripcion(ejercicio)} · {ejercicio.rest_seconds} s de descanso</p>
      <ImagenEjercicio key={`imagen-${ejercicio.id}`} ejercicio={ejercicio} />
      <GuiaEntrenamiento
        ejercicio={ejercicio}
        siguiente={siguienteEjercicio}
        fase={progreso.fase}
        serie={serie}
        restante={segundos}
        pausado={progreso.pausado}
        revision={progreso.revision}
        vozActiva={guiaVozActiva}
        alCambiarVoz={alternarGuiaVoz}
      />
      {(previa || verAyuda) && <Demostracion key={`ayuda-${ejercicio.id}`} ejercicio={ejercicio} mostrarImagen={false} />}
      {previa ? <>
        <p className="text-sm">{ejercicio.machine_detail?.name || 'Ejercicio libre'}{ejercicio.weight_suggestion_kg != null ? ` · Peso sugerido: ${formatPesoSugerido(ejercicio.weight_suggestion_kg, ejercicio.weight_suggestion_unit)}` : ''}</p>
        <button className="btn-primary flex min-h-14 w-full items-center justify-center gap-2" disabled={bloquear} onClick={() => void enviar('comenzar')}><Play size={20} />Comenzar ejercicio</button>
      </> : <>
        <p className="text-center text-lg font-semibold">{progreso.pausado ? 'En pausa' : enDescanso ? 'Descansa' : progreso.fase === 'preparacion' ? 'Prepárate' : `Serie ${serie} de ${ejercicio.sets ?? 1}`}</p>
        {cuenta ? <div className="text-center"><p role="timer" className="font-heading text-7xl font-black tabular-nums">{progreso.fase === 'preparacion' ? segundos : `${Math.floor(segundos / 60).toString().padStart(2, '0')}:${(segundos % 60).toString().padStart(2, '0')}`}</p><p className="mt-3 text-sm text-neutral-500">{enDescanso ? `Siguiente: serie ${serie} de ${ejercicio.sets ?? 1}` : progreso.fase === 'preparacion' ? '3 · 2 · 1 · Iniciar' : `Serie ${serie} de ${ejercicio.sets ?? 1}`}</p></div> : <p className="text-center text-4xl font-bold">{ejercicio.reps_range} repeticiones</p>}
        {progreso.pausado ? <button className="btn-primary min-h-14 w-full" disabled={bloquear} onClick={() => void enviar('reanudar')}>Reanudar</button> : <>
          {!esTiempo && progreso.fase === 'trabajo' && <button className="btn-primary flex min-h-16 w-full items-center justify-center gap-2 text-lg" disabled={bloquear} onClick={() => void enviar('confirmar_serie')}><CheckCircle size={24} />Serie completada</button>}
          <div className="flex gap-3"><button className="btn-secondary flex min-h-12 flex-1 items-center justify-center gap-2" disabled={bloquear} onClick={() => void enviar('pausar')}><Pause size={18} />Pausar</button>{enDescanso && <button className="btn-secondary min-h-12 flex-1" disabled={bloquear} onClick={() => void enviar('saltar_descanso')}>Saltar descanso</button>}</div>
        </>}
        <button className="min-h-11 w-full text-sm font-semibold text-primary" onClick={() => establecerVerAyuda(!verAyuda)}>{verAyuda ? 'Ocultar demostración' : 'Ver cómo hacerlo'}</button>
      </>}
      {guardando && <p role="status" className="flex items-center justify-center gap-2 text-sm"><Loader2 size={16} className="animate-spin" />Guardando progreso…</p>}
      <div className="grid grid-cols-2 gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <button className="btn-secondary inline-flex min-h-12 items-center justify-center gap-2" disabled={bloquear || progreso.indice === 0 || confirmarSalto} onClick={() => { establecerIndiceRevisado(progreso.indice - 1); pausarParaRevisar() }}><ArrowLeft size={18} />Anterior</button>
        <button className="btn-secondary inline-flex min-h-12 items-center justify-center gap-2" disabled={bloquear || confirmarSalto} onClick={() => { establecerConfirmarSalto(true); pausarParaRevisar() }}>Siguiente<ArrowRight size={18} /></button>
      </div>
      {confirmarSalto && <section aria-label="Confirmar salto de ejercicio" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
        <h2 className="font-bold">¿Dejar este ejercicio aquí?</h2>
        <p className="text-sm">Conservaremos tus series realizadas. Las pendientes de {ejercicio.name} quedarán como omitidas.{siguienteEjercicio ? ` Después verás ${siguienteEjercicio.name}.` : ' Este es el último ejercicio: la rutina quedará finalizada.'}</p>
        <div className="grid gap-2 sm:grid-cols-2"><button className="btn-secondary min-h-12" disabled={bloquear} onClick={() => establecerConfirmarSalto(false)}>Quedarme aquí</button><button className="btn-primary min-h-12" disabled={bloquear} onClick={() => void enviar('omitir_ejercicio')}>{siguienteEjercicio ? 'Omitir pendientes y seguir' : 'Omitir pendientes y finalizar'}</button></div>
      </section>}
      <details><summary className="cursor-pointer py-3 text-sm text-neutral-500">Otras opciones</summary><div className="flex flex-wrap gap-3">{!previa && !enDescanso && <button className="btn-secondary min-h-11" disabled={bloquear || progreso.pausado} onClick={() => void enviar('omitir_serie')}>Omitir esta serie</button>}</div></details>
    </article>
    {confirmarFin ? <section className="card space-y-3 p-5"><h2 className="font-bold">¿Finalizar ahora?</h2><p>Conservaremos las series realizadas. Lo pendiente quedará como omitido.</p><div className="flex gap-3"><button className="btn-secondary min-h-12" onClick={() => establecerConfirmarFin(false)}>Continuar</button><button className="btn-primary min-h-12" disabled={bloquear} onClick={() => void enviar('finalizar')}>Finalizar entrenamiento</button></div></section> : <button className="min-h-12 w-full text-sm text-neutral-500" disabled={bloquear} onClick={() => { establecerConfirmarFin(true); void enviar('pausar') }}>Finalizar entrenamiento</button>}
  </div>
}

function Demostracion({ ejercicio, mostrarImagen = true }: { ejercicio: Exercise; mostrarImagen?: boolean }) {
  return <section aria-label="Demostración del ejercicio" className="space-y-3">
    {mostrarImagen && <ImagenEjercicio key={ejercicio.id} ejercicio={ejercicio} />}
    <ExerciseVideo url={ejercicio.catalogo_detalle?.video_url} extraUrl={ejercicio.video_url} />
    <p className="text-sm leading-relaxed">{ejercicio.technique_notes || ejercicio.catalogo_detalle?.instrucciones_es || 'Sigue las indicaciones de tu instructor.'}</p>
    {!!ejercicio.catalogo_detalle?.pasos_es?.length && <ol className="list-decimal space-y-1 pl-5 text-sm">{ejercicio.catalogo_detalle.pasos_es.map((paso, indice) => <li key={indice}>{paso}</li>)}</ol>}
  </section>
}
