import { Dumbbell, CheckSquare, CreditCard, AlertTriangle, Utensils, Activity, Flame, GaugeCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/shared/store/authStore'
import { useMemberActivePrescriptionQuery, useMemberDashboardQuery } from '@/modules/members/hooks/useMembers'
import { Badge, PageHeader } from '@/shared/components/UI'
import { StatCardSkeleton } from '@/shared/components/Skeleton'
import { formatRelative, GOAL_LABELS, RISK_LEVEL_BADGE, RISK_LEVEL_LABELS } from '@/shared/lib/utils'

export function MemberDashboard() {
  const { user } = useAuthStore()
  const memberId = user?.memberprofile_id || 0
  const { data, isLoading } = useMemberDashboardQuery(memberId)
  const { data: activePrescription } = useMemberActivePrescriptionQuery(memberId)

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

  return (
    <div data-testid="member-dashboard" className="page-enter">
      <PageHeader
        title={`Hola, ${user?.first_name || 'Atleta'}`}
        subtitle="Tu resumen de hoy"
      />

      {data?.inactivity_alert && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-sm" data-testid="inactivity-banner">
          <AlertTriangle size={18} className="text-yellow-500 flex-shrink-0" />
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            Tienes una alerta de inactividad. ¡Retoma tu rutina hoy!
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6 mb-8">
        <section className="card p-6" data-testid="today-hero">
          <div className="flex flex-wrap items-center gap-2 justify-between mb-4">
            <div>
              <p className="label-base">Enfoque del día</p>
              <h2 className="text-2xl font-heading font-bold text-neutral-900 dark:text-white">
                {data?.active_plan?.name || 'Activa tu plan'}
              </h2>
            </div>
            {data?.riesgo_personal && (
                <Badge variant={RISK_LEVEL_BADGE[data.riesgo_personal.level]}>
                  Riesgo {RISK_LEVEL_LABELS[data.riesgo_personal.level]}
                </Badge>
            )}
          </div>
          <p className="text-base text-neutral-700 dark:text-neutral-300 mb-3">{data?.resumen_hoy}</p>
          <p className="text-sm text-primary font-medium mb-4">{data?.siguiente_accion}</p>
          <div className="flex flex-wrap gap-3 text-sm">
            <MetricPill icon={<Flame size={16} />} label={`${data?.streak_asistencia || 0} días de racha`} />
            <MetricPill icon={<GaugeCircle size={16} />} label={`${data?.cumplimiento_semanal ?? 0}% de cumplimiento`} />
            <MetricPill icon={<Activity size={16} />} label={`${data?.weekly_sessions_done || 0} sesiones esta semana`} />
          </div>
          {data?.riesgo_personal?.reasons?.length ? (
            <div className="mt-4 rounded-sm bg-neutral-100 dark:bg-neutral-900 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Señales a cuidar</p>
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                {data.riesgo_personal.reasons.join(' · ')}
              </p>
            </div>
          ) : null}
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DashboardCard
            title="Pago"
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

          <DashboardCard
            title="Entrenamiento"
            icon={<Dumbbell size={20} className="text-primary" />}
            to={data?.active_plan ? `/plans/${data.active_plan.id}/today` : '/plans/my'}
            testId="card-workout"
          >
            {data?.today_has_workout ? (
              <>
                <Badge variant="info">{activePrescription?.plan_activo?.name || data.active_plan?.name}</Badge>
                <p className="text-xs text-green-500 mt-1">Tienes sesión lista para hoy</p>
              </>
            ) : activePrescription?.plan_activo || data?.active_plan ? (
              <>
                <Badge variant="neutral">{activePrescription?.plan_activo?.name || data?.active_plan?.name}</Badge>
                <p className="text-xs text-neutral-400 mt-1">Hoy toca recuperación o descanso</p>
              </>
            ) : (
              <p className="text-sm text-neutral-400">Sin plan activo</p>
            )}
          </DashboardCard>

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

          <DashboardCard
            title="Nutrición"
            icon={<Utensils size={20} className="text-primary" />}
            to="/nutrition"
            testId="card-nutrition"
          >
            {activePrescription?.perfil_nutricional?.goal_type || data?.nutrition_goal ? (
              <Badge variant="info">
                {GOAL_LABELS[activePrescription?.perfil_nutricional?.goal_type || data?.nutrition_goal || ''] ||
                  activePrescription?.perfil_nutricional?.goal_type ||
                  data?.nutrition_goal}
              </Badge>
            ) : (
              <p className="text-sm text-neutral-400">Sin perfil nutricional</p>
            )}
          </DashboardCard>
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
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

function MetricPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 dark:border-neutral-800 px-3 py-1.5 text-sm text-neutral-700 dark:text-neutral-300">
      <span className="text-primary">{icon}</span>
      <span>{label}</span>
    </div>
  )
}
