import { useState } from 'react'
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import { useAlertsQuery, useResolveAlertMutation } from '../hooks/useAlerts'
import { Badge, PageHeader, EmptyState } from '@/shared/components/UI'
import { formatRelative } from '@/shared/lib/utils'
import type { InactivityAlert } from '@/shared/types'

export function AlertsPage() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('pending')
  const { data, isLoading } = useAlertsQuery()
  const { mutate: resolve, isPending: isResolving, variables: resolvingId } = useResolveAlertMutation()

  const filtered = data?.results.filter((a) => {
    if (filter === 'pending') return !a.resolved
    if (filter === 'resolved') return a.resolved
    return true
  }) || []

  return (
    <div data-testid="alerts-page" className="page-enter">
      <PageHeader
        title="Alertas de Inactividad"
        subtitle={`${data?.results.filter((a) => !a.resolved).length || 0} alertas pendientes`}
      />

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'pending', 'resolved'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            data-testid={`filter-${f}`}
            className={`px-4 py-2 text-sm font-medium rounded-sm transition-colors ${
              filter === f
                ? 'bg-primary text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendientes' : 'Resueltas'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card p-4 h-16 skeleton" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<CheckCircle size={48} className="text-green-400" />}
          title="Sin alertas"
          description={filter === 'pending' ? '¡Todo está en orden! No hay alertas pendientes.' : 'No hay alertas en esta categoría.'}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onResolve={() => resolve(alert.id)}
              isResolving={isResolving && resolvingId === alert.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface AlertCardProps {
  alert: InactivityAlert
  onResolve: () => void
  isResolving: boolean
}

function AlertCard({ alert, onResolve, isResolving }: AlertCardProps) {
  return (
    <div
      className={`card p-5 flex items-center justify-between gap-4 ${
        !alert.resolved ? 'border-yellow-500/30' : ''
      }`}
      data-testid={`alert-card-${alert.id}`}
    >
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded-sm ${alert.resolved ? 'bg-green-100 dark:bg-green-900/20 text-green-500' : 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-500'}`}>
          {alert.resolved ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-900 dark:text-white">
            Alerta de inactividad #{alert.id}
          </p>
          <p className="text-xs text-neutral-400">
            Creada {formatRelative(alert.created_at)}
            {alert.resolved_at && ` · Resuelta ${formatRelative(alert.resolved_at)}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <Badge variant={alert.resolved ? 'success' : 'warning'}>
          {alert.resolved ? 'Resuelta' : 'Pendiente'}
        </Badge>
        {!alert.resolved && (
          <button
            onClick={onResolve}
            disabled={isResolving}
            className="btn-primary text-xs py-2 px-3 flex items-center gap-1"
            data-testid={`resolve-alert-${alert.id}`}
          >
            {isResolving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
            Resolver
          </button>
        )}
      </div>
    </div>
  )
}
