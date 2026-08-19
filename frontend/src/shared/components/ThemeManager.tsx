import { useLayoutEffect } from 'react'
import { THEME_STORAGE_KEY, useAuthStore } from '@/shared/store/authStore'

export function ThemeManager() {
  const theme = useAuthStore((state) => state.theme)

  useLayoutEffect(() => {
    const root = document.documentElement
    const isDark = theme === 'dark'

    root.classList.toggle('dark', isDark)
    root.style.colorScheme = theme
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // El tema sigue funcionando aunque el navegador bloquee el almacenamiento.
    }
  }, [theme])

  return null
}
