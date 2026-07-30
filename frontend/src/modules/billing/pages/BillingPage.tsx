import { Link, useSearchParams } from 'react-router-dom'
import { CreditCard, Calendar, DollarSign, ReceiptText, TrendingUp, Users } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  useCancelMemberMembershipMutation,
  useCreateMemberMembershipMutation,
  useMarkPaymentAsPaidMutation,
  useMemberMembershipsQuery,
  useMemberSubscriptionsQuery,
  useMembershipPlansQuery,
  usePaymentRecordsQuery,
  usePaymentSchedulesQuery,
  useRenewMemberMembershipMutation,
  useSuspendMemberMembershipMutation,
} from '../hooks/useBilling'
import { useMembersQuery } from '@/modules/members/hooks/useMembers'
import { Badge, EmptyState, PageHeader } from '@/shared/components/UI'
import { TableRowSkeleton } from '@/shared/components/Skeleton'
import { formatCurrency, formatDate } from '@/shared/lib/utils'
import type { MemberMembership, MemberMembershipSummary, MemberProfile, MemberSubscription, PaymentRecord } from '@/shared/types'

type CobroFormState = {
  payment_reference: string
  notes: string
}

type PaymentPortfolioFilter = '' | 'pending' | 'late'
type MembershipCreationMode = 'custom' | 'catalog_plan'

const SUBSCRIPTION_STATUS_LABELS: Record<MemberSubscription['status'], string> = {
  pending: 'Pendiente',
  active: 'Activa',
  expiring: 'Por vencer',
  expired: 'Vencida',
  suspended: 'Suspendida',
  cancelled: 'Cancelada',
}

const SUBSCRIPTION_STATUS_VARIANT: Record<MemberSubscription['status'], 'success' | 'warning' | 'error' | 'neutral'> = {
  pending: 'warning',
  active: 'success',
  expiring: 'warning',
  expired: 'error',
  suspended: 'warning',
  cancelled: 'neutral',
}

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
    recurrence_type: 'monthly' as MemberSubscription['recurrence_type'],
    grace_period_days: 7,
    start_date: today,
    notes: '',
    auto_renew: true,
  }
}

function getMembershipBadge(membership?: MemberMembershipSummary | null): {
  label: string
  variant: 'success' | 'warning' | 'error' | 'neutral'
} {
  if (!membership) {
    return { label: 'Sin membresía', variant: 'neutral' }
  }
  if (membership.status === 'cancelled') {
    return { label: 'Cancelada', variant: 'neutral' }
  }
  if (membership.status === 'suspended') {
    return { label: 'Suspendida', variant: 'warning' }
  }
  if (membership.status === 'expired' || membership.payment_status === 'late') {
    return { label: 'Vencida', variant: 'error' }
  }
  if (membership.payment_status === 'pending') {
    return { label: 'Pendiente', variant: 'warning' }
  }
  return { label: membership.access_allowed ? 'Vigente' : 'Revisar acceso', variant: membership.access_allowed ? 'success' : 'warning' }
}

function getPortfolioPlanName(member: MemberProfile) {
  return member.membresia_actual?.plan_name || 'Sin membresía'
}

