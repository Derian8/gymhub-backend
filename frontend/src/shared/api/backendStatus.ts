import type { AxiosError } from 'axios'

export interface BackendIssue {
  kind: 'network' | 'stale_bundle' | 'backend_error'
  title: string
  message: string
  backendUrl: string
}

const PLACEHOLDER_URLS = new Set(['', 'https://api.tu-dominio.com'])

export function classifyBackendIssue(error: AxiosError, backendUrl: string): BackendIssue | null {
  const normalizedUrl = backendUrl.trim()
  const displayUrl = normalizedUrl || 'sin configurar'

  if (!error.response) {
    if (PLACEHOLDER_URLS.has(normalizedUrl)) {
      return {
        kind: 'stale_bundle',
        title: 'Frontend desactualizado o API sin configurar',
        message: `La app intenta usar "${displayUrl}". Recarga la página y verifica el deploy/env del frontend.`,
        backendUrl: displayUrl,
      }
    }

    return {
      kind: 'network',
      title: 'No se puede alcanzar el backend',
      message: `No hubo respuesta desde ${displayUrl}. Reintenta, recarga la página o revisa red/cookies.`,
      backendUrl: displayUrl,
    }
  }

  if (error.response.status >= 500) {
    return {
      kind: 'backend_error',
      title: 'El backend respondió con error',
      message: `La API en ${displayUrl} respondió ${error.response.status}. La infraestructura está reachable pero el servidor necesita revisión.`,
      backendUrl: displayUrl,
    }
  }

  return null
}
