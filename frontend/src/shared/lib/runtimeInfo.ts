const APP_BUILD_STORAGE_KEY = 'gymhub-build-id'

export const APP_BUILD_ID = import.meta.env.VITE_APP_BUILD_ID || 'dev-local'

export function getRuntimeOrigin(): string {
  return window.location.origin
}

export function isPreviewDeployment(): boolean {
  const hostname = window.location.hostname
  return hostname.includes('-') && hostname.endsWith('.vercel.app')
}

export function syncClientBuildState(onBuildChange: () => void) {
  const previousBuildId = window.localStorage.getItem(APP_BUILD_STORAGE_KEY)
  if (previousBuildId && previousBuildId !== APP_BUILD_ID) {
    onBuildChange()
  }
  window.localStorage.setItem(APP_BUILD_STORAGE_KEY, APP_BUILD_ID)
}
