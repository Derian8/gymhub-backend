import { ESTADOS_CLIENTE, obtenerEstadoMembresia } from '@/shared/lib/estadoMembresia'
import { Link, useSearchParams } from 'react-router-dom'
import { BASE_URL } from '@/shared/api/client'
import { EstadoCorreos } from '../components/EstadoCorreos'
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, Banknote, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, CreditCard, History, ReceiptText, RotateCcw, Search, UserPlus, Users, Wallet } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  useCancelMemberMembershipMutation,
  useArchiveMembershipPlanMutation,
  useCreateMembershipPlanMutation,
  useCreateMemberMembershipMutation,
  useMarkPaymentAsPaidMutation,
  useMemberMembershipsQuery,
  useMemberSubscriptionsQuery,
  useMembershipPlansQuery,
  usePaymentRecordsQuery,
  useRenewMemberMembershipMutation,
  useResumeMemberMembershipMutation,
  useSuspendMemberMembershipMutation,
} from '../hooks/useBilling'
import { useMembersQuery } from '@/modules/members/hooks/useMembers'
import { useAdminDashboard } from '@/modules/admin/hooks/useAdminReport'
import { Badge, EmptyState, PageHeader } from '@/shared/components/UI'
import { TableRowSkeleton } from '@/shared/components/Skeleton'
import { formatCurrency, formatDate } from '@/shared/lib/utils'
import type { MemberMembership, MemberProfile, MemberSubscription, PaymentRecord } from '@/shared/types'

type CobroFormState = {
  aplicacion?: 'activar' | 'deuda'
  payment_reference: string
  notes: string
  method: 'cash' | 'sinpe' | 'transfer' | 'other'
}

type PaymentPortfolioFilter = string
type PortfolioSortField = 'cliente' | 'membresia' | 'fecha' | 'estado'
type SortDirection = 'asc' | 'desc'
type BillingSection = 'portfolio' | 'history' | 'catalog'
type MembershipCreationMode = 'custom' | 'catalog_plan'

const RECURRENCE_TYPE_LABELS: Record<MemberSubscription['recurrence_type'], string> = {
  daily: 'Diario',
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  annual: 'Anual',
}

const RECURRENCE_SHORT_LABELS: Record<MemberSubscription['recurrence_type'], string> = {
  daily: 'día',
  weekly: 'semana',
  biweekly: 'quincena',
  monthly: 'mes',
  quarterly: 'trimestre',
  annual: 'año',
}

function emptyMembershipForm() {
  const today = new Date().toISOString().slice(0, 10)
  return {
    mode: 'catalog_plan' as MembershipCreationMode,
    membership_plan: '',
    membership_name: '',
    agreed_price: '',
    motivo_ajuste_precio: '',
    recurrence_type: 'monthly' as MemberSubscription['recurrence_type'],
    grace_period_days: 7,
    start_date: today,
    notes: '',
    auto_renew: true,
  }
}

const getMembershipBadge = (member: MemberProfile) => obtenerEstadoMembresia(member, true)

function getPortfolioPlanName(member: MemberProfile) {
  return member.membresia_actual?.plan_name || 'Sin membresía'
}

function getPortfolioDueDate(member: MemberProfile) {
  const membership = member.membresia_actual
  if (!membership) return ''
  const hasCharge = Boolean(member.id_cobro_abierto) && (membership.payment_status !== 'paid' || membership.status === 'expired')
  return hasCharge ? membership.next_billing_date || '' : membership.current_period_end || membership.next_billing_date || ''
}

