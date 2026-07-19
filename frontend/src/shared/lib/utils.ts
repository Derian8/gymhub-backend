import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { MuscleGroup } from '@/shared/types'

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
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 0,
  }).format(num)
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
  maintenance: 'Mantenimiento',
  general: 'General',
}

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Pecho',
  back: 'Espalda',
  lats: 'Dorsales',
  shoulders: 'Hombros',
  traps: 'Trapecios',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebrazos',
  legs: 'Piernas',
  quadriceps: 'Cuádriceps',
  hamstrings: 'Isquiotibiales',
  glutes: 'Glúteos',
  calves: 'Pantorrillas',
  adductors: 'Aductores',
  abductors: 'Abductores',
  hip_flexors: 'Flexores de cadera',
  core: 'Core',
  abs: 'Abdominales',
  obliques: 'Oblicuos',
  lower_back: 'Zona lumbar',
  full_body: 'Cuerpo completo',
  cardio: 'Cardio',
}

export const MUSCLE_GROUP_OPTIONS: Array<{ value: MuscleGroup; label: string }> = [
  { value: 'chest', label: MUSCLE_LABELS.chest },
  { value: 'back', label: MUSCLE_LABELS.back },
  { value: 'lats', label: MUSCLE_LABELS.lats },
  { value: 'shoulders', label: MUSCLE_LABELS.shoulders },
  { value: 'traps', label: MUSCLE_LABELS.traps },
  { value: 'biceps', label: MUSCLE_LABELS.biceps },
  { value: 'triceps', label: MUSCLE_LABELS.triceps },
  { value: 'forearms', label: MUSCLE_LABELS.forearms },
  { value: 'legs', label: MUSCLE_LABELS.legs },
  { value: 'quadriceps', label: MUSCLE_LABELS.quadriceps },
  { value: 'hamstrings', label: MUSCLE_LABELS.hamstrings },
  { value: 'glutes', label: MUSCLE_LABELS.glutes },
  { value: 'calves', label: MUSCLE_LABELS.calves },
  { value: 'adductors', label: MUSCLE_LABELS.adductors },
  { value: 'abductors', label: MUSCLE_LABELS.abductors },
  { value: 'hip_flexors', label: MUSCLE_LABELS.hip_flexors },
  { value: 'core', label: MUSCLE_LABELS.core },
  { value: 'abs', label: MUSCLE_LABELS.abs },
  { value: 'obliques', label: MUSCLE_LABELS.obliques },
  { value: 'lower_back', label: MUSCLE_LABELS.lower_back },
  { value: 'full_body', label: MUSCLE_LABELS.full_body },
  { value: 'cardio', label: MUSCLE_LABELS.cardio },
]

export const DAY_OF_WEEK_LABELS: Record<string, string> = {
  mon: 'Lunes',
  tue: 'Martes',
  wed: 'Miércoles',
  thu: 'Jueves',
  fri: 'Viernes',
  sat: 'Sábado',
  sun: 'Domingo',
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

export const RISK_LEVEL_LABELS: Record<string, string> = {
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
}

export const RISK_LEVEL_BADGE: Record<string, 'success' | 'warning' | 'error'> = {
  low: 'success',
  medium: 'warning',
  high: 'error',
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
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: unknown }).code || '')
    if (code === 'BACKEND_WARMUP_FAILED') {
      return 'El servidor tardó demasiado en prepararse. Intenta nuevamente.'
    }
    if (code === 'ECONNABORTED') {
      return 'El servidor respondió demasiado lento. Intenta nuevamente.'
    }
    if (!('response' in error)) {
      return 'No se pudo conectar con el servidor. Revisa tu conexión e intenta nuevamente.'
    }
  }
  return 'Ocurrió un error inesperado'
}
