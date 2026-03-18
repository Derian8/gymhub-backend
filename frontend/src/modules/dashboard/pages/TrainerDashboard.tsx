import { Users, CheckSquare, AlertTriangle, DollarSign, Activity, UserPlus, Dumbbell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTrainerOverviewQuery } from '@/modules/members/hooks/useMembers'
import { StatCard, PageHeader, EmptyState } from '@/shared/components/UI'
import { StatCardSkeleton } from '@/shared/components/Skeleton'
import { formatCurrency } from '@/shared/lib/utils'
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
          label: 'Ingresos del mes',
          value: formatCurrency(data.revenue_this_month),
          icon: <DollarSign size={20} />,
          variant: 'success' as const,
          testId: 'stat-revenue',
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
      ]
    : []

  return (
    <div data-testid="trainer-dashboard" className="page-enter">
      <PageHeader
        title={`Hola, ${user?.first_name || 'Trainer'}`}
        subtitle="Resumen del gimnasio en tiempo real"
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)
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

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <QuickAction
          title="Ver miembros"
          description="Lista completa con filtros y búsqueda"
          to="/members"
          icon={<Users size={24} />}
          testId="quick-members"
        />
        <QuickAction
          title="Alertas activas"
          description={`${data?.pending_alerts || 0} alertas pendientes de resolución`}
          to="/alerts"
          icon={<AlertTriangle size={24} />}
          variant={data && data.pending_alerts > 0 ? 'warning' : 'default'}
          testId="quick-alerts"
        />
        <QuickAction
          title="Facturación"
          description="Pagos, estados y vencimientos"
          to="/billing"
          icon={<DollarSign size={24} />}
          testId="quick-billing"
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
      <div className={`p-3 rounded-sm ${variant === 'warning' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-primary/10 text-primary'}`}>
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-neutral-900 dark:text-white group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{description}</p>
      </div>
    </Link>
  )
}
