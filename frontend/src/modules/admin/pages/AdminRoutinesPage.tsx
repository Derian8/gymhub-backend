import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Dumbbell, PencilLine, Plus, Power, PowerOff, Search, UserPlus, Users } from 'lucide-react'
import { useTrainingTemplateSummariesQuery, useUpdateTrainingTemplateMutation } from '@/modules/plans/hooks/usePlans'
import { PageHeader } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { GOAL_LABELS } from '@/shared/lib/utils'
import type { TrainingTemplateSummary } from '@/shared/types'

function estructuraRutina(rutina: TrainingTemplateSummary) {
  return `${rutina.dias_count} ${rutina.dias_count === 1 ? 'día' : 'días'} · ${rutina.ejercicios_count} ${rutina.ejercicios_count === 1 ? 'ejercicio' : 'ejercicios'}`
}

function AccionesRutina({ rutina }: { rutina: TrainingTemplateSummary }) {
  const actualizar = useUpdateTrainingTemplateMutation()
  const clases = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="flex flex-nowrap items-center justify-end gap-0" aria-label={'Acciones de ' + rutina.nombre}>
      <Link className={clases} to={'/routines/' + rutina.id + '/edit'} aria-label={'Editar ' + rutina.nombre} title="Editar rutina">
        <PencilLine size={18} aria-hidden="true" />
      </Link>
      <Link className={clases} to={'/routines/' + rutina.id + '/clientes'} aria-label={'Ver clientes asignados a ' + rutina.nombre} title="Clientes asignados">
        <Users size={18} aria-hidden="true" />
      </Link>
      <button
        type="button"
        className={clases}
        onClick={() => actualizar.mutate({ templateId: rutina.id, payload: { esta_activa: !rutina.esta_activa } })}
        disabled={actualizar.isPending}
        aria-label={(rutina.esta_activa ? 'Desactivar ' : 'Activar ') + rutina.nombre}
        title={rutina.esta_activa ? 'Desactivar rutina; los clientes actuales la conservan' : 'Activar rutina'}
      >
        {rutina.esta_activa ? <PowerOff size={18} aria-hidden="true" /> : <Power size={18} aria-hidden="true" />}
      </button>
      {rutina.esta_activa ? (
        <Link className={clases} to={'/routines/assign?template=' + rutina.id} aria-label={'Asignar ' + rutina.nombre} title="Asignar a un cliente">
          <UserPlus size={18} aria-hidden="true" />
        </Link>
      ) : (
        <span className={clases + ' opacity-40'} aria-label="No disponible para nuevas asignaciones" title="Activa la rutina para asignarla">
          <UserPlus size={18} aria-hidden="true" />
        </span>
      )}
    </div>
  )
}

