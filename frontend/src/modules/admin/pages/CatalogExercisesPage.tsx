import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, PencilLine, Plus, Power, PowerOff, Search } from 'lucide-react'
import { plansApi } from '@/modules/plans/api/plansApi'
import { Badge, PageHeader } from '@/shared/components/UI'

type CampoOrden = 'nombre' | 'musculo_objetivo' | 'equipo' | 'esta_activo'
type DireccionOrden = 'asc' | 'desc'

const clasesAccion = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40'

function EncabezadoOrdenable({ titulo, campo, campoOrden, direccion, onOrdenar, className = '' }: {
  className?: string
  titulo: string
  campo: CampoOrden
  campoOrden: CampoOrden
  direccion: DireccionOrden
  onOrdenar: (campo: CampoOrden) => void
}) {
  const seleccionado = campo === campoOrden
  const Icono = seleccionado ? (direccion === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown

  return (
    <th scope="col" className={`px-3 py-3 sm:px-4 ${className}`} aria-sort={seleccionado ? (direccion === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg font-semibold text-neutral-700 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-neutral-200"
        onClick={() => onOrdenar(campo)}
        aria-label={`Ordenar por ${titulo.toLowerCase()}${seleccionado ? (direccion === 'asc' ? ', descendente' : ', ascendente') : ''}`}
      >
        {titulo}<Icono size={15} className={seleccionado ? 'text-primary' : 'text-neutral-400'} aria-hidden="true" />
      </button>
    </th>
  )
}

export function CatalogExercisesPage() {
  const [busqueda, setBusqueda] = useState('')
  const [incluirInactivos, setIncluirInactivos] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [tamanoPagina, setTamanoPagina] = useState(25)
  const [campoOrden, setCampoOrden] = useState<CampoOrden>('nombre')
  const [direccion, setDireccion] = useState<DireccionOrden>('asc')
  const [idEnCambio, setIdEnCambio] = useState<number | null>(null)
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const ejercicios = useQuery({
    queryKey: ['admin-catalog-exercises', busqueda, incluirInactivos, pagina, tamanoPagina, campoOrden, direccion],
    queryFn: () => plansApi.catalogExercises({
      search: busqueda,
      incluir_inactivos: incluirInactivos ? '1' : '0',
      page: String(pagina),
      page_size: String(tamanoPagina),
      ordering: `${direccion === 'desc' ? '-' : ''}${campoOrden}`,
    }),
  })

  const total = ejercicios.data?.count ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / tamanoPagina))

  useEffect(() => {
    if (ejercicios.data && pagina > totalPaginas) setPagina(totalPaginas)
  }, [ejercicios.data, pagina, totalPaginas])

  const ordenar = (campo: CampoOrden) => {
    if (campo === campoOrden) setDireccion((actual) => actual === 'asc' ? 'desc' : 'asc')
    else {
      setCampoOrden(campo)
      setDireccion('asc')
    }
    setPagina(1)
  }

  const cambiarEstado = async (id: number, estaActivo: boolean) => {
    setIdEnCambio(id)
    setError('')
    try {
      await plansApi.updateCatalogExercise(id, { esta_activo: !estaActivo })
      if (estaActivo && !incluirInactivos && ejercicios.data?.results.length === 1 && pagina > 1) {
        setPagina(pagina - 1)
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-catalog-exercises'] })
      await queryClient.invalidateQueries({ queryKey: ['catalogo-ejercicios'] })
    } catch {
      setError('No se pudo cambiar el estado del ejercicio.')
    } finally {
      setIdEnCambio(null)
    }
  }

  return (
    <div className="page-enter space-y-6">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary" to="/routines"><ArrowLeft size={16} /> Rutinas</Link>
      <PageHeader
        title="Ejercicios"
        subtitle="Gestiona las referencias reutilizables. Los planes asignados conservan la descripción y los medios que tenían al crearse."
        accionEnLinea
        action={<Link className="btn-primary inline-flex items-center gap-2 whitespace-nowrap" to="/routines/exercises/new"><Plus size={16} /><span className="sr-only sm:not-sr-only">Crear ejercicio</span></Link>}
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 basis-full sm:flex-1">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <input className="input pl-10" type="search" value={busqueda} onChange={(event) => { setBusqueda(event.target.value); setPagina(1) }} placeholder="Buscar ejercicio o músculo" aria-label="Buscar ejercicio" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={incluirInactivos} onChange={(event) => { setIncluirInactivos(event.target.checked); setPagina(1) }} />
          Incluir desactivados
        </label>
      </div>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {ejercicios.isLoading ? (
        <div className="card p-6">Cargando ejercicios…</div>
      ) : ejercicios.isError ? (
        <div className="card p-6">No se pudo cargar el catálogo.</div>
      ) : !ejercicios.data?.results.length ? (
        <div className="card p-6 text-neutral-600 dark:text-neutral-300">No hay ejercicios con estos filtros.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
              <tr>
                <EncabezadoOrdenable titulo="Ejercicio" campo="nombre" campoOrden={campoOrden} direccion={direccion} onOrdenar={ordenar} />
                <EncabezadoOrdenable className="hidden w-1/5 md:table-cell" titulo="Músculo" campo="musculo_objetivo" campoOrden={campoOrden} direccion={direccion} onOrdenar={ordenar} />
                <EncabezadoOrdenable className="hidden w-1/6 xl:table-cell" titulo="Equipo" campo="equipo" campoOrden={campoOrden} direccion={direccion} onOrdenar={ordenar} />
                <EncabezadoOrdenable className="hidden w-36 sm:table-cell" titulo="Estado" campo="esta_activo" campoOrden={campoOrden} direccion={direccion} onOrdenar={ordenar} />
                <th scope="col" className="w-32 px-3 py-3 text-right sm:px-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {ejercicios.data.results.map((ejercicio) => (
                <tr key={ejercicio.id} className="transition-colors hover:bg-neutral-50/80 dark:hover:bg-neutral-900/70">
                  <td className="break-words px-3 py-3 sm:px-4">
                    <div className="font-semibold text-neutral-900 dark:text-white">{ejercicio.nombre}</div>
                    <div className="hidden text-neutral-500 dark:text-neutral-400 md:block">{ejercicio.categoria}</div>
                    <div className="mt-2 sm:hidden"><Badge variant={ejercicio.esta_activo ? 'success' : 'neutral'}>{ejercicio.esta_activo ? 'Activo' : 'Desactivado'}</Badge></div>
                  </td>
                  <td className="hidden break-words px-4 py-3 md:table-cell">{ejercicio.musculo_objetivo || '—'}</td>
                  <td className="hidden break-words px-4 py-3 xl:table-cell">{ejercicio.equipo || '—'}</td>
                  <td className="hidden px-4 py-3 sm:table-cell"><Badge variant={ejercicio.esta_activo ? 'success' : 'neutral'}>{ejercicio.esta_activo ? 'Activo' : 'Desactivado'}</Badge></td>
                  <td className="px-3 py-3 sm:px-4">
                    <div className="flex items-center justify-end gap-1" aria-label={`Acciones de ${ejercicio.nombre}`}>
                      <Link className={clasesAccion} to={`/routines/exercises/${ejercicio.id}/edit`} aria-label={`Editar ${ejercicio.nombre}`} title="Editar ejercicio">
                        <PencilLine size={18} aria-hidden="true" />
                      </Link>
                      <button
                        type="button"
                        className={clasesAccion}
                        disabled={idEnCambio === ejercicio.id}
                        onClick={() => void cambiarEstado(ejercicio.id, ejercicio.esta_activo)}
                        aria-label={`${ejercicio.esta_activo ? 'Desactivar' : 'Activar'} ${ejercicio.nombre}`}
                        title={ejercicio.esta_activo ? 'Desactivar ejercicio' : 'Activar ejercicio'}
                      >
                        {ejercicio.esta_activo ? <PowerOff size={18} aria-hidden="true" /> : <Power size={18} aria-hidden="true" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ejercicios.data && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-neutral-500 dark:text-neutral-400">
            Mostrando {(pagina - 1) * tamanoPagina + 1}–{Math.min(pagina * tamanoPagina, total)} de {total} ejercicios
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
              Filas por página
              <select className="input w-auto py-2" value={tamanoPagina} onChange={(event) => { setTamanoPagina(Number(event.target.value)); setPagina(1) }}>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
            <button type="button" className="btn-secondary disabled:cursor-not-allowed disabled:opacity-40" disabled={!ejercicios.data.previous} onClick={() => setPagina((actual) => actual - 1)}>Anterior</button>
            <span className="min-w-24 text-center text-neutral-600 dark:text-neutral-300" aria-live="polite">Página {pagina} de {totalPaginas}</span>
            <button type="button" className="btn-secondary disabled:cursor-not-allowed disabled:opacity-40" disabled={!ejercicios.data.next} onClick={() => setPagina((actual) => actual + 1)}>Siguiente</button>
          </div>
        </div>
      )}
    </div>
  )
}
