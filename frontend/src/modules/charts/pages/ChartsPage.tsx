import { useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  Calendar,
  CreditCard,
  Dumbbell,
  Loader2,
  RefreshCcw,
  Search,
  Scale,
  TrendingUp,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { chartsApi } from '../api/chartsApi'
import { PageHeader, EmptyState, Badge } from '@/shared/components/UI'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'
import { formatDate } from '@/shared/lib/utils'
import { useAuthStore } from '@/shared/store/authStore'
import type { ChartSeriesPoint, MemberChartsOverview, TrainerChartsOverview } from '@/shared/types'

const RISK_BADGE: Record<'low' | 'medium' | 'high', 'success' | 'warning' | 'error'> = {
  low: 'success',
  medium: 'warning',
  high: 'error',
}

const PAYMENT_LABELS: Record<string, string> = {
  paid: 'Al día',
  pending: 'Pendiente',
  late: 'En mora',
  sin_dato: 'Sin dato',
}

const MEMBERSHIP_LABELS: Record<string, string> = {
  active: 'Activa',
  expiring: 'Próxima a vencer',
  expired: 'Vencida',
  suspended: 'Suspendida',
  pending: 'Pendiente',
  none: 'Sin membresía',
}

const FOLLOWUP_LABELS: Record<string, string> = {
  ok: 'Al día',
  attention: 'Atención',
  urgent: 'Urgente',
}

const FOLLOWUP_BADGE: Record<'ok' | 'attention' | 'urgent', 'success' | 'warning' | 'error'> = {
  ok: 'success',
  attention: 'warning',
  urgent: 'error',
}

type TrainerChartFilters = {
  period: '7' | '30' | '90' | 'custom'
  start_date: string
  end_date: string
  membership_status: string
  followup_status: string
  search: string
}

const DEFAULT_TRAINER_FILTERS: TrainerChartFilters = {
  period: '30',
  start_date: '',
  end_date: '',
  membership_status: 'all',
  followup_status: 'all',
  search: '',
}

export function ChartsPage() {
  const { user } = useAuthStore()
  const [trainerFilters, setTrainerFilters] = useState<TrainerChartFilters>(DEFAULT_TRAINER_FILTERS)
  const trainerQueryParams = useMemo(() => {
    if (user?.role !== 'trainer') return undefined
    return Object.fromEntries(
      Object.entries(trainerFilters).filter(([, value]) => value),
    ) as Record<string, string>
  }, [trainerFilters, user?.role])
  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.CHART_OVERVIEW, trainerQueryParams],
    queryFn: () => chartsApi.getOverview(trainerQueryParams),
  })
  const hasActiveTrainerFilters = user?.role === 'trainer' && JSON.stringify(trainerFilters) !== JSON.stringify(DEFAULT_TRAINER_FILTERS)

  return (
    <div data-testid="charts-page" className="page-enter space-y-6">
      <PageHeader
        title={user?.role === 'trainer' ? 'Resumen de tus miembros' : 'Mis Gráficos'}
        subtitle={
          user?.role === 'trainer'
            ? 'Revisa asistencia, progreso y estado de membresías para identificar quién necesita seguimiento.'
            : 'Progreso físico, adherencia y estado operativo de tu proceso.'
        }
      />

      {isLoading ? (
        <div className="card p-10 flex items-center justify-center">
          <Loader2 className="animate-spin text-neutral-400" size={32} />
        </div>
      ) : !data ? (
        <EmptyState
          icon={<Activity size={36} />}
          title="Sin analytics disponibles"
          description="Todavía no hay suficientes datos para construir tus gráficos."
        />
      ) : data.role === 'trainer' ? (
        <TrainerChartsView
          data={data}
          filters={trainerFilters}
          setFilters={setTrainerFilters}
          hasActiveFilters={hasActiveTrainerFilters}
          onResetFilters={() => setTrainerFilters(DEFAULT_TRAINER_FILTERS)}
        />
      ) : (
        <MemberChartsView data={data} />
      )}
    </div>
  )
}

