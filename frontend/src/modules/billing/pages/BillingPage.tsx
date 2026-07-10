import { Link, useSearchParams } from 'react-router-dom'
import { CreditCard, Calendar, DollarSign, ReceiptText, TrendingUp, Users } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  useCreateMemberSubscriptionMutation,
  useCreateMembershipPlanMutation,
  useMarkPaymentAsPaidMutation,
  useMemberSubscriptionsQuery,
  useMembershipPlansQuery,
  usePaymentRecordsQuery,
  usePaymentSchedulesQuery,
  useUpdateMemberSubscriptionMutation,
  useUpdateMembershipPlanMutation,
} from '../hooks/useBilling'
import { useMembersQuery } from '@/modules/members/hooks/useMembers'
import { Badge, EmptyState, PageHeader } from '@/shared/components/UI'
import { TableRowSkeleton } from '@/shared/components/Skeleton'
import { formatCurrency, formatDate } from '@/shared/lib/utils'
import type { MemberMembershipSummary, MemberProfile, MemberSubscription, MembershipPlan, PaymentRecord } from '@/shared/types'

type CobroFormState = {
  payment_reference: string
  notes: string
}

const SUBSCRIPTION_STATUS_LABELS: Record<MemberSubscription['status'], string> = {
  active: 'Activa',
  past_due: 'Con mora',
  suspended: 'Suspendida',
  cancelled: 'Cancelada',
}

const SUBSCRIPTION_STATUS_VARIANT: Record<MemberSubscription['status'], 'success' | 'warning' | 'error' | 'neutral'> = {
  active: 'success',
  past_due: 'error',
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
  if (membership.status === 'past_due' || membership.payment_status === 'late') {
    return { label: 'Vencida', variant: 'error' }
  }
  if (membership.payment_status === 'pending') {
    return { label: 'Pendiente', variant: 'warning' }
  }
  return { label: membership.access_allowed ? 'Vigente' : 'Revisar acceso', variant: membership.access_allowed ? 'success' : 'warning' }
}

function hasAssignedMembershipPlan(member: MemberProfile) {
  return Boolean(member.membership_plan)
}

function getPortfolioPlanName(member: MemberProfile) {
  return member.membresia_actual?.plan_name || member.membership_plan_nombre || 'Sin plan'
}

