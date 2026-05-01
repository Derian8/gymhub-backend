import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { ProtectedRoute, PublicRoute } from '@/shared/components/RouteGuards'
import { useAuth } from '@/shared/hooks/useAuth'
import { useAuthStore } from '@/shared/store/authStore'
import { useBackendStatusStore } from '@/shared/store/backendStatusStore'
import { syncClientBuildState } from '@/shared/lib/runtimeInfo'

// Auth
import { LoginPage } from '@/modules/auth/pages/LoginPage'
import { RegisterPage } from '@/modules/auth/pages/RegisterPage'

// Dashboards
import { TrainerDashboard } from '@/modules/dashboard/pages/TrainerDashboard'
import { MemberDashboard } from '@/modules/dashboard/pages/MemberDashboard'

// Members
import { MembersPage } from '@/modules/members/pages/MembersPage'
import { MemberDetailPage } from '@/modules/members/pages/MemberDetailPage'
import { TrainerProgramPage } from '@/modules/members/pages/TrainerProgramPage'

// Plans
import { PlansPage } from '@/modules/plans/pages/PlansPage'
import { PlanDetailPage } from '@/modules/plans/pages/PlanDetailPage'
import { TodayWorkoutPage } from '@/modules/plans/pages/TodayWorkoutPage'

// Attendance
import { CheckInPage } from '@/modules/attendance/pages/CheckInPage'

// Progress
import { ProgressPage } from '@/modules/progress/pages/ProgressPage'

// Alerts
import { AlertsPage } from '@/modules/alerts/pages/AlertsPage'
import { MessagesPage } from '@/modules/alerts/pages/MessagesPage'

// Billing
import { BillingPage } from '@/modules/billing/pages/BillingPage'

// Nutrition
import { NutritionPage } from '@/modules/nutrition/pages/NutritionPage'

// Charts
import { ChartsPage } from '@/modules/charts/pages/ChartsPage'

// AI Chat
import { AiChatPage } from '@/modules/ai-chat/pages/AiChatPage'

// Profile
import { ProfilePage } from '@/modules/profile/pages/ProfilePage'

const PUBLIC_PATHS = new Set(['/login', '/register', '/'])

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
  const logout = useAuthStore((s) => s.logout)
  const setAuthResolved = useAuthStore((s) => s.setAuthResolved)
  const clearBackendIssue = useBackendStatusStore((s) => s.clearIssue)

  useEffect(() => {
    syncClientBuildState(() => {
      window.localStorage.removeItem('gymhub-auth')
      clearBackendIssue()
      logout()
      setAuthResolved(true)
    })
  }, [clearBackendIssue, logout, setAuthResolved])

  return (
    <>
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
        <Route path="/register" element={<RegisterPage />} />
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
          path="/dashboard/trainer"
          element={
            <ProtectedRoute requiredRole="trainer">
              <TrainerDashboard />
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
        <Route path="/members" element={<ProtectedRoute requiredRole="trainer"><MembersPage /></ProtectedRoute>} />
        <Route path="/members/:id" element={<ProtectedRoute requiredRole="trainer"><MemberDetailPage /></ProtectedRoute>} />
        <Route path="/members/:id/program" element={<ProtectedRoute requiredRole="trainer"><TrainerProgramPage /></ProtectedRoute>} />
        <Route path="/members/new" element={<ProtectedRoute requiredRole="trainer"><MemberDetailPage /></ProtectedRoute>} />

        {/* Plans */}
        <Route
          path="/today"
          element={
            <ProtectedRoute requiredRole="member">
              <TodayWorkoutPage />
            </ProtectedRoute>
          }
        />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/plans/my" element={<PlansPage />} />
        <Route path="/plans/:id" element={<PlanDetailPage />} />
        <Route path="/plans/:id/today" element={<TodayWorkoutPage />} />

        {/* Attendance */}
        <Route path="/attendance" element={<CheckInPage />} />
        <Route
          path="/attendance/check-in"
          element={
            <ProtectedRoute requiredRole="member">
              <CheckInPage />
            </ProtectedRoute>
          }
        />

        {/* Progress */}
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/sessions" element={<ProgressPage />} />

        {/* Alerts */}
        <Route
          path="/alerts"
          element={
            <ProtectedRoute requiredRole="trainer">
              <AlertsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <ProtectedRoute requiredRole="member">
              <MessagesPage />
            </ProtectedRoute>
          }
        />

        {/* Billing */}
        <Route path="/billing" element={<BillingPage />} />

        {/* Nutrition */}
        <Route path="/nutrition" element={<NutritionPage />} />

        {/* Charts */}
        <Route
          path="/charts"
          element={
            <ProtectedRoute requiredRole="trainer">
              <ChartsPage />
            </ProtectedRoute>
          }
        />

        {/* AI Chat */}
        <Route path="/ai-chat" element={<AiChatPage />} />

        {/* Profile */}
        <Route path="/profile" element={<ProfilePage />} />

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
