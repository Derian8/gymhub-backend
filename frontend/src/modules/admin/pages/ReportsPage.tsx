import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, DoorOpen, ReceiptText, ShieldAlert, Users } from 'lucide-react'
import { adminApi } from '../api/adminApi'
import { useAdminReport, useCollectionFollowUpMutation } from '../hooks/useAdminReport'
import { PageHeader, StatCard } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { formatCurrency, formatDate } from '@/shared/lib/utils'

function initialFilters() {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  return {
    fecha_inicio: `${today.slice(0, 7)}-01`,
    fecha_fin: today,
  }
}

export function ReportsPage() {
  const [filters, setFilters] = useState(initialFilters)
  const { data, isLoading } = useAdminReport(filters)
  const followUp = useCollectionFollowUpMutation()

  return (
    <div className="page-enter space-y-8">
      <PageHeader title="Reportes" subtitle="Control comercial y de accesos físicos con exportes del período seleccionado." />
      <section className="card flex flex-wrap items-end gap-4 p-5">
        <label><span className="label-base">Desde</span><input className="input-base mt-2 block" type="date" value={filters.fecha_inicio} onChange={(event) => setFilters((current) => ({ ...current, fecha_inicio: event.target.value }))} /></label>
        <label><span className="label-base">Hasta</span><input className="input-base mt-2 block" type="date" value={filters.fecha_fin} onChange={(event) => setFilters((current) => ({ ...current, fecha_fin: event.target.value }))} /></label>
        <div className="ml-auto flex flex-wrap gap-2">
          <a className="btn-secondary" href={adminApi.exportUrl(filters, 'csv', 'pagos')}><Download size={16} /> CSV pagos</a>
          <a className="btn-secondary" href={adminApi.exportUrl(filters, 'csv', 'accesos')}><Download size={16} /> CSV accesos</a>
          <a className="btn-primary" href={adminApi.exportUrl(filters, 'pdf')}><ReceiptText size={16} /> PDF</a>
        </div>
      </section>

      {isLoading || !data ? <CardSkeleton lines={8} /> : (
        <>
          <section>
            <h2 className="mb-4 text-xl font-bold text-neutral-900 dark:text-white">Control de ingresos</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Cobrado" value={formatCurrency(data.commercial.collected)} variant="success" />
              <StatCard label="Esperado" value={formatCurrency(data.commercial.expected)} />
              <StatCard label="Pendiente" value={formatCurrency(data.commercial.pending)} variant="warning" />
              <StatCard label="Vencido" value={formatCurrency(data.commercial.overdue)} variant="danger" />
            </div>
          </section>
          <section>
            <h2 className="mb-4 text-xl font-bold text-neutral-900 dark:text-white">Control de accesos</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Entradas" value={data.access.entries} icon={<DoorOpen size={18} />} variant="info" />
              <StatCard label="Clientes únicos" value={data.access.unique_clients} icon={<Users size={18} />} />
              <StatCard label="Excepciones" value={data.access.exceptions} icon={<ShieldAlert size={18} />} variant="warning" />
              <StatCard label="Intentos rechazados" value={data.access.denied_attempts} icon={<ShieldAlert size={18} />} variant="danger" />
            </div>
          </section>
          <section className="card overflow-x-auto p-6">
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Cuentas que requieren seguimiento</h2>
            <table className="mt-5 w-full min-w-[680px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-neutral-500"><tr><th className="py-3">Cliente</th><th>Vencimiento</th><th>Días</th><th>Monto</th><th>Seguimiento</th><th>Acciones</th></tr></thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {data.alerts.map((alert) => <tr key={alert.payment_id}>
                  <td className="py-3 font-semibold">{alert.member_name}</td>
                  <td>{formatDate(alert.due_date)}</td>
                  <td>{alert.days_overdue}</td>
                  <td>{formatCurrency(alert.amount)}</td>
                  <td className="capitalize">{alert.follow_up_status.replace('_', ' ')}</td>
                  <td><div className="flex flex-wrap gap-2 py-2">
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={followUp.isPending || alert.follow_up_status === 'en_seguimiento'}
                      onClick={() => followUp.mutate({
                        id: alert.follow_up_id,
                        cliente: alert.member_id,
                        estado: 'en_seguimiento',
                        nota: 'Seguimiento iniciado desde el reporte administrativo.',
                      })}
                    >
                      En seguimiento
                    </button>
                    <Link className="btn-primary" to={`/billing?member=${alert.member_id}&payment=${alert.payment_id}`}>Registrar pago</Link>
                    <Link className="btn-secondary" to={`/members/${alert.member_id}`}>Revisar / baja</Link>
                  </div></td>
                </tr>)}
                {!data.alerts.length ? <tr><td className="py-6 text-neutral-500" colSpan={6}>No hay cobros vencidos pendientes de seguimiento.</td></tr> : null}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  )
}
