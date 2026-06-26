import { useSearchParams } from 'react-router-dom'
import { CreditCard, Calendar, DollarSign, ReceiptText, TrendingUp } from 'lucide-react'
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
import { Badge, EmptyState, PageHeader } from '@/shared/components/UI'
import { TableRowSkeleton } from '@/shared/components/Skeleton'
import { formatCurrency, formatDate } from '@/shared/lib/utils'
import type { MemberSubscription, MembershipPlan, PaymentRecord } from '@/shared/types'

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

export function BillingPage() {
  const [searchParams] = useSearchParams()
  const memberId = searchParams.get('member')
  const filtros = memberId ? { member: memberId } : undefined
  const memberIdNumber = memberId ? Number(memberId) : undefined
  const { data: records, isLoading } = usePaymentRecordsQuery(filtros)
  const { data: plans } = useMembershipPlansQuery()
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
    price_monthly: '0',
    duration_months: 1,
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
      price_monthly: plan.price_monthly,
      duration_months: plan.duration_months,
      features: plan.features,
      is_active: plan.is_active ?? true,
    })
  }

  const handlePlanSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const payload = {
      ...planForm,
      price_monthly: planForm.price_monthly,
      duration_months: Number(planForm.duration_months),
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
        title={memberId ? 'Facturación Del Miembro' : 'Facturación'}
        subtitle={memberId ? 'Cobros, recibos y estado comercial del miembro seleccionado' : 'Cobros, recibos y vencimientos de la cartera'}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <SummaryCard label="Total cobrado" value={formatCurrency(totalPaid)} icon={<DollarSign size={18} className="text-green-400" />} />
        <SummaryCard label="Pendientes" value={String(pendingCount)} icon={<Calendar size={18} className="text-yellow-400" />} />
        <SummaryCard label="En mora" value={String(lateCount)} icon={<TrendingUp size={18} className="text-red-400" />} accentClass="border-red-500/20" valueClassName="text-red-500" />
        <SummaryCard label="Recibos emitidos" value={String(receiptsIssued)} icon={<ReceiptText size={18} className="text-sky-400" />} />
      </div>

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
          Planes configurables del trainer
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
                  {formatCurrency(plan.price_monthly)}<span className="text-sm font-body font-normal text-neutral-400"> base</span>
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
            <input className="input" type="number" min={0} placeholder="Precio base mensual" value={planForm.price_monthly} onChange={(event) => setPlanForm({ ...planForm, price_monthly: event.target.value })} required />
            <input className="input" type="number" min={1} max={12} placeholder="Duración en meses" value={planForm.duration_months} onChange={(event) => setPlanForm({ ...planForm, duration_months: Number(event.target.value) })} required />
            <textarea className="input min-h-24" placeholder="Beneficios / features" value={planForm.features} onChange={(event) => setPlanForm({ ...planForm, features: event.target.value })} />
            <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              <input type="checkbox" checked={planForm.is_active} onChange={(event) => setPlanForm({ ...planForm, is_active: event.target.checked })} />
              Plan activo
            </label>
            <div className="flex justify-end gap-2">
              {selectedPlan ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setSelectedPlanId(null)
                    setPlanForm({ name: '', description: '', price_monthly: '0', duration_months: 1, features: '', is_active: true })
                  }}
                >
                  Nuevo
                </button>
              ) : null}
              <button className="btn-primary" type="submit">
                {selectedPlan ? 'Guardar plan' : 'Crear plan'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {memberId && (
        <div className="mt-8">
          <h3 className="font-heading font-bold text-xl text-neutral-900 dark:text-white mb-4">
            Suscripción del member
          </h3>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="card p-5">
              <h4 className="font-heading font-bold text-lg text-neutral-900 dark:text-white mb-3">Estado actual</h4>
              {activeSubscription ? (
                <div className="space-y-3">
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    Plan: <span className="font-semibold text-neutral-900 dark:text-white">{activeSubscription.plan_detail?.name || activeSubscription.plan}</span>
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
                <p className="text-sm text-neutral-500">Este member todavía no tiene una suscripción creada.</p>
              )}
            </div>

            <form className="card p-5 space-y-3" onSubmit={handleSubscriptionSubmit}>
              <h4 className="font-heading font-bold text-lg text-neutral-900 dark:text-white">
                {activeSubscription ? 'Actualizar suscripción' : 'Crear suscripción'}
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
                    agreed_price: nextPlan?.price_monthly ?? subscriptionForm.agreed_price,
                  })
                }}
              >
                <option value={0}>Selecciona un plan</option>
                {plans?.results.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} · base {formatCurrency(plan.price_monthly)}
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
                  onChange={(event) => setSubscriptionForm({ ...subscriptionForm, recurrence_type: event.target.value as MemberSubscription['recurrence_type'] })}
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
                  {activeSubscription ? 'Guardar suscripción' : 'Crear suscripción'}
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
        <div className="text-xs text-neutral-400">{record.plan_name || 'Sin plan'}</div>
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
