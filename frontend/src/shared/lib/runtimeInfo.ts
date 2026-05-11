const APP_BUILD_STORAGE_KEY = 'gymhub-build-id'
const FRONTEND_PRODUCTION_URL = 'https://proyectoappgym-frontend.vercel.app'
const PREVIEW_BYPASS_PARAM = 'preview'

export const APP_BUILD_ID = import.meta.env.VITE_APP_BUILD_ID || 'dev-local'
export const PRODUCTION_FRONTEND_URL = FRONTEND_PRODUCTION_URL
export const PREVIEW_BYPASS_QUERY = `${PREVIEW_BYPASS_PARAM}=1`

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

export function isPreviewBypassEnabled(search: string = window.location.search): boolean {
  return new URLSearchParams(search).get(PREVIEW_BYPASS_PARAM) === '1'
}

export function shouldRedirectPreviewToProduction(
  hostname: string = window.location.hostname,
  search: string = window.location.search,
): boolean {
  return hostname !== 'localhost'
    && hostname !== '127.0.0.1'
    && isPreviewDeployment()
    && !isProductionAlias()
    && !isPreviewBypassEnabled(search)
}

export function getProductionRedirectUrl(
  pathname: string = window.location.pathname,
  search: string = window.location.search,
  hash: string = window.location.hash,
): string {
  const params = new URLSearchParams(search)
  params.delete(PREVIEW_BYPASS_PARAM)
  const nextSearch = params.toString()
  return `${FRONTEND_PRODUCTION_URL}${pathname}${nextSearch ? `?${nextSearch}` : ''}${hash}`
}

export function syncClientBuildState(onBuildChange: () => void) {
  const previousBuildId = window.localStorage.getItem(APP_BUILD_STORAGE_KEY)
  if (previousBuildId && previousBuildId !== APP_BUILD_ID) {
    onBuildChange()
  }
  window.localStorage.setItem(APP_BUILD_STORAGE_KEY, APP_BUILD_ID)
}
