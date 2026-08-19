import { cn } from '@/shared/lib/utils'
import { BrandMark, SymbolFrame } from './Brand'

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
        'rounded-[1.1rem] flex items-center justify-center font-bold border border-primary/10 bg-gradient-to-br from-white to-primary/10 text-primary shadow-sm dark:border-white/10 dark:from-neutral-900 dark:to-primary/10',
        sizeClasses[size],
        className,
      )}
    >
      <span className="relative z-10">{initials}</span>
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
      <div className="mb-5">
        {icon ? (
          <SymbolFrame size="lg" className="h-16 w-16 rounded-[1.4rem]">
            <span className="text-neutral-500 dark:text-neutral-300">{icon}</span>
          </SymbolFrame>
        ) : (
          <BrandMark size="lg" />
        )}
      </div>
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
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
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
        <h1 className="text-3xl lg:text-4xl font-heading font-bold uppercase tracking-[0.04em] text-neutral-900 dark:text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</p>
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
    danger: 'border-red-500/20',
    success: 'border-green-500/20',
    warning: 'border-yellow-500/20',
    info: 'border-blue-500/20',
  }

  const iconTones = {
    default: 'default' as const,
    danger: 'danger' as const,
    success: 'success' as const,
    warning: 'warning' as const,
    info: 'primary' as const,
  }

  return (
    <div className={cn('stat-card', variantClasses[variant])} data-testid={testId}>
      <div className="flex items-center justify-between gap-3">
        <span className="label-base">{label}</span>
        {icon && (
          <SymbolFrame tone={iconTones[variant]} size="sm" className="rounded-xl">
            {icon}
          </SymbolFrame>
        )}
      </div>
      <span className="text-3xl font-heading font-bold tracking-tight text-neutral-900 dark:text-white">
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
