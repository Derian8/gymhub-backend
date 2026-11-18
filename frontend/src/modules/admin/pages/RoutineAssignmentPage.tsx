import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Search } from 'lucide-react'
import { useMembersQuery, useMemberDetailQuery, useAdministratorsQuery } from '@/modules/members/hooks/useMembers'
import { plansApi } from '@/modules/plans/api/plansApi'
import { usePlanDetailQuery, useQuickRoutineAssignmentMutation, useReusablePlanSourcesQuery, useTrainingTemplateSummariesQuery } from '@/modules/plans/hooks/usePlans'
import { PageHeader } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { formatDate } from '@/shared/lib/utils'
import { useAuthStore } from '@/shared/store/authStore'
import type { QuickRoutineAssignmentPayload } from '@/shared/types'

function fechaLocal(fecha = new Date()) {
  return new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

function diaSiguiente(fecha: string) {
  const valor = new Date(`${fecha}T12:00:00`)
  valor.setDate(valor.getDate() + 1)
  return fechaLocal(valor)
}

function fechaPosterior(fecha: string) {
  const siguiente = diaSiguiente(fecha)
  return siguiente > fechaLocal() ? siguiente : fechaLocal()
}

export function RoutineAssignmentPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const miembroId = Number(params.get('member')) || 0
  const plantillaId = Number(params.get('template')) || 0
  const [origen, setOrigen] = useState(() => plantillaId ? `template:${plantillaId}` : '')
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [busquedaRutina, setBusquedaRutina] = useState('')
  const [paginaRutina, setPaginaRutina] = useState(1)
  const [verPlanes, setVerPlanes] = useState(false)
  const [estrategia, setEstrategia] = useState<'schedule_after_active' | 'replace_active'>('schedule_after_active')
  const [inicio, setInicio] = useState(fechaLocal())
  const [semanas, setSemanas] = useState(8)
  const [administradorId, setAdministradorId] = useState<number | null>(null)
  const usuario = useAuthStore((estado) => estado.user)

  const miembros = useMembersQuery({ search: busquedaCliente.trim() || undefined, page: 1 }, !miembroId)
  const miembro = useMemberDetailQuery(miembroId)
  const estado = useQuery({
    queryKey: ['assignment-state', miembroId],
    queryFn: () => plansApi.assignmentState(miembroId),
    enabled: Boolean(miembroId),
  })
  const administradores = useAdministratorsQuery(Boolean(miembroId))
  const plantillas = useTrainingTemplateSummariesQuery({
    page: String(paginaRutina), state: 'active',
    ...(busquedaRutina.trim() ? { search: busquedaRutina.trim() } : {}),
  })
  const planes = useReusablePlanSourcesQuery(verPlanes)
  const origenTipo = origen.startsWith('draft:') ? 'draft' : origen.startsWith('plan:') ? 'plan' : 'template'
  const origenId = Number(origen.split(':')[1]) || 0
  const plantilla = useQuery({
    queryKey: ['plan-template', origenTipo === 'template' ? origenId : 0],
    queryFn: () => plansApi.trainingTemplate(origenId),
    enabled: origenTipo === 'template' && Boolean(origenId),
  })
  const planOrigen = usePlanDetailQuery(origenTipo !== 'template' ? origenId : 0)
  const asignar = useQuickRoutineAssignmentMutation()
  const vigente = estado.data?.plan_vigente
  const programado = estado.data?.plan_programado
  const responsableId = administradorId ?? miembro.data?.trainer_asignado ?? usuario?.id ?? 0
  const responsable = administradores.data?.find((item) => item.id === responsableId)
  const fechaMinima = vigente && estrategia === 'schedule_after_active' && vigente.fecha_fin
    ? fechaPosterior(vigente.fecha_fin)
    : fechaLocal()
  const fechaValida = inicio >= fechaMinima && (estrategia !== 'replace_active' || inicio === fechaLocal())
  const origenValido = origenTipo === 'template'
    ? Boolean(plantilla.data?.esta_activa && plantilla.data.dias.length && plantilla.data.dias.every((dia) => dia.ejercicios.length))
    : Boolean(planOrigen.data?.workout_days?.length && planOrigen.data.workout_days.every((dia) => dia.exercises?.length))
  const puedeAsignar = Boolean(miembroId && estado.data?.puede_publicar && !programado && responsableId && origenValido
    && fechaValida && semanas >= 1 && semanas <= 52
    && (!vigente || estrategia === 'replace_active' || Boolean(vigente.fecha_fin)))

  useEffect(() => {
    if (plantillaId) setOrigen(`template:${plantillaId}`)
  }, [plantillaId])

  useEffect(() => {
    setInicio(estrategia === 'replace_active' ? fechaLocal()
      : vigente?.fecha_fin ? fechaPosterior(vigente.fecha_fin) : fechaLocal())
  }, [miembroId, estrategia, vigente?.fecha_fin])

  function seleccionarCliente(id: number) {
    setParams((actual) => {
      const siguiente = new URLSearchParams(actual)
      siguiente.set('member', String(id))
      return siguiente
    })
  }

  function seleccionarRutina(valor: string) {
    setOrigen(valor)
    setParams((actual) => {
      const siguiente = new URLSearchParams(actual)
      if (valor.startsWith('template:')) siguiente.set('template', valor.split(':')[1])
      else siguiente.delete('template')
      return siguiente
    })
  }

  function confirmar() {
    if (!puedeAsignar) return
    const comun = {
      member_id: miembroId,
      trainer_id: responsableId,
      start_date: inicio,
      weeks_duration: semanas,
      conflict_strategy: estrategia,
      confirm_trainer_change: Boolean(miembro.data?.trainer_asignado && miembro.data.trainer_asignado !== responsableId),
    }
    const tipoAsignacion = origenTipo === 'template' ? 'template'
      : planOrigen.data?.status === 'draft' && planOrigen.data.member === miembroId ? 'draft' : 'plan'
    const datos: QuickRoutineAssignmentPayload = tipoAsignacion === 'template'
      ? { ...comun, source_type: 'template', template_id: origenId }
      : { ...comun, source_type: tipoAsignacion, plan_id: origenId }
    asignar.mutate(datos, { onSuccess: () => navigate(`/routines?tab=asignadas&member=${miembroId}`) })
  }

  const planesReutilizables = planes.data?.pages.flatMap((pagina) => pagina.results) ?? []

  return <div className="page-enter space-y-6">
    <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary" to="/routines"><ArrowLeft size={16} /> Rutinas</Link>
    <PageHeader title="Asignar rutina" subtitle="Elige un cliente, revisa la rutina y define cuándo comenzará su copia." />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
      <div className="space-y-6">
        <section className="card space-y-4 p-5" aria-labelledby="cliente-titulo">
          <div className="flex items-center justify-between gap-3"><h2 id="cliente-titulo" className="text-lg font-bold">1. Cliente</h2>{miembroId > 0 && <button type="button" className="text-sm font-semibold text-primary" onClick={() => setParams((actual) => { const siguiente = new URLSearchParams(actual); siguiente.delete('member'); return siguiente })}>Cambiar</button>}</div>
          {miembroId ? miembro.isLoading ? <CardSkeleton lines={2} /> : miembro.isError ? <p role="alert">No se pudo cargar el cliente.</p> : <div><p className="font-semibold">{miembro.data?.full_name}</p><p className="text-sm text-neutral-600 dark:text-neutral-300">{miembro.data?.email}</p></div> : <>
            <label className="relative block"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400" /><input className="input pl-10" type="search" value={busquedaCliente} onChange={(evento) => setBusquedaCliente(evento.target.value)} placeholder="Buscar cliente" aria-label="Buscar cliente" /></label>
            {miembros.isLoading ? <CardSkeleton lines={2} /> : miembros.isError ? <p role="alert">No se pudieron cargar los clientes.</p> : <div className="grid gap-2 sm:grid-cols-2">{miembros.data?.results.map((item) => <button type="button" className="rounded-lg border border-neutral-200 p-3 text-left hover:border-primary dark:border-neutral-700" key={item.id} onClick={() => seleccionarCliente(item.id)}><span className="block font-semibold">{item.full_name}</span><span className="block text-sm text-neutral-600 dark:text-neutral-300">{item.email}</span></button>)}</div>}
          </>}
          {miembroId > 0 && estado.isLoading && <p className="text-sm">Revisando si se puede asignar…</p>}
          {estado.isError && <p className="text-sm text-red-700 dark:text-red-300" role="alert">No se pudo comprobar el estado de asignación.</p>}
          {estado.data && !estado.data.puede_publicar && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">El cliente necesita una membresía vigente para recibir una rutina. <Link className="font-semibold underline" to={`/billing?member=${miembroId}`}>Revisar facturación</Link></div>}
          {programado && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">Ya tiene “{programado.nombre}” programada para el {formatDate(programado.fecha_inicio)}. Revisa o finaliza esa programación antes de asignar otra. <Link className="font-semibold underline" to={`/plans/${programado.id}`}>Ver plan</Link></div>}
          {vigente && <div className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-700">Rutina vigente: <Link className="font-semibold text-primary" to={`/plans/${vigente.id}`}>{vigente.nombre}</Link>{vigente.fecha_fin ? ` · termina el ${formatDate(vigente.fecha_fin)}` : ' · sin fecha final'}</div>}
        </section>
        <section className="card space-y-4 p-5" aria-labelledby="rutina-titulo">
          <div><h2 id="rutina-titulo" className="text-lg font-bold">2. Rutina</h2><p className="text-sm text-neutral-600 dark:text-neutral-300">Se crea una copia independiente. Las futuras ediciones de la biblioteca no cambian esta asignación.</p></div>
          <label className="relative block"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400" /><input className="input pl-10" type="search" value={busquedaRutina} onChange={(evento) => { setBusquedaRutina(evento.target.value); setPaginaRutina(1) }} placeholder="Buscar rutina o ejercicio" aria-label="Buscar rutinas para asignar" /></label>
          {plantillas.isLoading ? <CardSkeleton lines={2} /> : plantillas.isError ? <p role="alert">No se pudieron cargar las rutinas.</p> : !plantillas.data?.results.length ? <p className="text-sm text-neutral-600 dark:text-neutral-300">No hay rutinas activas con esta búsqueda. <Link className="font-semibold text-primary" to="/routines/new">Crear rutina</Link></p> : <div className="grid gap-2 sm:grid-cols-2">{plantillas.data.results.map((item) => <button type="button" key={item.id} aria-pressed={origen === `template:${item.id}`} className={`rounded-lg border p-3 text-left ${origen === `template:${item.id}` ? 'border-primary bg-primary/5' : 'border-neutral-200 hover:border-primary dark:border-neutral-700'}`} onClick={() => seleccionarRutina(`template:${item.id}`)}><span className="block font-semibold">{item.nombre}</span><span className="block text-sm text-neutral-600 dark:text-neutral-300">{item.dias_count} días · {item.ejercicios_count} ejercicios</span></button>)}</div>}
          {(plantillas.data?.next || plantillas.data?.previous) && <div className="flex items-center gap-2"><button type="button" className="btn-secondary" disabled={!plantillas.data.previous} onClick={() => setPaginaRutina((valor) => valor - 1)}>Anterior</button><span className="text-sm">Página {paginaRutina}</span><button type="button" className="btn-secondary" disabled={!plantillas.data.next} onClick={() => setPaginaRutina((valor) => valor + 1)}>Siguiente</button></div>}
          <details onToggle={(evento) => { if (evento.currentTarget.open) setVerPlanes(true) }}><summary className="cursor-pointer py-2 font-semibold text-primary">Reutilizar un plan anterior</summary><div className="space-y-2 pt-2">{planesReutilizables.map((item) => <button type="button" key={item.id} aria-pressed={origen === `${item.status === 'draft' && item.member === miembroId ? 'draft' : 'plan'}:${item.id}`} className="block w-full rounded-lg border border-neutral-200 p-3 text-left dark:border-neutral-700" onClick={() => seleccionarRutina(`${item.status === 'draft' && item.member === miembroId ? 'draft' : 'plan'}:${item.id}`)}>{item.name} · {item.member_name ?? 'Sin cliente'} · {item.status}</button>)}{planes.hasNextPage && <button type="button" className="btn-secondary" onClick={() => void planes.fetchNextPage()}>Cargar más planes</button>}</div></details>
          {(plantilla.isLoading || planOrigen.isLoading) && origen && <p className="text-sm">Cargando contenido…</p>}
          {origen && <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700"><h3 className="font-semibold">{origenTipo === 'template' ? plantilla.data?.nombre : planOrigen.data?.name}</h3><div className="mt-3 space-y-2 text-sm text-neutral-600 dark:text-neutral-300">{origenTipo === 'template' ? plantilla.data?.dias.map((dia) => <p key={dia.id}><strong>{dia.nombre}:</strong> {dia.ejercicios.map((ejercicio) => ejercicio.nombre).join(' · ')}</p>) : planOrigen.data?.workout_days?.map((dia) => <p key={dia.id}><strong>{dia.name}:</strong> {dia.exercises?.map((ejercicio) => ejercicio.name).join(' · ')}</p>)}</div>{!origenValido && !plantilla.isLoading && !planOrigen.isLoading && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">Esta rutina necesita días y ejercicios completos antes de asignarse.</p>}</div>}
        </section>
      </div>
      <section className="card h-fit space-y-5 p-5" aria-labelledby="programacion-titulo">
        <h2 id="programacion-titulo" className="text-lg font-bold">3. Programación</h2>
        {vigente && <fieldset className="space-y-3"><legend className="font-semibold">¿Cuándo debe comenzar?</legend><label className="flex gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700"><input type="radio" name="estrategia" checked={estrategia === 'schedule_after_active'} onChange={() => setEstrategia('schedule_after_active')} /><span><strong className="block">Después de la rutina vigente</strong><span className="text-sm text-neutral-600 dark:text-neutral-300">Conserva la rutina actual hasta su fecha final.</span></span></label><label className="flex gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700"><input type="radio" name="estrategia" checked={estrategia === 'replace_active'} onChange={() => setEstrategia('replace_active')} /><span><strong className="block">Reemplazar hoy</strong><span className="text-sm text-neutral-600 dark:text-neutral-300">Finaliza la rutina vigente y conserva su historial.</span></span></label></fieldset>}
        {vigente && !vigente.fecha_fin && estrategia === 'schedule_after_active' && <p className="text-sm text-amber-700 dark:text-amber-300">La rutina vigente no tiene fecha final. Elige «Reemplazar hoy» para continuar.</p>}
        <label className="block space-y-1 text-sm"><span className="font-semibold">Administrador responsable</span><select className="input" value={responsableId || ''} onChange={(evento) => setAdministradorId(Number(evento.target.value))}>{administradores.data?.map((item) => <option key={item.id} value={item.id}>{item.user.first_name} {item.user.last_name}</option>)}</select></label>
        {miembro.data?.trainer_asignado && miembro.data.trainer_asignado !== responsableId && <p className="text-sm text-amber-700 dark:text-amber-300">También se cambiará el administrador responsable de este cliente.</p>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><label className="block space-y-1 text-sm"><span className="font-semibold">Fecha de inicio</span><input className="input" type="date" min={fechaMinima} value={inicio} disabled={estrategia === 'replace_active'} onChange={(evento) => setInicio(evento.target.value)} /></label><label className="block space-y-1 text-sm"><span className="font-semibold">Duración en semanas</span><input className="input" type="number" min={1} max={52} value={semanas} onChange={(evento) => setSemanas(Number(evento.target.value))} /></label></div>
        {origen && miembroId > 0 && <p className="rounded-lg bg-neutral-50 p-3 text-sm dark:bg-neutral-900">Se asignará {origenTipo === 'template' ? plantilla.data?.nombre : planOrigen.data?.name} a {miembro.data?.full_name}, desde el {inicio ? formatDate(inicio) : 'día elegido'} por {semanas} semanas. {responsable?.user.first_name ? `Responsable: ${responsable.user.first_name}.` : ''}</p>}
        <button type="button" className="btn-primary w-full justify-center" disabled={!puedeAsignar || asignar.isPending} onClick={confirmar}>{asignar.isPending ? 'Asignando…' : vigente && estrategia === 'replace_active' ? 'Reemplazar rutina hoy' : 'Confirmar asignación'}</button>
      </section>
    </div>
  </div>
}
