import type { AxiosError } from 'axios'

export interface BackendIssue {
  kind: 'network' | 'stale_bundle' | 'backend_error' | 'backend_not_ready' | 'backend_slow'
  title: string
  message: string
  backendUrl: string
}

const PLACEHOLDER_URLS = new Set(['', 'https://api.tu-dominio.com'])
const HEALTH_TIMEOUT_MS = 5000

interface BackendHealthProbeResult {
  live: boolean
  ready: boolean
}

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

async function fetchHealth(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    })
    return response.ok
  } catch {
    return false
  } finally {
    window.clearTimeout(timeoutId)
  }
}

async function probeBackendHealth(backendUrl: string): Promise<BackendHealthProbeResult> {
  const normalizedUrl = backendUrl.trim().replace(/\/$/, '')
  if (!normalizedUrl || PLACEHOLDER_URLS.has(normalizedUrl)) {
    return { live: false, ready: false }
  }

  const live = await fetchHealth(`${normalizedUrl}/health/live/`)
  if (!live) {
    return { live: false, ready: false }
  }

  const ready = await fetchHealth(`${normalizedUrl}/health/ready/`)
  return { live, ready }
}

export async function diagnoseBackendIssue(
  error: AxiosError,
  backendUrl: string,
): Promise<BackendIssue | null> {
  const normalizedUrl = backendUrl.trim()
  const displayUrl = normalizedUrl || 'sin configurar'
  const classified = classifyBackendIssue(error, backendUrl)

  if (classified?.kind === 'stale_bundle' || classified?.kind === 'backend_error') {
    return classified
  }

  if (error.response) {
    return classified
  }

  const probe = await probeBackendHealth(backendUrl)
  if (!probe.live) {
    return classified
  }

  if (!probe.ready) {
    return {
      kind: 'backend_not_ready',
      title: 'El backend está vivo pero no está listo',
      message: `La API en ${displayUrl} responde, pero su estado de readiness falló. Revisa base de datos, caché o arranque del runtime.`,
      backendUrl: displayUrl,
    }
  }

  if (error.code === 'ECONNABORTED') {
    return {
      kind: 'backend_slow',
      title: 'El backend respondió demasiado lento',
      message: `La API en ${displayUrl} está viva y lista, pero excedió el tiempo de espera del cliente. Revisa latencia de Vercel, Supabase o la consulta del endpoint.`,
      backendUrl: displayUrl,
    }
  }

  return classified
}
