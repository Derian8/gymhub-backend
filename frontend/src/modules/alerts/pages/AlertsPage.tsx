import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Mail,
  MessageCircle,
  Phone,
  RefreshCcw,
  Search,
  UserCheck,
  Users,
} from 'lucide-react'
import {
  useAlertsQuery,
  useAlertsSummaryQuery,
  useCreateAlertContactMutation,
  useDismissAlertMutation,
  useMembersWithoutAlertsQuery,
  useReopenAlertMutation,
  useResolveAlertMutation,
  useStartFollowUpMutation,
} from '../hooks/useAlerts'
import { Avatar, Badge, EmptyState, PageHeader, StatCard } from '@/shared/components/UI'
import { formatDate, formatDateTime } from '@/shared/lib/utils'
import type { InactivityAlert, InactivityAlertContact, MemberWithoutInactivityAlert } from '@/shared/types'

type AlertStatusFilter = 'all' | 'new' | 'in_follow_up' | 'resolved' | 'dismissed' | 'without_alerts'

interface AlertFilters {
  status: AlertStatusFilter
  priority: string
  period_without_attendance: string
  membership_status: string
  search: string
}

const DEFAULT_FILTERS: AlertFilters = {
  status: 'new',
  priority: 'all',
  period_without_attendance: 'all',
  membership_status: 'all',
  search: '',
}

const STATUS_LABELS: Record<Exclude<AlertStatusFilter, 'without_alerts'>, string> = {
  all: 'Todas',
  new: 'Nuevas',
  in_follow_up: 'En seguimiento',
  resolved: 'Resueltas',
  dismissed: 'Descartadas',
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
}

const PRIORITY_BADGES: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  low: 'success',
  medium: 'info',
  high: 'warning',
  urgent: 'error',
}

const MEMBERSHIP_LABELS: Record<string, string> = {
  none: 'Sin membresía',
  pending: 'Pendiente',
  active: 'Activa',
  expiring: 'Por vencer',
  expired: 'Vencida',
  suspended: 'Suspendida',
  cancelled: 'Cancelada',
}

const CONTACT_METHOD_LABELS: Record<InactivityAlertContact['method'], string> = {
  whatsapp: 'WhatsApp',
  call: 'Llamada',
  email: 'Correo',
  in_person: 'Presencial',
}

