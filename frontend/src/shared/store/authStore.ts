import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User } from '@/shared/types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  theme: 'dark' | 'light'
  setUser: (user: User | null) => void
  logout: () => void
  toggleTheme: () => void
  setTheme: (theme: 'dark' | 'light') => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      theme: 'dark',

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
        }),

      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
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
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated, theme: state.theme }),
    },
  ),
)
