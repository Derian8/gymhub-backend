import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/shared/store/authStore'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'trainer' | 'member' | 'any'
}

export function ProtectedRoute({ children, requiredRole = 'any' }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore()

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
  const { isAuthenticated, user } = useAuthStore()

  if (isAuthenticated && user) {
    if (user.role === 'trainer' || user.is_staff) {
      return <Navigate to="/dashboard/trainer" replace />
    }
    return <Navigate to="/dashboard/member" replace />
  }

  return <>{children}</>
}