export function BillingPage() {
  const [searchParams] = useSearchParams()
  const memberId = searchParams.get('member')
  const filtros = memberId ? { member: memberId } : undefined
  const memberIdNumber = memberId ? Number(memberId) : undefined
  const { data: records, isLoading } = usePaymentRecordsQuery(filtros)
  const { data: plans } = useMembershipPlansQuery()
  const { data: membersPortfolio, isLoading: isLoadingMembersPortfolio } = useMembersQuery(
    { ordering: 'riesgo_desc' },
    !memberId,
  )
  usePaymentSchedulesQuery(filtros)
  const { data: subscriptions } = useMemberSubscriptionsQuery(filtros)
  const createPlan = useCreateMembershipPlanMutation()
  const updatePlan = useUpdateMembershipPlanMutation()
  const createSubscription = useCreateMemberSubscriptionMutation(memberIdNumber)
  const updateSubscription = useUpdateMemberSubscriptionMutation(memberIdNumber)
  const markPaymentAsPaid = useMarkPaymentAsPaidMutation(memberIdNumber)
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [paymentDrafts, setPaymentDrafts] = useState<Record<number, CobroFormState>>({})
  const [planForm, setPlanForm] = useState({
    name: '',
    description: '',
    price: '0',
    recurrence_type: 'monthly' as MembershipPlan['recurrence_type'],
    grace_period_days: 7,
    features: '',
    is_active: true,
  })
  const [subscriptionForm, setSubscriptionForm] = useState({
    plan: 0,
    agreed_price: '0',
    start_date: new Date().toISOString().slice(0, 10),
    next_billing_date: new Date().toISOString().slice(0, 10),
    recurrence_type: 'monthly' as MemberSubscription['recurrence_type'],
    grace_period_days: 7,
    auto_generate_next: true,
    is_active: true,
    status: 'active' as MemberSubscription['status'],
    renewal_date: new Date().toISOString().slice(0, 10),
    cancellation_date: '',
    cancellation_reason: '',
    commercial_notes: '',
  })

  const activeSubscription = useMemo(
    () => subscriptions?.results.find((item) => item.is_active) ?? subscriptions?.results[0] ?? null,
    [subscriptions],
  )

  const selectedPlan = useMemo(
    () => plans?.results.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  )

  useEffect(() => {
    if (!activeSubscription) {
      return
    }
    setSubscriptionForm({
      plan: activeSubscription.plan,
      agreed_price: activeSubscription.agreed_price,
      start_date: activeSubscription.start_date,
      next_billing_date: activeSubscription.next_billing_date,
      recurrence_type: activeSubscription.recurrence_type,
      grace_period_days: activeSubscription.grace_period_days,
      auto_generate_next: activeSubscription.auto_generate_next,
      is_active: activeSubscription.is_active,
      status: activeSubscription.status,
      renewal_date: activeSubscription.renewal_date || activeSubscription.next_billing_date,
      cancellation_date: activeSubscription.cancellation_date || '',
      cancellation_reason: activeSubscription.cancellation_reason,
      commercial_notes: activeSubscription.commercial_notes,
    })
  }, [activeSubscription])

  const beginPlanEdit = (plan: MembershipPlan) => {
    setSelectedPlanId(plan.id)
    setPlanForm({
      name: plan.name,
      description: plan.description,
      price: plan.price,
      recurrence_type: plan.recurrence_type,
      grace_period_days: plan.grace_period_days,
      features: plan.features,
      is_active: plan.is_active ?? true,
    })
  }

  const handlePlanSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const payload = {
      ...planForm,
      price: planForm.price,
      grace_period_days: Number(planForm.grace_period_days),
    }
    if (selectedPlanId) {
      updatePlan.mutate({ id: selectedPlanId, payload })
      return
    }
    createPlan.mutate(payload)
  }

  const handleSubscriptionSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!memberIdNumber || !subscriptionForm.plan) {
      return
    }
    const payload = {
      member: memberIdNumber,
      plan: subscriptionForm.plan,
      agreed_price: subscriptionForm.agreed_price,
      start_date: subscriptionForm.start_date,
      next_billing_date: subscriptionForm.next_billing_date,
      recurrence_type: subscriptionForm.recurrence_type,
      grace_period_days: Number(subscriptionForm.grace_period_days),
      auto_generate_next: subscriptionForm.auto_generate_next,
      is_active: subscriptionForm.is_active,
      status: subscriptionForm.status,
      renewal_date: subscriptionForm.renewal_date || null,
      cancellation_date: subscriptionForm.cancellation_date || null,
      cancellation_reason: subscriptionForm.cancellation_reason,
      commercial_notes: subscriptionForm.commercial_notes,
    }
    if (activeSubscription) {
      updateSubscription.mutate({ id: activeSubscription.id, payload })
      return
    }
    createSubscription.mutate(payload)
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
          isLoading={isLoadingMembersPortfolio}
        />
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

      <div className="mt-8">
        <h3 className="font-heading font-bold text-xl text-neutral-900 dark:text-white mb-4">
          Planes de membresía configurables
        </h3>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans?.results.length ? plans.results.map((plan) => (
              <button
                key={plan.id}
                type="button"
                className="card p-5 text-left"
                data-testid={`plan-card-${plan.id}`}
                onClick={() => beginPlanEdit(plan)}
              >
                <h4 className="font-heading font-bold text-lg text-neutral-900 dark:text-white mb-1">{plan.name}</h4>
                <p className="text-2xl font-heading font-black text-primary mb-2">
                  {formatCurrency(plan.price)}<span className="text-sm font-body font-normal text-neutral-400"> / {RECURRENCE_TYPE_LABELS[plan.recurrence_type].toLowerCase()}</span>
                </p>
                {plan.description && <p className="text-xs text-neutral-500 mb-2">{plan.description}</p>}
                {plan.features && <p className="text-xs text-neutral-400">{plan.features}</p>}
                <div className="mt-3">
                  <Badge variant={plan.is_active === false ? 'warning' : 'success'}>
                    {plan.is_active === false ? 'Inactivo' : 'Activo'}
                  </Badge>
                </div>
              </button>
            )) : (
              <div className="md:col-span-3">
                <EmptyState
                  icon={<CreditCard size={32} />}
                  title="Sin planes configurados"
                  description="Crea tu primer plan comercial para empezar a suscribir members con precio negociable."
                />
              </div>
            )}
          </div>

          <form className="card p-5 space-y-3" onSubmit={handlePlanSubmit}>
            <h4 className="font-heading font-bold text-lg text-neutral-900 dark:text-white">
              {selectedPlan ? 'Editar plan comercial' : 'Nuevo plan comercial'}
            </h4>
            <input className="input" placeholder="Nombre" value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })} required />
            <textarea className="input min-h-24" placeholder="Descripción" value={planForm.description} onChange={(event) => setPlanForm({ ...planForm, description: event.target.value })} />
            <input className="input" type="number" min={0} placeholder="Precio del periodo" value={planForm.price} onChange={(event) => setPlanForm({ ...planForm, price: event.target.value })} required />
            <select
              className="input"
              value={planForm.recurrence_type}
              onChange={(event) => {
                const recurrence = event.target.value as MembershipPlan['recurrence_type']
                const graceDefaults: Record<MembershipPlan['recurrence_type'], number> = {
                  daily: 0, weekly: 1, biweekly: 2, monthly: 7, quarterly: 7, annual: 7,
                }
                setPlanForm({ ...planForm, recurrence_type: recurrence, grace_period_days: graceDefaults[recurrence] })
              }}
              data-testid="plan-recurrence-select"
            >
              {Object.entries(RECURRENCE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <input className="input" type="number" min={0} placeholder="Días de tolerancia" value={planForm.grace_period_days} onChange={(event) => setPlanForm({ ...planForm, grace_period_days: Number(event.target.value) })} required />
            <textarea className="input min-h-24" placeholder="Beneficios / features" value={planForm.features} onChange={(event) => setPlanForm({ ...planForm, features: event.target.value })} />
            <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              <input type="checkbox" checked={planForm.is_active} onChange={(event) => setPlanForm({ ...planForm, is_active: event.target.checked })} />
              Plan de membresía activo
            </label>
            <div className="flex justify-end gap-2">
              {selectedPlan ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setSelectedPlanId(null)
                    setPlanForm({ name: '', description: '', price: '0', recurrence_type: 'monthly', grace_period_days: 7, features: '', is_active: true })
                  }}
                >
                  Nuevo
                </button>
              ) : null}
              <button className="btn-primary" type="submit">
                {selectedPlan ? 'Guardar plan de membresía' : 'Crear plan de membresía'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {memberId && (
        <div className="mt-8">
          <h3 className="font-heading font-bold text-xl text-neutral-900 dark:text-white mb-4">
            Membresía del miembro
          </h3>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="card p-5">
              <h4 className="font-heading font-bold text-lg text-neutral-900 dark:text-white mb-3">Estado actual</h4>
              {activeSubscription ? (
                <div className="space-y-3">
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    Plan de membresía: <span className="font-semibold text-neutral-900 dark:text-white">{activeSubscription.plan_detail?.name || activeSubscription.plan}</span>
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    Precio acordado: <span className="font-semibold text-neutral-900 dark:text-white">{formatCurrency(activeSubscription.agreed_price)}</span>
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    Recurrencia: <span className="font-semibold text-neutral-900 dark:text-white">{RECURRENCE_TYPE_LABELS[activeSubscription.recurrence_type]}</span>
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    Próximo cobro: <span className="font-semibold text-neutral-900 dark:text-white">{formatDate(activeSubscription.next_billing_date)}</span>
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    Renovación comercial: <span className="font-semibold text-neutral-900 dark:text-white">{activeSubscription.renewal_date ? formatDate(activeSubscription.renewal_date) : 'Sin fecha'}</span>
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    Vigencia pagada: <span className="font-semibold text-neutral-900 dark:text-white">{activeSubscription.current_period_end ? `hasta ${formatDate(activeSubscription.current_period_end)}` : 'Pendiente del primer pago'}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={SUBSCRIPTION_STATUS_VARIANT[activeSubscription.status]}>
                      {SUBSCRIPTION_STATUS_LABELS[activeSubscription.status]}
                    </Badge>
                    <Badge variant={activeSubscription.is_active ? 'success' : 'warning'}>
                      {activeSubscription.is_active ? 'Cobro habilitado' : 'Cobro pausado'}
                    </Badge>
                  </div>
                  {activeSubscription.cancellation_reason && (
                    <p className="text-xs text-neutral-500">
                      Motivo de cancelación: {activeSubscription.cancellation_reason}
                    </p>
                  )}
                  {activeSubscription.commercial_notes && (
                    <p className="text-xs text-neutral-500">
                      Nota comercial: {activeSubscription.commercial_notes}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-neutral-500">Este miembro todavía no tiene una membresía comercial creada.</p>
              )}
            </div>

            <form className="card p-5 space-y-3" onSubmit={handleSubscriptionSubmit}>
              <h4 className="font-heading font-bold text-lg text-neutral-900 dark:text-white">
                {activeSubscription ? 'Actualizar membresía del miembro' : 'Crear membresía del miembro'}
              </h4>
              <select
                className="input"
                data-testid="subscription-plan-select"
                value={subscriptionForm.plan}
                onChange={(event) => {
                  const nextPlanId = Number(event.target.value)
                  const nextPlan = plans?.results.find((plan) => plan.id === nextPlanId)
                  setSubscriptionForm({
                    ...subscriptionForm,
                    plan: nextPlanId,
                    agreed_price: nextPlan?.price ?? subscriptionForm.agreed_price,
                    recurrence_type: nextPlan?.recurrence_type ?? subscriptionForm.recurrence_type,
                    grace_period_days: nextPlan?.grace_period_days ?? subscriptionForm.grace_period_days,
                  })
                }}
              >
                <option value={0}>Selecciona un plan de membresía</option>
                {plans?.results.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} · {formatCurrency(plan.price)} / {RECURRENCE_TYPE_LABELS[plan.recurrence_type].toLowerCase()}
                  </option>
                ))}
              </select>
              <input
                className="input"
                data-testid="subscription-agreed-price-input"
                type="number"
                min={0}
                placeholder="Precio acordado"
                value={subscriptionForm.agreed_price}
                onChange={(event) => setSubscriptionForm({ ...subscriptionForm, agreed_price: event.target.value })}
                required
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input className="input" type="date" value={subscriptionForm.start_date} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, start_date: event.target.value })} required />
                <input className="input" type="date" value={subscriptionForm.next_billing_date} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, next_billing_date: event.target.value })} required />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <select
                  className="input"
                  data-testid="subscription-recurrence-select"
                  value={subscriptionForm.recurrence_type}
                  disabled
                  title="La recurrencia se define en el plan comercial"
                  aria-label="Recurrencia del plan de membresía"
                >
                  <option value="daily">Diario</option>
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quincenal</option>
                  <option value="monthly">Mensual</option>
                  <option value="quarterly">Trimestral</option>
                  <option value="annual">Anual</option>
                </select>
                <input className="input" type="number" min={0} value={subscriptionForm.grace_period_days} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, grace_period_days: Number(event.target.value) })} />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <select className="input" value={subscriptionForm.status} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, status: event.target.value as MemberSubscription['status'] })}>
                  <option value="active">Activa</option>
                  <option value="past_due">Con mora</option>
                  <option value="suspended">Suspendida</option>
                  <option value="cancelled">Cancelada</option>
                </select>
                <input className="input" type="date" value={subscriptionForm.renewal_date} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, renewal_date: event.target.value })} />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input className="input" type="date" value={subscriptionForm.cancellation_date} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, cancellation_date: event.target.value })} />
                <input className="input" placeholder="Motivo de cancelación" value={subscriptionForm.cancellation_reason} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, cancellation_reason: event.target.value })} />
              </div>
              <textarea className="input min-h-24" placeholder="Notas comerciales" value={subscriptionForm.commercial_notes} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, commercial_notes: event.target.value })} />
              <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                <input type="checkbox" checked={subscriptionForm.auto_generate_next} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, auto_generate_next: event.target.checked })} />
                Generar próximo cobro automáticamente
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                <input type="checkbox" checked={subscriptionForm.is_active} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, is_active: event.target.checked })} />
                Suscripción operativa
              </label>
              <div className="flex justify-end">
                <button className="btn-primary" type="submit">
                  {activeSubscription ? 'Guardar membresía' : 'Crear membresía'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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

function MembershipPortfolio({ members, isLoading }: { members: MemberProfile[]; isLoading: boolean }) {
  const membersWithMembership = members.filter((member) => Boolean(member.membresia_actual))
  const membersWithPlanWithoutSubscription = members.filter((member) => !member.membresia_actual && hasAssignedMembershipPlan(member))
  const membersWithoutPlan = members.filter((member) => !member.membresia_actual && !hasAssignedMembershipPlan(member))
  const visibleMembers = [...membersWithMembership, ...membersWithPlanWithoutSubscription, ...membersWithoutPlan]

  return (
    <section className="card p-6 mb-8" data-testid="membership-portfolio">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <p className="label-base">Cartera de membresías</p>
          <h2 className="font-heading text-2xl font-black text-neutral-900 dark:text-white">
            Plan y estado por miembro
          </h2>
          <p className="text-sm text-neutral-500">
            Revisa rápidamente qué plan tiene cada persona, cuánto paga y cuándo vence.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="info">{membersWithMembership.length} con membresía</Badge>
          {membersWithPlanWithoutSubscription.length > 0 && (
            <Badge variant="warning">{membersWithPlanWithoutSubscription.length} con plan sin cobro</Badge>
          )}
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
          title="Sin miembros para mostrar"
          description="Cuando existan miembros asignados, aparecerán aquí con su información de membresía."
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
  const badge = membership
    ? getMembershipBadge(membership)
    : hasAssignedMembershipPlan(member)
      ? { label: 'Plan sin cobro', variant: 'warning' as const }
      : getMembershipBadge(membership)

  return (
    <div className="rounded-sm border border-neutral-200 p-4 dark:border-neutral-800" data-testid={`portfolio-member-${member.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-neutral-900 dark:text-white">{member.full_name}</h3>
          <p className="text-xs text-neutral-500">{member.email}</p>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <PortfolioMetric label="Plan" value={getPortfolioPlanName(member)} />
        <PortfolioMetric
          label="Precio"
          value={membership ? `${formatCurrency(membership.agreed_price)} / ${RECURRENCE_SHORT_LABELS[membership.recurrence_type]}` : hasAssignedMembershipPlan(member) ? 'Pendiente de suscripción' : 'Sin precio'}
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
                : hasAssignedMembershipPlan(member)
                  ? 'Tiene plan asignado, falta crear cobro.'
                  : 'Debe crearse una membresía comercial.'}
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
  const badgeVariant = record.status === 'paid' ? 'success' : record.status === 'late' ? 'error' : 'warning'
  const statusLabel = record.status === 'paid' ? 'Pagado' : record.status === 'late' ? 'En mora' : 'Pendiente'

  return (
    <tr className="tr-hover align-top" data-testid={`payment-row-${record.id}`}>
      <td className="td-base font-mono text-xs text-neutral-400">#{record.id}</td>
      <td className="td-base font-semibold text-neutral-900 dark:text-white">
        <div>{formatCurrency(record.amount)}</div>
        <div className="text-xs text-neutral-400">{record.plan_name || 'Sin plan de membresía'}</div>
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
