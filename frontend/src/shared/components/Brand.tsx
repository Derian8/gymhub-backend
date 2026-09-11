import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function BrandMark({ size = 'md', className }: BrandMarkProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-14 w-14',
  }

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center overflow-hidden rounded-[0.9rem] border border-black/10 bg-neutral-950 text-white shadow-[0_12px_30px_rgba(10,10,10,0.16)] dark:border-white/10 dark:bg-neutral-900',
        sizeClasses[size],
        className,
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-[2px] rounded-[0.75rem] bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-950 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950" />
      <div className="absolute -right-1 top-1 h-4 w-4 rounded-full bg-primary/85 blur-[2px]" />
      <div className="relative flex items-center gap-1.5">
        <span className="block h-4 w-1.5 rounded-full bg-primary shadow-[0_0_14px_rgba(255,59,48,0.4)]" />
        <span className="block h-3 w-1.5 rounded-full bg-white/95" />
      </div>
    </div>
  )
}

interface BrandWordmarkProps {
  compact?: boolean
  className?: string
}

export function BrandWordmark({ compact = false, className }: BrandWordmarkProps) {
  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      <BrandMark size={compact ? 'sm' : 'md'} />
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-xl font-black uppercase tracking-[0.16em] text-neutral-950 dark:text-white">
            GymHub
          </span>
        </div>
        {!compact && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-neutral-500 dark:text-neutral-400">
            Performance System
          </p>
        )}
      </div>
    </div>
  )
}

interface SymbolFrameProps {
  children: ReactNode
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function SymbolFrame({
  children,
  tone = 'default',
  size = 'md',
  className,
}: SymbolFrameProps) {
  const sizeClasses = {
    sm: 'h-8 w-8 text-[0.95rem]',
    md: 'h-10 w-10 text-[1rem]',
    lg: 'h-12 w-12 text-[1.1rem]',
  }

  const toneClasses = {
    default: 'border-neutral-200 bg-white text-neutral-700 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-200',
    primary: 'border-primary/20 bg-primary/10 text-primary dark:border-primary/20 dark:bg-primary/15 dark:text-primary',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
    warning: 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
    danger: 'border-red-200 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300',
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-2xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]',
        sizeClasses[size],
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
