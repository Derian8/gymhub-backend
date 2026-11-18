import { obtenerEstadoMembresia } from '@/shared/lib/estadoMembresia'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Search, UserPlus, ChevronLeft, ChevronRight, CreditCard, ArrowUpRight, Dumbbell, TrendingUp } from 'lucide-react'
import { useMembersQuery } from '../hooks/useMembers'
import { Badge, PageHeader, Avatar } from '@/shared/components/UI'
import { formatCurrency, formatDate, RISK_LEVEL_LABELS } from '@/shared/lib/utils'
import type { MemberMembershipSummary, MemberProfile } from '@/shared/types'
import { useAuthStore } from '@/shared/store/authStore'

const MEMBERSHIP_RECURRENCE_LABELS: Record<MemberMembershipSummary['recurrence_type'], string> = {
  daily: 'día',
  weekly: 'semana',
  biweekly: 'quincena',
  monthly: 'mes',
  quarterly: 'trimestre',
  annual: 'año',
}

const getMembershipBadge = (member: MemberProfile) => obtenerEstadoMembresia(member, true)

function getMembershipPlanName(member: MemberProfile) {
  return member.membresia_actual?.plan_name || 'Sin membresía'
}

export function MembersPage() {
  const user = useAuthStore((state) => state.user)
  const isAdmin = Boolean(user?.is_staff)
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('search') || '')
  const [estadoClienteFiltro, setEstadoClienteFiltro] = useState(() => {
    const estado = searchParams.get('estado_cliente')
    if (['membresia_activa', 'membresia_inactiva', 'cliente_inactivo'].includes(estado || '')) {
      return estado || ''
    }
    const anterior = searchParams.get('payment_status')
    const comercial = searchParams.get('commercial_status')
    if (anterior === 'paid' || comercial === 'al_dia') return 'membresia_activa'
    if (anterior || comercial === 'sin_membresia') return 'membresia_inactiva'
    return ''
  })
  const [inactivityFilter, setInactivityFilter] = useState(() => searchParams.get('inactivity') || '')
  const [riskFilter, setRiskFilter] = useState(() => searchParams.get('risk_level') || '')
  const [prescriptionFilter, setPrescriptionFilter] = useState(() => searchParams.get('prescription_status') || '')
  const [ordering, setOrdering] = useState(() => searchParams.get('ordering') || 'riesgo_desc')
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get('page')) || 1))
  const [pageSize, setPageSize] = useState(() => [10, 20, 50, 100].includes(Number(searchParams.get('page_size'))) ? Number(searchParams.get('page_size')) : 20)
  const scrollRestored = useRef(false)
  const listScrollKey = `gymhub-list-scroll:${location.pathname}`

  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (estadoClienteFiltro) params.set('estado_cliente', estadoClienteFiltro)
    if (inactivityFilter) params.set('inactivity', inactivityFilter)
    if (riskFilter) params.set('risk_level', riskFilter)
    if (prescriptionFilter) params.set('prescription_status', prescriptionFilter)
    if (ordering !== 'riesgo_desc') params.set('ordering', ordering)
    if (pageSize !== 20) params.set('page_size', String(pageSize))
    if (page > 1) params.set('page', String(page))
    if (searchParams.toString() !== params.toString()) {
      setSearchParams(params, { replace: true })
    }
  }, [search, estadoClienteFiltro, inactivityFilter, riskFilter, prescriptionFilter, ordering, page, pageSize, searchParams, setSearchParams])

  useEffect(() => {
    let saveFrame = 0
    const saveScroll = () => {
      cancelAnimationFrame(saveFrame)
      saveFrame = requestAnimationFrame(() => sessionStorage.setItem(listScrollKey, String(window.scrollY)))
    }
    window.addEventListener('scroll', saveScroll, { passive: true })
    return () => {
      cancelAnimationFrame(saveFrame)
      sessionStorage.setItem(listScrollKey, String(window.scrollY))
      window.removeEventListener('scroll', saveScroll)
    }
  }, [listScrollKey])

  const { data, isLoading } = useMembersQuery({
    assignment: isAdmin ? undefined : 'mine',
    search: search || undefined,
    estado_cliente: estadoClienteFiltro || undefined,
    inactivity: inactivityFilter || undefined,
    risk_level: riskFilter || undefined,
    prescription_status: prescriptionFilter || undefined,
    ordering: ordering || undefined,
    page,
    page_size: pageSize,
  })

  useEffect(() => {
    if (isLoading || scrollRestored.current) return
    const savedScroll = Number(sessionStorage.getItem(listScrollKey))
    if (Number.isFinite(savedScroll) && savedScroll > 0) {
      requestAnimationFrame(() => window.scrollTo(0, savedScroll))
    }
    scrollRestored.current = true
  }, [isLoading, listScrollKey])

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setPage(1)
  }

  return (
    <div data-testid="members-page" className="page-enter">
      <PageHeader
        title={isAdmin ? 'Clientes' : 'Clientes asignados'}
        subtitle={isAdmin ? 'Gestiona los perfiles y membresías.' : `${data?.count || 0} clientes bajo tu seguimiento técnico`}
        accionEnLinea={isAdmin}
        action={isAdmin ? (
          <Link to="/members/new" state={{ returnTo: `${location.pathname}${location.search}`, returnLabel: 'Volver a clientes' }} className="btn-primary flex items-center gap-2" data-testid="new-member-btn">
            <UserPlus size={16} />
            <span className="sr-only sm:not-sr-only">Nuevo cliente</span>
          </Link>
        ) : undefined}
      />

      <div className="mb-6 flex flex-wrap gap-3 [&_select]:min-h-11 [&_select]:max-w-full [&_select]:flex-1 [&_select]:rounded-xl [&_input]:rounded-xl">
        <div className="relative min-w-0 basis-full lg:flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={handleSearch}
            placeholder="Buscar por nombre, email o teléfono..."
            aria-label="Buscar clientes"
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-sm focus:outline-none focus:border-primary text-neutral-900 dark:text-white placeholder-neutral-400"
            data-testid="members-search"
          />
        </div>

        {isAdmin && <select
          value={estadoClienteFiltro}
          onChange={(e) => { setEstadoClienteFiltro(e.target.value); setPage(1) }}
          className="py-2.5 px-3 text-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-sm focus:outline-none focus:border-primary text-neutral-700 dark:text-neutral-300"
          data-testid="payment-filter"
          aria-label="Estado del cliente"
        >
          <option value="">Todos los estados</option>
          <option value="membresia_activa">Membresía activa</option>
          <option value="membresia_inactiva">Membresía inactiva</option>
          <option value="cliente_inactivo">Cliente inactivo (+30 días)</option>
        </select>}

        {!isAdmin && <label className="flex items-center gap-2 py-2.5 px-3 text-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-sm cursor-pointer">
          <input
            type="checkbox"
            checked={inactivityFilter === 'true'}
            onChange={(e) => { setInactivityFilter(e.target.checked ? 'true' : ''); setPage(1) }}
            className="accent-primary"
            data-testid="inactivity-filter"
          />
          <span className="text-neutral-700 dark:text-neutral-300">Solo inactivos</span>
        </label>}

        {!isAdmin && <select
          value={riskFilter}
          onChange={(e) => { setRiskFilter(e.target.value); setPage(1) }}
          className="py-2.5 px-3 text-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-sm focus:outline-none focus:border-primary text-neutral-700 dark:text-neutral-300"
          data-testid="risk-filter"
          aria-label="Nivel de riesgo"
        >
          <option value="">Todos los riesgos</option>
          <option value="high">Riesgo alto</option>
          <option value="medium">Riesgo medio</option>
          <option value="low">Riesgo bajo</option>
        </select>}

        {!isAdmin && <select
          value={prescriptionFilter}
          onChange={(e) => { setPrescriptionFilter(e.target.value); setPage(1) }}
          className="py-2.5 px-3 text-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-sm focus:outline-none focus:border-primary text-neutral-700 dark:text-neutral-300"
          data-testid="prescription-filter"
          aria-label="Estado de la rutina"
        >
          <option value="">Toda la prescripción</option>
          <option value="sin_plan">Sin entrenamiento publicado</option>
          <option value="incompleta">Incompleta</option>
          <option value="lista">Lista para member</option>
        </select>}

        <select
          value={ordering}
          onChange={(e) => { setOrdering(e.target.value); setPage(1) }}
          className="py-2.5 px-3 text-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-sm focus:outline-none focus:border-primary text-neutral-700 dark:text-neutral-300"
          data-testid="members-ordering"
          aria-label="Ordenar clientes"
        >
          <option value="riesgo_desc">Priorizar riesgo</option>
          <option value="prescripcion">Priorizar prescripción</option>
          <option value="riesgo_asc">Menor riesgo primero</option>
        </select>
      </div>

      <section aria-label="Lista de clientes" className="card overflow-hidden">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
            <tr>
              <th scope="col" className="px-3 py-3 font-semibold sm:px-4">Cliente</th>
              <th scope="col" className="hidden w-1/3 px-3 py-3 font-semibold md:table-cell md:px-4">{isAdmin ? 'Membresía' : 'Estado comercial'}</th>
              <th scope="col" className="hidden w-32 px-3 py-3 font-semibold xl:table-cell">Perfil</th>
              <th scope="col" className="w-44 px-2 py-3 text-right font-semibold sm:w-48 sm:px-4">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {isLoading ? (
              <tr><td colSpan={4} role="status" aria-label="Cargando clientes" className="p-6">
                <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-neutral-100 motion-reduce:animate-none dark:bg-neutral-900" />)}</div>
              </td></tr>
            ) : data?.results.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-neutral-500">No se encontraron clientes con estos filtros.</td></tr>
            ) : data?.results.map((member) => <MemberRow key={member.id} member={member} isAdmin={isAdmin} returnTo={`${location.pathname}${location.search}`} />)}
          </tbody>
        </table>
      </section>

      {/* Pagination */}
      {data && data.count > 0 && (
        <div className="mt-4 flex flex-col gap-3 px-2 text-sm lg:flex-row lg:items-center lg:justify-between">
          <p className="text-neutral-500">
            Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, data.count)} de {data.count} clientes
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
            <label className="flex items-center justify-between gap-3 text-neutral-600 sm:justify-start dark:text-neutral-300">
              Filas por página
              <select className="input min-h-11 w-20 shrink-0 py-2" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
            <nav aria-label="Paginación de clientes" className="flex items-center justify-between gap-2 sm:justify-end">
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={!data.previous}
                className="btn-secondary min-h-11 min-w-11 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="prev-page"
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="min-w-24 text-center text-neutral-600 dark:text-neutral-400" aria-live="polite">Pág. {page}{data.count > pageSize ? ` de ${Math.ceil(data.count / pageSize)}` : ''}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={!data.next}
                className="btn-secondary min-h-11 min-w-11 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="next-page"
                aria-label="Página siguiente"
              >
                <ChevronRight size={16} />
              </button>
            </nav>
          </div>
        </div>
      )}
    </div>
  )
}

