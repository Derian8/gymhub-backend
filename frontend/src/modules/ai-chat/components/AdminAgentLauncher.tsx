import { useEffect, useState } from 'react'
import { Bot, X } from 'lucide-react'

import { AdminAgentsPanel } from '@/modules/dashboard/components/AdminAgentsPanel'
import { useAuthStore } from '@/shared/store/authStore'

export function AdminAgentLauncher() {
  const user = useAuthStore((state) => state.user)
  const [abierto, setAbierto] = useState(false)
  const esAdministrador = Boolean(user?.is_staff || user?.role === 'admin')

  useEffect(() => {
    if (!abierto) return

    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAbierto(false)
    }

    window.addEventListener('keydown', cerrarConEscape)
    return () => window.removeEventListener('keydown', cerrarConEscape)
  }, [abierto])

  if (!esAdministrador) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Abrir agente IA de administración"
        title="Agente IA de administración"
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950 lg:bottom-6 lg:right-6"
        data-testid="admin-agent-launcher"
      >
        <Bot size={19} />
        <span>Agente IA</span>
      </button>

      {abierto ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAbierto(false)
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-agent-modal-title"
            className="relative max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-t-2xl border border-neutral-200 bg-white p-4 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950 sm:rounded-2xl sm:p-6"
            data-testid="admin-agent-modal"
          >
            <div className="mb-3 flex items-center justify-between gap-4 sm:mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Acceso rápido</p>
                <h2 id="admin-agent-modal-title" className="mt-1 text-lg font-semibold text-neutral-900 dark:text-white">
                  Asistente de administración
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar agente IA"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-neutral-200 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-neutral-800 dark:hover:bg-neutral-900 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <AdminAgentsPanel />
          </section>
        </div>
      ) : null}
    </>
  )
}
