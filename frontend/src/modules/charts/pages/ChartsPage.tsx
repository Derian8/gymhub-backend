import { useState } from 'react'
import { Activity, TrendingUp, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { chartsApi, type ChartType } from '../api/chartsApi'
import { progressApi } from '@/modules/progress/api/progressApi'
import { PageHeader, EmptyState } from '@/shared/components/UI'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, BarChart, Bar
} from 'recharts'
import { formatDate } from '@/shared/lib/utils'

const CHART_TYPES: Array<{ value: ChartType; label: string }> = [
  { value: 'attendance_monthly', label: 'Asistencia mensual' },
  { value: 'retention_rate', label: 'Tasa de retención' },
  { value: 'payment_status', label: 'Estado de pagos' },
  { value: 'physical_progress', label: 'Progreso físico' },
  { value: 'exercise_progression', label: 'Progresión de ejercicios' },
]

export function ChartsPage() {
  const [selectedType, setSelectedType] = useState<ChartType>('attendance_monthly')

  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: QUERY_KEYS.CHART(selectedType),
    queryFn: () => chartsApi.get(selectedType),
  })

  const { data: progressLogs, isLoading: progressLoading } = useQuery({
    queryKey: QUERY_KEYS.PROGRESS_LOGS,
    queryFn: progressApi.logs,
  })

  const progressData = progressLogs?.results.map((log) => ({
    date: formatDate(log.date),
    peso: log.weight_kg,
    grasa: log.body_fat_percentage,
  })).reverse() || []

  const { data: sessions } = useQuery({
    queryKey: QUERY_KEYS.WORKOUT_SESSIONS,
    queryFn: progressApi.sessions,
  })

  return (
    <div data-testid="charts-page" className="page-enter">
      <PageHeader title="Gráficas" subtitle="Estadísticas y análisis del gimnasio" />

      {/* Chart type selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CHART_TYPES.map((type) => (
          <button
            key={type.value}
            onClick={() => setSelectedType(type.value)}
            data-testid={`chart-type-${type.value}`}
            className={`px-4 py-2 text-sm font-medium rounded-sm transition-colors ${
              selectedType === type.value
                ? 'bg-primary text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Backend chart image */}
      <div className="card p-6 mb-6">
        <h3 className="font-heading font-bold text-lg text-neutral-900 dark:text-white mb-4">
          {CHART_TYPES.find((t) => t.value === selectedType)?.label}
        </h3>
        {chartLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin text-neutral-400" size={32} />
          </div>
        ) : chartData?.url ? (
          <img
            src={chartData.url}
            alt={selectedType}
            className="w-full rounded-sm"
            data-testid="chart-image"
          />
        ) : (
          <EmptyState
            icon={<Activity size={32} />}
            title="Gráfica no disponible"
            description="No hay datos suficientes para generar esta gráfica"
          />
        )}
      </div>

      {/* Progress chart (client side) */}
      {progressData.length > 0 && (
        <div className="card p-6 mb-6" data-testid="progress-chart">
          <h3 className="font-heading font-bold text-lg text-neutral-900 dark:text-white mb-4">
            Progreso físico (mi historial)
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={progressData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--tw-color-neutral-900, #171717)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="peso" stroke="#FF3B30" name="Peso (kg)" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="grasa" stroke="#007AFF" name="Grasa (%)" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Sessions chart */}
      {sessions?.results && sessions.results.length > 0 && (
        <div className="card p-6" data-testid="sessions-chart">
          <h3 className="font-heading font-bold text-lg text-neutral-900 dark:text-white mb-4">
            Sesiones de entrenamiento
          </h3>
          <div className="text-center">
            <span className="text-5xl font-heading font-black text-primary">
              {sessions.results.filter((s) => s.is_completed).length}
            </span>
            <p className="text-sm text-neutral-400 mt-1">sesiones completadas</p>
          </div>
        </div>
      )}
    </div>
  )
}
