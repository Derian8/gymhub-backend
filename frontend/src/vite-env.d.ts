/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_PROXY_TARGET: string
  readonly VITE_API_TIMEOUT_MS: string
  readonly VITE_APP_BUILD_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
