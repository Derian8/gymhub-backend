import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { ProtectedRoute, PublicRoute } from '@/shared/components/RouteGuards'

// Auth
import { LoginPage } from '@/modules/auth/pages/LoginPage'

// Dashboards
import { TrainerDashboard } from '@/modules/dashboard/pages/TrainerDashboard'
import { MemberDashboard } from '@/modules/dashboard/pages/MemberDashboard'

// Members
import { MembersPage } from '@/modules/members/pages/MembersPage'
import { MemberDetailPage } from '@/modules/members/pages/MemberDetailPage'

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

function App() {
  return (
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
        <Route path="/members/new" element={<ProtectedRoute requiredRole="trainer"><MemberDetailPage /></ProtectedRoute>} />

        {/* Plans */}
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/plans/my" element={<PlansPage />} />
        <Route path="/plans/:id" element={<PlanDetailPage />} />
        <Route path="/plans/:id/today" element={<TodayWorkoutPage />} />

        {/* Attendance */}
        <Route path="/attendance" element={<CheckInPage />} />
        <Route path="/attendance/check-in" element={<CheckInPage />} />

        {/* Progress */}
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/sessions" element={<ProgressPage />} />

        {/* Alerts */}
        <Route path="/alerts" element={<AlertsPage />} />

        {/* Billing */}
        <Route path="/billing" element={<BillingPage />} />

        {/* Nutrition */}
        <Route path="/nutrition" element={<NutritionPage />} />

        {/* Charts */}
        <Route path="/charts" element={<ChartsPage />} />

        {/* AI Chat */}
        <Route path="/ai-chat" element={<AiChatPage />} />

        {/* Profile */}
        <Route path="/profile" element={<ProfilePage />} />

        {/* Calendar (placeholder) */}
        <Route path="/calendar" element={<CalendarPlaceholder />} />
      </Route>

      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

function CalendarPlaceholder() {
  return (
    <div className="page-enter text-center py-20">
      <h1 className="text-3xl font-heading font-black text-neutral-900 dark:text-white mb-2">CALENDARIO</h1>
      <p className="text-neutral-500">Próximamente disponible</p>
    </div>
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
