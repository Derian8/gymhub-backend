import { Dumbbell, CheckSquare, CreditCard, AlertTriangle, Utensils, Activity } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/shared/store/authStore'
import { useMemberDashboardQuery } from '@/modules/members/hooks/useMembers'
import { Badge, PageHeader, EmptyState } from '@/shared/components/UI'
import { StatCardSkeleton } from '@/shared/components/Skeleton'
import { formatRelative, GOAL_LABELS, PAYMENT_STATUS_CLASS } from '@/shared/lib/utils'

export function MemberDashboard() {
  const { user } = useAuthStore()
  const memberId = (user as any)?.memberprofile_id || (user as any)?.id
  const { data, isLoading } = useMemberDashboardQuery(memberId)

  if (isLoading) {
    return (
      <div className="page-enter">
        <PageHeader title="Mi Dashboard" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  const paymentBadge = data?.payment_status
    ? PAYMENT_STATUS_CLASS[data.payment_status]
    : 'badge-neutral'

  return (
    <div data-testid="member-dashboard" className="page-enter">
      <PageHeader
        title={`Hola, ${user?.first_name || 'Atleta'}`}
        subtitle="Tu resumen de hoy"
      />

      {/* Alerts banner */}
      {data?.inactivity_alert && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-sm" data-testid="inactivity-banner">
          <AlertTriangle size={18} className="text-yellow-500 flex-shrink-0" />
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            Tienes una alerta de inactividad. ¡Retoma tu rutina hoy!
          </p>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
        {/* Payment status */}
        <DashboardCard
          title="Estado de pago"
          icon={<CreditCard size={20} className="text-primary" />}
          to="/billing"
          testId="card-payment"
        >
          {data?.payment_status ? (
            <>
              <Badge variant={data.payment_status === 'paid' ? 'success' : data.payment_status === 'late' ? 'error' : 'warning'}>
                {data.payment_status === 'paid' ? 'Al día' : data.payment_status === 'pending' ? 'Pendiente' : 'En mora'}
              </Badge>
              {data.days_until_due != null && (
                <p className="text-xs text-neutral-500 mt-1">Vence en {data.days_until_due} días</p>
              )}
              {data.days_overdue != null && (
                <p className="text-xs text-red-500 mt-1">{data.days_overdue} días vencido</p>
              )}
            </>
          ) : (
            <p className="text-sm text-neutral-400">Sin información</p>
          )}
        </DashboardCard>

        {/* Today workout */}
        <DashboardCard
          title="Entrenamiento hoy"
          icon={<Dumbbell size={20} className="text-primary" />}
          to={data?.active_plan ? `/plans/${data.active_plan.id}/today` : '/plans/my'}
          testId="card-workout"
        >
          {data?.today_has_workout ? (
            <>
              <Badge variant="info">{data.active_plan?.name}</Badge>
              <p className="text-xs text-green-500 mt-1">Plan activo disponible</p>
            </>
          ) : data?.active_plan ? (
            <>
              <Badge variant="neutral">{data.active_plan.name}</Badge>
              <p className="text-xs text-neutral-400 mt-1">No hay entrenamiento hoy</p>
            </>
          ) : (
            <p className="text-sm text-neutral-400">Sin plan activo</p>
          )}
        </DashboardCard>

        {/* Last check-in */}
        <DashboardCard
          title="Último check-in"
          icon={<CheckSquare size={20} className="text-primary" />}
          to="/attendance/check-in"
          testId="card-checkin"
        >
          {data?.last_checkin ? (
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              {formatRelative(data.last_checkin)}
            </p>
          ) : (
            <p className="text-sm text-neutral-400">Sin registros</p>
          )}
          <p className="text-xs text-primary mt-1 font-medium">Registrar asistencia →</p>
        </DashboardCard>

        {/* Weekly sessions */}
        <DashboardCard
          title="Sesiones esta semana"
          icon={<Activity size={20} className="text-primary" />}
          to="/sessions"
          testId="card-sessions"
        >
          <span className="text-4xl font-heading font-black text-neutral-900 dark:text-white">
            {data?.weekly_sessions_done || 0}
          </span>
          <p className="text-xs text-neutral-400 mt-1">sesiones completadas</p>
        </DashboardCard>

        {/* Nutrition goal */}
        <DashboardCard
          title="Objetivo nutricional"
          icon={<Utensils size={20} className="text-primary" />}
          to="/nutrition"
          testId="card-nutrition"
        >
          {data?.nutrition_goal ? (
            <Badge variant="info">{GOAL_LABELS[data.nutrition_goal] || data.nutrition_goal}</Badge>
          ) : (
            <p className="text-sm text-neutral-400">Sin perfil nutricional</p>
          )}
        </DashboardCard>

        {/* Notifications */}
        <DashboardCard
          title="Notificaciones"
          icon={<AlertTriangle size={20} className="text-primary" />}
          to="/alerts"
          testId="card-notifications"
        >
          {data?.unread_notifications ? (
            <>
              <span className="text-4xl font-heading font-black text-primary">
                {data.unread_notifications}
              </span>
              <p className="text-xs text-neutral-400 mt-1">sin leer</p>
            </>
          ) : (
            <p className="text-sm text-neutral-400">Sin notificaciones nuevas</p>
          )}
        </DashboardCard>
      </div>
    </div>
  )
}

interface DashboardCardProps {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  to: string
  testId: string
}

function DashboardCard({ title, icon, children, to, testId }: DashboardCardProps) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className="card p-6 hover:border-primary/50 transition-all duration-300 hover:-translate-y-0.5 block"
    >
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="label-base">{title}</span>
      </div>
      <div>{children}</div>
    </Link>
  )
}
