import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { PerfilUsuario, User } from '@/shared/types'

const CONTEXT_KEY = 'gymhub-active-context'

export function getAvailableProfiles(user: User | null): PerfilUsuario[] {
  if (!user) return []
  if (user.perfiles_disponibles?.length) return user.perfiles_disponibles
  const profiles: PerfilUsuario[] = []
  if (user.is_staff) profiles.push('administrador')
  if (user.trainerprofile_id || user.role === 'trainer') profiles.push('instructor')
  if (user.memberprofile_id || user.role === 'member') profiles.push('cliente')
  return profiles
}

export function getDefaultContext(user: User): PerfilUsuario {
  if (user.contexto_predeterminado) return user.contexto_predeterminado
  if (user.is_staff) return 'administrador'
  if (user.trainerprofile_id || user.role === 'trainer') return 'instructor'
  return 'cliente'
}

export function getResolvedContext(
  user: User | null,
  context: PerfilUsuario | null,
): PerfilUsuario | null {
  if (!user) return null
  return context && getAvailableProfiles(user).includes(context)
    ? context
    : getDefaultContext(user)
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  authResolved: boolean
  activeContext: PerfilUsuario | null
  theme: 'dark' | 'light'
  setUser: (user: User | null) => void
  setAuthResolved: (resolved: boolean) => void
  setActiveContext: (context: PerfilUsuario) => void
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
      activeContext: null,
      theme: 'dark',

      setUser: (user) => set((state) => {
        if (!user) {
          window.sessionStorage.removeItem(CONTEXT_KEY)
          return { user: null, isAuthenticated: false, activeContext: null }
        }
        const profiles = getAvailableProfiles(user)
        const stored = window.sessionStorage.getItem(CONTEXT_KEY) as PerfilUsuario | null
        const activeContext: PerfilUsuario = stored && profiles.includes(stored)
          ? stored
          : state.activeContext && profiles.includes(state.activeContext)
            ? state.activeContext
            : getDefaultContext(user)
        window.sessionStorage.setItem(CONTEXT_KEY, activeContext)
        return { user, isAuthenticated: true, activeContext }
      }),

      setAuthResolved: (authResolved) => set({ authResolved }),

      setActiveContext: (activeContext) => set((state) => {
        if (!getAvailableProfiles(state.user).includes(activeContext)) return state
        window.sessionStorage.setItem(CONTEXT_KEY, activeContext)
        return { activeContext }
      }),

      logout: () => {
        window.sessionStorage.removeItem(CONTEXT_KEY)
        set({
          user: null,
          isAuthenticated: false,
          authResolved: true,
          activeContext: null,
        })
      },

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
