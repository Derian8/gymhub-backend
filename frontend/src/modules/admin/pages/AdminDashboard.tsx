import { Link } from 'react-router-dom'
import { ArrowUpRight, Banknote, CalendarClock, CheckCircle2, ChevronRight, Dumbbell, QrCode, Users, UserRound } from 'lucide-react'
import { PageHeader } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { formatCurrency, formatDate } from '@/shared/lib/utils'
import type { AdminDashboardOverview } from '@/shared/types'
import { useAdminDashboard } from '../hooks/useAdminReport'

export function AdminDashboard() {
  const { data, isLoading } = useAdminDashboard()

  return (
    <div className="pulso-inicio page-enter space-y-5 sm:space-y-8" data-testid="admin-dashboard">
      <PageHeader
        title="Inicio"
        action={(
          <Link
            to="/attendance"
            state={{ returnTo: '/dashboard/admin', returnLabel: 'Volver a Inicio' }}
            className="btn-primary flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-xs sm:px-4 sm:text-sm"
            data-testid="admin-register-attendance"
          >
            <QrCode size={17} /> Registrar asistencia
          </Link>
        )}
      />

      {isLoading || !data ? <CardSkeleton lines={4} /> : (
        <section className="card overflow-hidden" aria-labelledby="admin-gym-summary-title" data-testid="admin-gym-summary">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-4 py-4 dark:border-neutral-800 sm:px-6">
            <div>
              <h2 id="admin-gym-summary-title" className="text-xl font-heading font-bold sm:text-2xl">Resumen del gimnasio</h2>
              <p className="mt-1 text-sm text-neutral-500">Clientes, cobros y rutinas que requieren seguimiento.</p>
            </div>
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${hasAttention(data) ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}>
              <span className={`h-2 w-2 rounded-full ${hasAttention(data) ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              {hasAttention(data) ? 'Atención requerida' : 'Todo al día'}
            </span>
          </header>

          <div className="grid divide-y divide-neutral-200 dark:divide-neutral-800 xl:grid-cols-[0.85fr_1.15fr] xl:divide-x xl:divide-y-0">
            <div className="space-y-5 p-4 sm:p-6">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Clientes</h3>
              <Link to="/members" aria-label={`Clientes activos: ${data.commercial.active_clients}`} className="group flex items-center justify-between gap-3 rounded-xl py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400"><Users size={19} /></span>
                  <span className="min-w-0"><span className="block font-semibold">Clientes activos</span><span className="mt-0.5 block truncate text-sm text-neutral-500">Perfiles registrados en el gimnasio</span></span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-lg font-bold tabular-nums text-neutral-900 dark:text-white">{data.commercial.active_clients}<ChevronRight size={18} className="text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-primary" /></span>
              </Link>

              <Link to="/billing?payment_status=paid" aria-label={`Clientes al día: ${data.commercial.current_clients} de ${data.commercial.active_clients}`} className="group block rounded-xl py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <span className="flex items-center justify-between gap-3 text-sm"><span className="font-medium">Membresías al día</span><span className="font-semibold tabular-nums text-neutral-900 dark:text-white">{data.commercial.current_clients} de {data.commercial.active_clients}</span></span>
                <span className="mt-2 block h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" role="progressbar" aria-label="Clientes al día" aria-valuemin={0} aria-valuemax={100} aria-valuenow={data.commercial.current_clients_pct}>
                  <span className="block h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${data.commercial.current_clients_pct}%` }} />
                </span>
                <span className="mt-1.5 flex items-center justify-between gap-2 text-xs text-neutral-500"><span>{data.commercial.current_clients_pct}% de los clientes</span><span className="inline-flex items-center gap-1 font-semibold text-primary">Abrir Pagos <ArrowUpRight size={13} /></span></span>
              </Link>
            </div>

            <div className="space-y-3 p-4 sm:p-6">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Por atender</h3>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {data.commercial.overdue_count > 0 && (
                  <SummaryAction to="/billing?payment_status=late" title="Cobros vencidos" detail={`${formatCurrency(data.commercial.overdue_amount)} pendientes de regularizar`} count={data.commercial.overdue_count} icon={<Banknote size={19} />} tone="danger" />
                )}
                {data.commercial.due_soon_count > 0 && (
                  <SummaryAction to="/billing?payment_status=pending" title="Próximos cobros" detail={`${formatCurrency(data.commercial.due_soon_amount)} durante los próximos 7 días`} count={data.commercial.due_soon_count} icon={<CalendarClock size={19} />} tone="warning" />
                )}
                {data.training.ending_soon_count > 0 && (
                  <SummaryAction
                    to="/routines"
                    title="Rutinas próximas a vencer"
                    detail={routineEndingSoonDescription(data.training.ending_soon)}
                    count={data.training.ending_soon_count}
                    icon={<Dumbbell size={19} />}
                    tone="info"
                  />
                )}
                {data.training.without_routine_count > 0 && (
                  <SummaryAction to="/routines" title="Clientes sin rutina" detail="Revisa y asigna una rutina activa" count={data.training.without_routine_count} icon={<UserRound size={19} />} tone="warning" />
                )}
                {!hasAttention(data) && (
                  <div className="flex items-center gap-3 py-4 text-sm text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 size={20} className="shrink-0" />
                    <p>No hay cobros ni rutinas que requieran seguimiento.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function hasAttention(data: AdminDashboardOverview) {
  return Boolean(data.commercial.overdue_count || data.commercial.due_soon_count || data.training.ending_soon_count || data.training.without_routine_count)
}

function routineEndingSoonDescription(items: Array<{ member_name: string; end_date?: string; days_until_end?: number }>) {
  const next = items[0]
  if (!next) return 'Revisa las rutinas que terminan durante los próximos 14 días'
  const when = next.days_until_end === 0 ? 'hoy' : next.days_until_end === 1 ? 'mañana' : next.days_until_end != null ? `en ${next.days_until_end} días` : next.end_date ? `el ${formatDate(next.end_date)}` : 'próximamente'
  const additional = items.length > 1 ? ` y ${items.length - 1} más` : ''
  return `${next.member_name}${additional} · ${when}`
}

function SummaryAction({ to, title, detail, count, icon, tone }: {
  to: string
  title: string
  detail: string
  count: number
  icon: React.ReactNode
  tone: 'danger' | 'warning' | 'info'
}) {
  const tones = {
    danger: 'bg-red-500/10 text-red-600 dark:text-red-400',
    warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  }

  return (
    <Link to={to} aria-label={`${title}: ${count}. ${detail}`} className="group flex items-center justify-between gap-3 py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <span className="flex min-w-0 items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>{icon}</span>
        <span className="min-w-0"><span className="block font-semibold text-neutral-900 dark:text-white">{title}</span><span className="mt-0.5 block truncate text-sm text-neutral-500">{detail}</span></span>
      </span>
      <span className="flex shrink-0 items-center gap-2"><span className={`min-w-7 rounded-full px-2 py-1 text-center text-xs font-bold tabular-nums ${tones[tone]}`}>{count}</span><ChevronRight size={18} className="text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-primary" /></span>
    </Link>
  )
}
