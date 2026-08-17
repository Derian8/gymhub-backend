import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { ProtectedRoute, PublicRoute } from '@/shared/components/RouteGuards'
import { useAuth } from '@/shared/hooks/useAuth'
import { useAuthStore } from '@/shared/store/authStore'
import { useBackendStatusStore } from '@/shared/store/backendStatusStore'
import { getProductionRedirectUrl, shouldRedirectPreviewToProduction, syncClientBuildState } from '@/shared/lib/runtimeInfo'
import { ThemeManager } from '@/shared/components/ThemeManager'

// Auth
import { LoginPage } from '@/modules/auth/pages/LoginPage'
import { ChangePasswordPage } from '@/modules/auth/pages/ChangePasswordPage'

// Dashboards
import { TrainerTechnicalDashboard } from '@/modules/dashboard/pages/TrainerTechnicalDashboard'
import { MemberDashboard } from '@/modules/dashboard/pages/MemberDashboard'
import { AdminDashboard } from '@/modules/admin/pages/AdminDashboard'
import { ReportsPage } from '@/modules/admin/pages/ReportsPage'
import { AdminRoutinesPage } from '@/modules/admin/pages/AdminRoutinesPage'
import { AdminUsersPage } from '@/modules/admin/pages/AdminUsersPage'

// Members
import { MembersPage } from '@/modules/members/pages/MembersPage'
import { MemberDetailPage } from '@/modules/members/pages/MemberDetailPage'
import { NewMemberPage } from '@/modules/members/pages/NewMemberPage'

// Plans
import { PlansPage } from '@/modules/plans/pages/PlansPage'
import { PlanDetailPage } from '@/modules/plans/pages/PlanDetailPage'
import { TodayWorkoutPage } from '@/modules/plans/pages/TodayWorkoutPage'
import { WorkoutDayDetailPage } from '@/modules/plans/pages/WorkoutDayDetailPage'
import { MemberProgramRedirectPage, PlanEditorPage } from '@/modules/plans/pages/PlanEditorPage'

// Attendance
import { CheckInPage } from '@/modules/attendance/pages/CheckInPage'

// Progress
import { ProgressPage } from '@/modules/progress/pages/ProgressPage'

// Billing
import { BillingPage } from '@/modules/billing/pages/BillingPage'
import { MemberMembershipPage } from '@/modules/billing/pages/MemberMembershipPage'

// Profile
import { ProfilePage } from '@/modules/profile/pages/ProfilePage'

const PUBLIC_PATHS = new Set(['/login', '/'])

function PreviewRedirectGuard({ pathname, search, hash }: { pathname: string; search: string; hash: string }) {
  useEffect(() => {
    window.location.replace(
      getProductionRedirectUrl(pathname, search, hash),
    )
  }, [hash, pathname, search])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950 px-6 text-center">
      <div className="max-w-md space-y-3">
        <p className="label-base">Redirigiendo</p>
        <h1 className="text-3xl font-heading font-black text-neutral-900 dark:text-white">
          Abriendo la versión estable
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Este deployment preview puede estar desactualizado. Te estamos llevando al alias principal.
        </p>
      </div>
    </div>
  )
}

function AuthBootstrap() {
  const location = useLocation()
  const { user, isAuthenticated, authResolved, setAuthResolved } = useAuthStore()
  const shouldCheckSession = !PUBLIC_PATHS.has(location.pathname)

  useAuth(shouldCheckSession)

  useEffect(() => {
    if (!shouldCheckSession && !user && !isAuthenticated && !authResolved) {
      setAuthResolved(true)
      return
    }

    if (shouldCheckSession && !user && !isAuthenticated && authResolved) {
      setAuthResolved(false)
    }
  }, [authResolved, isAuthenticated, setAuthResolved, shouldCheckSession, user])

  return null
}

