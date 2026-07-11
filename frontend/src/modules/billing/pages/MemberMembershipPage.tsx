import { AlertTriangle, CalendarClock, CheckCircle2, CreditCard, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useMemberDashboardQuery } from '@/modules/members/hooks/useMembers'
import { Badge, PageHeader } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { SymbolFrame } from '@/shared/components/Brand'
import { cn, formatCurrency, formatDate } from '@/shared/lib/utils'
import { useAuthStore } from '@/shared/store/authStore'
import type { MemberDashboardSummary } from '@/shared/types'

const RECURRENCE_LABELS: Record<string, string> = {
  daily: 'día',
  weekly: 'semana',
  biweekly: 'quincena',
  monthly: 'mes',
  quarterly: 'trimestre',
  annual: 'año',
}

function getMembershipPresentation(data?: MemberDashboardSummary) {
  if (!data?.membership_plan_name) {
    return {
      label: 'Sin membresía asignada',
      badge: 'Sin membresía',
      variant: 'neutral' as const,
      tone: 'default' as const,
      title: 'Aún no tienes una membresía asignada',
      detail: 'Cuando tu entrenador o el gimnasio asigne una membresía, verás aquí el precio, vencimiento y estado de acceso.',
      icon: <CreditCard size={24} />,
    }
  }

  if (!data.membership_agreed_price && !data.membership_next_billing_date && data.payment_status == null) {
    return {
      label: data.membership_plan_name,
      badge: 'Sin membresía activa',
      variant: 'warning' as const,
      tone: 'warning' as const,
      title: 'Aún no tienes una membresía activa',
      detail: 'Cuando el gimnasio cree tu membresía comercial, verás aquí precio, pagos y vencimientos.',
      icon: <AlertTriangle size={24} />,
    }
  }

  if (data.payment_status === 'paid') {
    return {
      label: data.membership_plan_name,
      badge: 'Membresía vigente',
      variant: 'success' as const,
      tone: 'success' as const,
      title: 'Tu membresía está al día',
      detail: data.days_until_due != null
        ? `Tienes ${data.days_until_due} día(s) restantes antes del próximo vencimiento.`
        : 'Tu acceso comercial está activo.',
      icon: <CheckCircle2 size={24} />,
    }
  }

  if (data.payment_status === 'late') {
    return {
      label: data.membership_plan_name,
      badge: 'Membresía vencida',
      variant: 'error' as const,
      tone: 'danger' as const,
      title: 'Tu membresía requiere regularización',
      detail: data.days_overdue != null
        ? `Tu membresía venció hace ${data.days_overdue} día(s). Contacta al gimnasio para regularizar el pago.`
        : 'Existe un cobro vencido pendiente de regularizar.',
      icon: <AlertTriangle size={24} />,
    }
  }

  return {
    label: data.membership_plan_name,
    badge: 'Pago pendiente',
    variant: 'warning' as const,
    tone: 'warning' as const,
    title: 'Tu pago está pendiente',
    detail: data.days_until_due != null
      ? `Tienes ${data.days_until_due} día(s) para completar el pago.`
      : 'Consulta con el gimnasio si necesitas actualizar tu membresía.',
    icon: <CalendarClock size={24} />,
  }
}

