import { cn } from '@/shared/lib/utils'

interface BadgeProps {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral'
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'neutral', children, className }: BadgeProps) {
  return (
    <span className={cn('badge', `badge-${variant}`, className)}>
      {children}
    </span>
  )
}

interface AvatarProps {
  name: string
  photo?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Avatar({ name, photo, size = 'md', className }: AvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
  }

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        className={cn('rounded-full object-cover', sizeClasses[size], className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-bold bg-primary/10 text-primary',
        sizeClasses[size],
        className,
      )}
    >
      {initials}
    </div>
  )
}

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && (
        <div className="mb-4 text-neutral-400 dark:text-neutral-600 opacity-50">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-heading font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-neutral-500 dark:text-neutral-500 max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
  breadcrumb?: Array<{ label: string; href?: string }>
}

export function PageHeader({ title, subtitle, action, breadcrumb }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        {breadcrumb && (
          <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 mb-1">
            {breadcrumb.map((item, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span>/</span>}
                <span className={i === breadcrumb.length - 1 ? 'text-neutral-900 dark:text-white' : ''}>
                  {item.label}
                </span>
              </span>
            ))}
          </div>
        )}
        <h1 className="text-3xl lg:text-4xl font-heading font-bold uppercase tracking-tight text-neutral-900 dark:text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  variant?: 'default' | 'danger' | 'success' | 'warning' | 'info'
  trend?: { value: number; label: string }
  'data-testid'?: string
}

export function StatCard({ label, value, icon, variant = 'default', trend, 'data-testid': testId }: StatCardProps) {
  const variantClasses = {
    default: '',
    danger: 'border-red-500/30',
    success: 'border-green-500/30',
    warning: 'border-yellow-500/30',
    info: 'border-blue-500/30',
  }

  const iconClasses = {
    default: 'text-neutral-400',
    danger: 'text-red-400',
    success: 'text-green-400',
    warning: 'text-yellow-400',
    info: 'text-blue-400',
  }

  return (
    <div className={cn('stat-card', variantClasses[variant])} data-testid={testId}>
      <div className="flex items-center justify-between">
        <span className="label-base">{label}</span>
        {icon && <span className={iconClasses[variant]}>{icon}</span>}
      </div>
      <span className="text-3xl font-heading font-bold text-neutral-900 dark:text-white">
        {value}
      </span>
      {trend && (
        <span className={cn('text-xs', trend.value >= 0 ? 'text-green-500' : 'text-red-500')}>
          {trend.value >= 0 ? '▲' : '▼'} {Math.abs(trend.value)}% {trend.label}
        </span>
      )}
    </div>
  )
}

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  isPending?: boolean
  onConfirm: () => void
  onCancel: () => void
  'data-testid'?: string
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  isPending = false,
  onConfirm,
  onCancel,
  'data-testid': testId,
}: ConfirmDialogProps) {
  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/70 px-4"
      role="dialog"
      aria-modal="true"
      data-testid={testId}
    >
      <div className="w-full max-w-lg rounded-lg border border-red-500/30 bg-white p-6 shadow-xl dark:bg-neutral-950">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Accion destructiva</p>
        <h3 className="mt-2 font-heading text-xl font-bold text-neutral-900 dark:text-white">{title}</h3>
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">{description}</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={isPending}>
            {cancelLabel}
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm} disabled={isPending}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
