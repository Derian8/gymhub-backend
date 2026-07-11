import {
  Users, CheckSquare, AlertTriangle, DollarSign, Activity, UserPlus,
  Dumbbell, ArrowRight, Siren, TrendingDown, CreditCard,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMembersQuery, useTrainerOverviewQuery } from '@/modules/members/hooks/useMembers'
import { Badge, EmptyState, PageHeader, StatCard } from '@/shared/components/UI'
import { StatCardSkeleton } from '@/shared/components/Skeleton'
import { SymbolFrame } from '@/shared/components/Brand'
import {
  formatCurrency,
  formatDate,
  PAYMENT_STATUS_LABELS,
  RISK_LEVEL_BADGE,
  RISK_LEVEL_LABELS,
} from '@/shared/lib/utils'
import { useAuthStore } from '@/shared/store/authStore'
import type { MemberMembershipSummary, MemberProfile } from '@/shared/types'

const MEMBERSHIP_RECURRENCE_LABELS: Record<MemberMembershipSummary['recurrence_type'], string> = {
  daily: 'día',
  weekly: 'semana',
  biweekly: 'quincena',
  monthly: 'mes',
  quarterly: 'trimestre',
  annual: 'año',
}

function getMembershipStatus(member: MemberProfile): {
  label: string
  variant: 'success' | 'warning' | 'error' | 'neutral'
  priority: number
} {
  const membership = member.membresia_actual
  if (!membership) {
    return { label: 'Sin membresía', variant: 'neutral', priority: 3 }
  }
  if (membership.payment_status === 'late' || membership.status === 'past_due') {
    return { label: 'Vencida', variant: 'error', priority: 0 }
  }
  if (membership.payment_status === 'pending' || (membership.days_until_due != null && membership.days_until_due <= 7)) {
    return { label: 'Por vencer', variant: 'warning', priority: 1 }
  }
  if (!membership.access_allowed) {
    return { label: 'Revisar acceso', variant: 'warning', priority: 2 }
  }
  return { label: 'Vigente', variant: 'success', priority: 4 }
}

function getMembershipPlanName(member: MemberProfile) {
  return member.membresia_actual?.plan_name || 'Sin membresía'
}

export function TrainerDashboard() {
  const { data, isLoading } = useTrainerOverviewQuery()
  const { data: membersData, isLoading: isLoadingMembers } = useMembersQuery({ ordering: 'riesgo_desc' })
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
          label: 'Sin entrenamiento publicado',
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

      <MembershipCriticalPanel
        members={membersData?.results || []}
        isLoading={isLoadingMembers}
        expectedRevenue={data?.expected_revenue_this_month || 0}
      />

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
            description={`${data?.members_without_active_plan || 0} sin entrenamiento publicado y ${data?.incomplete_prescriptions || 0} incompletas`}
            to="/members"
            icon={<Dumbbell size={20} />}
            variant={data && (data.members_without_active_plan > 0 || data.incomplete_prescriptions > 0) ? 'warning' : 'default'}
            testId="quick-prescriptions"
          />
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PrescriptionQueue
          title="Miembros sin entrenamiento publicado"
          subtitle={`${data?.members_without_active_plan || 0} miembro(s) todavía no tienen una rutina publicada`}
          items={data?.miembros_sin_plan_activo || []}
          emptyTitle="Todos tienen entrenamiento publicado"
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

function MembershipCriticalPanel({
  members,
  isLoading,
  expectedRevenue,
}: {
  members: MemberProfile[]
  isLoading: boolean
  expectedRevenue: number
}) {
  const withStatus = members.map((member) => ({
    member,
    status: getMembershipStatus(member),
  }))
  const activeCount = withStatus.filter((item) => item.status.label === 'Vigente').length
  const dueSoonCount = withStatus.filter((item) => item.status.label === 'Por vencer').length
  const overdueCount = withStatus.filter((item) => item.status.label === 'Vencida').length
  const planWithoutBillingCount = withStatus.filter((item) => item.status.label === 'Sin membresía').length
  const withoutMembershipCount = withStatus.filter((item) => item.status.label === 'Sin membresía').length
  const criticalMembers = [...withStatus]
    .sort((a, b) => a.status.priority - b.status.priority)
    .slice(0, 6)

  return (
    <section className="card p-6 mb-8 border-primary/20" data-testid="membership-critical-panel">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <p className="label-base">Membresías y cobros críticos</p>
          <h2 className="font-heading text-2xl font-black text-neutral-900 dark:text-white">
            Estado comercial de tus miembros
          </h2>
          <p className="text-sm text-neutral-500">
            Prioriza vencidos, próximos cobros y miembros sin membresía antes de revisar entrenamiento.
          </p>
        </div>
        <Link to="/billing" className="btn-secondary">
          Ver facturación
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6 mb-5">
        <MembershipKpi label="Vigentes" value={String(activeCount)} tone="success" />
        <MembershipKpi label="Por vencer" value={String(dueSoonCount)} tone="warning" />
        <MembershipKpi label="Vencidas" value={String(overdueCount)} tone="danger" />
        <MembershipKpi label="Falta cobro" value={String(planWithoutBillingCount)} tone="warning" />
        <MembershipKpi label="Sin membresía" value={String(withoutMembershipCount)} tone="default" />
        <MembershipKpi label="Cobranza esperada" value={formatCurrency(expectedRevenue)} tone="primary" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-36 skeleton rounded-sm" />
          ))}
        </div>
      ) : !criticalMembers.length ? (
        <EmptyState
          icon={<CreditCard size={40} />}
          title="Sin miembros para analizar"
          description="Cuando tengas miembros asignados, sus membresías aparecerán aquí."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {criticalMembers.map(({ member, status }) => (
            <MembershipCriticalCard key={member.id} member={member} status={status} />
          ))}
        </div>
      )}
    </section>
  )
}

