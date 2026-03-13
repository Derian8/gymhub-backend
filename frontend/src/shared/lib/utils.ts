import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string | null | undefined, fmt = 'dd/MM/yyyy'): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), fmt, { locale: es })
  } catch {
    return dateStr
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy 'a las' HH:mm", { locale: es })
  } catch {
    return dateStr
  }
}

export function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true, locale: es })
  } catch {
    return dateStr
  }
}

export function formatCurrency(amount: string | number | null | undefined): string {
  if (amount == null) return '—'
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num)
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export const GOAL_LABELS: Record<string, string> = {
  fat_loss: 'Pérdida de grasa',
  muscle_gain: 'Ganancia muscular',
  endurance: 'Resistencia',
  flexibility: 'Flexibilidad',
  general: 'General',
}

export const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Pecho',
  back: 'Espalda',
  shoulders: 'Hombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  legs: 'Piernas',
  glutes: 'Glúteos',
  core: 'Core',
  full_body: 'Cuerpo completo',
  cardio: 'Cardio',
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: 'Pagado',
  pending: 'Pendiente',
  late: 'En mora',
}

export const PAYMENT_STATUS_CLASS: Record<string, string> = {
  paid: 'badge-success',
  pending: 'badge-warning',
  late: 'badge-error',
}

export function extractApiError(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: unknown } }).response
    if (response?.data) {
      const data = response.data as Record<string, unknown>
      if (typeof data === 'string') return data
      const values = Object.values(data).flat()
      if (values.length > 0) return String(values[0])
    }
  }
  return 'Ocurrió un error inesperado'
}