export function AlertsPage() {
  const [filters, setFilters] = useState<AlertFilters>(DEFAULT_FILTERS)
  const [contactAlertId, setContactAlertId] = useState<number | null>(null)
  const [dismissAlertId, setDismissAlertId] = useState<number | null>(null)
  const [dismissReason, setDismissReason] = useState('')

  const listParams = useMemo(() => {
    if (filters.status === 'without_alerts') return undefined
    return {
      status: filters.status,
      priority: filters.priority,
      period_without_attendance: filters.period_without_attendance,
      membership_status: filters.membership_status,
      search: filters.search,
    }
  }, [filters])

  const { data, isLoading } = useAlertsQuery(listParams)
  const { data: summary } = useAlertsSummaryQuery()
  const { data: membersWithoutAlerts, isLoading: loadingRegularMembers } = useMembersWithoutAlertsQuery(filters.status === 'without_alerts')
  const startFollowUp = useStartFollowUpMutation()
  const resolveAlert = useResolveAlertMutation()
  const dismissAlert = useDismissAlertMutation()
  const reopenAlert = useReopenAlertMutation()
  const createContact = useCreateAlertContactMutation()

  const alerts = data?.results || []
  const regularMembers = membersWithoutAlerts?.results || []

  const updateFilter = (key: keyof AlertFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const handleDismiss = (alertId: number) => {
    if (!dismissReason.trim()) return
    dismissAlert.mutate({ id: alertId, reason: dismissReason.trim() }, {
      onSuccess: () => {
        setDismissAlertId(null)
        setDismissReason('')
      },
    })
  }

  return (
    <div data-testid="alerts-page" className="page-enter">
      <PageHeader
        title="Alertas de inactividad"
        subtitle="Detecta miembros que han reducido o detenido su asistencia y realiza un seguimiento a tiempo."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-4">
        <StatCard label="Alertas nuevas" value={summary?.new_alerts ?? 0} icon={<AlertTriangle size={18} />} variant={(summary?.new_alerts ?? 0) > 0 ? 'warning' : 'success'} data-testid="summary-new-alerts" />
        <StatCard label="En seguimiento" value={summary?.in_follow_up ?? 0} icon={<Clock size={18} />} variant={(summary?.in_follow_up ?? 0) > 0 ? 'info' : 'default'} data-testid="summary-follow-up" />
        <StatCard label="Resueltas del mes" value={summary?.resolved_this_month ?? 0} icon={<CheckCircle size={18} />} variant="success" data-testid="summary-resolved" />
        <StatCard label="Recuperados del mes" value={summary?.recovered_this_month ?? 0} icon={<UserCheck size={18} />} variant="success" data-testid="summary-recovered" />
      </section>

      <p className="mb-6 text-sm font-medium text-neutral-700 dark:text-neutral-300" data-testid="attention-message">
        {summary?.attention_message || '0 miembros necesitan atención esta semana.'}
      </p>

      <section className="card p-4 mb-6">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1fr_auto]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              className="input pl-9"
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Buscar por nombre o correo"
              data-testid="alerts-search"
            />
          </div>

          <select className="input" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} data-testid="filter-status">
            <option value="all">Todas</option>
            <option value="new">Nuevas</option>
            <option value="in_follow_up">En seguimiento</option>
            <option value="resolved">Resueltas</option>
            <option value="dismissed">Descartadas</option>
            <option value="without_alerts">Sin alertas</option>
          </select>

          <select className="input" value={filters.priority} onChange={(event) => updateFilter('priority', event.target.value)} disabled={filters.status === 'without_alerts'} data-testid="filter-priority">
            <option value="all">Todas las prioridades</option>
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>

          <select className="input" value={filters.period_without_attendance} onChange={(event) => updateFilter('period_without_attendance', event.target.value)} disabled={filters.status === 'without_alerts'} data-testid="filter-period">
            <option value="all">Todo periodo sin asistir</option>
            <option value="5_7">5 a 7 días</option>
            <option value="8_14">8 a 14 días</option>
            <option value="15_21">15 a 21 días</option>
            <option value="22_plus">22 días o más</option>
          </select>

          <select className="input" value={filters.membership_status} onChange={(event) => updateFilter('membership_status', event.target.value)} disabled={filters.status === 'without_alerts'} data-testid="filter-membership">
            <option value="all">Todas las membresías</option>
            <option value="active">Activa</option>
            <option value="expiring">Por vencer</option>
            <option value="expired">Vencida</option>
            <option value="suspended">Suspendida</option>
          </select>

          <button type="button" className="btn-secondary inline-flex items-center justify-center gap-2" onClick={() => setFilters(DEFAULT_FILTERS)} data-testid="reset-alert-filters">
            <RefreshCcw size={16} />
            Limpiar
          </button>
        </div>
      </section>

      {filters.status === 'without_alerts' ? (
        <MembersWithoutAlertsList members={regularMembers} isLoading={loadingRegularMembers} />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card h-32 p-4 skeleton" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={<CheckCircle size={42} className="text-green-500" />}
          title={emptyTitle(filters.status)}
          description="No hay datos para los filtros actuales."
        />
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              contactOpen={contactAlertId === alert.id}
              dismissOpen={dismissAlertId === alert.id}
              dismissReason={dismissReason}
              onDismissReasonChange={setDismissReason}
              onToggleContact={() => setContactAlertId(contactAlertId === alert.id ? null : alert.id)}
              onToggleDismiss={() => {
                setDismissAlertId(dismissAlertId === alert.id ? null : alert.id)
                setDismissReason('')
              }}
              onStartFollowUp={() => startFollowUp.mutate(alert.id)}
              onResolve={() => resolveAlert.mutate(alert.id)}
              onDismiss={() => handleDismiss(alert.id)}
              onReopen={() => reopenAlert.mutate(alert.id)}
              onCreateContact={(payload) => createContact.mutate({ id: alert.id, payload }, { onSuccess: () => setContactAlertId(null) })}
              isBusy={startFollowUp.isPending || resolveAlert.isPending || dismissAlert.isPending || reopenAlert.isPending || createContact.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function emptyTitle(status: AlertStatusFilter) {
  if (status === 'new') return 'No hay alertas nuevas.'
  if (status === 'in_follow_up') return 'No existen miembros en seguimiento.'
  if (status === 'resolved') return 'No hay alertas resueltas.'
  if (status === 'dismissed') return 'No hay alertas descartadas.'
  return 'No hay alertas.'
}

interface AlertCardProps {
  alert: InactivityAlert
  contactOpen: boolean
  dismissOpen: boolean
  dismissReason: string
  onDismissReasonChange: (value: string) => void
  onToggleContact: () => void
  onToggleDismiss: () => void
  onStartFollowUp: () => void
  onResolve: () => void
  onDismiss: () => void
  onReopen: () => void
  onCreateContact: (payload: { method: InactivityAlertContact['method']; result: string; note?: string; next_follow_up_date?: string }) => void
  isBusy: boolean
}

function AlertCard({
  alert,
  contactOpen,
  dismissOpen,
  dismissReason,
  onDismissReasonChange,
  onToggleContact,
  onToggleDismiss,
  onStartFollowUp,
  onResolve,
  onDismiss,
  onReopen,
  onCreateContact,
  isBusy,
}: AlertCardProps) {
  const priority = alert.priority || 'low'
  const isClosed = alert.status === 'resolved' || alert.status === 'dismissed'

  return (
    <article className="card p-4 sm:p-5" data-testid={`alert-card-${alert.id}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <Avatar name={alert.member_name} photo={alert.member_photo} size="md" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-lg font-bold text-neutral-900 dark:text-white">{alert.member_name}</h2>
              <Badge variant={PRIORITY_BADGES[priority]}>{PRIORITY_LABELS[priority]}</Badge>
              <Badge variant={statusBadge(alert.status)}>{STATUS_LABELS[alert.status]}</Badge>
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{alert.member_email}</p>
            <p className="mt-2 text-sm font-medium text-primary">{alert.recommended_action}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:min-w-[520px]">
          <Metric label="Días sin asistir" value={`${alert.days_inactive} días`} />
          <Metric label="Última asistencia" value={formatDate(alert.last_checkin_date)} />
          <Metric label="Promedio previo" value={`${alert.weekly_attendance_average}/sem`} />
          <Metric label="Membresía" value={MEMBERSHIP_LABELS[alert.membership_status] || alert.membership_status} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <InfoLine label="Último contacto" value={alert.last_contact ? `${CONTACT_METHOD_LABELS[alert.last_contact.method]} · ${formatDateTime(alert.last_contact.contacted_at)}` : 'Sin contacto registrado'} />
        <InfoLine label="Vencimiento" value={formatDate(alert.membership_end_date)} />
        <InfoLine label="Nota reciente" value={alert.latest_note || 'Sin nota registrada'} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {alert.whatsapp_url && (
          <a href={alert.whatsapp_url} target="_blank" rel="noreferrer" className="btn-secondary inline-flex items-center gap-2 text-sm" data-testid={`send-message-${alert.id}`}>
            <MessageCircle size={16} />
            Enviar mensaje
          </a>
        )}
        <button type="button" className="btn-secondary inline-flex items-center gap-2 text-sm" onClick={onToggleContact} disabled={isBusy} data-testid={`contact-alert-${alert.id}`}>
          <Phone size={16} />
          Registrar contacto
        </button>
        {!isClosed && alert.status === 'new' && (
          <button type="button" className="btn-secondary inline-flex items-center gap-2 text-sm" onClick={onStartFollowUp} disabled={isBusy} data-testid={`follow-alert-${alert.id}`}>
            <Clock size={16} />
            Marcar en seguimiento
          </button>
        )}
        {!isClosed && (
          <button type="button" className="btn-primary inline-flex items-center gap-2 text-sm" onClick={onResolve} disabled={isBusy} data-testid={`resolve-alert-${alert.id}`}>
            <CheckCircle size={16} />
            Resolver alerta
          </button>
        )}
        {!isClosed && (
          <button type="button" className="btn-secondary inline-flex items-center gap-2 text-sm" onClick={onToggleDismiss} disabled={isBusy} data-testid={`dismiss-alert-${alert.id}`}>
            <AlertTriangle size={16} />
            Descartar
          </button>
        )}
        {isClosed && (
          <button type="button" className="btn-secondary inline-flex items-center gap-2 text-sm" onClick={onReopen} disabled={isBusy} data-testid={`reopen-alert-${alert.id}`}>
            <RefreshCcw size={16} />
            Reabrir
          </button>
        )}
        <Link to={`/members/${alert.member}`} className="btn-secondary inline-flex items-center gap-2 text-sm">
          <Users size={16} />
          Ver perfil
        </Link>
        <Link to={`/attendance?member=${alert.member}`} className="btn-secondary inline-flex items-center gap-2 text-sm">
          <Mail size={16} />
          Historial de asistencia
        </Link>
      </div>

      {contactOpen && <ContactForm onSubmit={onCreateContact} isBusy={isBusy} />}

      {dismissOpen && (
        <div className="mt-4 rounded-sm border border-neutral-200 p-4 dark:border-neutral-800">
          <label className="label-base" htmlFor={`dismiss-reason-${alert.id}`}>Motivo para descartar</label>
          <textarea
            id={`dismiss-reason-${alert.id}`}
            className="input mt-2 min-h-20"
            value={dismissReason}
            onChange={(event) => onDismissReasonChange(event.target.value)}
            placeholder="Ej. Ausencia justificada confirmada por el trainer."
            data-testid={`dismiss-reason-${alert.id}`}
          />
          <button type="button" className="btn-primary mt-3" onClick={onDismiss} disabled={isBusy || !dismissReason.trim()} data-testid={`confirm-dismiss-${alert.id}`}>
            Confirmar descarte
          </button>
        </div>
      )}
    </article>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-base">{label}</p>
      <p className="font-semibold text-neutral-900 dark:text-white">{value}</p>
    </div>
  )
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-neutral-500 dark:text-neutral-400">
      <span className="font-medium text-neutral-700 dark:text-neutral-200">{label}:</span> {value}
    </p>
  )
}

function statusBadge(status: InactivityAlert['status']): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  if (status === 'resolved') return 'success'
  if (status === 'dismissed') return 'neutral'
  if (status === 'in_follow_up') return 'info'
  return 'warning'
}

function ContactForm({
  onSubmit,
  isBusy,
}: {
  onSubmit: (payload: { method: InactivityAlertContact['method']; result: string; note?: string; next_follow_up_date?: string }) => void
  isBusy: boolean
}) {
  const [method, setMethod] = useState<InactivityAlertContact['method']>('whatsapp')
  const [result, setResult] = useState('')
  const [note, setNote] = useState('')
  const [nextFollowUpDate, setNextFollowUpDate] = useState('')

  return (
    <form
      className="mt-4 grid gap-3 rounded-sm border border-neutral-200 p-4 dark:border-neutral-800 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (!result.trim()) return
        onSubmit({
          method,
          result: result.trim(),
          note: note.trim(),
          next_follow_up_date: nextFollowUpDate || undefined,
        })
      }}
      data-testid="contact-form"
    >
      <select className="input" value={method} onChange={(event) => setMethod(event.target.value as InactivityAlertContact['method'])}>
        <option value="whatsapp">WhatsApp</option>
        <option value="call">Llamada</option>
        <option value="email">Correo</option>
        <option value="in_person">Presencial</option>
      </select>
      <input className="input" value={result} onChange={(event) => setResult(event.target.value)} placeholder="Resultado del contacto" data-testid="contact-result" />
      <textarea className="input min-h-20 md:col-span-2" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nota para seguimiento" />
      <input className="input" type="date" value={nextFollowUpDate} onChange={(event) => setNextFollowUpDate(event.target.value)} />
      <button type="submit" className="btn-primary" disabled={isBusy || !result.trim()} data-testid="submit-contact">
        Guardar contacto
      </button>
    </form>
  )
}

function MembersWithoutAlertsList({ members, isLoading }: { members: MemberWithoutInactivityAlert[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="card h-20 p-4 skeleton" />)}
      </div>
    )
  }
  if (!members.length) {
    return (
      <EmptyState
        icon={<Users size={42} />}
        title="Tus miembros mantienen una asistencia regular."
        description="No hay miembros activos sin alerta para mostrar con los datos actuales."
      />
    )
  }
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-heading text-xl font-bold text-neutral-900 dark:text-white">Estos miembros mantienen una asistencia regular.</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Tienen membresía activa y no presentan una alerta abierta.</p>
      </div>
      {members.map((member) => (
        <div key={member.id} className="card flex items-center justify-between gap-3 p-4" data-testid={`regular-member-${member.id}`}>
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={member.full_name} photo={member.photo} size="sm" />
            <div className="min-w-0">
              <p className="font-medium text-neutral-900 dark:text-white">{member.full_name}</p>
              <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">{member.email}</p>
            </div>
          </div>
          <Badge variant="success">Regular</Badge>
        </div>
      ))}
    </section>
  )
}
