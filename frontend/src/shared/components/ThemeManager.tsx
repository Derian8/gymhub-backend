import { useLayoutEffect } from 'react'
import { useAuthStore } from '@/shared/store/authStore'

export function ThemeManager() {
  const theme = useAuthStore((state) => state.theme)

  useLayoutEffect(() => {
    const root = document.documentElement
    const isDark = theme === 'dark'

    root.classList.toggle('dark', isDark)
    root.style.colorScheme = theme
  }, [theme])

  return null
}