function MemberRow({ member, isAdmin, returnTo }: { member: MemberProfile; isAdmin: boolean; returnTo: string }) {
  const membership = member.membresia_actual
  const membershipBadge = getMembershipBadge(member)
  const isUnassigned = member.trainer_asignado == null
  const regreso = { returnTo, returnLabel: 'Volver a clientes' }
  const accion = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
  const rutina = member.estado_prescripcion === 'sin_plan' ? 'Sin rutina asignada'
    : member.estado_prescripcion === 'incompleta' ? 'Rutina por completar'
    : member.estado_prescripcion === 'lista' ? 'Rutina lista' : null
  const estadoComercial = member.estado_comercial === 'bloqueado' ? 'Bloqueado' : member.estado_comercial === 'por_vencer' ? 'Por vencer' : 'Al día'
  const estadoComercialVariant = member.estado_comercial === 'bloqueado' ? 'error' : member.estado_comercial === 'por_vencer' ? 'warning' : 'success'

  return (
    <tr className="transition-colors hover:bg-neutral-50/80 dark:hover:bg-neutral-900/70" data-testid={`member-row-${member.id}`}>
      <td className="min-w-0 break-words px-3 py-3 align-top sm:px-4">
        <div className="flex min-w-0 items-start gap-2 sm:gap-3">
          <div className="hidden shrink-0 md:block"><Avatar name={member.full_name} photo={member.photo} size="sm" /></div>
          <div className="min-w-0">
            <Link to={`/members/${member.id}`} state={regreso} className="block break-words font-semibold text-neutral-900 hover:text-primary focus-visible:outline-primary dark:text-white">{member.full_name}</Link>
            <p className="hidden truncate text-xs text-neutral-500 md:block" title={member.email}>{member.email}</p>
            {membership?.current_period_end ? <p className="mt-1 hidden text-xs text-neutral-500 md:block">Vencimiento: {formatDate(membership.current_period_end)}</p> : null}
            <div className="mt-2 md:hidden"><Badge variant={membershipBadge.variant}>{membershipBadge.label === 'Cliente inactivo' ? 'Inactivo' : membershipBadge.label}</Badge></div>
          </div>
        </div>
      </td>
      <td className="hidden min-w-0 break-words px-3 py-3 align-top md:table-cell md:px-4" data-testid={`member-membership-${member.id}`}>
        {isAdmin ? <>
          <p className="font-semibold text-neutral-900 dark:text-white">{getMembershipPlanName(member)}</p>
          <div className="mt-1"><Badge variant={membershipBadge.variant}>{membershipBadge.label}</Badge></div>
          {membership ? <p className="mt-1 hidden text-xs text-neutral-500 lg:block">{formatCurrency(membership.agreed_price)} / {MEMBERSHIP_RECURRENCE_LABELS[membership.recurrence_type]}</p> : null}
        </> : <>
          <Badge variant={estadoComercialVariant}>{estadoComercial}</Badge>
          {rutina ? <p className="mt-2 text-xs text-neutral-500">{rutina}</p> : null}
        </>}
      </td>
      <td className="hidden px-3 py-3 align-top xl:table-cell">
        <Badge variant={member.is_active && member.estado_cliente !== 'cliente_inactivo' ? 'success' : 'error'}>{member.is_active && member.estado_cliente !== 'cliente_inactivo' ? 'Activo' : 'Inactivo'}</Badge>
        {member.nivel_riesgo ? <p className="mt-2 text-xs text-neutral-500">Riesgo {RISK_LEVEL_LABELS[member.nivel_riesgo]}{member.riesgo_adherencia != null ? ` · ${member.riesgo_adherencia}/100` : ''}</p> : null}
        {isUnassigned ? <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Sin responsable</p> : null}
      </td>
      <td className="px-2 py-2 align-middle sm:px-3">
        <div className="flex flex-nowrap items-center justify-end gap-0" aria-label={`Acciones de ${member.full_name}`}>
          <Link to={`/members/${member.id}`} state={regreso} className={accion} data-testid={`member-detail-${member.id}`} aria-label={`Ver perfil de ${member.full_name}`} title="Ver perfil"><ArrowUpRight size={18} aria-hidden="true" /></Link>
          {isAdmin ? <>
            <Link to={`/billing?member=${member.id}`} state={regreso} className={accion} aria-label={`Cobrar a ${member.full_name}`} title="Cobrar"><CreditCard size={18} aria-hidden="true" /></Link>
            <Link to={`/routines/assign?member=${member.id}`} state={regreso} className={accion} aria-label={`Asignar rutina a ${member.full_name}`} title="Asignar rutina"><Dumbbell size={18} aria-hidden="true" /></Link>
            <Link to={`/members/${member.id}#progreso`} state={regreso} className={accion} aria-label={`Ver progreso de ${member.full_name}`} title="Ver progreso"><TrendingUp size={18} aria-hidden="true" /></Link>
          </> : !isUnassigned ? <Link to={`/members/${member.id}/program`} state={regreso} className={accion} data-testid={`member-program-${member.id}`} aria-label={`Ver entrenamiento de ${member.full_name}`} title="Entrenamiento"><Dumbbell size={18} aria-hidden="true" /></Link> : null}
        </div>
      </td>
    </tr>
  )
}