function App() {
  const location = useLocation()
  const logout = useAuthStore((s) => s.logout)
  const setAuthResolved = useAuthStore((s) => s.setAuthResolved)
  const clearBackendIssue = useBackendStatusStore((s) => s.clearIssue)
  const previewRedirectRequired = shouldRedirectPreviewToProduction(window.location.hostname, window.location.search)

  useEffect(() => {
    syncClientBuildState(() => {
      window.localStorage.removeItem('gymhub-auth')
      clearBackendIssue()
      logout()
      setAuthResolved(true)
    })
  }, [clearBackendIssue, logout, setAuthResolved])

  if (previewRedirectRequired) {
    return (
      <PreviewRedirectGuard
        pathname={location.pathname}
        search={location.search}
        hash={location.hash}
      />
    )
  }

  return (
    <>
      <ThemeManager />
      <AuthBootstrap />
      <Routes>
      {/* Public routes */}
      <Route
        element={
          <PublicRoute>
            <AuthLayout />
          </PublicRoute>
        }
      >
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* Protected routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Dashboards */}
        <Route
          path="/dashboard/admin"
          element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>}
        />
        <Route
          path="/dashboard/trainer"
          element={
            <ProtectedRoute requiredRole="trainer">
              <TrainerTechnicalDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/member"
          element={
            <ProtectedRoute requiredRole="member">
              <MemberDashboard />
            </ProtectedRoute>
          }
        />

        {/* Members (trainer/staff only) */}
        <Route path="/members" element={<ProtectedRoute requiredRole="operator"><MembersPage /></ProtectedRoute>} />
        <Route path="/members/:id" element={<ProtectedRoute requiredRole="operator"><MemberDetailPage /></ProtectedRoute>} />
        <Route path="/members/:id/program" element={<ProtectedRoute requiredRole="trainer"><MemberProgramRedirectPage /></ProtectedRoute>} />
        <Route path="/members/new" element={<ProtectedRoute requiredRole="admin"><NewMemberPage /></ProtectedRoute>} />

        <Route path="/routines" element={<ProtectedRoute requiredRole="admin"><AdminRoutinesPage /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin"><AdminUsersPage /></ProtectedRoute>} />

        {/* Plans */}
        <Route
          path="/today"
          element={
            <ProtectedRoute requiredRole="member">
              <TodayWorkoutPage />
            </ProtectedRoute>
          }
        />
        <Route path="/plans" element={<ProtectedRoute requiredRole="trainer"><PlansPage /></ProtectedRoute>} />
        <Route path="/plans/my" element={<ProtectedRoute requiredRole="member"><PlansPage /></ProtectedRoute>} />
        <Route path="/plans/:planId/days/:dayId" element={<WorkoutDayDetailPage />} />
        <Route path="/plans/:id/edit" element={<ProtectedRoute requiredRole="trainer"><PlanEditorPage /></ProtectedRoute>} />
        <Route path="/plans/:id" element={<PlanDetailPage />} />
        <Route path="/plans/:id/today" element={<TodayWorkoutPage />} />

        {/* Attendance */}
        <Route path="/attendance" element={<ProtectedRoute requiredRole="admin"><CheckInPage /></ProtectedRoute>} />
        <Route
          path="/attendance/check-in"
          element={
            <ProtectedRoute requiredRole="member">
              <CheckInPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/records"
          element={
            <ProtectedRoute requiredRole="member">
              <CheckInPage />
            </ProtectedRoute>
          }
        />

        {/* Progress */}
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/sessions" element={<ProgressPage />} />

        {/* Billing */}
        <Route path="/billing" element={<ProtectedRoute requiredRole="admin"><BillingPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute requiredRole="admin"><ReportsPage /></ProtectedRoute>} />
        <Route
          path="/membership"
          element={
            <ProtectedRoute requiredRole="member">
              <MemberMembershipPage />
            </ProtectedRoute>
          }
        />

        {/* Profile */}
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />

      </Route>

      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}

function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-neutral-950">
      <h1 className="text-8xl font-heading font-black text-neutral-900 dark:text-white">404</h1>
      <p className="text-neutral-500 mt-2">Página no encontrada</p>
      <a href="/login" className="btn-primary mt-6 inline-block">Ir al inicio</a>
    </div>
  )
}

export default App
