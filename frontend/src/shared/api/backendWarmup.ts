const HEALTH_PATH = '/health/live/'
const HEALTH_TIMEOUT_MS = 20000
const RETRY_DELAY_MS = 750
const READY_CACHE_MS = 60000

let warmupRequest: Promise<void> | null = null
let lastReadyAt = 0

export class BackendWarmupError extends Error {
  code = 'BACKEND_WARMUP_FAILED'

  constructor() {
    super('El servidor tardó demasiado en prepararse. Intenta nuevamente.')
    this.name = 'BackendWarmupError'
  }
}

async function healthRequest(baseUrl: string): Promise<boolean> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS)

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${HEALTH_PATH}`, {
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

async function waitForBackend(baseUrl: string): Promise<void> {
  if (await healthRequest(baseUrl)) {
    lastReadyAt = Date.now()
    return
  }

  await new Promise((resolve) => window.setTimeout(resolve, RETRY_DELAY_MS))
  if (await healthRequest(baseUrl)) {
    lastReadyAt = Date.now()
    return
  }

  throw new BackendWarmupError()
}

export function warmBackend(baseUrl = ''): Promise<void> {
  if (Date.now() - lastReadyAt < READY_CACHE_MS) {
    return Promise.resolve()
  }
  if (!warmupRequest) {
    warmupRequest = waitForBackend(baseUrl).finally(() => {
      warmupRequest = null
    })
  }
  return warmupRequest
}

export function resetBackendWarmupForTests() {
  warmupRequest = null
  lastReadyAt = 0
}
