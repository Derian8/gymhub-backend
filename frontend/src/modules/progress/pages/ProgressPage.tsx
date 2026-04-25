import { Activity, Ruler, Scale } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { progressApi } from '../api/progressApi'
import { Badge, PageHeader, EmptyState } from '@/shared/components/UI'
import { TableRowSkeleton } from '@/shared/components/Skeleton'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'
import { formatDate } from '@/shared/lib/utils'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip
} from 'recharts'

export function ProgressPage() {
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: QUERY_KEYS.PROGRESS_LOGS(),
    queryFn: () => progressApi.logs(),
  })

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: QUERY_KEYS.WORKOUT_SESSIONS,
    queryFn: progressApi.sessions,
  })

  const { data: physicalSummary } = useQuery({
    queryKey: ['progress-logs', 'summary', 'self'],
    queryFn: () => progressApi.summary(),
  })

  const chartData = logs?.results
    .slice()
    .reverse()
    .map((log) => ({
      date: formatDate(log.recorded_at),
      peso: log.weight_kg,
      grasa: log.body_fat_pct,
    })) || []

  return (
    <div data-testid="progress-page" className="page-enter">
      <PageHeader title="Mi Progreso" subtitle="Seguimiento de métricas y evolución" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" data-testid="physical-summary-grid">
        <div className="card p-5">
          <p className="label-base mb-2">Peso actual</p>
          <div className="text-2xl font-heading font-bold text-neutral-900 dark:text-white">
            {physicalSummary?.current_weight_kg == null ? 'Sin dato' : `${physicalSummary.current_weight_kg} kg`}
          </div>
          {physicalSummary?.weight_change_kg != null && (
            <p className="text-sm text-neutral-500 mt-2">
              Cambio vs medición previa: {physicalSummary.weight_change_kg > 0 ? '+' : ''}
              {physicalSummary.weight_change_kg} kg
            </p>
          )}
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="label-base">Altura</p>
            <Ruler size={16} className="text-sky-500" />
          </div>
          <div className="text-2xl font-heading font-bold text-neutral-900 dark:text-white">
            {physicalSummary?.height_cm == null ? 'Sin dato' : `${physicalSummary.height_cm} cm`}
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="label-base">IMC actual</p>
            <Badge variant={physicalSummary?.bmi == null ? 'neutral' : 'info'}>
              {physicalSummary?.latest_recorded_at ? formatDate(physicalSummary.latest_recorded_at) : 'Sin medición'}
            </Badge>
          </div>
          <div className="text-2xl font-heading font-bold text-neutral-900 dark:text-white">
            {physicalSummary?.bmi == null ? 'Sin dato' : physicalSummary.bmi}
          </div>
        </div>
      </div>

      {/* Weight chart */}
      {chartData.length > 0 ? (
        <div className="card p-6 mb-6" data-testid="weight-chart">
          <h3 className="font-heading font-bold text-lg text-neutral-900 dark:text-white mb-4">
            Evolución de peso
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="peso" stroke="#FF3B30" name="Peso (kg)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {/* Progress logs table */}
      <div className="card p-6 mb-6">
        <h3 className="font-heading font-bold text-lg text-neutral-900 dark:text-white mb-4">
          Registros de progreso
        </h3>
        {logsLoading ? (
          <div className="table-container">
            <table className="table-base">
              <tbody>{Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={4} />)}</tbody>
            </table>
          </div>
        ) : !logs?.results.length ? (
          <EmptyState
            icon={<Scale size={32} />}
            title="Sin registros de progreso"
            description="Tus métricas aparecerán aquí cuando tu entrenador las registre"
          />
        ) : (
          <div className="table-container">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="th-base">Fecha</th>
                  <th className="th-base">Peso (kg)</th>
                  <th className="th-base">Altura (cm)</th>
                  <th className="th-base">Grasa (%)</th>
                  <th className="th-base">Notas</th>
                </tr>
              </thead>
              <tbody>
                {logs.results.map((log) => (
                  <tr key={log.id} className="tr-hover" data-testid={`progress-row-${log.id}`}>
                    <td className="td-base">{formatDate(log.recorded_at)}</td>
                    <td className="td-base font-semibold">{log.weight_kg ?? '—'}</td>
                    <td className="td-base">{log.height_cm ?? '—'}</td>
                    <td className="td-base">{log.body_fat_pct ?? '—'}</td>
                    <td className="td-base text-xs text-neutral-400">{log.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sessions summary */}
      <div className="card p-6">
        <h3 className="font-heading font-bold text-lg text-neutral-900 dark:text-white mb-4">
          Sesiones de entrenamiento
        </h3>
        {sessionsLoading ? (
          <div className="table-container">
            <table className="table-base">
              <tbody>{Array.from({ length: 3 }).map((_, i) => <TableRowSkeleton key={i} cols={4} />)}</tbody>
            </table>
          </div>
        ) : !sessions?.results.length ? (
          <EmptyState
            icon={<Activity size={32} />}
            title="Sin sesiones registradas"
            description="Tus sesiones de entrenamiento aparecerán aquí"
          />
        ) : (
          <div className="table-container">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="th-base">Fecha</th>
                  <th className="th-base">Estado</th>
                  <th className="th-base">Sensación</th>
                </tr>
              </thead>
              <tbody>
                {sessions.results.slice(0, 10).map((s) => (
                  <tr key={s.id} className="tr-hover" data-testid={`session-row-${s.id}`}>
                    <td className="td-base">{formatDate(s.started_at)}</td>
                    <td className="td-base">
                      <span className={`text-xs font-medium ${s.is_completed ? 'text-green-500' : 'text-yellow-500'}`}>
                        {s.is_completed ? '✓ Completada' : '⏳ En progreso'}
                      </span>
                    </td>
                    <td className="td-base">
                      {s.overall_feeling ? `${s.overall_feeling}/5` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
