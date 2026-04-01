import { useSearchParams } from 'react-router-dom'
import { CreditCard, Calendar, DollarSign, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  useCreateMemberSubscriptionMutation,
  useCreateMembershipPlanMutation,
  useMemberSubscriptionsQuery,
  useMembershipPlansQuery,
  usePaymentRecordsQuery,
  usePaymentSchedulesQuery,
  useUpdateMemberSubscriptionMutation,
  useUpdateMembershipPlanMutation,
} from '../hooks/useBilling'
import { Badge, PageHeader, EmptyState } from '@/shared/components/UI'
import { TableRowSkeleton } from '@/shared/components/Skeleton'
import { formatDate, formatCurrency } from '@/shared/lib/utils'
import type { MemberSubscription, MembershipPlan, PaymentRecord } from '@/shared/types'

export function BillingPage() {
  const [searchParams] = useSearchParams()
  const memberId = searchParams.get('member')
  const filtros = memberId ? { member: memberId } : undefined
  const { data: records, isLoading } = usePaymentRecordsQuery(filtros)
  const { data: plans } = useMembershipPlansQuery()
  usePaymentSchedulesQuery(filtros)
  const { data: subscriptions } = useMemberSubscriptionsQuery(filtros)
  const createPlan = useCreateMembershipPlanMutation()
  const updatePlan = useUpdateMembershipPlanMutation()
  const createSubscription = useCreateMemberSubscriptionMutation(memberId ? Number(memberId) : undefined)
  const updateSubscription = useUpdateMemberSubscriptionMutation(memberId ? Number(memberId) : undefined)
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
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
    recurrence_type: 'monthly' as 'monthly' | 'quarterly' | 'annual',
    grace_period_days: 7,
    auto_generate_next: true,
    is_active: true,
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
    if (activeSubscription) {
      setSubscriptionForm({
        plan: activeSubscription.plan,
        agreed_price: activeSubscription.agreed_price,
        start_date: activeSubscription.start_date,
        next_billing_date: activeSubscription.next_billing_date,
        recurrence_type: activeSubscription.recurrence_type,
        grace_period_days: activeSubscription.grace_period_days,
        auto_generate_next: activeSubscription.auto_generate_next,
        is_active: activeSubscription.is_active,
      })
    }
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

  const handlePlanSubmit = (event: React.FormEvent<HTMLFormElement>) => {
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

  const handleSubscriptionSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!memberId || !subscriptionForm.plan) {
      return
    }
    const payload = {
      member: Number(memberId),
      plan: subscriptionForm.plan,
      agreed_price: subscriptionForm.agreed_price,
      start_date: subscriptionForm.start_date,
      next_billing_date: subscriptionForm.next_billing_date,
      recurrence_type: subscriptionForm.recurrence_type,
      grace_period_days: Number(subscriptionForm.grace_period_days),
      auto_generate_next: subscriptionForm.auto_generate_next,
      is_active: subscriptionForm.is_active,
    }
    if (activeSubscription) {
      updateSubscription.mutate({ id: activeSubscription.id, payload })
      return
    }
    createSubscription.mutate(payload)
  }

  const totalPaid = records?.results
    .filter((r) => r.status === 'paid')
    .reduce((sum, r) => sum + parseFloat(r.amount), 0) || 0

  const pendingCount = records?.results.filter((r) => r.status === 'pending').length || 0
  const lateCount = records?.results.filter((r) => r.status === 'late').length || 0

  return (
    <div data-testid="billing-page" className="page-enter">
      <PageHeader
        title={memberId ? 'Facturación Del Miembro' : 'Facturación'}
        subtitle={memberId ? 'Pagos, estados y vencimientos del miembro seleccionado' : 'Pagos, estados y vencimientos'}
      />

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="stat-card">
          <div className="flex justify-between items-center">
            <span className="label-base">Total cobrado</span>
            <DollarSign size={18} className="text-green-400" />
          </div>
          <span className="text-3xl font-heading font-black text-neutral-900 dark:text-white">
            {formatCurrency(totalPaid)}
          </span>
        </div>
        <div className="stat-card">
          <div className="flex justify-between items-center">
            <span className="label-base">Pendientes</span>
            <Calendar size={18} className="text-yellow-400" />
          </div>
          <span className="text-3xl font-heading font-black text-yellow-500">{pendingCount}</span>
        </div>
        <div className="stat-card border-red-500/20">
          <div className="flex justify-between items-center">
            <span className="label-base">En mora</span>
            <TrendingUp size={18} className="text-red-400" />
          </div>
          <span className="text-3xl font-heading font-black text-red-500">{lateCount}</span>
        </div>
      </div>

      {/* Payment records */}
      <h3 className="font-heading font-bold text-xl text-neutral-900 dark:text-white mb-4">
        Registros de pago
      </h3>

      {isLoading ? (
        <div className="table-container">
          <table className="table-base">
            <tbody>{Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} cols={5} />)}</tbody>
          </table>
        </div>
      ) : !records?.results.length ? (
        <EmptyState
          icon={<CreditCard size={40} />}
          title="Sin registros de pago"
          description="Los pagos aparecerán aquí cuando se generen."
        />
      ) : (
        <div className="table-container">
          <table className="table-base">
            <thead>
              <tr>
                <th className="th-base">#</th>
                <th className="th-base">Monto</th>
                <th className="th-base">Estado</th>
                <th className="th-base hidden md:table-cell">Fecha pago</th>
                <th className="th-base">Notas</th>
              </tr>
            </thead>
            <tbody>
              {records.results.map((record) => (
                <PaymentRow key={record.id} record={record} />
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
                {plan.description && (
                  <p className="text-xs text-neutral-500 mb-2">{plan.description}</p>
                )}
                {plan.features && (
                  <p className="text-xs text-neutral-400">{plan.features}</p>
                )}
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
            <input className="input" placeholder="Nombre" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} required />
            <textarea className="input min-h-24" placeholder="Descripción" value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} />
            <input className="input" type="number" min={0} placeholder="Precio base mensual" value={planForm.price_monthly} onChange={(e) => setPlanForm({ ...planForm, price_monthly: e.target.value })} required />
            <input className="input" type="number" min={1} max={12} placeholder="Duración en meses" value={planForm.duration_months} onChange={(e) => setPlanForm({ ...planForm, duration_months: Number(e.target.value) })} required />
            <textarea className="input min-h-24" placeholder="Beneficios / features" value={planForm.features} onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })} />
            <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              <input type="checkbox" checked={planForm.is_active} onChange={(e) => setPlanForm({ ...planForm, is_active: e.target.checked })} />
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
                <div className="space-y-2">
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    Plan: <span className="font-semibold text-neutral-900 dark:text-white">{activeSubscription.plan_detail?.name || activeSubscription.plan}</span>
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    Precio acordado: <span className="font-semibold text-neutral-900 dark:text-white">{formatCurrency(activeSubscription.agreed_price)}</span>
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    Próximo cobro: <span className="font-semibold text-neutral-900 dark:text-white">{formatDate(activeSubscription.next_billing_date)}</span>
                  </p>
                  <Badge variant={activeSubscription.is_active ? 'success' : 'warning'}>
                    {activeSubscription.is_active ? 'Suscripción activa' : 'Suscripción inactiva'}
                  </Badge>
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
                onChange={(e) => {
                  const nextPlanId = Number(e.target.value)
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
              <input className="input" data-testid="subscription-agreed-price-input" type="number" min={0} placeholder="Precio acordado" value={subscriptionForm.agreed_price} onChange={(e) => setSubscriptionForm({ ...subscriptionForm, agreed_price: e.target.value })} required />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input className="input" type="date" value={subscriptionForm.start_date} onChange={(e) => setSubscriptionForm({ ...subscriptionForm, start_date: e.target.value })} required />
                <input className="input" type="date" value={subscriptionForm.next_billing_date} onChange={(e) => setSubscriptionForm({ ...subscriptionForm, next_billing_date: e.target.value })} required />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <select className="input" value={subscriptionForm.recurrence_type} onChange={(e) => setSubscriptionForm({ ...subscriptionForm, recurrence_type: e.target.value as MemberSubscription['recurrence_type'] })}>
                  <option value="monthly">Mensual</option>
                  <option value="quarterly">Trimestral</option>
                  <option value="annual">Anual</option>
                </select>
                <input className="input" type="number" min={0} value={subscriptionForm.grace_period_days} onChange={(e) => setSubscriptionForm({ ...subscriptionForm, grace_period_days: Number(e.target.value) })} />
              </div>
              <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                <input type="checkbox" checked={subscriptionForm.auto_generate_next} onChange={(e) => setSubscriptionForm({ ...subscriptionForm, auto_generate_next: e.target.checked })} />
                Generar próximo cobro automáticamente
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

function PaymentRow({ record }: { record: PaymentRecord }) {
  const badgeVariant = record.status === 'paid' ? 'success' : record.status === 'late' ? 'error' : 'warning'
  const statusLabel = record.status === 'paid' ? 'Pagado' : record.status === 'late' ? 'En mora' : 'Pendiente'

  return (
    <tr className="tr-hover" data-testid={`payment-row-${record.id}`}>
      <td className="td-base font-mono text-xs text-neutral-400">#{record.id}</td>
      <td className="td-base font-semibold text-neutral-900 dark:text-white">{formatCurrency(record.amount)}</td>
      <td className="td-base">
        <Badge variant={badgeVariant}>{statusLabel}</Badge>
      </td>
      <td className="td-base hidden md:table-cell text-xs">{record.paid_at ? formatDate(record.paid_at) : '—'}</td>
      <td className="td-base text-xs text-neutral-400">{record.notes || '—'}</td>
    </tr>
  )
}
