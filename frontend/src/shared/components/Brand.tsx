import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function BrandMark({ size = 'md', className }: BrandMarkProps) {
  const tamanos = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-14 w-14' }
  return (
    <img
      src="/marca/pulso-icono.png"
      alt="PULSO"
      width={56}
      height={56}
      className={cn('shrink-0 rounded-full bg-white object-contain', tamanos[size], className)}
    />
  )
}

interface BrandWordmarkProps {
  compact?: boolean
  className?: string
}

export function BrandWordmark({ compact = false, className }: BrandWordmarkProps) {
  return (
    <div className={cn('inline-flex min-w-0 flex-col items-start gap-3', className)}>
      <div className={cn('pulso-logo-placa', compact ? 'w-32' : 'w-52')}>
        <div className="pulso-logo-encuadre">
          <img src="/marca/pulso-logo.png" alt="PULSO" width={1448} height={1086} />
        </div>
      </div>
      {!compact && (
        <p className="max-w-xs text-xs font-medium leading-relaxed text-neutral-600 dark:text-neutral-300">
          El ritmo de tu gimnasio en un solo lugar
        </p>
      )}
    </div>
  )
}

export function PulsoDecorativo({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 600 160" fill="none" className={className}>
      <path d="M0 94h180l42-67 43 116 46-91h80l25 42h184" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
