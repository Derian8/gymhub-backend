import { CalendarClock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMemberDashboardQuery } from '@/modules/members/hooks/useMembers'
import { Badge } from '@/shared/components/UI'
import { SymbolFrame } from '@/shared/components/Brand'
import { obtenerEstadoMembresia } from '@/shared/lib/estadoMembresia'
import { formatDate } from '@/shared/lib/utils'

export function TarjetaMembresiaCliente({ clienteId }: { clienteId: number }) {
  const { data: resumenMembresia } = useMemberDashboardQuery(clienteId)
  const estadoMembresia = obtenerEstadoMembresia(resumenMembresia)
  return (
    <section
      className="mt-6 rounded-[1.75rem] border border-primary/25 bg-primary/5 p-5 shadow-sm dark:border-primary/20 dark:bg-primary/10"
      data-testid="profile-membership-spotlight"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <SymbolFrame size="md" tone={estadoMembresia.estado === 'membresia_activa' ? 'success' : 'danger'}>
            <CalendarClock size={18} />
          </SymbolFrame>
          <div>
            <p className="label-base">Membresía actual</p>
            <h2 className="font-heading text-2xl font-black text-neutral-900 dark:text-white">
              {resumenMembresia?.membership_plan_name || 'Sin membresía asignada'}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={estadoMembresia.variant}>
                {estadoMembresia.label}
              </Badge>
              <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                {resumenMembresia?.membership_access_allowed ? 'Acceso permitido' : 'Acceso requiere revisión'}
              </span>
            </div>
            <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
              {resumenMembresia?.membership_expires_at
                ? `Vence el ${formatDate(resumenMembresia.membership_expires_at)}.`
                : 'Fecha de vencimiento no disponible.'}
              {' '}
              {resumenMembresia?.days_overdue != null
                ? `${resumenMembresia.days_overdue} día(s) vencida.`
                : resumenMembresia?.days_until_due != null
                  ? `${resumenMembresia.days_until_due} día(s) restantes.`
                  : ''}
            </p>
          </div>
        </div>
        <Link to="/membership" className="btn-primary" data-testid="profile-membership-link">
          Ver mi membresía
        </Link>
      </div>
    </section>
  )
}