export function MemberMembershipPage() {
  const { user } = useAuthStore()
  const memberId = user?.memberprofile_id || 0
  const { data, isLoading } = useMemberDashboardQuery(memberId)
  const presentation = getMembershipPresentation(data)

  if (isLoading) {
    return (
      <div className="page-enter">
        <PageHeader title="Mi membresía" subtitle="Estado comercial, vencimientos y acceso" />
        <CardSkeleton lines={6} />
      </div>
    )
  }

  return (
    <div data-testid="member-membership-page" className="page-enter space-y-6">
      <PageHeader
        title="Mi membresía"
        subtitle="Consulta tu plan, estado de pago, vencimiento y acceso al gimnasio"
      />

      <section
        className={cn(
          'card relative overflow-hidden p-6 md:p-8',
          presentation.tone === 'success' && 'border-emerald-400/40 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-950/10',
          presentation.tone === 'warning' && 'border-amber-400/50 bg-amber-50/60 dark:border-amber-500/25 dark:bg-amber-950/20',
          presentation.tone === 'danger' && 'border-red-400/50 bg-red-50/60 dark:border-red-500/30 dark:bg-red-950/20',
        )}
        data-testid="membership-hero"
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/60 blur-3xl dark:bg-white/5" />
        <div className="relative grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="flex items-start gap-4">
            <SymbolFrame tone={presentation.tone} size="lg" className="rounded-3xl">
              {presentation.icon}
            </SymbolFrame>
            <div>
              <p className="label-base">Estado de membresía</p>
              <h2 className="font-heading text-3xl font-black text-neutral-900 dark:text-white">
                {presentation.label}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant={presentation.variant}>{presentation.badge}</Badge>
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                  {data?.membership_access_allowed ? 'Acceso permitido' : 'Acceso requiere revisión'}
                </span>
              </div>
              <h3 className="mt-5 font-heading text-xl font-bold text-neutral-900 dark:text-white">
                {presentation.title}
              </h3>
              <p className="mt-2 max-w-2xl text-sm font-medium text-neutral-700 dark:text-neutral-200">
                {presentation.detail}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MembershipMetric label="Precio acordado" value={data?.membership_agreed_price ? formatCurrency(data.membership_agreed_price) : 'Sin precio'} />
            <MembershipMetric label="Recurrencia" value={data?.membership_recurrence_type ? RECURRENCE_LABELS[data.membership_recurrence_type] : 'Sin dato'} />
            <MembershipMetric label="Vencimiento" value={data?.membership_expires_at ? formatDate(data.membership_expires_at) : 'Sin fecha'} />
            <MembershipMetric label="Próximo cobro" value={data?.membership_next_billing_date ? formatDate(data.membership_next_billing_date) : 'Sin fecha'} />
            <MembershipMetric
              label={data?.days_overdue != null ? 'Días vencidos' : 'Días restantes'}
              value={data?.days_overdue != null ? String(data.days_overdue) : data?.days_until_due != null ? String(data.days_until_due) : 'Sin dato'}
            />
            <MembershipMetric label="Acceso" value={data?.membership_access_allowed ? 'Permitido' : 'Requiere revisión'} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <InfoCard
          icon={<ShieldCheck size={20} />}
          title="Qué significa acceso"
          description="El acceso permitido indica que tu membresía está operativa para asistencia y uso del gimnasio."
        />
        <InfoCard
          icon={<CalendarClock size={20} />}
          title="Fechas importantes"
          description="El vencimiento indica hasta cuándo cubre el periodo pagado. El próximo cobro indica cuándo debe renovarse."
        />
        <InfoCard
          icon={<CreditCard size={20} />}
          title="Dudas o pagos"
          description="Si ves pago pendiente, vencido o plan sin cobro, contacta al gimnasio o a tu entrenador para regularizarlo."
        />
      </section>

      <div className="flex flex-wrap gap-3">
        <Link to="/dashboard/member" className="btn-secondary">
          Volver al dashboard
        </Link>
        <Link to="/profile" className="btn-secondary">
          Ver mi perfil
        </Link>
      </div>
    </div>
  )
}

function MembershipMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-white/60 bg-white/70 p-4 dark:border-white/10 dark:bg-neutral-950/40">
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-lg font-heading font-bold text-neutral-900 dark:text-white">{value}</p>
    </div>
  )
}

function InfoCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2 text-primary">
        {icon}
        <h3 className="font-heading font-bold text-neutral-900 dark:text-white">{title}</h3>
      </div>
      <p className="text-sm text-neutral-500">{description}</p>
    </div>
  )
}
