import { useMemo, useState } from 'react'
import type React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Copy, Dumbbell, LibraryBig, Pencil, Plus, Search, Video } from 'lucide-react'
import { usePlansQuery, useTrainingTemplatesQuery } from '@/modules/plans/hooks/usePlans'
import { useMembersQuery } from '@/modules/members/hooks/useMembers'
import { AssignRoutineDialog } from '@/modules/plans/components/AssignRoutineDialog'
import { RoutineTemplateBuilder } from '@/modules/plans/components/RoutineTemplateBuilder'
import { Badge, PageHeader } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { formatDate, GOAL_LABELS } from '@/shared/lib/utils'
import type { MemberProfile, TrainingPlan, TrainingTemplate } from '@/shared/types'

type RoutineTab = 'biblioteca' | 'asignadas'
const IMAGENES_REPDB_POR_EJERCICIO: Record<string, string> = {
  'dead bug': 'dead-bug',
  'reverse crunches': 'reverse-crunches',
  'crunches': 'crunches',
  'flutter kicks': 'flutter-kicks',
  'glute kickback': 'glute-kickback',
  'squats': 'bodyweight-squat',
  'knee push ups': 'knee-push-ups',
  'superman': 'superman',
  'mountain climber': 'mountain-climbers',
  'mountain climbers': 'mountain-climbers',
}

function normalizarNombreEjercicio(nombre: string) {
  return nombre.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim()
}

