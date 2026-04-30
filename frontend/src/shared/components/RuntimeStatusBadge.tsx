import { APP_BUILD_ID, getRuntimeOrigin, isPreviewDeployment } from '@/shared/lib/runtimeInfo'

export function RuntimeStatusBadge() {
  const preview = isPreviewDeployment()

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400"
      data-testid="runtime-status-badge"
    >
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
  )
}
