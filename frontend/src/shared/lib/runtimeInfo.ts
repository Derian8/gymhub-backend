const APP_BUILD_STORAGE_KEY = 'gymhub-build-id'
const FRONTEND_PRODUCTION_URL = 'https://proyectoappgym-frontend.vercel.app'

export const APP_BUILD_ID = import.meta.env.VITE_APP_BUILD_ID || 'dev-local'
export const PRODUCTION_FRONTEND_URL = FRONTEND_PRODUCTION_URL

export function getRuntimeOrigin(): string {
  return window.location.origin
}

export function isPreviewDeployment(): boolean {
  const hostname = window.location.hostname
  return hostname !== 'proyectoappgym-frontend.vercel.app' && hostname.endsWith('.vercel.app')
}

export function isProductionAlias(): boolean {
  return window.location.origin === FRONTEND_PRODUCTION_URL
}

export function syncClientBuildState(onBuildChange: () => void) {
  const previousBuildId = window.localStorage.getItem(APP_BUILD_STORAGE_KEY)
  if (previousBuildId && previousBuildId !== APP_BUILD_ID) {
    onBuildChange()
  }
  window.localStorage.setItem(APP_BUILD_STORAGE_KEY, APP_BUILD_ID)
}
