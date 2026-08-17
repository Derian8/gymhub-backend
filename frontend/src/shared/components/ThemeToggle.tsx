import { Moon, Sun } from 'lucide-react'
import { useAuthStore } from '@/shared/store/authStore'
import { cn } from '@/shared/lib/utils'

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useAuthStore()
  const isDark = theme === 'dark'
  const label = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      data-testid="theme-toggle"
      className={cn('transition-colors', className)}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}