export function AdminRoutinesPage() {
  const [params] = useSearchParams()
  const [busqueda, setBusqueda] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [estado, setEstado] = useState('')
  const [pagina, setPagina] = useState(1)
  const [tamanoPagina, setTamanoPagina] = useState(20)
  const rutinas = useTrainingTemplateSummariesQuery({
    page: String(pagina),
    page_size: String(tamanoPagina),
    ...(busqueda.trim() ? { search: busqueda.trim() } : {}),
    ...(objetivo ? { goal: objetivo } : {}),
    ...(estado ? { state: estado } : {}),
  })
  const resultados = rutinas.data?.results ?? []
  const total = rutinas.data?.count ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / tamanoPagina))

  if (params.get('tab') === 'asignadas') return <Navigate to="/routines/assign" replace />

  return (
    <div className="page-enter space-y-7" data-testid="admin-routines-page">
      <PageHeader
        title="Rutinas"
        subtitle="Administra la biblioteca, consulta clientes y asigna rutinas desde esta lista."
        accionEnLinea
        action={<Link className="btn-primary" to="/routines/new" aria-label="Crear rutina"><Plus size={17} /><span className="hidden sm:inline">Crear rutina</span></Link>}
      />

      <div className="flex flex-wrap justify-end gap-2">
        <Link className="btn-primary inline-flex items-center justify-center gap-2 whitespace-nowrap" to="/routines/assign"><UserPlus size={17} /> Asignar rutina</Link>
        <Link className="btn-primary inline-flex items-center justify-center gap-2 whitespace-nowrap" to="/routines/exercises"><Dumbbell size={17} /> Ejercicios</Link>
      </div>

      <section className="space-y-5" aria-label="Biblioteca de rutinas">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Biblioteca</h2>
            <p className="mt-1 text-sm text-neutral-500">Las rutinas desactivadas conservan sus clientes y no admiten asignaciones nuevas.</p>
          </div>
          {rutinas.data ? <span className="text-sm text-neutral-500">{rutinas.data.count} rutinas</span> : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Buscar rutina o ejercicio</span>
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              className="input pl-10"
              value={busqueda}
              onChange={(evento) => { setBusqueda(evento.target.value); setPagina(1) }}
              placeholder="Buscar rutina o ejercicio"
            />
          </label>
          <label className="sm:w-48">
            <span className="sr-only">Filtrar por objetivo</span>
            <select className="input w-full" value={objetivo} onChange={(evento) => { setObjetivo(evento.target.value); setPagina(1) }}>
              <option value="">Todos los objetivos</option>
              {Object.entries(GOAL_LABELS).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
            </select>
          </label>
          <label className="sm:w-36">
            <span className="sr-only">Filtrar por estado</span>
            <select className="input w-full" value={estado} onChange={(evento) => { setEstado(evento.target.value); setPagina(1) }}>
              <option value="">Todos los estados</option>
              <option value="active">Activas</option>
              <option value="inactive">Inactivas</option>
            </select>
          </label>
        </div>

        {rutinas.isLoading ? <CardSkeleton lines={5} /> : rutinas.isError ? (
          <div className="card p-6 text-sm text-red-600">No se pudieron cargar las rutinas. Recarga la página para intentarlo de nuevo.</div>
        ) : resultados.length ? (
          <div className="card overflow-hidden">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
                <tr>
                  <th scope="col" className="px-3 py-3 sm:px-4">Rutina</th>
                  <th scope="col" className="hidden w-1/6 px-3 py-3 sm:table-cell sm:px-4">Clientes</th>
                  <th scope="col" className="hidden w-1/5 px-3 py-3 xl:table-cell sm:px-4">Objetivo</th>
                  <th scope="col" className="hidden w-1/5 px-3 py-3 xl:table-cell sm:px-4">Estructura</th>
                  <th scope="col" className="hidden w-32 px-3 py-3 sm:table-cell sm:px-4">Estado</th>
                  <th scope="col" className="w-48 px-2 py-3 text-right sm:px-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {resultados.map((rutina) => (
                  <tr key={rutina.id} className="transition-colors hover:bg-neutral-50/80 dark:hover:bg-neutral-900/70">
                    <td className="break-words px-3 py-3 sm:px-4">
                      <div className="font-semibold text-neutral-900 dark:text-white">{rutina.nombre}</div>
                      {rutina.descripcion ? <div className="hidden max-w-64 truncate text-neutral-500 md:block" title={rutina.descripcion}>{rutina.descripcion}</div> : null}
                      <div className="mt-1 text-xs text-neutral-500 xl:hidden">
                        {GOAL_LABELS[rutina.objetivo] ?? rutina.objetivo} · {estructuraRutina(rutina)}
                      </div>
                      <div className="mt-2 sm:hidden"><span className={'badge ' + (rutina.esta_activa ? 'badge-success' : 'badge-neutral')}>{rutina.esta_activa ? 'Activa' : 'Inactiva'}</span></div>
                    </td>
                    <td className="hidden px-3 py-3 text-sm text-neutral-600 sm:table-cell sm:px-4 dark:text-neutral-300">{rutina.clientes_vigentes ? `${rutina.clientes_vigentes} asignados` : 'Sin clientes'}</td>
                    <td className="hidden break-words px-3 py-3 xl:table-cell sm:px-4">{GOAL_LABELS[rutina.objetivo] ?? rutina.objetivo}</td>
                    <td className="hidden break-words px-3 py-3 xl:table-cell sm:px-4">{estructuraRutina(rutina)}</td>
                    <td className="hidden px-3 py-3 sm:table-cell sm:px-4"><span className={'badge ' + (rutina.esta_activa ? 'badge-success' : 'badge-neutral')}>{rutina.esta_activa ? 'Activa' : 'Inactiva'}</span></td>
                    <td className="px-2 py-2 align-middle sm:px-3"><AccionesRutina rutina={rutina} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card px-6 py-12 text-center">
            <h3 className="font-semibold">No hay rutinas con estos filtros</h3>
            <p className="mt-1 text-sm text-neutral-500">Prueba otra búsqueda o crea una rutina nueva.</p>
            <Link className="btn-primary mt-4" to="/routines/new"><Plus size={17} /> Crear rutina</Link>
          </div>
        )}

        {rutinas.data && total > 0 ? (
          <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-neutral-500 dark:text-neutral-400">Mostrando {(pagina - 1) * tamanoPagina + 1}–{Math.min(pagina * tamanoPagina, total)} de {total} rutinas</p>
            <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
              <label className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
                Filas por página
                <select className="input w-auto py-2" value={tamanoPagina} onChange={(evento) => { setTamanoPagina(Number(evento.target.value)); setPagina(1) }}>
                  <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option>
                </select>
              </label>
              <button type="button" className="btn-secondary disabled:cursor-not-allowed disabled:opacity-40" disabled={!rutinas.data.previous} onClick={() => setPagina((actual) => Math.max(1, actual - 1))}>Anterior</button>
              <span className="min-w-24 text-center text-neutral-600 dark:text-neutral-300" aria-live="polite">Página {pagina} de {totalPaginas}</span>
              <button type="button" className="btn-secondary disabled:cursor-not-allowed disabled:opacity-40" disabled={!rutinas.data.next} onClick={() => setPagina((actual) => actual + 1)}>Siguiente</button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