function MemberChartsView({ data }: { data: MemberChartsOverview }) {
  const summaryCards = [
    {
      label: 'Peso actual',
      value: data.summary.current_weight == null ? 'Sin dato' : `${data.summary.current_weight} kg`,
      icon: <Scale size={18} className="text-primary" />,
    },
    {
      label: 'Sesiones esta semana',
      value: String(data.summary.sessions_this_week),
      icon: <Dumbbell size={18} className="text-emerald-500" />,
    },
    {
      label: 'Racha de asistencia',
      value: `${data.summary.streak_asistencia} días`,
      icon: <Calendar size={18} className="text-amber-500" />,
    },
    {
      label: 'Cumplimiento semanal',
      value: data.summary.cumplimiento_semanal == null ? 'Sin meta' : `${data.summary.cumplimiento_semanal}%`,
      icon: <TrendingUp size={18} className="text-sky-500" />,
    },
  ]

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="label-base">{card.label}</span>
              {card.icon}
            </div>
            <div className="text-2xl font-heading font-black text-neutral-900 dark:text-white">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="card p-6">
          <SectionTitle title="Progreso físico" subtitle="Peso, grasa y cintura según registros reales del member." />
          {data.physical_progress.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.physical_progress}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="weight_kg" name="Peso" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="body_fat_pct" name="Grasa" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="waist_cm" name="Cintura" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState text="Aún no hay registros físicos para mostrar tendencia." />
          )}
        </div>

        <div className="card p-6 space-y-4">
          <SectionTitle title="Estado actual" subtitle="Riesgo, pagos y siguiente acción." />
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500">Riesgo personal</span>
            <Badge variant={RISK_BADGE[data.summary.riesgo_personal.level]}>
              {data.summary.riesgo_personal.level} · {data.summary.riesgo_personal.score}/100
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500">Pago</span>
            <span className="font-semibold text-neutral-900 dark:text-white">
              {data.summary.payment_status ? PAYMENT_LABELS[data.summary.payment_status] : 'Sin dato'}
            </span>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{data.summary.resumen_hoy}</p>
          <p className="text-sm font-medium text-primary">{data.summary.siguiente_accion}</p>
          <div className="space-y-2">
            {data.summary.riesgo_personal.reasons.map((reason) => (
              <div key={reason} className="flex items-start gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                <AlertTriangle size={14} className="mt-0.5 text-amber-500 flex-shrink-0" />
                <span>{reason}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card p-6">
          <SectionTitle title="Adherencia semanal" subtitle="Check-ins y sesiones completadas en las últimas semanas." />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={mergeWeeklySeries(data.attendance_weekly, data.sessions_weekly)}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="asistencias" name="Check-ins" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="sesiones" name="Sesiones" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6">
          <SectionTitle title="Cumplimiento del plan" subtitle="Qué días del plan activo ya ejecutaste esta semana." />
          {data.plan_completion.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.plan_completion}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="completed" name="Sesiones hechas" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState text="Tu plan activo todavía no tiene días visibles para medir cumplimiento." />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_0.9fr] gap-6">
        <div className="card p-6">
          <SectionTitle
            title={data.exercise_progress.exercise_name ? `Progresión en ${data.exercise_progress.exercise_name}` : 'Progresión en ejercicio clave'}
            subtitle="Evolución del peso usado en el ejercicio con más registros."
          />
          {data.exercise_progress.series.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.exercise_progress.series}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="weight_used_kg" name="Peso usado" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState text="Todavía no hay logs de ejercicio suficientes para medir progresión." />
          )}
        </div>

        <div className="card p-6">
          <SectionTitle title="Lecturas útiles" subtitle="Mensajes cortos a partir de tus datos actuales." />
          <div className="space-y-3">
            {data.insights.map((insight) => (
              <div key={insight} className="rounded-sm border border-neutral-200 dark:border-neutral-800 p-3 text-sm text-neutral-700 dark:text-neutral-300">
                {insight}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function TrainerChartsView({
  data,
  filters,
  setFilters,
  hasActiveFilters,
  onResetFilters,
}: {
  data: TrainerChartsOverview
  filters: TrainerChartFilters
  setFilters: Dispatch<SetStateAction<TrainerChartFilters>>
  hasActiveFilters: boolean
  onResetFilters: () => void
}) {
  const cards = [
    {
      label: 'Miembros asignados',
      value: String(data.summary.members_count),
      icon: <Activity size={18} className="text-primary" />,
    },
    {
      label: 'Asistieron en el periodo',
      value: String(data.summary.active_attendance_count ?? 0),
      icon: <Calendar size={18} className="text-sky-500" />,
    },
    {
      label: 'Necesitan seguimiento',
      value: String((data.summary.urgent_followup_count ?? 0) + (data.summary.attention_followup_count ?? 0)),
      icon: <AlertTriangle size={18} className="text-red-500" />,
    },
    {
      label: 'Pagos pendientes',
      value: String((data.summary.pending_payment_count ?? 0) + data.summary.late_payment_count),
      icon: <CreditCard size={18} className="text-amber-500" />,
    },
  ]
  const followupMembers = data.members_needing_followup ?? []

  return (
    <>
      <div className="card p-5">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[160px_1fr_1fr_1fr_1.2fr_auto]">
          <label className="space-y-1">
            <span className="label-base">Periodo</span>
            <select
              className="input"
              value={filters.period}
              onChange={(event) => setFilters((current) => ({ ...current, period: event.target.value as TrainerChartFilters['period'] }))}
              data-testid="trainer-chart-period"
            >
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
              <option value="custom">Rango personalizado</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="label-base">Desde</span>
            <input
              className="input"
              type="date"
              value={filters.start_date}
              disabled={filters.period !== 'custom'}
              onChange={(event) => setFilters((current) => ({ ...current, start_date: event.target.value }))}
              data-testid="trainer-chart-start-date"
            />
          </label>
          <label className="space-y-1">
            <span className="label-base">Hasta</span>
            <input
              className="input"
              type="date"
              value={filters.end_date}
              disabled={filters.period !== 'custom'}
              onChange={(event) => setFilters((current) => ({ ...current, end_date: event.target.value }))}
              data-testid="trainer-chart-end-date"
            />
          </label>
          <label className="space-y-1">
            <span className="label-base">Membresía</span>
            <select
              className="input"
              value={filters.membership_status}
              onChange={(event) => setFilters((current) => ({ ...current, membership_status: event.target.value }))}
              data-testid="trainer-chart-membership"
            >
              <option value="all">Todas</option>
              <option value="active">Activa</option>
              <option value="expiring">Próxima a vencer</option>
              <option value="expired">Vencida</option>
              <option value="suspended">Suspendida</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="label-base">Seguimiento</span>
            <select
              className="input"
              value={filters.followup_status}
              onChange={(event) => setFilters((current) => ({ ...current, followup_status: event.target.value }))}
              data-testid="trainer-chart-followup"
            >
              <option value="all">Todos</option>
              <option value="ok">Al día</option>
              <option value="attention">Atención</option>
              <option value="urgent">Urgente</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              className="btn-secondary flex w-full items-center justify-center gap-2"
              disabled={!hasActiveFilters}
              onClick={onResetFilters}
              data-testid="trainer-chart-reset"
            >
              <RefreshCcw size={16} />
              Limpiar
            </button>
          </div>
        </div>
        <label className="mt-3 block space-y-1">
          <span className="label-base flex items-center gap-2">
            <Search size={14} />
            Buscar miembro
          </span>
          <input
            className="input"
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            placeholder="Nombre o correo"
            data-testid="trainer-chart-search"
          />
        </label>
        {hasActiveFilters ? (
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-500">
            <Badge variant="neutral">Filtros activos</Badge>
            <span>{data.filters?.start_date ? `${formatDate(data.filters.start_date)} - ${formatDate(data.filters.end_date)}` : 'Periodo filtrado'}</span>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="label-base">{card.label}</span>
              {card.icon}
            </div>
            <div className="text-2xl font-heading font-black text-neutral-900 dark:text-white">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card p-6">
          <SectionTitle title="Asistencia y rutinas" subtitle="Check-ins y sesiones completadas en el periodo seleccionado." />
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={mergeWeeklySeries(data.attendance_trend, data.sessions_trend)}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="asistencias" stroke="#2563eb" name="Check-ins" strokeWidth={2} />
              <Line type="monotone" dataKey="sesiones" stroke="#f97316" name="Rutinas completadas" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-6">
          <SectionTitle title="Estado de membresías" subtitle="Vigencia actual de las membresías de tus miembros." />
          <SeriesBarChart data={normalizeLabels(data.membership_distribution ?? [], MEMBERSHIP_LABELS)} barKey="value" barName="Miembros" color="#0ea5e9" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card p-6">
          <SectionTitle title="Pagos de miembros" subtitle="Miembros al día, pendientes o en mora." />
          <SeriesBarChart data={normalizeLabels(data.payment_distribution, PAYMENT_LABELS)} barKey="value" barName="Miembros" color="#f59e0b" />
        </div>
        <div className="card p-6">
          <SectionTitle title="Seguimiento necesario" subtitle="Cuántos miembros están al día, en atención o urgentes." />
          <SeriesBarChart data={normalizeLabels(data.followup_distribution ?? [], FOLLOWUP_LABELS)} barKey="value" barName="Miembros" color="#ef4444" />
        </div>
      </div>

      <div className="card p-6">
        <SectionTitle title="Miembros que necesitan seguimiento" subtitle="Casos concretos derivados de asistencia, pagos, membresía y rutinas." />
        <div className="space-y-3">
          {followupMembers.length ? followupMembers.map((member) => (
              <Link
                key={member.id}
                to={`/members/${member.id}`}
                className="block rounded-sm border border-neutral-200 p-3 transition-colors hover:border-primary dark:border-neutral-800"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-900 dark:text-white">{member.full_name}</p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      {member.email} · Membresía: {MEMBERSHIP_LABELS[member.membership_status] ?? member.membership_status}
                    </p>
                  </div>
                  <Badge variant={FOLLOWUP_BADGE[member.followup_status]}>
                    {FOLLOWUP_LABELS[member.followup_status]}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-neutral-600 dark:text-neutral-300 md:grid-cols-3">
                  <span>Pago: {member.payment_status ? PAYMENT_LABELS[member.payment_status] : 'Sin dato'}</span>
                  <span>Check-in: {member.days_since_last_checkin == null ? 'sin registros' : `${member.days_since_last_checkin} días`}</span>
                  <span>Rutinas: {member.weekly_completion == null ? 'sin meta' : `${member.weekly_completion}%`}</span>
                </div>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{member.reason}</p>
                <p className="mt-2 text-sm text-primary">{member.next_action}</p>
              </Link>
          )) : (
            <EmptyChartState text="No hay miembros que necesiten seguimiento con los filtros actuales." />
          )}
        </div>
      </div>
    </>
  )
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h3 className="font-heading font-bold text-lg text-neutral-900 dark:text-white">{title}</h3>
      <p className="text-sm text-neutral-500 mt-1">{subtitle}</p>
    </div>
  )
}

function EmptyChartState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-[280px] text-sm text-neutral-500 text-center">
      {text}
    </div>
  )
}

function SeriesBarChart({
  data,
  barKey,
  barName,
  color,
  formatValue,
}: {
  data: ChartSeriesPoint[]
  barKey: 'value'
  barName: string
  color: string
  formatValue?: (value: number) => string
}) {
  if (!data.length) {
    return <EmptyChartState text="No hay datos suficientes para esta gráfica." />
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={formatValue} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value: number) => (formatValue ? formatValue(value) : value)} />
        <Bar dataKey={barKey} name={barName} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function mergeWeeklySeries(attendance: ChartSeriesPoint[], sessions: Array<ChartSeriesPoint & { goal?: number }>) {
  return attendance.map((point, index) => ({
    label: point.label,
    asistencias: point.value,
    sesiones: sessions[index]?.value ?? 0,
    meta: sessions[index] && 'goal' in sessions[index] ? sessions[index].goal ?? 0 : 0,
  }))
}

function normalizeLabels(series: ChartSeriesPoint[], labels: Record<string, string>) {
  return series.map((item) => ({
    ...item,
    label: labels[item.label] ?? item.label,
  }))
}