export function AdminRoutinesPage() {
  const templatesQuery = useTrainingTemplatesQuery()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: RoutineTab = searchParams.get('tab') === 'asignadas' ? 'asignadas' : 'biblioteca'
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const membersQuery = useMembersQuery({ search: busquedaCliente.trim() || undefined, page: 1 }, tab === 'asignadas')
  const clientes = membersQuery.data?.results ?? []
  const cliente = clientes.find((item) => item.id === selectedClientId) ?? null
  const plansQuery = usePlansQuery({ member: String(cliente?.id ?? 0) }, Boolean(cliente?.id) && tab === 'asignadas')
  const planes = useMemo(() => plansQuery.data?.results ?? [], [plansQuery.data])
  const planPrincipal = planes.find((plan) => plan.status === 'active')
    ?? planes.find((plan) => plan.status === 'scheduled')
    ?? planes.find((plan) => plan.status === 'draft')
  const otrosPlanes = planes.filter((plan) => plan.id !== planPrincipal?.id)
  const [templateToAssign, setTemplateToAssign] = useState<TrainingTemplate | null>(null)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [templateToEdit, setTemplateToEdit] = useState<TrainingTemplate | null>(null)
  const [asignarDespuesDeCrear, setAsignarDespuesDeCrear] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [objetivoFiltro, setObjetivoFiltro] = useState('')
  const templates = templatesQuery.data?.results ?? []
  const rutinasFiltradas = useMemo(() => {
    const term = busqueda.trim().toLocaleLowerCase()
    return templates.filter((template) => {
      if (objetivoFiltro && template.objetivo !== objetivoFiltro) return false
      if (!term) return true
      const contenido = [
        template.nombre,
        template.descripcion ?? '',
        GOAL_LABELS[template.objetivo] ?? template.objetivo,
        ...template.dias.flatMap((day) => [day.nombre, day.etiqueta_dia, ...day.ejercicios.map((exercise) => exercise.nombre)]),
      ].join(' ').toLocaleLowerCase()
      return contenido.includes(term)
    })
  }, [busqueda, objetivoFiltro, templates])

  const changeTab = (nextTab: RoutineTab) => setSearchParams(nextTab === 'biblioteca' ? {} : { tab: nextTab })
  const abrirCreacion = (asignarAlGuardar = false) => {
    setTemplateToEdit(null)
    setAsignarDespuesDeCrear(asignarAlGuardar)
    setBuilderOpen(true)
  }

  return (
    <div className="page-enter space-y-7" data-testid="admin-routines-page">
      <PageHeader
        title="Rutinas"
        subtitle="Crea, guarda y asigna rutinas; administra el plan de cada cliente desde una sola vista."
        action={tab === 'biblioteca'
          ? <button type="button" className="btn-primary" onClick={() => abrirCreacion()}><Plus size={17} /> Crear rutina</button>
          : undefined}
      />

      <nav className="flex gap-2 border-b border-neutral-200 dark:border-neutral-800" aria-label="Secciones de rutinas">
        <Tab active={tab === 'biblioteca'} onClick={() => changeTab('biblioteca')} icon={<LibraryBig size={16} />}>Biblioteca</Tab>
        <Tab active={tab === 'asignadas'} onClick={() => changeTab('asignadas')} icon={<Dumbbell size={16} />}>Planes asignados</Tab>
      </nav>

      {tab === 'biblioteca' ? (
        <section className="space-y-4" aria-label="Biblioteca de rutinas">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="text-xl font-bold">Biblioteca</h2><p className="mt-1 text-sm text-neutral-500">Rutinas listas para editar y volver a asignar.</p></div>
            <span className="text-sm text-neutral-500">{templates.length} {templates.length === 1 ? 'rutina guardada' : 'rutinas guardadas'}</span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Buscar rutinas o ejercicios</span>
              <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                className="input pl-10"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar rutina o ejercicio"
              />
            </label>
            <label className="sm:w-56">
              <span className="sr-only">Filtrar por objetivo</span>
              <select className="input w-full" value={objetivoFiltro} onChange={(event) => setObjetivoFiltro(event.target.value)}>
                <option value="">Todos los objetivos</option>
                {Object.entries(GOAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          {templatesQuery.isLoading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><CardSkeleton lines={4} /><CardSkeleton lines={4} /><CardSkeleton lines={4} /></div> : templates.length ? (
            rutinasFiltradas.length ? (
              <>
                <p className="text-xs text-neutral-500">Mostrando {rutinasFiltradas.length} de {templates.length}</p>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {rutinasFiltradas.map((template) => <RoutineTemplateCard key={template.id} template={template} onEdit={() => { setTemplateToEdit(template); setBuilderOpen(true) }} onAssign={() => setTemplateToAssign(template)} />)}
                </div>
              </>
            ) : (
              <div className="card px-6 py-10 text-center">
                <h3 className="font-semibold">No encontramos rutinas con esos filtros</h3>
                <p className="mt-1 text-sm text-neutral-500">Prueba otro nombre, ejercicio u objetivo.</p>
                <button type="button" className="btn-secondary mt-4" onClick={() => { setBusqueda(''); setObjetivoFiltro('') }}>Limpiar búsqueda</button>
              </div>
            )
          ) : (
            <div className="card flex flex-col items-center px-6 py-14 text-center">
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><LibraryBig size={26} /></span>
              <h3 className="text-lg font-bold">Tu biblioteca empieza aquí</h3>
              <p className="mt-2 max-w-md text-sm text-neutral-500">Crea una rutina con ejercicios, series, repeticiones, descansos y equipo. Se guardará para que puedas volver a usarla.</p>
              <button type="button" className="btn-primary mt-5" onClick={() => abrirCreacion()}><Plus size={17} /> Crear primera rutina</button>
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-6" aria-label="Rutinas asignadas">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Clientes</h2>
              <p className="mt-1 text-sm text-neutral-500">Selecciona un cliente para consultar o actualizar su plan.</p>
            </div>
            <span className="text-sm text-neutral-500">{clientes.length} {clientes.length === 1 ? 'coincidencia' : 'coincidencias'}</span>
          </div>

          <label className="relative block max-w-xl">
            <span className="sr-only">Buscar cliente por nombre o correo</span>
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              className="input pl-10"
              value={busquedaCliente}
              onChange={(event) => { setBusquedaCliente(event.target.value); setSelectedClientId(null) }}
              placeholder="Buscar cliente por nombre o correo"
            />
          </label>

          {membersQuery.isLoading ? <CardSkeleton lines={3} /> : clientes.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Lista de clientes">
              {clientes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-expanded={selectedClientId === item.id}
                  onClick={() => setSelectedClientId((current) => current === item.id ? null : item.id)}
                  className={`card flex min-w-0 items-center justify-between gap-3 p-4 text-left transition-colors ${selectedClientId === item.id ? 'border-primary ring-1 ring-primary/40' : 'hover:border-primary/50'}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-neutral-900 dark:text-white">{item.full_name}</span>
                    <span className="mt-1 block truncate text-sm text-neutral-500">{item.email}</span>
                  </span>
                  <span className={`shrink-0 text-xs font-semibold ${selectedClientId === item.id ? 'text-primary' : 'text-neutral-500'}`}>
                    {selectedClientId === item.id ? 'Seleccionado' : 'Ver plan'}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="card p-5 text-sm text-neutral-500">No encontramos clientes. Prueba con otro nombre o correo.</div>
          )}

          {cliente ? (
            <ClienteRutinas
              cliente={cliente}
              planes={planes}
              planesLoading={plansQuery.isLoading}
              planPrincipal={planPrincipal}
              otrosPlanes={otrosPlanes}
              onBrowseLibrary={() => changeTab('biblioteca')}
              onCreateAndAssign={() => abrirCreacion(true)}
            />
          ) : null}
        </section>
      )}

      {templateToAssign ? <AssignRoutineDialog template={templateToAssign} onClose={() => setTemplateToAssign(null)} onAssigned={() => changeTab('asignadas')} /> : null}
      <RoutineTemplateBuilder
        open={builderOpen}
        template={templateToEdit}
        assignAfterSave={asignarDespuesDeCrear}
        onClose={() => { setBuilderOpen(false); setTemplateToEdit(null); setAsignarDespuesDeCrear(false) }}
        onSaved={(savedTemplate) => { if (asignarDespuesDeCrear) setTemplateToAssign(savedTemplate) }}
      />
    </div>
  )
}

function RoutineTemplateCard({ template, onEdit, onAssign }: { template: TrainingTemplate; onEdit: () => void; onAssign: () => void }) {
  const exerciseCount = template.dias.reduce((sum, day) => sum + day.ejercicios.length, 0)
  const exercises = template.dias.flatMap((day) => day.ejercicios)
  const machinesCount = exercises.filter((exercise) => exercise.maquina).length
  const videosCount = exercises.filter((exercise) => exercise.video_display_url || exercise.url_video || exercise.catalogo_detalle?.video_url).length
  const contextoRutina = normalizarNombreEjercicio([template.nombre, ...template.dias.map((day) => day.nombre)].join(' '))
  const nombresPreferidos = /piernas|lower|glute/.test(contextoRutina)
    ? ['glute kickback', 'squats']
    : /tren superior|upper/.test(contextoRutina)
      ? ['knee push ups', 'superman', 'mountain climber', 'mountain climbers']
      : /hiit|cuerpo completo/.test(contextoRutina)
        ? ['mountain climber', 'mountain climbers', 'knee push ups']
        : /abdomen|abs|core/.test(contextoRutina)
          ? ['dead bug', 'reverse crunches', 'crunches', 'flutter kicks']
          : []
  const exerciseWithRepdbReference = nombresPreferidos
    .map((nombre) => exercises.find((exercise) => normalizarNombreEjercicio(exercise.nombre) === nombre && IMAGENES_REPDB_POR_EJERCICIO[nombre]))
    .find((exercise) => Boolean(exercise))
    ?? exercises.find((exercise) => IMAGENES_REPDB_POR_EJERCICIO[normalizarNombreEjercicio(exercise.nombre)])
  const coverExercise = exerciseWithRepdbReference
    ?? exercises.find((exercise) => exercise.imagen_visual_url || exercise.imagen_referencia_url || exercise.catalogo_detalle?.animacion_url || exercise.catalogo_detalle?.imagen_url)
  const catalogImage = coverExercise?.imagen_visual_url || coverExercise?.imagen_referencia_url || coverExercise?.catalogo_detalle?.animacion_url || coverExercise?.catalogo_detalle?.imagen_url
  const repdbImageSlug = coverExercise ? IMAGENES_REPDB_POR_EJERCICIO[normalizarNombreEjercicio(coverExercise.nombre)] : undefined
  const coverImage = catalogImage || (repdbImageSlug ? `https://exercise-dataset.com/images/flat/${repdbImageSlug}-peak.webp` : undefined)
  const coverExerciseName = coverExercise?.nombre || exerciseWithRepdbReference?.nombre
  const coverAttribution = !catalogImage && repdbImageSlug ? 'Referencia visual · RepDB' : null

  return (
    <article className="card group flex h-full flex-col overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-neutral-800 via-neutral-900 to-primary/40">
        {coverImage ? <img src={coverImage} alt={coverExerciseName ? `Referencia visual de ${coverExerciseName}` : 'Referencia visual del ejercicio'} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : <div className="absolute inset-0 flex items-center justify-center text-white/40"><Dumbbell size={42} strokeWidth={1.3} /></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/30" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <span className="max-w-[70%] truncate rounded-full border border-white/15 bg-black/45 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur-sm">{GOAL_LABELS[template.objetivo] ?? template.objetivo}</span>
          <Badge variant={template.esta_activa ? 'success' : 'neutral'}>{template.esta_activa ? 'Lista' : 'Pausada'}</Badge>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <p className="text-xs font-medium text-white/75">{template.dias.length} {template.dias.length === 1 ? 'día' : 'días'} · {exerciseCount} {exerciseCount === 1 ? 'ejercicio' : 'ejercicios'}</p>
          {coverExerciseName ? <p className="mt-1 truncate text-sm font-semibold">Enfoque: {coverExerciseName}</p> : null}
          {coverAttribution ? <p className="mt-1 text-[10px] text-white/65">{coverAttribution}</p> : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold text-neutral-900 dark:text-white">{template.nombre}</h3>
          {template.descripcion ? <p className="mt-1 line-clamp-2 min-h-10 text-sm text-neutral-500">{template.descripcion}</p> : <p className="mt-1 min-h-10 text-sm text-neutral-400">Rutina lista para personalizar y asignar.</p>}
        </div>

        {(videosCount > 0 || machinesCount > 0) ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {videosCount > 0 ? <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"><Video size={13} /> {videosCount} {videosCount === 1 ? 'video' : 'videos'}</span> : null}
            {machinesCount > 0 ? <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"><Dumbbell size={13} /> {machinesCount} con equipo</span> : null}
          </div>
        ) : null}

        <div className="mt-auto flex gap-2 pt-5">
          <button type="button" className="btn-secondary flex-1" onClick={onEdit}><Pencil size={15} /> Editar</button>
          <button type="button" className="btn-primary flex-1" disabled={!template.esta_activa} onClick={onAssign}><Copy size={15} /> Asignar</button>
        </div>
      </div>
    </article>
  )
}

function ClienteRutinas({
  cliente,
  planes,
  planesLoading,
  planPrincipal,
  otrosPlanes,
  onBrowseLibrary,
  onCreateAndAssign,
}: {
  cliente: MemberProfile
  planes: TrainingPlan[]
  planesLoading: boolean
  planPrincipal?: TrainingPlan
  otrosPlanes: TrainingPlan[]
  onBrowseLibrary: () => void
  onCreateAndAssign: () => void
}) {
  return (
    <section className="card p-5 sm:p-6" aria-label={`Plan de ${cliente.full_name}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label-base">Plan del cliente</p>
            <h3 className="mt-1 text-lg font-bold">{cliente.full_name}</h3>
            <p className="text-sm text-neutral-500">{cliente.email}</p>
          </div>
          <Link className="btn-secondary" to={`/members/${cliente.id}`}>Ver perfil</Link>
        </div>
        {planesLoading ? <CardSkeleton lines={4} /> : planPrincipal ? (
          <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold">{planPrincipal.name}</h4>
                <p className="mt-1 text-sm text-neutral-500">{GOAL_LABELS[planPrincipal.goal] ?? planPrincipal.goal} · {planPrincipal.days_per_week} días por semana · {planPrincipal.end_date ? `finaliza ${formatDate(planPrincipal.end_date)}` : 'sin fecha de finalización'}</p>
              </div>
              <Badge variant={planPrincipal.status === 'active' ? 'success' : planPrincipal.status === 'draft' ? 'warning' : planPrincipal.status === 'scheduled' ? 'info' : 'neutral'}>{etiquetaEstado(planPrincipal.status)}</Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {planPrincipal.status === 'active' || planPrincipal.status === 'draft'
                ? <Link className="btn-primary" to={`/plans/${planPrincipal.id}/edit`}><Pencil size={15} /> Editar plan</Link>
                : <Link className="btn-secondary" to={`/plans/${planPrincipal.id}`}>Consultar plan</Link>}
              <button type="button" className="btn-secondary" onClick={onBrowseLibrary}><LibraryBig size={16} /> Asignar guardada</button>
              <button type="button" className="btn-primary" onClick={onCreateAndAssign}><Plus size={16} /> Crear y asignar</button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center dark:border-neutral-700">
            <Dumbbell className="mx-auto text-primary" size={24} />
            <p className="mt-2 font-semibold">{planes.length ? 'No hay un plan activo o próximo' : 'Este cliente todavía no tiene un plan'}</p>
            <p className="mt-1 text-sm text-neutral-500">Elige una rutina guardada o crea un plan nuevo para asignárselo.{otrosPlanes.length ? ' Los planes anteriores están disponibles más abajo.' : ''}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" className="btn-secondary" onClick={onBrowseLibrary}><LibraryBig size={16} /> Asignar guardada</button>
              <button type="button" className="btn-primary" onClick={onCreateAndAssign}><Plus size={16} /> Crear y asignar</button>
            </div>
          </div>
        )}
        {otrosPlanes.length ? <details className="mt-4 rounded-lg border border-neutral-200 px-4 py-3 dark:border-neutral-800"><summary className="cursor-pointer text-sm font-semibold">Ver otros planes ({otrosPlanes.length})</summary><div className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-800">{otrosPlanes.map((plan) => <div key={plan.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{plan.name}</p><p className="text-xs text-neutral-500">{etiquetaEstado(plan.status)} · {plan.start_date ? formatDate(plan.start_date) : 'sin inicio'}</p></div><Link className="btn-secondary text-sm" to={plan.status === 'active' || plan.status === 'draft' ? `/plans/${plan.id}/edit` : `/plans/${plan.id}`}>{plan.status === 'active' || plan.status === 'draft' ? 'Editar' : 'Consultar'}</Link></div>)}</div></details> : null}
    </section>
  )
}

function etiquetaEstado(status: TrainingPlan['status']) {
  return status === 'active' ? 'Activa' : status === 'draft' ? 'Borrador' : status === 'scheduled' ? 'Programada' : status === 'finished' ? 'Finalizada' : 'Archivada'
}

function Tab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return <button type="button" className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${active ? 'border-primary text-primary' : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'}`} aria-current={active ? 'page' : undefined} onClick={onClick}>{icon}{children}</button>
}
