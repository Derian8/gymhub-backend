import React from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/shared/store/authStore'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'trainer' | 'member' | 'any'
}

export function ProtectedRoute({ children, requiredRole = 'any' }: ProtectedRouteProps) {
  const { isAuthenticated, authResolved, user } = useAuthStore()

  if (!authResolved) {
    return <AuthLoadingScreen />
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole === 'trainer' && user.role !== 'trainer' && !user.is_staff) {
    return <Navigate to="/dashboard/member" replace />
  }

  if (requiredRole === 'member' && user.role !== 'member') {
    return <Navigate to="/dashboard/trainer" replace />
  }

  return <>{children}</>
}

export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, authResolved, user } = useAuthStore()

  if (!authResolved) {
    return <AuthLoadingScreen />
  }

  if (isAuthenticated && user) {
    if (user.role === 'trainer' || user.is_staff) {
      return <Navigate to="/dashboard/trainer" replace />
    }
    return <Navigate to="/dashboard/member" replace />
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
