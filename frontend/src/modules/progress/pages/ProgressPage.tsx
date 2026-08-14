import { useEffect, useState, type FormEvent } from 'react'
import { Activity, Plus, Ruler, Scale } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { progressApi } from '../api/progressApi'
import { Badge, PageHeader, EmptyState } from '@/shared/components/UI'
import { TableRowSkeleton } from '@/shared/components/Skeleton'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'
import { formatDate } from '@/shared/lib/utils'
import { getResolvedContext, useAuthStore } from '@/shared/store/authStore'
import { useMembersQuery } from '@/modules/members/hooks/useMembers'
import { toast } from 'sonner'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip
} from 'recharts'

export function ProgressPage() {
  const { user, activeContext } = useAuthStore()
  const clientView = getResolvedContext(user, activeContext) === 'cliente'
  const { data: members } = useMembersQuery({ assignment: 'mine' }, !clientView)
  const [memberId, setMemberId] = useState(0)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!clientView && !memberId && members?.results.length) setMemberId(members.results[0].id)
  }, [clientView, memberId, members])

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: QUERY_KEYS.PROGRESS_LOGS(clientView ? undefined : memberId),
    queryFn: () => progressApi.logs(clientView ? undefined : memberId),
    enabled: clientView || memberId > 0,
  })

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: [...QUERY_KEYS.WORKOUT_SESSIONS, clientView ? 'self' : memberId],
    queryFn: () => progressApi.sessions(clientView ? undefined : memberId),
    enabled: clientView || memberId > 0,
  })

  const { data: physicalSummary } = useQuery({
    queryKey: ['progress-logs', 'summary', clientView ? 'self' : memberId],
    queryFn: () => progressApi.summary(clientView ? undefined : memberId),
    enabled: clientView || memberId > 0,
  })

  const createLog = useMutation({
    mutationFn: (payload: Parameters<typeof progressApi.createLog>[0]) => progressApi.createLog(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROGRESS_LOGS(memberId) })
      queryClient.invalidateQueries({ queryKey: ['progress-logs', 'summary', memberId] })
      toast.success('Avance registrado')
    },
    onError: () => toast.error('No se pudo registrar el avance'),
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
      <PageHeader
        title={clientView ? 'Mi progreso' : 'Progreso de clientes'}
        subtitle={clientView ? 'Consulta tus métricas y evolución registradas.' : 'Selecciona un cliente y registra sus mediciones sin salir del módulo.'}
      />

      {!clientView ? (
        <ProgressOperatorPanel
          members={members?.results || []}
          memberId={memberId}
          onMemberChange={setMemberId}
          onSubmit={(payload) => createLog.mutate({ member: memberId, ...payload })}
          isPending={createLog.isPending}
        />
      ) : null}

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

function ProgressOperatorPanel({ members, memberId, onMemberChange, onSubmit, isPending }: {
  members: Array<{ id: number; full_name: string; email: string }>
  memberId: number
  onMemberChange: (id: number) => void
  onSubmit: (payload: { weight_kg?: number; height_cm?: number; body_fat_pct?: number; waist_cm?: number; notes?: string }) => void
  isPending: boolean
}) {
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [fat, setFat] = useState('')
  const [waist, setWaist] = useState('')
  const [notes, setNotes] = useState('')
  const numberOrUndefined = (value: string) => value.trim() ? Number(value) : undefined

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!memberId) return
    onSubmit({
      weight_kg: numberOrUndefined(weight),
      height_cm: numberOrUndefined(height),
      body_fat_pct: numberOrUndefined(fat),
      waist_cm: numberOrUndefined(waist),
      notes,
    })
  }

  return (
    <section className="card mb-6 p-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.3fr)]">
        <label className="text-sm font-medium">Cliente
          <select className="input mt-2 w-full" value={memberId || ''} onChange={(event) => onMemberChange(Number(event.target.value))}>
            <option value="">Selecciona un cliente</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.full_name || member.email}</option>)}
          </select>
        </label>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MeasurementInput label="Peso kg" value={weight} onChange={setWeight} />
          <MeasurementInput label="Altura cm" value={height} onChange={setHeight} />
          <MeasurementInput label="Grasa %" value={fat} onChange={setFat} />
          <MeasurementInput label="Cintura cm" value={waist} onChange={setWaist} />
          <button className="btn-primary self-end" type="submit" disabled={!memberId || isPending}><Plus size={16} /> Registrar</button>
          <label className="sm:col-span-2 xl:col-span-5 text-sm font-medium">Notas
            <input className="input mt-2 w-full" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observaciones del avance" />
          </label>
        </form>
      </div>
    </section>
  )
}

function MeasurementInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-sm font-medium">{label}<input type="number" min="0" step="0.1" className="input mt-2 w-full" value={value} onChange={(event) => onChange(event.target.value)} /></label>
}