export function BillingPage() {
  const [searchParams] = useSearchParams()
  const memberId = searchParams.get('member')
  const filtros = memberId ? { member: memberId } : undefined
  const memberIdNumber = memberId ? Number(memberId) : undefined
  const [portfolioSearch, setPortfolioSearch] = useState('')
  const [portfolioPaymentFilter, setPortfolioPaymentFilter] = useState<PaymentPortfolioFilter>('')
  const memberPortfolioParams = useMemo(
    () => ({
      ordering: 'riesgo_desc',
      search: portfolioSearch.trim() || undefined,
      payment_status: portfolioPaymentFilter || undefined,
    }),
    [portfolioPaymentFilter, portfolioSearch],
  )
  const { data: records, isLoading } = usePaymentRecordsQuery(filtros)
  const { data: membersPortfolio, isLoading: isLoadingMembersPortfolio } = useMembersQuery(
    memberPortfolioParams,
    !memberId,
  )
  usePaymentSchedulesQuery(filtros)
  const { data: plans } = useMembershipPlansQuery()
  const { data: subscriptions } = useMemberSubscriptionsQuery(filtros)
  const { data: memberships } = useMemberMembershipsQuery(filtros)
  const createMembership = useCreateMemberMembershipMutation(memberIdNumber)
  const renewMembership = useRenewMemberMembershipMutation(memberIdNumber)
  const suspendMembership = useSuspendMemberMembershipMutation(memberIdNumber)
  const cancelMembership = useCancelMemberMembershipMutation(memberIdNumber)
  const markPaymentAsPaid = useMarkPaymentAsPaidMutation(memberIdNumber)
  const [paymentDrafts, setPaymentDrafts] = useState<Record<number, CobroFormState>>({})
  const [membershipForm, setMembershipForm] = useState(emptyMembershipForm)

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
    if (!plans?.results.length || membershipForm.membership_plan || activeMembership || membershipForm.mode !== 'catalog_plan') {
      return
    }
    setMembershipForm((current) => ({ ...current, membership_plan: String(plans.results[0].id) }))
  }, [activeMembership, membershipForm.membership_plan, membershipForm.mode, plans?.results])

  const canSubmitMembership = membershipForm.mode === 'catalog_plan'
    ? Boolean(plans?.results.length && membershipForm.membership_plan)
    : Boolean(membershipForm.membership_name.trim() && membershipForm.agreed_price)

  const handleMembershipSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!memberIdNumber || activeMembership) {
      return
    }
    if (membershipForm.mode === 'catalog_plan') {
      if (!membershipForm.membership_plan) {
        return
      }
      createMembership.mutate({
        member: memberIdNumber,
        membership_plan: Number(membershipForm.membership_plan),
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

  const totalPaid = records?.results
    .filter((record) => record.status === 'paid')
    .reduce((sum, record) => sum + parseFloat(record.amount), 0) || 0
  const pendingCount = records?.results.filter((record) => record.status === 'pending').length || 0
  const lateCount = records?.results.filter((record) => record.status === 'late').length || 0
  const receiptsIssued = records?.results.filter((record) => Boolean(record.receipt_issued_at)).length || 0

  return (
    <div data-testid="billing-page" className="page-enter">
      <PageHeader
        title={memberId ? 'Facturación del miembro' : 'Facturación'}
        subtitle={memberId ? 'Cobros, recibos y estado comercial del miembro seleccionado' : 'Cobros, recibos y vencimientos de la cartera'}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <SummaryCard label="Total cobrado" value={formatCurrency(totalPaid)} icon={<DollarSign size={18} className="text-green-400" />} />
        <SummaryCard label="Pendientes" value={String(pendingCount)} icon={<Calendar size={18} className="text-yellow-400" />} />
        <SummaryCard label="En mora" value={String(lateCount)} icon={<TrendingUp size={18} className="text-red-400" />} accentClass="border-red-500/20" valueClassName="text-red-500" />
        <SummaryCard label="Recibos emitidos" value={String(receiptsIssued)} icon={<ReceiptText size={18} className="text-sky-400" />} />
      </div>

      {!memberId && (
        <MembershipPortfolio
          members={membersPortfolio?.results || []}
          totalCount={membersPortfolio?.count || 0}
          isLoading={isLoadingMembersPortfolio}
          search={portfolioSearch}
          paymentFilter={portfolioPaymentFilter}
          onSearchChange={setPortfolioSearch}
          onPaymentFilterChange={setPortfolioPaymentFilter}
        />
      )}

      {memberId && (
        <div className="mb-8">
          <h3 className="font-heading font-bold text-xl text-neutral-900 dark:text-white mb-4">
            Membresía del miembro
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
                    <Badge variant={SUBSCRIPTION_STATUS_VARIANT[activeMembership.status]}>
                      {SUBSCRIPTION_STATUS_LABELS[activeMembership.status]}
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
                      {latestMembership?.plan_name || latestSubscription?.membership_name || 'Membresía'} · {SUBSCRIPTION_STATUS_LABELS[(latestMembership?.status || latestSubscription?.status || 'cancelled') as MemberSubscription['status']]}
                    </p>
                    <p className="text-neutral-500">
                      {latestMembership
                        ? `${formatCurrency(latestMembership.agreed_price)} / ${RECURRENCE_SHORT_LABELS[latestMembership.recurrence_type]}`
                        : latestSubscription
                          ? `${formatCurrency(latestSubscription.agreed_price)} / ${RECURRENCE_SHORT_LABELS[latestSubscription.recurrence_type]}`
                          : 'Sin precio'}
                    </p>
                  </div>
                  <p className="text-sm text-neutral-500">Asigna un plan para crear una membresía nueva desde cero.</p>
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
                {activeMembership ? 'Acciones de membresía' : 'Asignar membresía al miembro'}
              </h4>
              {!activeMembership ? (
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
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-neutral-500">Plan de membresía</span>
                      <select
                        className="input"
                        data-testid="membership-plan-select"
                        value={membershipForm.membership_plan}
                        onChange={(event) => setMembershipForm({ ...membershipForm, membership_plan: event.target.value })}
                        required
                      >
                        <option value="">Selecciona un plan</option>
                        {(plans?.results || []).map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name} · {formatCurrency(plan.price)} / {RECURRENCE_SHORT_LABELS[plan.recurrence_type]}
                          </option>
                        ))}
                      </select>
                    </label>
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
                  {membershipForm.mode === 'catalog_plan' && !plans?.results.length && (
                    <p className="text-sm text-amber-600">Primero crea una membresía en el catálogo comercial para poder asignarla.</p>
                  )}
                </>
              ) : (
                <MembershipActions
                  membership={activeMembership}
                  onRenew={() => renewMembership.mutate(activeMembership.id)}
                  onSuspend={() => suspendMembership.mutate({ id: activeMembership.id, reason: 'Suspensión manual desde facturación' })}
                  onCancel={() => cancelMembership.mutate({ id: activeMembership.id, reason: 'Cancelación manual desde facturación' })}
                  isSubmitting={renewMembership.isPending || suspendMembership.isPending || cancelMembership.isPending}
                />
              )}
              {!activeMembership && (
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

      <h3 className="font-heading font-bold text-xl text-neutral-900 dark:text-white mb-4">
        Registros de pago
      </h3>

      {isLoading ? (
        <div className="table-container">
          <table className="table-base">
            <tbody>{Array.from({ length: 6 }).map((_, index) => <TableRowSkeleton key={index} cols={6} />)}</tbody>
          </table>
        </div>
      ) : !records?.results.length ? (
        <EmptyState
          icon={<CreditCard size={40} />}
          title="Sin registros de pago"
          description="Los cobros aparecerán aquí cuando exista un schedule activo."
        />
      ) : (
        <div className="table-container">
          <table className="table-base">
            <thead>
              <tr>
                <th className="th-base">#</th>
                <th className="th-base">Monto</th>
                <th className="th-base">Estado</th>
                <th className="th-base hidden xl:table-cell">Referencia</th>
                <th className="th-base hidden md:table-cell">Recibo</th>
                <th className="th-base">Acción</th>
              </tr>
            </thead>
            <tbody>
              {records.results.map((record) => (
                <PaymentRow
                  key={record.id}
                  record={record}
                  draft={paymentDrafts[record.id] || { payment_reference: '', notes: '' }}
                  onDraftChange={(nextDraft) => setPaymentDrafts((current) => ({ ...current, [record.id]: nextDraft }))}
                  onMarkPaid={(payload) => markPaymentAsPaid.mutate({ id: record.id, payload })}
                  isSubmitting={markPaymentAsPaid.isPending}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function MembershipActions({
  membership,
  onRenew,
  onSuspend,
  onCancel,
  isSubmitting,
}: {
  membership: MemberMembership
  onRenew: () => void
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
        Para activar una membresía pendiente o renovada, registra el cobro como pagado en la tabla de pagos.
      </p>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  icon,
  accentClass = '',
  valueClassName = 'text-neutral-900 dark:text-white',
}: {
  label: string
  value: string
  icon: ReactNode
  accentClass?: string
  valueClassName?: string
}) {
  return (
    <div className={`stat-card ${accentClass}`.trim()}>
      <div className="flex justify-between items-center">
        <span className="label-base">{label}</span>
        {icon}
      </div>
      <span className={`text-3xl font-heading font-black ${valueClassName}`}>{value}</span>
    </div>
  )
}

function MembershipPortfolio({
  members,
  totalCount,
  isLoading,
  search,
  paymentFilter,
  onSearchChange,
  onPaymentFilterChange,
}: {
  members: MemberProfile[]
  totalCount: number
  isLoading: boolean
  search: string
  paymentFilter: PaymentPortfolioFilter
  onSearchChange: (value: string) => void
  onPaymentFilterChange: (value: PaymentPortfolioFilter) => void
}) {
  const membersWithMembership = members.filter((member) => Boolean(member.membresia_actual))
  const membersWithoutMembership = members.filter((member) => !member.membresia_actual)
  const visibleMembers = [...membersWithMembership, ...membersWithoutMembership]
  const hasActiveFilter = Boolean(search.trim() || paymentFilter)
  const filterLabel = paymentFilter === 'pending' ? 'pagos pendientes' : paymentFilter === 'late' ? 'pagos en mora' : 'todos los pagos'

  return (
    <section className="card p-6 mb-8" data-testid="membership-portfolio">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <p className="label-base">Cartera de membresías</p>
          <h2 className="font-heading text-2xl font-black text-neutral-900 dark:text-white">
            Membresías por miembro
          </h2>
          <p className="text-sm text-neutral-500">
            Revisa exactamente qué membresía y qué suscripción corresponde a cada member.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="neutral">{totalCount} resultado(s)</Badge>
          <Badge variant="info">{membersWithMembership.length} con membresía</Badge>
          {membersWithoutMembership.length > 0 && (
            <Badge variant="warning">{membersWithoutMembership.length} sin membresía</Badge>
          )}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
        <label className="space-y-1">
          <span className="text-xs font-medium text-neutral-500">Buscar miembro</span>
          <input
            className="input"
            data-testid="billing-member-search"
            placeholder="Nombre, apellido o correo"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            className={paymentFilter === '' ? 'btn-primary' : 'btn-secondary'}
            data-testid="billing-payment-filter-all"
            onClick={() => onPaymentFilterChange('')}
          >
            Todos
          </button>
          <button
            type="button"
            className={paymentFilter === 'pending' ? 'btn-primary' : 'btn-secondary'}
            data-testid="billing-payment-filter-pending"
            onClick={() => onPaymentFilterChange('pending')}
          >
            Pendientes
          </button>
          <button
            type="button"
            className={paymentFilter === 'late' ? 'btn-primary' : 'btn-secondary'}
            data-testid="billing-payment-filter-late"
            onClick={() => onPaymentFilterChange('late')}
          >
            En mora
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 skeleton rounded-sm" />
          ))}
        </div>
      ) : !visibleMembers.length ? (
        <EmptyState
          icon={<Users size={40} />}
          title={hasActiveFilter ? 'No hay miembros con ese filtro' : 'Sin miembros para mostrar'}
          description={hasActiveFilter ? `No se encontraron miembros para "${search || filterLabel}".` : 'Cuando existan miembros asignados, aparecerán aquí con su información de membresía.'}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {visibleMembers.map((member) => (
            <MembershipPortfolioCard key={member.id} member={member} />
          ))}
        </div>
      )}
    </section>
  )
}

function MembershipPortfolioCard({ member }: { member: MemberProfile }) {
  const membership = member.membresia_actual
  const badge = getMembershipBadge(membership)

  return (
    <div className="rounded-sm border border-neutral-200 p-4 dark:border-neutral-800" data-testid={`portfolio-member-${member.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-neutral-900 dark:text-white">{member.full_name}</h3>
          <p className="text-xs text-neutral-500">{member.email}</p>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PortfolioMetric label="Plan" value={getPortfolioPlanName(member)} />
        <PortfolioMetric label="Suscripción" value={membership ? `#${membership.subscription_id}` : 'Sin suscripción'} />
        <PortfolioMetric
          label="Precio"
          value={membership ? `${formatCurrency(membership.agreed_price)} / ${RECURRENCE_SHORT_LABELS[membership.recurrence_type]}` : 'Sin precio'}
        />
        <PortfolioMetric
          label="Vence"
          value={membership?.current_period_end ? formatDate(membership.current_period_end) : membership?.next_billing_date ? formatDate(membership.next_billing_date) : 'Sin fecha'}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-neutral-500">
          {membership?.days_overdue != null
            ? `${membership.days_overdue} día(s) vencido(s)`
            : membership?.days_until_due != null
              ? `${membership.days_until_due} día(s) restante(s)`
                : membership
                  ? 'Sin señal de vencimiento'
                  : 'Debe crearse una membresía comercial desde cero.'}
        </p>
        <Link to={`/billing?member=${member.id}`} className="btn-secondary">
          Gestionar
        </Link>
      </div>
    </div>
  )
}

function PortfolioMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-white">{value}</p>
    </div>
  )
}

function PaymentRow({
  record,
  draft,
  onDraftChange,
  onMarkPaid,
  isSubmitting,
}: {
  record: PaymentRecord
  draft: CobroFormState
  onDraftChange: (draft: CobroFormState) => void
  onMarkPaid: (payload: CobroFormState) => void
  isSubmitting: boolean
}) {
  const badgeVariant = record.status === 'paid' ? 'success' : record.status === 'late' ? 'error' : record.status === 'void' ? 'neutral' : 'warning'
  const statusLabel = record.status === 'paid' ? 'Pagado' : record.status === 'late' ? 'En mora' : record.status === 'void' ? 'Anulado' : 'Pendiente'

  return (
    <tr className="tr-hover align-top" data-testid={`payment-row-${record.id}`}>
      <td className="td-base font-mono text-xs text-neutral-400">#{record.id}</td>
      <td className="td-base font-semibold text-neutral-900 dark:text-white">
        <div>{formatCurrency(record.amount)}</div>
        <div className="text-xs text-neutral-400">{record.plan_name || 'Sin membresía'}</div>
      </td>
      <td className="td-base">
        <div className="flex flex-col gap-2">
          <Badge variant={badgeVariant}>{statusLabel}</Badge>
          {record.days_overdue > 0 && record.status !== 'paid' ? (
            <span className="text-xs text-red-500">Vencido hace {record.days_overdue} día(s)</span>
          ) : null}
        </div>
      </td>
      <td className="td-base hidden xl:table-cell text-xs">
        {record.payment_reference || '—'}
      </td>
      <td className="td-base hidden md:table-cell text-xs">
        {record.receipt_number ? (
          <div className="space-y-1">
            <div className="font-medium text-neutral-700 dark:text-neutral-200">{record.receipt_number}</div>
            <div className="text-neutral-400">{record.receipt_issued_at ? formatDate(record.receipt_issued_at) : '—'}</div>
          </div>
        ) : '—'}
      </td>
      <td className="td-base">
        {record.status === 'paid' ? (
          <div className="text-xs text-neutral-500">
            <div>{record.paid_at ? `Cobrado el ${formatDate(record.paid_at)}` : 'Cobrado'}</div>
            <div>{record.notes || 'Sin observaciones'}</div>
          </div>
        ) : record.status === 'void' ? (
          <div className="text-xs text-neutral-500">
            <div>Cobro anulado</div>
            <div>{record.notes || 'No debe registrarse como pagado.'}</div>
          </div>
        ) : (
          <div className="space-y-2 min-w-44">
            <input
              className="input"
              placeholder="Referencia de pago"
              value={draft.payment_reference}
              onChange={(event) => onDraftChange({ ...draft, payment_reference: event.target.value })}
            />
            <textarea
              className="input min-h-20"
              placeholder="Nota del cobro"
              value={draft.notes}
              onChange={(event) => onDraftChange({ ...draft, notes: event.target.value })}
            />
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => onMarkPaid(draft)}
              disabled={isSubmitting}
              data-testid={`mark-paid-${record.id}`}
            >
              Registrar cobro
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}
