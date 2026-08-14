import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { getDefaultContext, getResolvedContext, useAuthStore } from '@/shared/store/authStore'
import type { PerfilUsuario, User } from '@/shared/types'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'admin' | 'trainer' | 'member' | 'operator' | 'any'
}

export function homePathForUser(user: User, context?: PerfilUsuario | null) {
  const selected = context || user.contexto_predeterminado
  if (selected === 'cliente') return '/dashboard/member'
  if (selected === 'instructor') return '/dashboard/trainer'
  if (selected === 'administrador') return '/dashboard/admin'
  if (user.is_staff) return '/dashboard/admin'
  if (user.trainerprofile_id || user.role === 'trainer') return '/dashboard/trainer'
  return '/dashboard/member'
}

export function ProtectedRoute({ children, requiredRole = 'any' }: ProtectedRouteProps) {
  const { isAuthenticated, authResolved, user, activeContext } = useAuthStore()
  const location = useLocation()

  if (!authResolved) {
    return <AuthLoadingScreen />
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }
  const currentContext = getResolvedContext(user, activeContext)

  if (user.requiere_cambio_contrasena && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  if (requiredRole === 'admin' && !user.is_staff) {
    return <Navigate to={homePathForUser(user, currentContext)} replace />
  }

  const hasTrainerProfile = Boolean(user.trainerprofile_id || user.role === 'trainer')
  const hasMemberProfile = Boolean(user.memberprofile_id || user.role === 'member')

  if (requiredRole === 'trainer' && !user.is_staff && (!hasTrainerProfile || currentContext !== 'instructor')) {
    return <Navigate to={homePathForUser(user, currentContext)} replace />
  }

  if (requiredRole === 'member' && (!hasMemberProfile || currentContext !== 'cliente')) {
    return <Navigate to={homePathForUser(user, currentContext)} replace />
  }

  if (requiredRole === 'operator' && !user.is_staff && (!hasTrainerProfile || currentContext !== 'instructor')) {
    return <Navigate to={homePathForUser(user, currentContext)} replace />
  }

  return <>{children}</>
}

export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, authResolved, user, activeContext } = useAuthStore()

  if (!authResolved) {
    return <AuthLoadingScreen />
  }

  if (isAuthenticated && user) {
    return <Navigate to={homePathForUser(user, activeContext || getDefaultContext(user))} replace />
  }

  return <>{children}</>
}

function AuthLoadingScreen() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 text-neutral-500 dark:text-neutral-400"
      data-testid="auth-loading"
    >
      <div className="flex items-center gap-3 text-sm">
        <Loader2 size={18} className="animate-spin" />
        Verificando sesión...
      </div>
    </div>
  )
}
