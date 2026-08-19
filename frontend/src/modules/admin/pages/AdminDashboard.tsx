import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, BarChart3, CalendarClock, CheckCircle2, CheckSquare, ClipboardList, Dumbbell, UserPlus, Users } from 'lucide-react'
import { PageHeader } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { formatCurrency, formatDate } from '@/shared/lib/utils'
import type { AdminRoutineQueueItem } from '@/shared/types'
import { QuickRoutineAssignmentModal } from '@/modules/plans/components/QuickRoutineAssignmentModal'
import { useAdminDashboard } from '../hooks/useAdminReport'

type PaymentTab = 'overdue' | 'due_soon' | 'current'

export function AdminDashboard() {
  const { data, isLoading } = useAdminDashboard()
  const [paymentTab, setPaymentTab] = useState<PaymentTab>('overdue')
  const [routineClient, setRoutineClient] = useState<AdminRoutineQueueItem | null>(null)

  return (
    <div className="page-enter space-y-8" data-testid="admin-dashboard">
      <PageHeader
        title="Control del gimnasio"
        subtitle="Primero cobros y clientes al día; después rutinas y seguimiento."
      />

      <Link
        to="/members/new"
        className="btn-primary flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base tracking-[0.12em]"
        data-testid="admin-register-and-charge"
      >
        <UserPlus size={19} /> Registrar y cobrar
      </Link>

      {isLoading || !data ? <CardSkeleton lines={8} /> : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-label="Resumen comercial">
            <CompactMetric
              to="/members"
              label="Clientes activos"
              value={data.commercial.active_clients}
              detail="Perfiles activos"
              icon={<Users size={17} />}
              variant="info"
            />
            <CompactMetric
              to="/members?commercial_status=al_dia"
              label="Clientes al día"
              value={data.commercial.current_clients}
              detail={`${data.commercial.current_clients_pct}% del total`}
              icon={<CheckCircle2 size={17} />}
              variant="success"
            />
            <CompactMetric
              to="/members?payment_status=pending"
              label="Pendientes por cobrar"
              value={data.commercial.due_soon_count}
              detail={formatCurrency(data.commercial.due_soon_amount)}
              icon={<CalendarClock size={17} />}
              variant="warning"
            />
            <CompactMetric
              to="/members?payment_status=late"
              label="Cobros vencidos"
              value={data.commercial.overdue_count}
              detail={formatCurrency(data.commercial.overdue_amount)}
              icon={<Banknote size={17} />}
              variant="danger"
            />
          </section>

          <section aria-label="Accesos directos" className="space-y-3">
            <div>
              <p className="label-base">Navegación rápida</p>
              <h2 className="mt-1 text-xl font-heading font-bold text-neutral-900 dark:text-white">Pantallas activas</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <QuickLink to="/members" icon={<Users size={20} />} title="Clientes" description="Gestionar clientes" />
              <QuickLink to="/billing" icon={<Banknote size={20} />} title="Pagos" description="Cartera y cobros" />
              <QuickLink to="/routines" icon={<Dumbbell size={20} />} title="Rutinas" description="Rutinas activas" />
              <QuickLink to="/attendance" icon={<CheckSquare size={20} />} title="Accesos" description="Entradas al gym" />
              <QuickLink to="/plans" icon={<ClipboardList size={20} />} title="Planes" description="Planes técnicos" />
              <QuickLink to="/reports" icon={<BarChart3 size={20} />} title="Reportes" description="Ver reportes" />
            </div>
          </section>

          <section className="card p-5 sm:p-6" data-testid="admin-payment-management">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="label-base">Prioridad comercial</p>
                <h2 className="mt-1 text-2xl font-heading font-bold">Gestión de pagos</h2>
                <p className="mt-1 text-sm text-neutral-500">Consulta la cartera y abre el cobro del cliente sin perder contexto.</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-3 py-2 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Cobrado este mes</p>
                  <p className="text-sm font-bold text-neutral-900 dark:text-white">{formatCurrency(data.commercial.collected_this_month)}</p>
                </div>
                <Link to="/billing" className="btn-secondary">Abrir cartera completa</Link>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Estado de pagos">
              <Tab active={paymentTab === 'overdue'} onClick={() => setPaymentTab('overdue')}>Vencidos ({data.commercial.overdue_count})</Tab>
              <Tab active={paymentTab === 'due_soon'} onClick={() => setPaymentTab('due_soon')}>Próximos ({data.commercial.due_soon_count})</Tab>
              <Tab active={paymentTab === 'current'} onClick={() => setPaymentTab('current')}>Al día ({data.commercial.current_clients})</Tab>
            </div>
            <div className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-800">
              {paymentTab === 'current' ? (
                data.payments.current.length ? data.payments.current.map((client) => (
                  <div key={client.member_id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div><p className="font-semibold">{client.member_name}</p><p className="text-xs text-emerald-600">Acceso vigente · sin mora</p></div>
                    <Link to={`/members/${client.member_id}`} className="btn-secondary text-sm">Ver cliente</Link>
                  </div>
                )) : <EmptyPayment text="Todavía no hay clientes al día." />
              ) : (
                data.payments[paymentTab].length ? data.payments[paymentTab].map((payment) => (
                  <div key={payment.payment_id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                    <div>
                      <p className="font-semibold">{payment.member_name}</p>
                      <p className="text-xs text-neutral-500">
                        {paymentTab === 'overdue'
                          ? `Venció ${formatDate(payment.due_date)} · ${payment.days_overdue} día(s)`
                          : `Vence ${formatDate(payment.due_date)} · faltan ${payment.days_until_due} día(s)`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold">{formatCurrency(payment.amount)}</span>
                      <Link to={`/billing?member=${payment.member_id}`} className="btn-primary text-sm">Registrar pago</Link>
                    </div>
                  </div>
                )) : <EmptyPayment text={paymentTab === 'overdue' ? 'No hay pagos vencidos.' : 'No hay cobros próximos durante los siguientes 7 días.'} />
              )}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <RoutineQueue
              title="Clientes sin rutina"
              subtitle={`${data.training.without_routine_count} cliente(s) requieren una rutina publicada.`}
              items={data.training.without_routine}
              empty="Todos los clientes tienen una rutina activa."
              onAssign={setRoutineClient}
            />
            <RoutineQueue
              title="Rutinas próximas a vencer"
              subtitle={`${data.training.ending_soon_count} rutina(s) terminan durante los próximos 14 días.`}
              items={data.training.ending_soon}
              empty="No hay rutinas próximas a vencer."
              onAssign={setRoutineClient}
            />
          </section>

        </>
      )}

      <QuickRoutineAssignmentModal client={routineClient} onClose={() => setRoutineClient(null)} />
    </div>
  )
}

function CompactMetric({ to, label, value, detail, icon, variant }: {
  to: string
  label: string
  value: number
  detail: string
  icon: React.ReactNode
  variant: 'danger' | 'success' | 'warning' | 'info'
}) {
  const tones = {
    danger: 'border-red-500/20 bg-red-500/[0.03] text-red-600 dark:text-red-400',
    success: 'border-green-500/20 bg-green-500/[0.03] text-green-600 dark:text-green-400',
    warning: 'border-yellow-500/25 bg-yellow-500/[0.04] text-yellow-700 dark:text-yellow-400',
    info: 'border-blue-500/20 bg-blue-500/[0.03] text-blue-600 dark:text-blue-400',
  }

  return (
    <Link to={to} aria-label={`${label}: ${value}`} className={`block min-w-0 rounded-2xl border p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-primary sm:p-4 ${tones[variant]}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[10px] font-semibold uppercase leading-tight tracking-wide text-neutral-500 sm:text-xs">{label}</p>
        <span className="shrink-0">{icon}</span>
      </div>
      <p className="mt-3 truncate text-2xl font-heading font-bold tracking-tight text-neutral-900 dark:text-white sm:text-3xl">{value}</p>
      <p className="mt-1 truncate text-[11px] text-neutral-500 sm:text-xs">{detail}</p>
      <span className="mt-2 inline-block text-[10px] font-bold uppercase tracking-wide text-primary">Ver detalle →</span>
    </Link>
  )
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={active ? 'btn-primary' : 'btn-secondary'}>{children}</button>
}

function EmptyPayment({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-neutral-500">{text}</p>
}

function RoutineQueue({ title, subtitle, items, empty, onAssign }: {
  title: string
  subtitle: string
  items: AdminRoutineQueueItem[]
  empty: string
  onAssign: (item: AdminRoutineQueueItem) => void
}) {
  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div><p className="label-base">Trabajo técnico</p><h2 className="mt-1 text-xl font-bold">{title}</h2><p className="mt-1 text-sm text-neutral-500">{subtitle}</p></div>
        <Dumbbell size={20} className="text-primary" />
      </div>
      <div className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-800">
        {items.length ? items.map((item) => (
          <div key={`${item.member_id}-${item.plan_id ?? 'none'}`} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="font-semibold">{item.member_name}</p>
              <p className="text-xs text-neutral-500">
                {item.end_date ? `${item.plan_name} · finaliza ${formatDate(item.end_date)}` : item.trainer_name || 'Sin entrenador asignado'}
              </p>
            </div>
            {item.can_publish ? (
              <button type="button" className="btn-primary text-sm" onClick={() => onAssign(item)}>{item.end_date ? 'Programar siguiente' : 'Asignar rutina'}</button>
            ) : (
              <Link to={`/billing?member=${item.member_id}`} className="btn-secondary text-sm">Regularizar pago</Link>
            )}
          </div>
        )) : <p className="py-8 text-center text-sm text-neutral-500">{empty}</p>}
      </div>
    </div>
  )
}

function QuickLink({ to, icon, title, description }: { to: string; icon: React.ReactNode; title: string; description: string }) {
  return (
    <Link to={to} className="card flex items-start gap-3 p-5 hover:border-primary">
      <span className="rounded-xl bg-primary/10 p-2 text-primary">{icon}</span>
      <span><strong className="block">{title}</strong><span className="mt-1 block text-sm text-neutral-500">{description}</span></span>
    </Link>
  )
}
