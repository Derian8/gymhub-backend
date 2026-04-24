import {
  Users, CheckSquare, AlertTriangle, DollarSign, Activity, UserPlus,
  Dumbbell, ArrowRight, Siren, TrendingDown, CreditCard,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTrainerOverviewQuery } from '@/modules/members/hooks/useMembers'
import { Badge, EmptyState, PageHeader, StatCard } from '@/shared/components/UI'
import { StatCardSkeleton } from '@/shared/components/Skeleton'
import { SymbolFrame } from '@/shared/components/Brand'
import {
  formatCurrency,
  PAYMENT_STATUS_LABELS,
  RISK_LEVEL_BADGE,
  RISK_LEVEL_LABELS,
} from '@/shared/lib/utils'
import { useAuthStore } from '@/shared/store/authStore'

export function TrainerDashboard() {
  const { data, isLoading } = useTrainerOverviewQuery()
  const { user } = useAuthStore()

  const stats = data
    ? [
        {
          label: 'Miembros activos',
          value: data.total_active_members,
          icon: <Users size={20} />,
          variant: 'default' as const,
          testId: 'stat-total-members',
        },
        {
          label: 'Check-ins hoy',
          value: data.checked_in_today,
          icon: <CheckSquare size={20} />,
          variant: 'info' as const,
          testId: 'stat-checkins',
        },
        {
          label: 'En mora',
          value: data.members_in_mora,
          icon: <AlertTriangle size={20} />,
          variant: data.members_in_mora > 0 ? 'danger' as const : 'default' as const,
          testId: 'stat-mora',
        },
        {
          label: 'Inactivos 30d',
          value: data.members_inactive_30d,
          icon: <Activity size={20} />,
          variant: data.members_inactive_30d > 5 ? 'warning' as const : 'default' as const,
          testId: 'stat-inactive',
        },
        {
          label: 'Alertas pendientes',
          value: data.pending_alerts,
          icon: <AlertTriangle size={20} />,
          variant: data.pending_alerts > 0 ? 'warning' as const : 'success' as const,
          testId: 'stat-alerts',
        },
        {
          label: 'Pagos por vencer',
          value: data.payments_due_soon,
          icon: <Siren size={20} />,
          variant: data.payments_due_soon > 0 ? 'warning' as const : 'default' as const,
          testId: 'stat-due-soon',
        },
        {
          label: 'Sin progreso reciente',
          value: data.members_without_progress_recently,
          icon: <TrendingDown size={20} />,
          variant: data.members_without_progress_recently > 0 ? 'warning' as const : 'default' as const,
          testId: 'stat-progress-risk',
        },
        {
          label: 'Sin plan activo',
          value: data.members_without_active_plan,
          icon: <Dumbbell size={20} />,
          variant: data.members_without_active_plan > 0 ? 'warning' as const : 'default' as const,
          testId: 'stat-without-plan',
        },
        {
          label: 'Prescripciones incompletas',
          value: data.incomplete_prescriptions,
          icon: <AlertTriangle size={20} />,
          variant: data.incomplete_prescriptions > 0 ? 'warning' as const : 'default' as const,
          testId: 'stat-incomplete-prescriptions',
        },
        {
          label: 'Ingresos del mes',
          value: formatCurrency(data.revenue_this_month),
          icon: <DollarSign size={20} />,
          variant: 'success' as const,
          testId: 'stat-revenue',
        },
        {
          label: 'MRR estimado',
          value: formatCurrency(data.estimated_mrr),
          icon: <DollarSign size={20} />,
          variant: 'info' as const,
          testId: 'stat-estimated-mrr',
        },
        {
          label: 'Cobranza esperada',
          value: formatCurrency(data.expected_revenue_this_month),
          icon: <CreditCard size={20} />,
          variant: 'default' as const,
          testId: 'stat-expected-revenue',
        },
        {
          label: 'Tasa de mora',
          value: `${data.late_rate_pct}%`,
          icon: <TrendingDown size={20} />,
          variant: data.late_rate_pct > 15 ? 'danger' as const : 'default' as const,
          testId: 'stat-late-rate',
        },
        {
          label: 'Nuevos miembros',
          value: data.new_members_this_month,
          icon: <UserPlus size={20} />,
          variant: 'info' as const,
          testId: 'stat-new-members',
        },
        {
          label: 'Sesiones esta semana',
          value: data.sessions_completed_this_week,
          icon: <Dumbbell size={20} />,
          variant: 'default' as const,
          testId: 'stat-sessions',
        },
        {
          label: 'Suscripciones activas',
          value: data.active_subscriptions_count,
          icon: <CreditCard size={20} />,
          variant: 'default' as const,
          testId: 'stat-active-subscriptions',
        },
      ]
    : []

  return (
    <div data-testid="trainer-dashboard" className="page-enter">
      <PageHeader
        title={`Hola, ${user?.first_name || 'Trainer'}`}
        subtitle="Prioriza miembros en riesgo, cobros y adherencia del gimnasio"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 mb-8">
        {isLoading
          ? Array.from({ length: 12 }).map((_, i) => <StatCardSkeleton key={i} />)
          : stats.map((stat) => (
              <StatCard
                key={stat.label}
                label={stat.label}
                value={stat.value}
                icon={stat.icon}
                variant={stat.variant}
                data-testid={stat.testId}
              />
            ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.7fr] gap-6 mb-8">
        <section className="card p-6" data-testid="risk-panel">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="label-base">Miembros que requieren atención</p>
              <h2 className="text-2xl font-heading font-bold text-neutral-900 dark:text-white">
                {data?.miembros_en_riesgo.length || 0} casos prioritarios
              </h2>
            </div>
            <Link to="/members" className="text-sm font-medium text-primary inline-flex items-center gap-1">
              Ver todos <ArrowRight size={16} />
            </Link>
          </div>

          {data?.miembros_en_riesgo.length ? (
            <div className="space-y-3">
              {data.miembros_en_riesgo.map((member) => (
                <div
                  key={member.id}
                  className="rounded-sm border border-neutral-200 dark:border-neutral-800 p-4 hover:border-primary/40 transition-colors"
                  data-testid={`risk-member-${member.id}`}
                >
                  <div className="flex flex-wrap items-center gap-2 justify-between mb-2">
                    <h3 className="font-semibold text-neutral-900 dark:text-white">{member.full_name}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant={RISK_LEVEL_BADGE[member.nivel_riesgo]}>
                        Riesgo {RISK_LEVEL_LABELS[member.nivel_riesgo]}
                      </Badge>
                      <span className="text-sm font-bold text-neutral-900 dark:text-white">
                        {member.riesgo_adherencia}/100
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
                    {member.motivos_riesgo.join(' · ')}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                    <span>
                      Pago: {member.payment_status ? PAYMENT_STATUS_LABELS[member.payment_status] : 'Sin dato'}
                    </span>
                    <span>
                      Último check-in: {member.days_since_last_checkin == null ? 'Sin registros' : `${member.days_since_last_checkin} días`}
                    </span>
                    <span>
                      Prescripción: {member.estado_prescripcion === 'sin_plan'
                        ? 'Sin plan'
                        : member.estado_prescripcion === 'incompleta'
                          ? 'Incompleta'
                          : 'Lista'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-primary font-medium">{member.next_action}</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Link
                      to={`/members/${member.id}/program`}
                      className="text-sm font-medium text-primary hover:underline"
                      data-testid={`prescribe-member-${member.id}`}
                    >
                      Prescribir ahora
                    </Link>
                    <Link
                      to={`/members/${member.id}`}
                      className="text-sm font-medium text-neutral-600 hover:text-primary dark:text-neutral-300"
                    >
                      Ver perfil
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Users size={40} />}
              title="Sin miembros en riesgo alto"
              description="La adherencia del gimnasio está bajo control por ahora."
            />
          )}
        </section>

        <section className="space-y-4">
          <QuickAction
            title="Resolver alertas"
            description={`${data?.pending_alerts || 0} alertas pendientes de resolución`}
            to="/alerts"
            icon={<AlertTriangle size={20} />}
            variant={data && data.pending_alerts > 0 ? 'warning' : 'default'}
            testId="quick-alerts"
          />
          <QuickAction
            title="Cobros urgentes"
            description={`${data?.payments_due_soon || 0} por vencer y ${data?.payments_overdue || 0} en mora`}
            to="/billing"
            icon={<DollarSign size={20} />}
            variant={data && (data.payments_due_soon > 0 || data.payments_overdue > 0) ? 'warning' : 'default'}
            testId="quick-billing"
          />
          <QuickAction
            title="Gestionar miembros"
            description="Lista completa con búsqueda y señales de adherencia"
            to="/members"
            icon={<Users size={20} />}
            testId="quick-members"
          />
          <QuickAction
            title="Completar prescripciones"
            description={`${data?.members_without_active_plan || 0} sin plan y ${data?.incomplete_prescriptions || 0} incompletas`}
            to="/members"
            icon={<Dumbbell size={20} />}
            variant={data && (data.members_without_active_plan > 0 || data.incomplete_prescriptions > 0) ? 'warning' : 'default'}
            testId="quick-prescriptions"
          />
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PrescriptionQueue
          title="Members sin plan activo"
          subtitle={`${data?.members_without_active_plan || 0} member(s) todavía no tienen una base publicada`}
          items={data?.miembros_sin_plan_activo || []}
          emptyTitle="Todos tienen plan activo"
          emptyDescription="No hay members pendientes de primera asignación ahora mismo."
          linkTo="/members?prescription_status=sin_plan&ordering=prescripcion"
          testId="queue-without-plan"
        />
        <PrescriptionQueue
          title="Prescripciones incompletas"
          subtitle={`${data?.incomplete_prescriptions || 0} member(s) necesitan completar entrenamiento o nutrición`}
          items={data?.miembros_con_prescripcion_incompleta || []}
          emptyTitle="No hay prescripciones incompletas"
          emptyDescription="La publicación hacia los members está al día por ahora."
          linkTo="/members?prescription_status=incompleta&ordering=prescripcion"
          testId="queue-incomplete-prescriptions"
        />
      </div>
    </div>
  )
}

interface QuickActionProps {
  title: string
  description: string
  to: string
  icon: React.ReactNode
  variant?: 'default' | 'warning'
  testId: string
}

function QuickAction({ title, description, to, icon, variant = 'default', testId }: QuickActionProps) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className={`card p-6 flex items-start gap-4 hover:border-primary/50 transition-all duration-300 hover:-translate-y-0.5 group ${
        variant === 'warning' ? 'border-yellow-500/30' : ''
      }`}
    >
      <SymbolFrame tone={variant === 'warning' ? 'warning' : 'primary'} size="md" className="rounded-2xl">
        {icon}
      </SymbolFrame>
      <div>
        <h3 className="font-semibold text-neutral-900 dark:text-white group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{description}</p>
      </div>
    </Link>
  )
}

interface PrescriptionQueueProps {
  title: string
  subtitle: string
  items: Array<{
    id: number
    full_name: string
    riesgo_adherencia: number
    nivel_riesgo: 'low' | 'medium' | 'high'
    motivos_riesgo: string[]
    next_action: string
  }>
  emptyTitle: string
  emptyDescription: string
  linkTo: string
  testId: string
}

function PrescriptionQueue({
  title,
  subtitle,
  items,
  emptyTitle,
  emptyDescription,
  linkTo,
  testId,
}: PrescriptionQueueProps) {
  return (
    <section className="card p-6" data-testid={testId}>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="label-base">Prescripción operativa</p>
          <h2 className="text-2xl font-heading font-bold text-neutral-900 dark:text-white">{title}</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{subtitle}</p>
        </div>
        <Link to={linkTo} className="text-sm font-medium text-primary inline-flex items-center gap-1">
          Ver cola <ArrowRight size={16} />
        </Link>
      </div>

      {items.length ? (
        <div className="space-y-3">
          {items.map((member) => (
            <div
              key={member.id}
              className="rounded-sm border border-neutral-200 dark:border-neutral-800 p-4"
              data-testid={`${testId}-member-${member.id}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="font-semibold text-neutral-900 dark:text-white">{member.full_name}</h3>
                <div className="flex items-center gap-2">
                  <Badge variant={RISK_LEVEL_BADGE[member.nivel_riesgo]}>
                    Riesgo {RISK_LEVEL_LABELS[member.nivel_riesgo]}
                  </Badge>
                  <span className="text-sm font-bold text-neutral-900 dark:text-white">{member.riesgo_adherencia}/100</span>
                </div>
              </div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
                {member.motivos_riesgo.join(' · ') || 'Sin señales adicionales.'}
              </p>
              <p className="text-sm text-primary font-medium">{member.next_action}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link
                  to={`/members/${member.id}/program`}
                  className="text-sm font-medium text-primary hover:underline"
                  data-testid={`${testId}-cta-${member.id}`}
                >
                  Resolver ahora
                </Link>
                <Link
                  to={`/members/${member.id}`}
                  className="text-sm font-medium text-neutral-600 hover:text-primary dark:text-neutral-300"
                >
                  Ver perfil
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Dumbbell size={40} />}
          title={emptyTitle}
          description={emptyDescription}
        />
      )}
    </section>
  )
}
