import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User } from '@/shared/types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  authResolved: boolean
  theme: 'dark' | 'light'
  setUser: (user: User | null) => void
  setAuthResolved: (resolved: boolean) => void
  logout: () => void
  toggleTheme: () => void
  setTheme: (theme: 'dark' | 'light') => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      authResolved: false,
      theme: 'dark',

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
        }),

      setAuthResolved: (authResolved) => set({ authResolved }),

      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          authResolved: true,
        }),

      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'dark' ? 'light' : 'dark',
        })),

      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'gymhub-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
)
