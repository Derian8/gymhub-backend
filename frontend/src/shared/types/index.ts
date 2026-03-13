// ============================================================
// Shared TypeScript Types for GymHub
// ============================================================

// --- Auth ---
export interface User {
  id: number
  email: string
  username: string
  first_name: string
  last_name: string
  role: 'member' | 'trainer'
  is_staff: boolean
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  username: string
  first_name: string
  last_name: string
  role: 'member' | 'trainer'
  password: string
  password2: string
}

// --- Member ---
export interface MembershipPlan {
  id: number
  name: string
  description: string
  price_monthly: string
  duration_months: number
  features: string
}

export interface MemberProfile {
  id: number
  user: User
  email: string
  full_name: string
  membership_plan: number | null
  phone: string
  birth_date: string | null
  emergency_contact: string
  join_date: string
  is_active: boolean
  photo: string | null
}

export interface MemberDashboardSummary {
  payment_status: 'paid' | 'pending' | 'late' | null
  days_until_due: number | null
  days_overdue: number | null
  last_checkin: string | null
  active_plan: { id: number; name: string } | null
  nutrition_goal: string | null
  inactivity_alert: boolean
  unread_notifications: number
  today_has_workout: boolean
  weekly_sessions_done: number
}

// --- Trainer Overview ---
export interface TrainerOverview {
  total_active_members: number
  checked_in_today: number
  members_in_mora: number
  members_inactive_30d: number
  pending_alerts: number
  revenue_this_month: number
  new_members_this_month: number
  sessions_completed_this_week: number
}

// --- Plans ---
export type GoalType = 'fat_loss' | 'muscle_gain' | 'endurance' | 'flexibility' | 'general'
export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'legs' | 'glutes' | 'core' | 'full_body' | 'cardio'
export type DayLabel = 'A' | 'B' | 'C' | 'D'

export interface Exercise {
  id: number
  name: string
  muscle_group: MuscleGroup
  sets: number
  reps_range: string
  weight_suggestion_kg: number | null
  rest_seconds: number
  technique_notes: string
  order: number
}

export interface WorkoutDay {
  id: number
  name: string
  day_label: DayLabel
  order: number
  exercises: Exercise[]
}

export interface TrainingPlan {
  id: number
  member: number
  trainer: number
  name: string
  goal: GoalType
  start_date: string
  end_date: string | null
  weeks_duration: number
  days_per_week: number
  is_active: boolean
  workout_days?: WorkoutDay[]
}

export interface TodayWorkout {
  workout_day: WorkoutDay
  plan: TrainingPlan
  day_index: number
}

// --- Attendance ---
export interface Attendance {
  id: number
  member: number
  check_in_time: string
  check_out_time: string | null
  notes: string
}

// --- Progress ---
export interface ProgressLog {
  id: number
  member: number
  date: string
  weight_kg: number | null
  body_fat_percentage: number | null
  notes: string
  source: string
}

export interface WorkoutSession {
  id: number
  member: number
  workout_day: number
  attendance: number | null
  started_at: string
  completed_at: string | null
  is_completed: boolean
  overall_feeling: number | null
  trainer_notes: string
  exercise_logs?: ExerciseLog[]
}

export interface ExerciseLog {
  id: number
  session: number
  exercise: number
  sets_completed: number
  reps_completed: number
  weight_used_kg: number | null
  rpe: number | null
  notes: string
}

export interface ProgressByExercise {
  exercise_name: string
  data_points: Array<{
    date: string
    weight_used_kg: number | null
    sets: number
    reps_completed: number
    rpe: number | null
  }>
}

// --- Billing ---
export type PaymentStatus = 'paid' | 'pending' | 'late'

export interface PaymentSchedule {
  id: number
  member: number
  plan: number
  due_date: string
  recurrence_type: string
  grace_period_days: number
  is_active: boolean
}

export interface PaymentRecord {
  id: number
  schedule: PaymentSchedule
  amount: string
  paid_at: string | null
  status: PaymentStatus
  notes: string
}

export interface PaymentMethod {
  id: number
  member: number
  type: 'cash' | 'transfer' | 'card'
  details: string
  is_default: boolean
  is_active: boolean
}

// --- Alerts ---
export interface InactivityAlert {
  id: number
  member: number
  member_name?: string
  created_at: string
  resolved: boolean
  resolved_by: number | null
  resolved_at: string | null
}

export interface Notification {
  id: number
  user: number
  message: string
  read: boolean
  created_at: string
}

// --- Nutrition ---
export interface NutritionProfile {
  id: number
  member: number
  goal_type: string
  calories_target: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  notes: string
}

export interface NutritionGuideline {
  id: number
  title: string
  goal_type: string
  content: string
  created_at: string
}

// --- AI Chat ---
export interface AIChatMessage {
  id: number
  user: number
  role: 'user' | 'assistant'
  content: string
  tokens_used: number
  created_at: string
}

export interface AIChatRequest {
  message: string
}

export interface AIChatResponse {
  reply: string
  tokens_used: number
  daily_count: number
  daily_limit: number
}

// --- Classes ---
export interface GymClass {
  id: number
  name: string
  description: string
  trainer: number
  capacity: number
  scheduled_at: string
  duration_minutes: number
  location: string
  is_active: boolean
}

// --- Pagination ---
export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// --- API Error ---
export interface ApiError {
  message: string
  status: number
  data?: Record<string, unknown>
}
