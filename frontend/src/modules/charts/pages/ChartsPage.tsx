import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  Calendar,
  CreditCard,
  Dumbbell,
  Loader2,
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
import { formatCurrency } from '@/shared/lib/utils'
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

export function ChartsPage() {
  const { user } = useAuthStore()
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.CHART_OVERVIEW,
    queryFn: chartsApi.getOverview,
  })

  return (
    <div data-testid="charts-page" className="page-enter space-y-6">
      <PageHeader
        title={user?.role === 'trainer' ? 'Gráficos Del Trainer' : 'Mis Gráficos'}
        subtitle={
          user?.role === 'trainer'
            ? 'Lectura conjunta de riesgo, cumplimiento y pagos de tu cartera.'
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
        <TrainerChartsView data={data} />
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

function TrainerChartsView({ data }: { data: TrainerChartsOverview }) {
  const cards = [
    {
      label: 'Members asignados',
      value: String(data.summary.members_count),
      icon: <Activity size={18} className="text-primary" />,
    },
    {
      label: 'Riesgo alto',
      value: String(data.summary.high_risk_count),
      icon: <AlertTriangle size={18} className="text-red-500" />,
    },
    {
      label: 'En mora',
      value: String(data.summary.late_payment_count),
      icon: <CreditCard size={18} className="text-amber-500" />,
    },
    {
      label: 'Cumplimiento medio',
      value: data.summary.average_weekly_completion == null ? 'Sin meta' : `${data.summary.average_weekly_completion}%`,
      icon: <TrendingUp size={18} className="text-emerald-500" />,
    },
  ]

  return (
    <>
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
          <SectionTitle title="Riesgo de la cartera" subtitle="Distribución de members por nivel de riesgo." />
          <SeriesBarChart data={data.risk_distribution} barKey="value" barName="Members" color="#ef4444" />
        </div>
        <div className="card p-6">
          <SectionTitle title="Estado de pagos" subtitle="Situación comercial visible del grupo asignado." />
          <SeriesBarChart data={normalizeLabels(data.payment_distribution)} barKey="value" barName="Members" color="#f59e0b" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card p-6">
          <SectionTitle title="Adherencia del grupo" subtitle="Check-ins y sesiones completadas por semana." />
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={mergeWeeklySeries(data.attendance_trend, data.sessions_trend)}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="asistencias" stroke="#2563eb" name="Check-ins" strokeWidth={2} />
              <Line type="monotone" dataKey="sesiones" stroke="#f97316" name="Sesiones" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-6">
          <SectionTitle title="Prescripción e inactividad" subtitle="Members listos, incompletos y rangos de inactividad." />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={composeTrainerStatusData(data.prescription_distribution, data.inactivity_distribution)}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="prescripcion" name="Prescripción" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="inactividad" name="Inactividad" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_0.9fr] gap-6">
        <div className="card p-6">
          <SectionTitle title="Ingresos y planes" subtitle="Cobrado por mes y distribución de suscripciones activas." />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SeriesBarChart data={data.revenue_monthly} barKey="value" barName="Cobrado" color="#22c55e" formatValue={formatCurrency} />
            {data.plan_distribution.length ? (
              <SeriesBarChart data={data.plan_distribution} barKey="value" barName="Suscripciones" color="#0ea5e9" />
            ) : (
              <EmptyChartState text="Aún no hay suscripciones activas para comparar planes." />
            )}
          </div>
        </div>

        <div className="card p-6">
          <SectionTitle title="Members prioritarios" subtitle="A quién intervenir primero según el estado conjunto." />
          <div className="space-y-3">
            {data.top_risk_members.length ? data.top_risk_members.map((member) => (
              <Link
                key={member.id}
                to={`/members/${member.id}`}
                className="block rounded-sm border border-neutral-200 dark:border-neutral-800 p-3 hover:border-primary transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-neutral-900 dark:text-white">{member.full_name}</p>
                    <p className="text-sm text-neutral-500">
                      Pago: {member.payment_status ? PAYMENT_LABELS[member.payment_status] : 'Sin dato'} ·
                      Último check-in: {member.days_since_last_checkin == null ? ' sin registros' : ` ${member.days_since_last_checkin} días`}
                    </p>
                  </div>
                  <Badge variant={RISK_BADGE[member.nivel_riesgo]}>
                    {member.riesgo_adherencia}/100
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-primary">{member.next_action}</p>
              </Link>
            )) : (
              <EmptyChartState text="No hay members críticos priorizados con los datos actuales." />
            )}
          </div>
          <div className="mt-4 space-y-2">
            {data.insights.map((insight) => (
              <div key={insight} className="text-sm text-neutral-600 dark:text-neutral-300">
                {insight}
              </div>
            ))}
          </div>
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

function composeTrainerStatusData(prescription: ChartSeriesPoint[], inactivity: ChartSeriesPoint[]) {
  const max = Math.max(prescription.length, inactivity.length)
  return Array.from({ length: max }).map((_, index) => ({
    label: prescription[index]?.label ?? inactivity[index]?.label ?? '',
    prescripcion: prescription[index]?.value ?? 0,
    inactividad: inactivity[index]?.value ?? 0,
  }))
}

function normalizeLabels(series: ChartSeriesPoint[]) {
  return series.map((item) => ({
    ...item,
    label: PAYMENT_LABELS[item.label] ?? item.label,
  }))
}
