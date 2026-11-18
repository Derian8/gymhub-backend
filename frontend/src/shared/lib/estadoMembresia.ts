import type { EstadoCliente } from '@/shared/types'

interface ContextoEstado {
  estado_cliente?: EstadoCliente
  is_active?: boolean
  status?: string
  current_period_end?: string | null
  end_date?: string | null
  membership_expires_at?: string | null
  access_allowed?: boolean
  membership_access_allowed?: boolean
  can_check_in?: boolean
  membresia_actual?: ContextoEstado | null
}

export const ESTADOS_CLIENTE = {
  membresia_activa: {
    label: 'Membresía activa', shortLabel: 'Activa',
    variant: 'success' as const, priority: 2,
    detail: 'El período está pagado y vigente.',
  },
  membresia_inactiva: {
    label: 'Membresía inactiva', shortLabel: 'Inactiva',
    variant: 'error' as const, priority: 1,
    detail: 'El período venció o todavía no está pagado. Registra el pago para activar la membresía.',
  },
  cliente_inactivo: {
    label: 'Cliente inactivo', shortLabel: 'Inactivo',
    variant: 'neutral' as const, priority: 0,
    detail: 'Más de 30 días de atraso o perfil desactivado. Revisa la renovación con administración.',
  },
}

export function obtenerEstadoMembresia(datos?: ContextoEstado | null, compacto = false) {
  let estado = datos?.estado_cliente ?? datos?.membresia_actual?.estado_cliente
  if (!estado) {
    const membresia = datos?.membresia_actual ?? datos
    const vencimiento = membresia?.current_period_end ?? membresia?.end_date
      ?? membresia?.membership_expires_at
    const partes = new Intl.DateTimeFormat('en', {
      timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date())
    const parte = (tipo: string) => partes.find(item => item.type === tipo)?.value
    const hoy = [parte('year'), parte('month'), parte('day')].join('-')
    const atraso = vencimiento
      ? Math.floor((Date.parse(hoy) - Date.parse(vencimiento.slice(0, 10))) / 86_400_000)
      : 0
    const bloqueada = ['suspended', 'cancelled'].includes(membresia?.status ?? '')
    estado = datos?.is_active === false || atraso > 30 ? 'cliente_inactivo'
      : !bloqueada && (vencimiento ? atraso <= 0
        : Boolean(membresia?.access_allowed || membresia?.membership_access_allowed || membresia?.can_check_in))
        ? 'membresia_activa' : 'membresia_inactiva'
  }
  const presentacion = ESTADOS_CLIENTE[estado]
  return { ...presentacion, estado, label: compacto ? presentacion.shortLabel : presentacion.label }
}