function MembershipKpi({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'success' | 'warning' | 'danger' | 'primary' | 'default'
}) {
  const toneClass = {
    success: 'border-emerald-400/30 bg-emerald-50/60 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-950/20 dark:text-emerald-300',
    warning: 'border-amber-400/30 bg-amber-50/70 text-amber-700 dark:border-amber-500/20 dark:bg-amber-950/20 dark:text-amber-300',
    danger: 'border-red-400/30 bg-red-50/70 text-red-700 dark:border-red-500/20 dark:bg-red-950/20 dark:text-red-300',
    primary: 'border-primary/30 bg-primary/10 text-primary',
    default: 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300',
  }[tone]

  return (
    <div className={`rounded-sm border p-3 ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 font-heading text-2xl font-black">{value}</p>
    </div>
  )
}

function MembershipCriticalCard({
  member,
  status,
}: {
  member: MemberProfile
  status: ReturnType<typeof getMembershipStatus>
}) {
  const membership = member.membresia_actual

  return (
    <div
      className={`rounded-sm border p-4 ${
        status.variant === 'error'
          ? 'border-red-400/40 bg-red-50/60 dark:border-red-500/25 dark:bg-red-950/20'
          : status.variant === 'warning'
            ? 'border-amber-400/40 bg-amber-50/60 dark:border-amber-500/25 dark:bg-amber-950/20'
            : 'border-neutral-200 dark:border-neutral-800'
      }`}
      data-testid={`membership-critical-member-${member.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-neutral-900 dark:text-white">{member.full_name}</h3>
          <p className="text-xs text-neutral-500">{member.email}</p>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MembershipMiniMetric label="Plan" value={getMembershipPlanName(member)} />
        <MembershipMiniMetric label="Suscripción" value={membership ? `#${membership.subscription_id}` : 'Sin suscripción'} />
        <MembershipMiniMetric
          label="Precio"
          value={membership ? `${formatCurrency(membership.agreed_price)} / ${MEMBERSHIP_RECURRENCE_LABELS[membership.recurrence_type]}` : 'Sin precio'}
        />
        <MembershipMiniMetric
          label="Vence"
          value={membership?.current_period_end ? formatDate(membership.current_period_end) : membership?.next_billing_date ? formatDate(membership.next_billing_date) : 'Sin fecha'}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
          {membership?.days_overdue != null
            ? `${membership.days_overdue} día(s) vencido(s)`
            : membership?.days_until_due != null
              ? `${membership.days_until_due} día(s) restante(s)`
              : membership
                ? 'Sin alerta de fecha'
                : 'Crea una membresía desde facturación para habilitar control de cobro.'}
        </p>
        <Link to={`/billing?member=${member.id}`} className="text-sm font-semibold text-primary hover:underline">
          {membership ? 'Gestionar cobro' : 'Crear membresía'}
        </Link>
      </div>
    </div>
  )
}

function MembershipMiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-white">{value}</p>
    </div>
  )
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
          <p className="label-base">Prescripción deportiva</p>
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
