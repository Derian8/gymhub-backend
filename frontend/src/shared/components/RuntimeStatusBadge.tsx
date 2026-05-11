import { APP_BUILD_ID, getRuntimeOrigin, isPreviewBypassEnabled, isPreviewDeployment, isProductionAlias, PREVIEW_BYPASS_QUERY, PRODUCTION_FRONTEND_URL } from '@/shared/lib/runtimeInfo'

export function RuntimeStatusBadge() {
  const preview = isPreviewDeployment()
  const isStable = isProductionAlias()
  const previewBypass = isPreviewBypassEnabled()

  return (
    <div className="mb-4 space-y-3" data-testid="runtime-status-badge">
      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        <span className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700">
          {preview ? 'Preview' : 'Production'}
        </span>
        <span className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700">
          {getRuntimeOrigin()}
        </span>
        <span className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700">
          build {APP_BUILD_ID}
        </span>
      </div>

      {preview && !isStable ? (
        <div
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
          data-testid="preview-runtime-notice"
        >
          <p className="font-semibold">
            {previewBypass ? 'Estás forzando un deployment preview de Vercel.' : 'Estás viendo un deployment preview de Vercel.'}
          </p>
          <p className="mt-1 text-amber-800/90 dark:text-amber-200/80">
            Esta URL puede ser distinta a la versión estable. Para validar funcionamiento normal, usa{' '}
            <a
              href={PRODUCTION_FRONTEND_URL}
              className="font-semibold underline underline-offset-2"
            >
              {PRODUCTION_FRONTEND_URL}
            </a>
            {!previewBypass ? null : (
              <>
                {' '}o quita <span className="font-semibold">{PREVIEW_BYPASS_QUERY}</span> de la URL para volver al alias estable.
              </>
            )}
            .
          </p>
        </div>
      ) : null}
    </div>
  )
}
