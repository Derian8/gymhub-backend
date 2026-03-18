import { CreditCard, Calendar, DollarSign, TrendingUp } from 'lucide-react'
import { usePaymentRecordsQuery, useMembershipPlansQuery, usePaymentSchedulesQuery } from '../hooks/useBilling'
import { Badge, PageHeader, EmptyState } from '@/shared/components/UI'
import { TableRowSkeleton } from '@/shared/components/Skeleton'
import { formatDate, formatCurrency, PAYMENT_STATUS_CLASS } from '@/shared/lib/utils'
import type { PaymentRecord } from '@/shared/types'

export function BillingPage() {
  const { data: records, isLoading } = usePaymentRecordsQuery()
  const { data: plans } = useMembershipPlansQuery()
  const { data: schedules } = usePaymentSchedulesQuery()

  const totalPaid = records?.results
    .filter((r) => r.status === 'paid')
    .reduce((sum, r) => sum + parseFloat(r.amount), 0) || 0

  const pendingCount = records?.results.filter((r) => r.status === 'pending').length || 0
  const lateCount = records?.results.filter((r) => r.status === 'late').length || 0

  return (
    <div data-testid="billing-page" className="page-enter">
      <PageHeader title="Facturación" subtitle="Pagos, estados y vencimientos" />

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

      {/* Membership plans */}
      {plans?.results && plans.results.length > 0 && (
        <div className="mt-8">
          <h3 className="font-heading font-bold text-xl text-neutral-900 dark:text-white mb-4">
            Planes de membresía disponibles
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.results.map((plan) => (
              <div key={plan.id} className="card p-5" data-testid={`plan-card-${plan.id}`}>
                <h4 className="font-heading font-bold text-lg text-neutral-900 dark:text-white mb-1">{plan.name}</h4>
                <p className="text-2xl font-heading font-black text-primary mb-2">
                  {formatCurrency(plan.price_monthly)}<span className="text-sm font-body font-normal text-neutral-400">/mes</span>
                </p>
                {plan.description && (
                  <p className="text-xs text-neutral-500 mb-2">{plan.description}</p>
                )}
                {plan.features && (
                  <p className="text-xs text-neutral-400">{plan.features}</p>
                )}
              </div>
            ))}
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