function PortfolioSortHeading({ title, field, sortedField, direction, onSort, className = '' }: {
  title: string
  field: PortfolioSortField
  sortedField: PortfolioSortField
  direction: SortDirection
  onSort: (field: PortfolioSortField) => void
  className?: string
}) {
  const selected = field === sortedField
  const Icon = selected ? (direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
  return <th scope="col" className={`px-3 py-3 sm:px-5 ${className}`} aria-sort={selected ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
    <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-lg font-semibold text-neutral-700 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-neutral-200" onClick={() => onSort(field)} aria-label={`Ordenar por ${title.toLowerCase()}${selected ? (direction === 'asc' ? ', descendente' : ', ascendente') : ''}`}>
      {title}<Icon size={15} className={selected ? 'text-primary' : 'text-neutral-400'} aria-hidden="true" />
    </button>
  </th>
}

export function BillingPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const memberId = searchParams.get('member')
  const filtros = memberId ? { member: memberId } : undefined
  const memberIdNumber = memberId ? Number(memberId) : undefined
  const [portfolioSearch, setPortfolioSearch] = useState(() => searchParams.get('search') || '')
  const [portfolioPaymentFilter, setPortfolioPaymentFilter] = useState<PaymentPortfolioFilter>(() => {
    const estado = searchParams.get('estado_cliente')
    if (estado === 'overdue') return 'membresia_inactiva'
    if (['membresia_activa', 'membresia_inactiva', 'cliente_inactivo'].includes(estado ?? '')) return estado as PaymentPortfolioFilter
    const anterior = searchParams.get('payment_status')
    return anterior === 'paid' ? 'membresia_activa' : anterior ? 'membresia_inactiva' : ''
  })
  const [section, setSection] = useState<BillingSection>(() => {
    const saved = searchParams.get('section')
    return saved === 'history' || saved === 'catalog' ? saved : 'portfolio'
  })
  const [portfolioPage, setPortfolioPage] = useState(() => Math.max(1, Number(searchParams.get('page')) || 1))
  const [portfolioPageSize, setPortfolioPageSize] = useState(() => [10, 20, 50, 100].includes(Number(searchParams.get('page_size'))) ? Number(searchParams.get('page_size')) : 20)
  const [scrollToOverdueResults, setScrollToOverdueResults] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [historySearch, setHistorySearch] = useState('')
  const [paymentDraft, setPaymentDraft] = useState<CobroFormState>({ payment_reference: '', notes: '', method: 'cash' })
  const requestedPaymentId = Number(searchParams.get('payment'))

  useEffect(() => {
    if (memberId) return
    const next = new URLSearchParams()
    if (section !== 'portfolio') next.set('section', section)
    if (portfolioSearch.trim()) next.set('search', portfolioSearch.trim())
    if (portfolioPaymentFilter) next.set('estado_cliente', portfolioPaymentFilter)
    if (portfolioPage > 1) next.set('page', String(portfolioPage))
    if (portfolioPageSize !== 20) next.set('page_size', String(portfolioPageSize))
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true })
  }, [memberId, section, portfolioSearch, portfolioPaymentFilter, portfolioPage, portfolioPageSize, searchParams, setSearchParams])

  useEffect(() => {
    if (!scrollToOverdueResults || section !== 'portfolio' || portfolioPaymentFilter !== 'membresia_inactiva') return
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('billing-portfolio-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setScrollToOverdueResults(false)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [scrollToOverdueResults, section, portfolioPaymentFilter])

  const memberPortfolioParams = useMemo(
    () => ({
      ordering: 'cobro',
      search: portfolioSearch.trim() || undefined,
      estado_cliente: portfolioPaymentFilter || undefined,
      page: portfolioPage,
      page_size: portfolioPageSize,
    }),
    [portfolioPaymentFilter, portfolioSearch, portfolioPage, portfolioPageSize],
  )
  const { data: overview } = useAdminDashboard(!memberId)
  const { data: records, isLoading: isLoadingHistory } = usePaymentRecordsQuery(
    { ...filtros, status: 'paid', page: String(historyPage), page_size: '10', search: historySearch.trim() },
    Boolean(memberId || section === 'history'),
  )
  const { data: outstanding, isLoading: isLoadingOutstanding } = usePaymentRecordsQuery(
    memberId ? { member: memberId, outstanding: 'true', page_size: '100' } : undefined,
    Boolean(memberId),
  )
  const { data: membersPortfolio, isLoading: isLoadingMembersPortfolio } = useMembersQuery(
    memberPortfolioParams,
    !memberId && section === 'portfolio',
  )
  const portfolioCount = portfolioPaymentFilter
    ? membersPortfolio?.count ?? (isLoadingMembersPortfolio ? null : 0)
    : membersPortfolio?.results.filter((member) => member.estado_cliente !== 'cliente_inactivo').length ?? null
  const { data: plans } = useMembershipPlansQuery(Boolean(memberId || section === 'catalog'))
  const activePlans = useMemo(() => plans?.results.filter((plan) => plan.is_active !== false) || [], [plans])
  const { data: subscriptions } = useMemberSubscriptionsQuery(filtros, Boolean(memberId))
  const { data: memberships } = useMemberMembershipsQuery(filtros, Boolean(memberId))
  const createMembership = useCreateMemberMembershipMutation(memberIdNumber)
  const renewMembership = useRenewMemberMembershipMutation(memberIdNumber)
  const suspendMembership = useSuspendMemberMembershipMutation(memberIdNumber)
  const cancelMembership = useCancelMemberMembershipMutation(memberIdNumber)
  const resumeMembership = useResumeMemberMembershipMutation(memberIdNumber)
  const markPaymentAsPaid = useMarkPaymentAsPaidMutation(memberIdNumber)
  const [membershipForm, setMembershipForm] = useState(emptyMembershipForm)
  const selectedPayment = outstanding?.results.find((record) => record.id === requestedPaymentId) ?? outstanding?.results[0]

  const latestSubscription = useMemo(
    () => subscriptions?.results[0] ?? null,
    [subscriptions],
  )
  const activeMembership = useMemo(
    () => memberships?.results.find((item) => ['pending', 'active', 'expiring', 'suspended'].includes(item.status)) ?? null,
    [memberships],
  )
  const latestMembership = useMemo(
    () => memberships?.results[0] ?? null,
    [memberships],
  )

  useEffect(() => {
    if (!activePlans.length || membershipForm.membership_plan || activeMembership || membershipForm.mode !== 'catalog_plan') {
      return
    }
    setMembershipForm((current) => ({ ...current, membership_plan: String(activePlans[0].id) }))
  }, [activeMembership, membershipForm.membership_plan, membershipForm.mode, activePlans])

  const canSubmitMembership = membershipForm.mode === 'catalog_plan'
    ? Boolean(activePlans.length && membershipForm.membership_plan)
    : Boolean(membershipForm.membership_name.trim() && membershipForm.agreed_price)

  const handleMembershipSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!memberIdNumber || activeMembership || selectedPayment) {
      return
    }
    if (membershipForm.mode === 'catalog_plan') {
      if (!membershipForm.membership_plan) {
        return
      }
      createMembership.mutate({
        member: memberIdNumber,
        membership_plan: Number(membershipForm.membership_plan),
        agreed_price: membershipForm.agreed_price || undefined,
        motivo_ajuste_precio: membershipForm.motivo_ajuste_precio,
        start_date: membershipForm.start_date,
        auto_renew: membershipForm.auto_renew,
        notes: membershipForm.notes,
      })
      return
    }
    if (!membershipForm.membership_name.trim() || !membershipForm.agreed_price) {
      return
    }
    createMembership.mutate({
      member: memberIdNumber,
      membership_plan: null,
      membership_name: membershipForm.membership_name.trim(),
      description: 'Membresía comercial personalizada.',
      agreed_price: membershipForm.agreed_price,
      recurrence_type: membershipForm.recurrence_type,
      grace_period_days: membershipForm.grace_period_days,
      start_date: membershipForm.start_date,
      auto_renew: membershipForm.auto_renew,
      notes: membershipForm.notes,
    })
  }

  return (
    <div data-testid="billing-page" className="page-enter">
      <PageHeader
        title={memberId ? `Pagos de ${selectedPayment?.member_name || records?.results[0]?.member_name || 'cliente'}` : 'Pagos'}
        subtitle={memberId ? 'Confirma la entrada del pago y consulta su membresía.' : 'Prioriza vencimientos, registra cobros y consulta recibos.'}
        backTo={memberId ? '/billing' : undefined}
        backLabel="Volver a pagos"
        accionEnLinea={!memberId}
        action={!memberId ? <Link to="/reports" className="btn-primary inline-flex items-center gap-2"><ReceiptText size={17} /><span className="sr-only sm:not-sr-only">Reportes</span></Link> : undefined}
      />

      {!memberId && <div className="mb-7 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => { setSection('portfolio'); setPortfolioPaymentFilter('membresia_inactiva'); setPortfolioPage(1); setScrollToOverdueResults(true) }} className="card flex items-center justify-between gap-3 p-4 text-left transition-colors hover:border-red-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Ver membresías inactivas por cobro vencido">
          <span className="flex items-center gap-3"><span className="rounded-xl bg-red-500/10 p-2.5 text-red-500"><Banknote size={20} /></span><span><span className="block text-sm font-semibold text-neutral-900 dark:text-white">Cobros vencidos</span><span className="block text-xs text-neutral-500">{overview ? `${overview.commercial.overdue_count} por atender` : 'Cargando…'}</span></span></span>
          <span className="flex items-center gap-2 font-heading text-lg font-bold text-red-500">{overview ? formatCurrency(overview.commercial.overdue_amount) : '—'} <ArrowRight size={17} /></span>
        </button>
        <button type="button" onClick={() => { setSection('portfolio'); setPortfolioPaymentFilter('due_soon'); setPortfolioPage(1) }} className="card flex items-center justify-between gap-3 p-4 text-left transition-colors hover:border-amber-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Ver cobros próximos">
          <span className="flex items-center gap-3"><span className="rounded-xl bg-amber-500/10 p-2.5 text-amber-500"><CalendarClock size={20} /></span><span><span className="block text-sm font-semibold text-neutral-900 dark:text-white">Próximos 7 días</span><span className="block text-xs text-neutral-500">{overview ? `${overview.commercial.due_soon_count} por vencer` : 'Cargando…'}</span></span></span>
          <span className="flex items-center gap-2 font-heading text-lg font-bold text-neutral-900 dark:text-white">{overview ? formatCurrency(overview.commercial.due_soon_amount) : '—'} <ArrowRight size={17} /></span>
        </button>
      </div>}

      {!memberId && (
        <div className="pestanas-pagos mb-6" role="tablist" aria-label="Secciones de pagos" onKeyDown={(evento) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(evento.key)) return
          evento.preventDefault()
          const pestanas = Array.from(evento.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
          const indice = pestanas.indexOf(document.activeElement as HTMLButtonElement)
          const siguiente = evento.key === 'Home' ? 0 : evento.key === 'End' ? pestanas.length - 1
            : (indice + (evento.key === 'ArrowRight' ? 1 : -1) + pestanas.length) % pestanas.length
          pestanas[siguiente]?.focus()
          pestanas[siguiente]?.click()
        }}>
          <button type="button" role="tab" aria-selected={section === 'portfolio'} tabIndex={section === 'portfolio' ? 0 : -1} onClick={() => setSection('portfolio')}><Wallet size={16} aria-hidden="true" /><span>Cartera</span></button>
          <button type="button" role="tab" aria-selected={section === 'history'} tabIndex={section === 'history' ? 0 : -1} onClick={() => setSection('history')}><History size={16} aria-hidden="true" /><span>Historial</span></button>
          <button type="button" role="tab" aria-selected={section === 'catalog'} tabIndex={section === 'catalog' ? 0 : -1} onClick={() => setSection('catalog')}><CreditCard size={16} aria-hidden="true" /><span>Planes</span></button>
        </div>
      )}

      {!memberId && section === 'portfolio' && (
        <MembershipPortfolio
          members={membersPortfolio?.results || []}
          totalCount={portfolioCount}
          isLoading={isLoadingMembersPortfolio}
          search={portfolioSearch}
          paymentFilter={portfolioPaymentFilter}
          page={portfolioPage}
          pageSize={portfolioPageSize}
          hasNext={Boolean(membersPortfolio?.next)}
          hasPrevious={Boolean(membersPortfolio?.previous)}
          onPageChange={setPortfolioPage}
          onPageSizeChange={(size) => { setPortfolioPageSize(size); setPortfolioPage(1) }}
          onSearchChange={(value) => { setPortfolioSearch(value); setPortfolioPage(1) }}
          onPaymentFilterChange={(value) => { setPortfolioPaymentFilter(value); setPortfolioPage(1) }}
        />
      )}

      {!memberId && section === 'catalog' && <MembershipCatalog plans={activePlans} />}

      {memberId && <CobroPendiente
        records={outstanding?.results || []}
        selectedPayment={selectedPayment}
        isLoading={isLoadingOutstanding}
        draft={paymentDraft}
        onDraftChange={setPaymentDraft}
        onSelectPayment={(id) => { const next = new URLSearchParams(searchParams); next.set('payment', String(id)); setSearchParams(next, { replace: true }); setPaymentDraft({ payment_reference: '', notes: '', method: 'cash' }) }}
        onMarkPaid={() => { if (!selectedPayment) return; markPaymentAsPaid.mutate({ id: selectedPayment.id, payload: paymentDraft }, { onSuccess: () => { setPaymentDraft({ payment_reference: '', notes: '', method: 'cash' }); const next = new URLSearchParams(searchParams); next.delete('payment'); setSearchParams(next, { replace: true }) } }) }}
        isSubmitting={markPaymentAsPaid.isPending}
      />}

      {memberId && markPaymentAsPaid.data?.member_id === memberIdNumber && markPaymentAsPaid.data?.membresia_confirmada?.can_check_in && (
        <div role="status" className="card flex items-center gap-3 border-emerald-500/30 p-4">
          <CheckCircle2 size={22} className="shrink-0 text-emerald-500" />
          <div><p className="font-semibold text-neutral-900 dark:text-white">Pago confirmado · Membresía activa</p><p className="text-sm text-neutral-500">Acceso habilitado{markPaymentAsPaid.data.membresia_confirmada.end_date ? ` hasta el ${formatDate(markPaymentAsPaid.data.membresia_confirmada.end_date)}` : ''}. El recibo está disponible en el historial.</p></div>
        </div>
      )}

      {memberId && (
        <div className="mb-8">
          <p className="label-base">Paso 2 · Membresía</p>
          <h3 className="font-heading font-bold text-xl text-neutral-900 dark:text-white mb-4">
            Membresía y vigencia
          </h3>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="card p-5">
              <h4 className="font-heading font-bold text-lg text-neutral-900 dark:text-white mb-3">Estado actual</h4>
              {activeMembership ? (
                <div className="space-y-3">
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    Membresía: <span className="font-semibold text-neutral-900 dark:text-white">{activeMembership.plan_name || 'Sin nombre'}</span>
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    Precio acordado: <span className="font-semibold text-neutral-900 dark:text-white">{formatCurrency(activeMembership.agreed_price)}</span>
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    Recurrencia: <span className="font-semibold text-neutral-900 dark:text-white">{RECURRENCE_TYPE_LABELS[activeMembership.recurrence_type]}</span>
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    Próximo cobro: <span className="font-semibold text-neutral-900 dark:text-white">{activeMembership.next_payment ? formatDate(activeMembership.next_payment.due_date) : 'Sin cobro pendiente'}</span>
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    Vigencia: <span className="font-semibold text-neutral-900 dark:text-white">{activeMembership.end_date ? `hasta ${formatDate(activeMembership.end_date)}` : 'Pendiente del primer pago'}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={obtenerEstadoMembresia(activeMembership).variant}>
                      {obtenerEstadoMembresia(activeMembership).label}
                    </Badge>
                    <Badge variant={activeMembership.can_check_in ? 'success' : 'warning'}>
                      {activeMembership.can_check_in ? 'Check-in permitido' : 'Check-in bloqueado'}
                    </Badge>
                  </div>
                  {activeMembership.notes && (
                    <p className="text-xs text-neutral-500">
                      Nota comercial: {activeMembership.notes}
                    </p>
                  )}
                </div>
              ) : latestMembership || latestSubscription ? (
                <div className="space-y-3">
                  <p className="text-sm text-neutral-500">Este miembro no tiene una membresía activa ahora mismo.</p>
                  <div className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
                    <p className="font-semibold text-neutral-900 dark:text-white">Último historial</p>
                    <p className="text-neutral-600 dark:text-neutral-300">
                      {latestMembership?.plan_name || latestSubscription?.membership_name || 'Membresía'} · {obtenerEstadoMembresia(latestMembership || latestSubscription).label}
                    </p>
                    <p className="text-neutral-500">
                      {latestMembership
                        ? `${formatCurrency(latestMembership.agreed_price)} / ${RECURRENCE_SHORT_LABELS[latestMembership.recurrence_type]}`
                        : latestSubscription
                          ? `${formatCurrency(latestSubscription.agreed_price)} / ${RECURRENCE_SHORT_LABELS[latestSubscription.recurrence_type]}`
                          : 'Sin precio'}
                    </p>
                  </div>
                  <p className="text-sm text-neutral-500">{selectedPayment ? 'Registra el cobro pendiente para reactivar esta membresía.' : 'Asigna un plan para crear una membresía nueva.'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-neutral-500">Este miembro todavía no tiene una membresía creada.</p>
                  <p className="text-sm text-neutral-500">Puedes asignarla desde el catálogo comercial o definir condiciones personalizadas.</p>
                </div>
              )}
            </div>

            <form className="card p-5 space-y-3" onSubmit={handleMembershipSubmit}>
              <h4 className="font-heading font-bold text-lg text-neutral-900 dark:text-white">
                {activeMembership ? 'Acciones de membresía' : selectedPayment ? 'Reactivar membresía' : 'Asignar membresía al cliente'}
              </h4>
              {!activeMembership && selectedPayment ? (
                <p className="rounded-xl border border-amber-300/50 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">Esta membresía tiene un cobro abierto. Al confirmarlo arriba se actualiza su vigencia y acceso.</p>
              ) : !activeMembership ? (
                <>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      className={membershipForm.mode === 'catalog_plan' ? 'btn-primary' : 'btn-secondary'}
                      data-testid="membership-mode-catalog"
                      onClick={() => setMembershipForm((current) => ({ ...current, mode: 'catalog_plan' }))}
                    >
                      Membresía del catálogo
                    </button>
                    <button
                      type="button"
                      className={membershipForm.mode === 'custom' ? 'btn-primary' : 'btn-secondary'}
                      data-testid="membership-mode-custom"
                      onClick={() => setMembershipForm((current) => ({ ...current, mode: 'custom' }))}
                    >
                      Membresía personalizada
                    </button>
                  </div>

                  {membershipForm.mode === 'custom' ? (
                    <>
                      <p className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
                        Define aquí las condiciones comerciales acordadas con este miembro. Esta membresía no modifica su rutina de entrenamiento.
                      </p>
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-neutral-500">Nombre de la membresía</span>
                        <input
                          className="input"
                          data-testid="custom-membership-name"
                          value={membershipForm.membership_name}
                          onChange={(event) => setMembershipForm({ ...membershipForm, membership_name: event.target.value })}
                          placeholder="Membresía personalizada"
                          required
                        />
                      </label>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="space-y-1">
                          <span className="text-xs font-medium text-neutral-500">Precio acordado</span>
                          <input
                            className="input"
                            data-testid="custom-membership-price"
                            type="number"
                            min="0"
                            step="1"
                            value={membershipForm.agreed_price}
                            onChange={(event) => setMembershipForm({ ...membershipForm, agreed_price: event.target.value })}
                            placeholder="25000"
                            required
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-xs font-medium text-neutral-500">Recurrencia</span>
                          <select
                            className="input"
                            data-testid="custom-membership-recurrence"
                            value={membershipForm.recurrence_type}
                            onChange={(event) => setMembershipForm({ ...membershipForm, recurrence_type: event.target.value as MemberSubscription['recurrence_type'] })}
                          >
                            {Object.entries(RECURRENCE_TYPE_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3"><label className="space-y-1 block">
                      <span className="text-xs font-medium text-neutral-500">Plan de membresía</span>
                      <select
                        className="input"
                        data-testid="membership-plan-select"
                        value={membershipForm.membership_plan}
                        onChange={(event) => setMembershipForm({ ...membershipForm, membership_plan: event.target.value })}
                        required
                      >
                        <option value="">Selecciona un plan</option>
                        {activePlans.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name} · {formatCurrency(plan.price)} / {RECURRENCE_SHORT_LABELS[plan.recurrence_type]}
                          </option>
                        ))}
                      </select>
                    </label><div className="grid gap-3 sm:grid-cols-2"><label><span className="text-xs font-medium text-neutral-500">Precio acordado (opcional)</span><input className="input mt-1" type="number" value={membershipForm.agreed_price} onChange={(event) => setMembershipForm({ ...membershipForm, agreed_price: event.target.value })} placeholder="Usa el precio del catálogo" /></label><label><span className="text-xs font-medium text-neutral-500">Motivo si cambia el precio</span><input className="input mt-1" value={membershipForm.motivo_ajuste_precio} onChange={(event) => setMembershipForm({ ...membershipForm, motivo_ajuste_precio: event.target.value })} /></label></div></div>
                  )}
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-neutral-500">Inicio y primer cobro</span>
                    <input className="input" type="date" value={membershipForm.start_date} onChange={(event) => setMembershipForm({ ...membershipForm, start_date: event.target.value })} required />
                  </label>
                  <textarea className="input min-h-24" placeholder="Notas comerciales" value={membershipForm.notes} onChange={(event) => setMembershipForm({ ...membershipForm, notes: event.target.value })} />
                  <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                    <input type="checkbox" checked={membershipForm.auto_renew} onChange={(event) => setMembershipForm({ ...membershipForm, auto_renew: event.target.checked })} />
                    Renovación automática habilitada
                  </label>
                  {membershipForm.mode === 'catalog_plan' && !activePlans.length && (
                    <p className="text-sm text-amber-600">Primero crea una membresía en el catálogo comercial para poder asignarla.</p>
                  )}
                </>
              ) : (
                <MembershipActions
                  membership={activeMembership}
                  onRenew={() => renewMembership.mutate(activeMembership.id)}
                  onResume={() => resumeMembership.mutate(activeMembership.id)}
                  onSuspend={() => { const reason = window.prompt('Motivo de la suspensión'); if (reason?.trim()) suspendMembership.mutate({ id: activeMembership.id, reason: reason.trim() }) }}
                  onCancel={() => { const reason = window.prompt('Motivo de la cancelación'); if (reason?.trim()) cancelMembership.mutate({ id: activeMembership.id, reason: reason.trim() }) }}
                  isSubmitting={renewMembership.isPending || resumeMembership.isPending || suspendMembership.isPending || cancelMembership.isPending}
                />
              )}
              {!activeMembership && !selectedPayment && (
                <div className="flex justify-end">
                  <button className="btn-primary" type="submit" disabled={createMembership.isPending || !canSubmitMembership}>
                    Asignar membresía y crear primer cobro
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {section === 'history' && <EstadoCorreos />}
      {(memberId || section === 'history') && <PaymentHistory
        records={records?.results || []}
        count={records?.count || 0}
        page={historyPage}
        hasNext={Boolean(records?.next)}
        hasPrevious={Boolean(records?.previous)}
        isLoading={isLoadingHistory}
        memberId={memberId}
        search={historySearch}
        onSearchChange={(value) => { setHistorySearch(value); setHistoryPage(1) }}
        onPageChange={setHistoryPage}
      />}
    </div>
  )
}

function MembershipActions({
  membership,
  onRenew,
  onResume,
  onSuspend,
  onCancel,
  isSubmitting,
}: {
  membership: MemberMembership
  onRenew: () => void
  onResume: () => void
  onSuspend: () => void
  onCancel: () => void
  isSubmitting: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-sm border border-neutral-200 p-4 text-sm dark:border-neutral-800">
        <p className="font-semibold text-neutral-900 dark:text-white">
          {membership.plan_name || 'Membresía asignada'}
        </p>
        <p className="mt-1 text-neutral-500">
          {membership.end_date ? `Vence el ${formatDate(membership.end_date)}` : 'Pendiente de confirmar el primer pago'}
        </p>
        <p className="mt-1 text-neutral-500">
          {membership.days_remaining != null ? `${membership.days_remaining} día(s) restantes` : 'Sin periodo pagado'}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {membership.status === 'suspended' ? <button className="btn-primary" type="button" onClick={onResume} disabled={isSubmitting}>Reanudar</button> : null}
        <button className="btn-secondary" type="button" onClick={onRenew} disabled={isSubmitting}>
          Renovar
        </button>
        <button className="btn-secondary" type="button" onClick={onSuspend} disabled={isSubmitting || membership.status === 'suspended'}>
          Suspender
        </button>
        <button className="btn-secondary" type="button" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        Para activar una membresía pendiente o renovada, confirma el pago en el panel de cobro superior.
      </p>
    </div>
  )
}

function CobroPendiente({ records, selectedPayment, isLoading, draft, onDraftChange, onSelectPayment, onMarkPaid, isSubmitting }: {
  records: PaymentRecord[]
  selectedPayment?: PaymentRecord
  isLoading: boolean
  draft: CobroFormState
  onDraftChange: (draft: CobroFormState) => void
  onSelectPayment: (id: number) => void
  onMarkPaid: () => void
  isSubmitting: boolean
}) {
  const [allowAdvance, setAllowAdvance] = useState(false)
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const isScheduled = Boolean(selectedPayment && selectedPayment.due_date > today)
  useEffect(() => setAllowAdvance(false), [selectedPayment?.id])
  return <section className="card mb-8 overflow-hidden" data-testid="pending-payment">
    <div className="border-b border-neutral-200 p-5 dark:border-neutral-800 sm:p-6">
      <p className="label-base">Paso 1 · Cobro</p>
      <h2 className="font-heading text-xl font-bold text-neutral-900 dark:text-white">{isScheduled ? 'Próximo cobro' : 'Cobro pendiente'}</h2>
      <p className="mt-1 text-sm text-neutral-500">{isScheduled ? 'Este cargo está programado para una fecha futura.' : 'Selecciona el cargo, confirma el medio de pago y emite el recibo.'}</p>
    </div>
    {isLoading ? <div className="p-6"><div className="h-40 skeleton rounded-xl" /></div> : !selectedPayment ? (
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
        <div className="flex items-center gap-3"><CheckCircle2 size={22} className="text-emerald-500" /><div><p className="font-semibold text-neutral-900 dark:text-white">No hay cobros pendientes</p><p className="text-sm text-neutral-500">Si aún no tiene membresía, asígnala en el siguiente paso.</p></div></div>
      </div>
    ) : <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
      <div>
        {records.length > 1 && <div className="mb-4 flex flex-wrap gap-2" aria-label="Cobros pendientes del cliente">{records.map((record) => <button key={record.id} type="button" onClick={() => onSelectPayment(record.id)} className={selectedPayment.id === record.id ? 'btn-primary' : 'btn-secondary'}>#{record.id} · {formatDate(record.due_date)}</button>)}</div>}
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-neutral-500">{isScheduled ? 'Próximo monto' : 'Monto a cobrar'}</p><p className="mt-1 font-heading text-3xl font-bold text-neutral-900 dark:text-white">{formatCurrency(selectedPayment.amount)}</p></div><Badge variant={selectedPayment.days_overdue > 0 || selectedPayment.status === 'late' ? 'error' : isScheduled ? 'neutral' : 'warning'}>{selectedPayment.days_overdue > 0 || selectedPayment.status === 'late' ? 'Vencido' : isScheduled ? 'Programado' : 'Pendiente'}</Badge></div>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><span className="text-neutral-500">Membresía</span><p className="font-semibold text-neutral-900 dark:text-white">{selectedPayment.plan_name || 'Membresía'}</p></div><div><span className="text-neutral-500">Fecha de cobro</span><p className="font-semibold text-neutral-900 dark:text-white">{formatDate(selectedPayment.due_date)}</p></div></div>
        </div>
      </div>
      {isScheduled && !allowAdvance ? <div className="flex flex-col justify-center gap-3 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800"><p className="text-sm text-neutral-600 dark:text-neutral-300">Vence el <strong>{formatDate(selectedPayment.due_date)}</strong>. Puedes recibir este pago antes si el cliente lo solicita.</p><button type="button" className="btn-secondary" onClick={() => setAllowAdvance(true)}>Cobrar por adelantado</button></div> : <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); onMarkPaid() }}>
        {selectedPayment.days_overdue > 0 && selectedPayment.vigencia_pago && <label className="block space-y-1"><span className="label-base">Aplicar pago</span><select className="input" value={draft.aplicacion ?? 'activar'} onChange={(event) => onDraftChange({ ...draft, aplicacion: event.target.value as 'activar' | 'deuda' })}><option value="activar">Cobrar y activar membresía</option><option value="deuda">Solo pagar deuda anterior</option></select></label>}
        {selectedPayment.vigencia_pago && <div className="rounded-xl bg-emerald-500/10 p-3 text-sm text-neutral-700 dark:text-neutral-200">{draft.aplicacion === 'deuda' ? 'Este pago salda el cargo anterior; no modifica la vigencia de la membresía.' : <><p className="font-semibold">Vigencia: {formatDate(selectedPayment.vigencia_pago.inicio)} al {formatDate(selectedPayment.vigencia_pago.fin)}</p><p className="mt-1 text-xs">{selectedPayment.vigencia_pago.reinicia ? 'El atraso supera la tolerancia del plan. Se inicia un periodo nuevo.' : 'Se conserva la continuidad de tu membresía.'} El pago confirma la membresía al instante.</p></>}</div>}
        <label className="block space-y-1"><span className="label-base">Medio de pago</span><select className="input" value={draft.method} onChange={(event) => onDraftChange({ ...draft, method: event.target.value as CobroFormState['method'] })}><option value="cash">Efectivo</option><option value="sinpe">SINPE Móvil</option><option value="transfer">Transferencia</option><option value="other">Otro</option></select></label>
        <label className="block space-y-1"><span className="label-base">Referencia {draft.method === 'cash' ? '(opcional)' : '(obligatoria)'}</span><input className="input" value={draft.payment_reference} onChange={(event) => onDraftChange({ ...draft, payment_reference: event.target.value })} placeholder={draft.method === 'sinpe' ? 'Número de comprobante SINPE' : 'Número de transacción'} required={draft.method !== 'cash'} /></label>
        <details className="text-sm text-neutral-500"><summary className="cursor-pointer py-1">Agregar nota</summary><textarea className="input mt-2 min-h-20" value={draft.notes} onChange={(event) => onDraftChange({ ...draft, notes: event.target.value })} placeholder="Detalle interno del cobro" /></details>
        <button type="submit" className="btn-primary inline-flex w-full items-center justify-center gap-2" disabled={isSubmitting || (draft.method !== 'cash' && !draft.payment_reference.trim())} data-testid={`mark-paid-${selectedPayment.id}`}><CheckCircle2 size={18} />{isSubmitting ? 'Confirmando…' : draft.aplicacion === 'deuda' ? 'Confirmar pago de deuda' : 'Confirmar pago y activar'}</button>
      </form>}
    </div>}
  </section>
}

function MembershipCatalog({ plans }: { plans: Array<{ id: number; name: string; price: string; recurrence_type: MemberSubscription['recurrence_type']; is_active?: boolean }> }) {
  const createPlan = useCreateMembershipPlanMutation()
  const archivePlan = useArchiveMembershipPlanMutation()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [recurrence, setRecurrence] = useState<MemberSubscription['recurrence_type']>('monthly')
  return <section className="card mb-8 overflow-hidden">
    <div className="border-b border-neutral-200 p-5 dark:border-neutral-800 sm:p-6"><p className="label-base">Configuración comercial</p><h2 className="font-heading text-xl font-bold text-neutral-900 dark:text-white">Planes de membresía</h2><p className="mt-1 text-sm text-neutral-500">Define precios y periodos para asignarlos a los clientes.</p></div>
    <form className="grid gap-3 border-b border-neutral-200 p-5 dark:border-neutral-800 sm:grid-cols-[minmax(0,1fr)_130px_150px_auto] sm:items-end sm:p-6" onSubmit={(event) => { event.preventDefault(); if (!name.trim() || !price) return; createPlan.mutate({ name: name.trim(), price, recurrence_type: recurrence, grace_period_days: 7, description: '', features: '', is_active: true }, { onSuccess: () => { setName(''); setPrice('') } }) }}>
      <label className="space-y-1"><span className="label-base">Nombre del plan</span><input className="input" placeholder="Ej. Mensual" value={name} onChange={(event) => setName(event.target.value)} required /></label>
      <label className="space-y-1"><span className="label-base">Precio</span><input className="input" type="number" min="0.01" step="0.01" placeholder="₡" value={price} onChange={(event) => setPrice(event.target.value)} required /></label>
      <label className="space-y-1"><span className="label-base">Periodo</span><select className="input" value={recurrence} onChange={(event) => setRecurrence(event.target.value as MemberSubscription['recurrence_type'])}>{Object.entries(RECURRENCE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button type="submit" className="btn-primary" disabled={createPlan.isPending}>Crear plan</button>
    </form>
    {plans.length ? <div className="divide-y divide-neutral-200 dark:divide-neutral-800">{plans.map((plan) => <div key={plan.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6"><div><p className="font-semibold text-neutral-900 dark:text-white">{plan.name}</p><p className="text-sm text-neutral-500">{formatCurrency(plan.price)} / {RECURRENCE_SHORT_LABELS[plan.recurrence_type]}</p></div><button className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-100 hover:text-red-600 dark:hover:bg-neutral-900" type="button" disabled={archivePlan.isPending} onClick={() => archivePlan.mutate(plan.id)}>Archivar</button></div>)}</div> : <div className="p-6"><EmptyState icon={<CreditCard size={38} />} title="Sin planes activos" description="Crea el primer plan para registrar membresías." /></div>}
  </section>
}

function MembershipPortfolio({
  members,
  totalCount,
  isLoading,
  search,
  paymentFilter,
  page,
  pageSize,
  hasNext,
  hasPrevious,
  onPageChange,
  onPageSizeChange,
  onSearchChange,
  onPaymentFilterChange,
}: {
  members: MemberProfile[]
  totalCount: number | null
  isLoading: boolean
  search: string
  paymentFilter: PaymentPortfolioFilter
  page: number
  pageSize: number
  hasNext: boolean
  hasPrevious: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onSearchChange: (value: string) => void
  onPaymentFilterChange: (value: PaymentPortfolioFilter) => void
}) {
  const hasActiveFilter = Boolean(search.trim() || paymentFilter)
  const [sortedField, setSortedField] = useState<PortfolioSortField>('fecha')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const sortBy = (field: PortfolioSortField) => {
    if (field === sortedField) setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc')
    else {
      setSortedField(field)
      setSortDirection('asc')
    }
  }
  const sortedMembers = useMemo(() => [...members].sort((a, b) => {
    const values: Record<PortfolioSortField, [string, string]> = {
      cliente: [a.full_name, b.full_name],
      membresia: [getPortfolioPlanName(a), getPortfolioPlanName(b)],
      fecha: [getPortfolioDueDate(a), getPortfolioDueDate(b)],
      estado: [getMembershipBadge(a).label, getMembershipBadge(b).label],
    }
    const [valueA, valueB] = values[sortedField]
    const compared = sortedField === 'fecha'
      ? valueA.localeCompare(valueB)
      : valueA.localeCompare(valueB, 'es', { sensitivity: 'base', numeric: true })
    return (sortDirection === 'asc' ? compared : -compared) || a.id - b.id
  }), [members, sortedField, sortDirection])
  return (
    <section className="card mb-8 overflow-hidden" data-testid="membership-portfolio">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 p-5 dark:border-neutral-800 sm:p-6">
        <div><p className="label-base">Cartera de clientes</p><h2 className="font-heading text-xl font-bold text-neutral-900 dark:text-white">Clientes y cobros</h2><p className="mt-1 text-sm text-neutral-500">Los cargos más urgentes aparecen primero.</p></div>
        <Badge variant="neutral">{totalCount === null ? '… clientes' : paymentFilter ? `${totalCount} ${totalCount === 1 ? 'cliente' : 'clientes'}` : `${totalCount} en página`}</Badge>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_190px] sm:p-5">
        <label className="relative"><Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-neutral-400" /><span className="sr-only">Buscar cliente</span><input className="input pl-10" data-testid="billing-member-search" placeholder="Buscar cliente por nombre o correo" value={search} onChange={(event) => onSearchChange(event.target.value)} /></label>
        <label><span className="sr-only">Filtrar cobros</span><select className="input" data-testid="billing-payment-filter" value={paymentFilter} onChange={(event) => onPaymentFilterChange(event.target.value as PaymentPortfolioFilter)}><option value="">Todos los clientes</option><option value="membresia_activa">Membresía activa</option><option value="membresia_inactiva">Membresía inactiva</option><option value="cliente_inactivo">Cliente inactivo (+30 días)</option></select></label>
      </div>
      <div id="billing-portfolio-results" className="scroll-mt-24">
      {isLoading ? <div className="px-4 pb-4"><table className="w-full"><tbody>{Array.from({ length: 5 }).map((_, index) => <TableRowSkeleton key={index} cols={3} />)}</tbody></table></div> : !members.length ? <div className="px-4 pb-5"><EmptyState icon={<Users size={38} />} title={hasActiveFilter ? 'Sin resultados' : 'Sin clientes'} description={hasActiveFilter ? 'Prueba otro nombre o cambia el filtro.' : 'Los clientes registrados aparecerán aquí.'} /></div> : <table className="w-full table-fixed text-left text-sm">
        <thead className="border-y border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"><tr><PortfolioSortHeading title="Cliente" field="cliente" sortedField={sortedField} direction={sortDirection} onSort={sortBy} /><PortfolioSortHeading title="Membresía" field="membresia" sortedField={sortedField} direction={sortDirection} onSort={sortBy} className="hidden w-1/4 md:table-cell" /><PortfolioSortHeading title="Fecha" field="fecha" sortedField={sortedField} direction={sortDirection} onSort={sortBy} className="hidden w-36 lg:table-cell" /><PortfolioSortHeading title="Estado" field="estado" sortedField={sortedField} direction={sortDirection} onSort={sortBy} className="hidden w-32 sm:table-cell" /><th scope="col" className="w-16 px-2 py-3 text-center sm:w-20 sm:px-4">Acción</th></tr></thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">{sortedMembers.map((member) => {
          const membership = member.membresia_actual
          const badge = getMembershipBadge(member)
          const hasCharge = Boolean(member.id_cobro_abierto) && (membership?.payment_status !== 'paid' || membership?.status === 'expired')
          const needsRenewal = Boolean(membership && membership.status === 'expired' && !member.id_cobro_abierto)
          const dueDate = hasCharge ? membership?.next_billing_date : membership?.current_period_end || membership?.next_billing_date
          return <tr key={member.id} className="transition-colors hover:bg-neutral-50/80 dark:hover:bg-neutral-900/70" data-testid={`portfolio-member-${member.id}`}>
            <td className="break-words px-3 py-3 sm:px-5"><p className="font-semibold text-neutral-900 dark:text-white">{member.full_name}</p><p className="hidden truncate text-xs text-neutral-500 sm:block">{member.email}</p><p className="mt-0.5 text-xs text-neutral-500 md:hidden">{getPortfolioPlanName(member)}{membership ? ` · ${formatCurrency(membership.agreed_price)}` : ''}</p><div className="mt-1 sm:hidden"><Badge variant={badge.variant}>{badge.label}</Badge></div></td>
            <td className="hidden break-words px-3 py-3 md:table-cell"><p className="font-medium text-neutral-900 dark:text-white">{getPortfolioPlanName(member)}</p><p className="text-xs text-neutral-500">{membership ? `${formatCurrency(membership.agreed_price)} / ${RECURRENCE_SHORT_LABELS[membership.recurrence_type]}` : 'Sin precio'}</p></td>
            <td className="hidden px-3 py-3 text-neutral-600 lg:table-cell dark:text-neutral-300">{dueDate ? formatDate(dueDate) : '—'}</td>
            <td className="hidden px-3 py-3 sm:table-cell"><Badge variant={badge.variant}>{badge.label}</Badge></td>
            <td className="px-2 py-3 text-center sm:px-4"><Link to={`/billing?member=${member.id}${hasCharge ? `&payment=${member.id_cobro_abierto}` : ''}`} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`${!membership ? 'Asignar plan a' : hasCharge ? 'Cobrar a' : needsRenewal ? 'Renovar membresía de' : 'Ver pagos de'} ${member.full_name}`} title={hasCharge ? 'Registrar pago' : needsRenewal ? 'Renovar membresía' : !membership ? 'Asignar membresía' : 'Ver pagos'}>{!membership ? <UserPlus size={18} aria-hidden="true" /> : hasCharge ? <CreditCard size={18} aria-hidden="true" /> : needsRenewal ? <RotateCcw size={18} aria-hidden="true" /> : <ReceiptText size={18} aria-hidden="true" />}</Link></td>
          </tr>
        })}</tbody>
      </table>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 text-sm dark:border-neutral-800 sm:px-5"><label className="flex items-center gap-2 text-neutral-500">Filas por página<select className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>{[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label><div className="flex items-center gap-2"><span className="text-neutral-500">Página {page}</span><button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 disabled:opacity-40 dark:border-neutral-800" aria-label="Página anterior" disabled={!hasPrevious} onClick={() => onPageChange(page - 1)}><ChevronLeft size={18} /></button><button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 disabled:opacity-40 dark:border-neutral-800" aria-label="Página siguiente" disabled={!hasNext} onClick={() => onPageChange(page + 1)}><ChevronRight size={18} /></button></div></div>
    </section>
  )
}

const PAYMENT_METHOD_LABELS: Record<Exclude<PaymentRecord['metodo_registrado'], ''>, string> = {
  cash: 'Efectivo', sinpe: 'SINPE Móvil', transfer: 'Transferencia', other: 'Otro',
}

function PaymentHistory({ records, count, page, hasNext, hasPrevious, isLoading, memberId, search, onSearchChange, onPageChange }: {
  records: PaymentRecord[]
  count: number
  page: number
  hasNext: boolean
  hasPrevious: boolean
  isLoading: boolean
  memberId: string | null
  search: string
  onSearchChange: (value: string) => void
  onPageChange: (page: number) => void
}) {
  return <section className="card mb-8 overflow-hidden">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 p-5 dark:border-neutral-800 sm:p-6"><div><p className="label-base">{memberId ? 'Paso 3 · Comprobantes' : 'Pagos confirmados'}</p><h2 className="font-heading text-xl font-bold text-neutral-900 dark:text-white">Historial de pagos</h2><p className="mt-1 text-sm text-neutral-500">Consulta pagos registrados y descarga sus recibos.</p></div><Badge variant="neutral">{count} {count === 1 ? 'pago' : 'pagos'}</Badge></div>
    {!memberId && <div className="p-4 sm:p-5"><label className="relative block max-w-md"><Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-neutral-400" /><span className="sr-only">Buscar cliente en el historial</span><input className="input pl-10" placeholder="Buscar cliente por nombre o correo" value={search} onChange={(event) => onSearchChange(event.target.value)} /></label></div>}
    {isLoading ? <div className="px-4 pb-4"><table className="w-full"><tbody>{Array.from({ length: 5 }).map((_, index) => <TableRowSkeleton key={index} cols={3} />)}</tbody></table></div> : !records.length ? <div className="px-4 pb-5"><EmptyState icon={<ReceiptText size={38} />} title="Aún no hay pagos registrados" description={search ? 'Prueba otro nombre para encontrar el pago.' : 'Los pagos confirmados aparecerán aquí con su comprobante.'} /></div> : <table className="w-full table-fixed text-left text-sm">
      <thead className="border-y border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"><tr><th scope="col" className="px-3 py-3 sm:px-5">Cliente / pago</th><th scope="col" className="hidden w-32 px-3 py-3 sm:table-cell">Fecha</th><th scope="col" className="hidden w-36 px-3 py-3 md:table-cell">Medio</th><th scope="col" className="hidden w-32 px-3 py-3 sm:table-cell">Monto</th><th scope="col" className="w-24 px-2 py-3 text-right sm:w-28 sm:px-5">Recibo</th></tr></thead>
      <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">{records.map((record) => <tr key={record.id} className="transition-colors hover:bg-neutral-50/80 dark:hover:bg-neutral-900/70" data-testid={`payment-row-${record.id}`}><td className="break-words px-3 py-3 sm:px-5"><p className="font-semibold text-neutral-900 dark:text-white">{record.member_name || `Cliente #${record.member_id || '—'}`}</p><p className="text-xs text-neutral-500">{record.plan_name || 'Membresía'} · #{record.id}</p><p className="mt-0.5 text-xs text-neutral-500 sm:hidden">{record.paid_at ? formatDate(record.paid_at) : '—'} · {formatCurrency(record.amount)}</p></td><td className="hidden px-3 py-3 text-neutral-600 sm:table-cell dark:text-neutral-300">{record.paid_at ? formatDate(record.paid_at) : '—'}</td><td className="hidden px-3 py-3 text-neutral-600 md:table-cell dark:text-neutral-300">{record.metodo_registrado ? PAYMENT_METHOD_LABELS[record.metodo_registrado] : 'No indicado'}</td><td className="hidden px-3 py-3 font-semibold text-neutral-900 sm:table-cell dark:text-white">{formatCurrency(record.amount)}</td><td className="px-2 py-3 text-right sm:px-5">{record.receipt_number ? <a className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl px-2 font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" href={`${BASE_URL}/api/payment-records/${record.id}/receipt/`} target="_blank" rel="noreferrer" aria-label={`Descargar recibo ${record.receipt_number}`}><ReceiptText size={16} /> PDF</a> : <span className="text-neutral-400">—</span>}</td></tr>)}</tbody>
    </table>}
    <div className="flex items-center justify-end gap-2 border-t border-neutral-200 px-4 py-3 text-sm dark:border-neutral-800 sm:px-5"><span className="mr-2 text-neutral-500">Página {page}</span><button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 disabled:opacity-40 dark:border-neutral-800" aria-label="Página anterior del historial" disabled={!hasPrevious} onClick={() => onPageChange(page - 1)}><ChevronLeft size={18} /></button><button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 disabled:opacity-40 dark:border-neutral-800" aria-label="Página siguiente del historial" disabled={!hasNext} onClick={() => onPageChange(page + 1)}><ChevronRight size={18} /></button></div>
  </section>
}
