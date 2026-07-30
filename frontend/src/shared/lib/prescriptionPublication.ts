export type TipoPublicacionPrescripcion =
  | 'plan'
  | 'dia'
  | 'ejercicio'
  | 'entrenamiento'
  | 'nutricion'
  | 'guia'

export interface PublicacionPrescripcion {
  memberId: number
  tipo: TipoPublicacionPrescripcion
  fechaIso: string
}

function getStorageKey(memberId: number) {
  return `gymhub:prescription-publication:${memberId}`
}

export function guardarPublicacionPrescripcion(memberId: number, tipo: TipoPublicacionPrescripcion) {
  if (typeof window === 'undefined') {
    return
  }

  const payload: PublicacionPrescripcion = {
    memberId,
    tipo,
    fechaIso: new Date().toISOString(),
  }

  window.localStorage.setItem(getStorageKey(memberId), JSON.stringify(payload))
}

export function leerPublicacionPrescripcion(memberId: number): PublicacionPrescripcion | null {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(getStorageKey(memberId))
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as PublicacionPrescripcion
    if (!parsed?.fechaIso || !parsed?.tipo) {
      return null
    }
    if (parsed.tipo === 'nutricion' || parsed.tipo === 'guia') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function descripcionPublicacionPrescripcion(tipo: TipoPublicacionPrescripcion) {
  switch (tipo) {
    case 'plan':
      return 'Plan activo'
    case 'dia':
      return 'Día de entrenamiento'
    case 'ejercicio':
      return 'Ejercicio'
    case 'entrenamiento':
      return 'Base de entrenamiento'
    default:
      return 'Prescripción'
  }
}
