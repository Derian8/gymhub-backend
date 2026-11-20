import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CheckCircle, Dumbbell, Loader2, Pause, Play } from 'lucide-react'
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
  const pausarPendiente = useRef(false)
  const enviarRef = useRef<(accion: AccionEntrenamiento) => Promise<void>>(async () => {})

  const actualizar = useCallback((nueva: WorkoutSession) => {
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
  if (sesion.is_completed) return <section className="card mx-auto max-w-2xl space-y-5 p-6 text-center"><CheckCircle className="mx-auto text-emerald-500" size={48} /><h1 className="text-3xl font-bold">Entrenamiento finalizado</h1><p>Tu progreso quedó guardado.{sesion.origen === 'libre' ? ' Tu plan conserva el siguiente bloque pendiente.' : ''}</p><ul className="space-y-2 text-left">{resumen.map((item) => <li key={item.ejercicio.id} className="rounded-xl bg-neutral-100 p-3 dark:bg-neutral-900"><strong>{item.ejercicio.name}</strong> · {item.estado}<span className="block text-sm">{item.realizadas} series realizadas · {item.omitidas} omitidas</span></li>)}</ul><Link className="btn-secondary inline-flex" to="/today">Volver a Inicio</Link><button className="btn-primary ml-3" onClick={() => { sesionRef.current = null; establecerSesion(null); establecerSeleccion(null); establecerModo(null); establecerConfirmarFin(false); void consulta.refetch() }}>Elegir otro entrenamiento</button></section>

  const ejercicio = ejercicios[progreso.indice]
  if (!ejercicio) return <p role="alert">No pudimos recuperar el ejercicio. Vuelve a abrir el entrenamiento.</p>
  const serie = (progreso.registros[String(ejercicio.id)] ?? []).length + 1
  const esTiempo = ejercicio.exercise_type === 'timed'
  const previa = progreso.fase === 'previa'
  const enDescanso = progreso.fase === 'descanso' || progreso.fase === 'descanso_ejercicio'
  const cuenta = progreso.fase === 'preparacion' || enDescanso || (progreso.fase === 'trabajo' && esTiempo)
  const bloquear = guardando || Boolean(fallida.current)
  const segundos = progreso.fin_fase ? restante : progreso.restante
  return <div className="page-enter mx-auto max-w-2xl space-y-4 pb-8">
    <div className="flex items-center justify-between text-sm"><span>Ejercicio {progreso.indice + 1} de {ejercicios.length}</span><span>{sesion.origen === 'libre' ? 'Rutina libre' : 'Mi plan'}</span></div>
    <progress aria-label="Ejercicios resueltos" className="h-2 w-full accent-primary" value={progreso.indice} max={ejercicios.length} />
    {mensajeError}
    <article className="card space-y-5 p-5 sm:p-7">
      <h1 className="font-heading text-3xl font-black">{ejercicio.name}</h1>
      <p className="text-sm text-neutral-500">{prescripcion(ejercicio)} · {ejercicio.rest_seconds} s de descanso</p>
      {(previa || verAyuda) && <Demostracion key={ejercicio.id} ejercicio={ejercicio} />}
      {previa ? <>
        <p className="text-sm">{ejercicio.machine_detail?.name || 'Ejercicio libre'}{ejercicio.weight_suggestion_kg != null ? ` · Peso sugerido: ${formatPesoSugerido(ejercicio.weight_suggestion_kg, ejercicio.weight_suggestion_unit)}` : ''}</p>
        <button className="btn-primary flex min-h-14 w-full items-center justify-center gap-2" disabled={bloquear} onClick={() => void enviar('comenzar')}><Play size={20} />Comenzar ejercicio</button>
      </> : <>
        <p className="text-center text-lg font-semibold">{progreso.pausado ? 'En pausa' : enDescanso ? 'Descansa' : progreso.fase === 'preparacion' ? 'Prepárate' : `Serie ${serie} de ${ejercicio.sets ?? 1}`}</p>
        {cuenta ? <div className="text-center"><p role="timer" className="font-heading text-7xl font-black tabular-nums">{Math.floor(segundos / 60).toString().padStart(2, '0')}:{(segundos % 60).toString().padStart(2, '0')}</p><p className="mt-3 text-sm text-neutral-500">{enDescanso ? `Siguiente: serie ${serie} de ${ejercicio.sets ?? 1}` : `Serie ${serie} de ${ejercicio.sets ?? 1}`}</p></div> : <p className="text-center text-4xl font-bold">{ejercicio.reps_range} repeticiones</p>}
        {progreso.pausado ? <button className="btn-primary min-h-14 w-full" disabled={bloquear} onClick={() => void enviar('reanudar')}>Reanudar</button> : <>
          {!esTiempo && progreso.fase === 'trabajo' && <button className="btn-primary flex min-h-16 w-full items-center justify-center gap-2 text-lg" disabled={bloquear} onClick={() => void enviar('confirmar_serie')}><CheckCircle size={24} />Serie completada</button>}
          <div className="flex gap-3"><button className="btn-secondary flex min-h-12 flex-1 items-center justify-center gap-2" disabled={bloquear} onClick={() => void enviar('pausar')}><Pause size={18} />Pausar</button>{enDescanso && <button className="btn-secondary min-h-12 flex-1" disabled={bloquear} onClick={() => void enviar('saltar_descanso')}>Saltar descanso</button>}</div>
        </>}
        <button className="min-h-11 w-full text-sm font-semibold text-primary" onClick={() => establecerVerAyuda(!verAyuda)}>{verAyuda ? 'Ocultar demostración' : 'Ver cómo hacerlo'}</button>
      </>}
      {guardando && <p role="status" className="flex items-center justify-center gap-2 text-sm"><Loader2 size={16} className="animate-spin" />Guardando progreso…</p>}
      <details><summary className="cursor-pointer py-3 text-sm text-neutral-500">Otras opciones</summary><div className="flex flex-wrap gap-3">{!previa && !enDescanso && <button className="btn-secondary min-h-11" disabled={bloquear || progreso.pausado} onClick={() => void enviar('omitir_serie')}>Omitir esta serie</button>}<button className="btn-secondary min-h-11" disabled={bloquear || progreso.pausado} onClick={() => void enviar('omitir_ejercicio')}>Omitir ejercicio</button></div></details>
    </article>
    {confirmarFin ? <section className="card space-y-3 p-5"><h2 className="font-bold">¿Finalizar ahora?</h2><p>Conservaremos las series realizadas. Lo pendiente quedará como omitido.</p><div className="flex gap-3"><button className="btn-secondary min-h-12" onClick={() => establecerConfirmarFin(false)}>Continuar</button><button className="btn-primary min-h-12" disabled={bloquear} onClick={() => void enviar('finalizar')}>Finalizar entrenamiento</button></div></section> : <button className="min-h-12 w-full text-sm text-neutral-500" disabled={bloquear} onClick={() => { establecerConfirmarFin(true); void enviar('pausar') }}>Finalizar entrenamiento</button>}
  </div>
}

function Demostracion({ ejercicio }: { ejercicio: Exercise }) {
  const imagen = ejercicio.imagen_visual_url || ejercicio.catalogo_detalle?.animacion_url || ejercicio.catalogo_detalle?.imagen_url
  const [imagenFallida, establecerImagenFallida] = useState(false)
  return <section aria-label="Demostración del ejercicio" className="space-y-3">
    {imagen && !imagenFallida && <img src={imagen} alt={`Demostración de ${ejercicio.name}`} className="h-64 w-full rounded-xl bg-neutral-50 object-contain dark:bg-neutral-900" onError={() => establecerImagenFallida(true)} />}
    <ExerciseVideo url={ejercicio.catalogo_detalle?.video_url} extraUrl={ejercicio.video_url} />
    <p className="text-sm leading-relaxed">{ejercicio.technique_notes || ejercicio.catalogo_detalle?.instrucciones_es || 'Sigue las indicaciones de tu instructor.'}</p>
    {!!ejercicio.catalogo_detalle?.pasos_es?.length && <ol className="list-decimal space-y-1 pl-5 text-sm">{ejercicio.catalogo_detalle.pasos_es.map((paso, indice) => <li key={indice}>{paso}</li>)}</ol>}
  </section>
}
