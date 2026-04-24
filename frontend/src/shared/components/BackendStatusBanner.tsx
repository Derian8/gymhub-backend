import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react'
import { useBackendStatusStore } from '@/shared/store/backendStatusStore'

export function BackendStatusBanner() {
  const issue = useBackendStatusStore((s) => s.issue)
  const clearIssue = useBackendStatusStore((s) => s.clearIssue)

  if (!issue) {
    return null
  }

  const resetLocalSession = () => {
    window.localStorage.removeItem('gymhub-auth')
    clearIssue()
    window.dispatchEvent(new CustomEvent('auth:logout'))
    window.location.reload()
  }

  const reloadPage = () => {
    clearIssue()
    window.location.reload()
  }

  return (
    <div
      className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
      data-testid="backend-status-banner"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{issue.title}</p>
          <p className="mt-1 break-words text-amber-800 dark:text-amber-200">{issue.message}</p>
          <p className="mt-2 text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Backend esperado: {issue.backendUrl}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={reloadPage}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <RefreshCw size={14} />
              Recargar
            </button>
            <button
              type="button"
              onClick={resetLocalSession}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <Trash2 size={14} />
              Limpiar sesión local
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
