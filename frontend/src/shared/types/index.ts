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
  memberprofile_id: number | null
  trainerprofile_id: number | null
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  username?: string
  first_name: string
  last_name: string
  role?: 'member' | 'trainer'
  password: string
  password2: string
}

export interface UpdateProfileData {
  email?: string
  username?: string
  first_name?: string
  last_name?: string
}

// --- Member ---
export interface MembershipPlan {
  id: number
  trainer?: number | null
  trainer_nombre?: string | null
  name: string
  description: string
  price_monthly: string
  duration_months: number
  features: string
  is_active?: boolean
}

export interface MemberSubscription {
  id: number
  member: number
  plan: number
  trainer: number
  agreed_price: string
  start_date: string
  next_billing_date: string
  recurrence_type: 'monthly' | 'quarterly' | 'annual'
  grace_period_days: number
  auto_generate_next: boolean
  is_active: boolean
  status: 'active' | 'past_due' | 'suspended' | 'cancelled'
  renewal_date: string | null
  cancellation_date: string | null
  cancellation_reason: string
  commercial_notes: string
  plan_detail?: MembershipPlan
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
  trainer_asignado?: number | null
  trainer_asignado_nombre?: string | null
  riesgo_adherencia?: number
  nivel_riesgo?: 'low' | 'medium' | 'high'
  motivos_riesgo?: string[]
  days_since_last_checkin?: number | null
  days_since_last_session?: number | null
  days_since_last_progress?: number | null
  estado_prescripcion?: 'sin_plan' | 'incompleta' | 'lista'
  tiene_plan_activo?: boolean
  prescripcion_lista_para_member?: boolean
  suscripcion_activa_id?: number | null
  precio_suscripcion_actual?: string | null
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
  streak_asistencia: number
  cumplimiento_semanal: number | null
  siguiente_accion: string
  resumen_hoy: string
  riesgo_personal: {
    score: number
    level: 'low' | 'medium' | 'high'
    reasons: string[]
  }
}

// --- Trainer Overview ---
export interface TrainerOverview {
  total_active_members: number
  active_subscriptions_count: number
  checked_in_today: number
  members_in_mora: number
  members_inactive_30d: number
  pending_alerts: number
  revenue_this_month: number
  estimated_mrr: number
  expected_revenue_this_month: number
  late_rate_pct: number
  new_members_this_month: number
  sessions_completed_this_week: number
  payments_due_soon: number
  payments_overdue: number
  members_without_progress_recently: number
  members_without_active_plan: number
  incomplete_prescriptions: number
  miembros_sin_plan_activo: Array<{
    id: number
    full_name: string
    riesgo_adherencia: number
    nivel_riesgo: 'low' | 'medium' | 'high'
    motivos_riesgo: string[]
    next_action: string
    estado_prescripcion: 'sin_plan' | 'incompleta' | 'lista'
  }>
  miembros_con_prescripcion_incompleta: Array<{
    id: number
    full_name: string
    riesgo_adherencia: number
    nivel_riesgo: 'low' | 'medium' | 'high'
    motivos_riesgo: string[]
    next_action: string
    estado_prescripcion: 'sin_plan' | 'incompleta' | 'lista'
  }>
  miembros_en_riesgo: Array<{
    id: number
    full_name: string
    payment_status: 'paid' | 'pending' | 'late' | null
    riesgo_adherencia: number
    nivel_riesgo: 'low' | 'medium' | 'high'
    motivos_riesgo: string[]
    days_since_last_checkin: number | null
    next_action: string
    estado_prescripcion: 'sin_plan' | 'incompleta' | 'lista'
  }>
}

export interface ChartSeriesPoint {
  label: string
  value: number
  week_start?: string
  month?: string
}

export interface MemberChartProgressPoint {
  date: string
  label: string
  weight_kg: number | null
  height_cm: number | null
  body_fat_pct: number | null
  waist_cm: number | null
  muscle_mass_kg: number | null
}

export interface MemberPhysicalSummary {
  latest_log_id: number | null
  latest_recorded_at: string | null
  current_weight_kg: number | null
  previous_weight_kg: number | null
  weight_change_kg: number | null
  height_cm: number | null
  body_fat_pct: number | null
  muscle_mass_kg: number | null
  waist_cm: number | null
  bmi: number | null
  notes: string
}

export interface MemberExerciseProgressPoint {
  date: string
  label: string
  weight_used_kg: number
  sets_completed: number
  reps_completed: number
}

export interface MemberChartsOverview {
  role: 'member'
  summary: {
    current_weight: number | null
    weight_change_30d: number | null
    current_height_cm: number | null
    current_bmi: number | null
    sessions_this_week: number
    streak_asistencia: number
    cumplimiento_semanal: number | null
    payment_status: 'paid' | 'pending' | 'late' | null
    days_until_due: number | null
    days_overdue: number | null
    riesgo_personal: {
      score: number
      level: 'low' | 'medium' | 'high'
      reasons: string[]
    }
    siguiente_accion: string
    resumen_hoy: string
    estado_prescripcion: {
      tiene_plan_activo: boolean
      tiene_dias: boolean
      tiene_ejercicios: boolean
      tiene_nutricion: boolean
      tiene_guias: boolean
      esta_lista_para_member: boolean
      estado?: 'sin_plan' | 'incompleta' | 'lista'
    }
  }
  physical_progress: MemberChartProgressPoint[]
  attendance_weekly: ChartSeriesPoint[]
  sessions_weekly: Array<ChartSeriesPoint & { goal: number }>
  plan_completion: Array<{ label: string; name: string; completed: number }>
  exercise_progress: {
    exercise_name: string | null
    series: MemberExerciseProgressPoint[]
  }
  insights: string[]
}

export interface TrainerChartsOverview {
  role: 'trainer'
  summary: {
    members_count: number
    high_risk_count: number
    late_payment_count: number
    ready_prescriptions_count: number
    average_weekly_completion: number | null
  }
  risk_distribution: ChartSeriesPoint[]
  payment_distribution: ChartSeriesPoint[]
  prescription_distribution: ChartSeriesPoint[]
  inactivity_distribution: ChartSeriesPoint[]
  attendance_trend: ChartSeriesPoint[]
  sessions_trend: ChartSeriesPoint[]
  revenue_monthly: ChartSeriesPoint[]
  plan_distribution: ChartSeriesPoint[]
  top_risk_members: Array<{
    id: number
    full_name: string
    riesgo_adherencia: number
    nivel_riesgo: 'low' | 'medium' | 'high'
    payment_status: 'paid' | 'pending' | 'late' | null
    days_since_last_checkin: number | null
    next_action: string
  }>
  insights: string[]
}

export type ChartsOverview = MemberChartsOverview | TrainerChartsOverview

// --- Plans ---
export type GoalType = 'fat_loss' | 'muscle_gain' | 'endurance' | 'flexibility' | 'maintenance' | 'general'
export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'legs' | 'glutes' | 'core' | 'full_body' | 'cardio'
export type DayLabel = 'A' | 'B' | 'C' | 'D'
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type ExerciseType = 'strength' | 'timed'

export interface GymMachine {
  id: number
  name: string
  category: string
  notes: string
  is_active: boolean
}

export interface Exercise {
  id: number
  workout_day: number
  name: string
  muscle_group: MuscleGroup
  exercise_type: ExerciseType
  sets: number | null
  reps_range: string
  target_minutes: number | null
  machine: number | null
  machine_detail?: GymMachine | null
  weight_suggestion_kg: number | null
  rest_seconds: number
  technique_notes: string
  order: number
}

export interface WorkoutDay {
  id: number
  plan: number
  name: string
  day_label: DayLabel
  day_of_week: DayOfWeek
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

export interface PrescriptionSummary {
  situacion_prescriptiva: string
  riesgo_adherencia: number
  nivel_riesgo: 'low' | 'medium' | 'high'
  motivos_riesgo: string[]
  recommended_goal: string
  recommended_days_per_week: number
  recommended_calories: {
    min: number
    max: number
  }
  recomendaciones: string[]
  advertencias: string[]
  active_plan_id: number | null
  active_nutrition_profile_id: number | null
}

export interface ActivePrescription {
  member: number
  trainer: {
    id: number
    nombre: string
    correo: string
  } | null
  plan_activo: TrainingPlan | null
  dias: WorkoutDay[]
  entrenamiento_hoy: TodayWorkout | null
  perfil_nutricional: NutritionProfile | null
  guias_vinculadas: PlanNutritionLink[]
  estado_prescripcion: {
    tiene_plan_activo: boolean
    tiene_dias: boolean
    tiene_ejercicios: boolean
    tiene_nutricion: boolean
    tiene_guias: boolean
    esta_lista_para_member: boolean
  }
}

export interface TrainingTemplateExercise {
  id: number
  dia: number
  nombre: string
  grupo_muscular: MuscleGroup
  tipo_ejercicio: ExerciseType
  series: number | null
  rango_repeticiones: string
  minutos_objetivo: number | null
  peso_sugerido_kg: number | null
  descanso_segundos: number
  notas_tecnicas: string
  orden: number
}

export interface TrainingTemplateDay {
  id: number
  plantilla: number
  nombre: string
  etiqueta_dia: DayLabel
  orden: number
  ejercicios: TrainingTemplateExercise[]
}

export interface TrainingTemplate {
  id: number
  trainer: number
  trainer_nombre: string
  nombre: string
  descripcion: string
  objetivo: GoalType
  nivel_adherencia_recomendado: 'low' | 'medium' | 'high'
  dias_por_semana_sugeridos: number
  esta_activa: boolean
  creada_en: string
  dias: TrainingTemplateDay[]
}

export interface TrainingTemplateUpdatePayload {
  nombre: string
  descripcion: string
  objetivo: GoalType
  nivel_adherencia_recomendado: 'low' | 'medium' | 'high'
  dias_por_semana_sugeridos: number
  esta_activa: boolean
}

export interface TrainingPlanPayload {
  member: number
  name: string
  goal: GoalType
  start_date: string
  end_date?: string | null
  weeks_duration: number
  days_per_week: number
  is_active: boolean
}

export interface WorkoutDayPayload {
  plan: number
  name: string
  day_label: DayLabel
  day_of_week: DayOfWeek
  order: number
}

export interface ExercisePayload {
  workout_day: number
  name: string
  muscle_group: MuscleGroup
  exercise_type: ExerciseType
  sets: number | null
  reps_range: string
  target_minutes: number | null
  machine?: number | null
  weight_suggestion_kg?: number | null
  rest_seconds: number
  technique_notes?: string
  order: number
}

export interface TodayWorkout {
  id: number
  name: string
  day_label: DayLabel
  exercises: Exercise[]
}

export interface WeeklyWorkoutStatus {
  date: string
  workout_day_name: string | null
  workout_day_id: number | null
  day_of_week: DayOfWeek
  day_label: DayLabel | null
  session_id: number | null
  is_completed: boolean
}

// --- Attendance ---
export interface Attendance {
  id: number
  member: number
  check_in_time: string
  gym_class?: number | null
  checked_in_by?: number | null
  is_manual_override?: boolean
  notes: string
}

export interface CheckInBlockedResponse {
  blocked: true
  reason: 'payment_overdue'
  days_overdue: number
}

// --- Progress ---
export interface ProgressLog {
  id: number
  member: number
  recorded_at: string
  weight_kg: number | null
  height_cm: number | null
  body_fat_pct: number | null
  muscle_mass_kg: number | null
  waist_cm: number | null
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
  minutes_completed: number | null
  weight_used_kg: number | null
  rpe: number | null
  notes: string
}

export interface ExerciseLogPayload {
  exercise_id: number
  sets_completed?: number
  reps_completed?: number
  minutes_completed?: number
  weight_used_kg?: number
  rpe?: number
  notes?: string
}

export interface ProgressByExercise {
  exercise_name: string
  data_points: Array<{
    date: string
    exercise_type?: ExerciseType
    weight_used_kg: number | null
    sets: number
    reps_completed: number
    minutes_completed?: number | null
    rpe: number | null
  }>
}

// --- Billing ---
export type PaymentStatus = 'paid' | 'pending' | 'late'

export interface PaymentSchedule {
  id: number
  member: number
  subscription?: number | null
  plan: number | null
  due_date: string
  recurrence_type: string
  grace_period_days: number
  auto_generate_next?: boolean
  is_active: boolean
  subscription_detail?: MemberSubscription | null
}

export interface PaymentRecord {
  id: number
  schedule: number
  subscription_id?: number | null
  due_date: string
  amount: string
  paid_at: string | null
  status: PaymentStatus
  method_used: number | null
  payment_reference: string
  receipt_issued_at: string | null
  receipt_number: string | null
  notes: string
  days_overdue: number
  plan_name?: string | null
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
  created_at: string
  last_checkin_date: string | null
  days_inactive: number
  resolved: boolean
  resolved_by: number | null
  resolved_at: string | null
}

export interface Notification {
  id: number
  user: number
  message: string
  type?: 'inactivity' | 'payment_due' | 'payment_overdue' | 'plan_assigned' | 'trainer_message' | 'system'
  read: boolean
  created_at: string
}

// --- Nutrition ---
export interface NutritionProfile {
  id: number
  training_plan: number
  goal_type: string
  calorie_range_min: number | null
  calorie_range_max: number | null
  protein_focus: string
  carb_strategy: string
  hydration_recommendation: string
}

export interface NutritionTemplate {
  id: number
  trainer: number
  trainer_nombre: string
  nombre: string
  descripcion: string
  goal_type: string
  nivel_adherencia_recomendado: 'low' | 'medium' | 'high'
  calorie_range_min: number
  calorie_range_max: number
  protein_focus: string
  carb_strategy: string
  hydration_recommendation: string
  esta_activa: boolean
  creada_en: string
}

export interface NutritionProfilePayload {
  training_plan: number
  goal_type: string
  calorie_range_min: number | null
  calorie_range_max: number | null
  protein_focus: string
  carb_strategy: string
  hydration_recommendation: string
}

export interface NutritionGuideline {
  id: number
  title: string
  goal_type: string
  description: string
  recommended_foods: string
  foods_to_limit: string
  timing_suggestions: string
}

export interface PlanNutritionLink {
  id: number
  plan: number
  guideline: NutritionGuideline
  priority_order: number
}

export interface PlanNutritionLinkPayload {
  plan: number
  guideline_id: number
  priority_order: number
}

// --- AI Chat ---
export type AIChatMode = 'member' | 'trainer_member'

export interface AIChatMessage {
  id: number
  member: number
  conversation_id: number
  mode: AIChatMode
  role: 'user' | 'assistant'
  content: string
  tokens_used: number
  created_at: string
}

export interface AIChatRequest {
  message: string
  member_id?: number
  conversation_id?: number
}

export interface AIChatResponse {
  role: 'assistant'
  content: string
  tokens_used?: number
  message_id?: number
  conversation_id?: number
  mode?: AIChatMode
  fallback_used?: boolean
  engine_mode?: 'deterministic' | 'local_hybrid'
  local_llm_used?: boolean
  response_source?: 'rules' | 'local_model'
  suggested_prompts?: string[]
  remaining_messages?: number
  limit?: number
  limit_reached?: boolean
  sendable?: boolean
  message_text?: string
  priority_detected?: 'payment' | 'adherence' | 'workout' | 'nutrition' | 'general' | ''
  intent_detected?: 'payment' | 'adherence' | 'workout' | 'nutrition' | 'client_message' | 'full_analysis' | 'general' | ''
  error?: boolean
}

export interface AIChatSendMessageRequest {
  member_id: number
  message_text: string
  conversation_id?: number
  source_message_id?: number
}

export interface AIChatSendMessageResponse {
  sent: boolean
  already_sent: boolean
  notification_id: number
  message_text: string
}

export interface AIChatContext {
  mode: AIChatMode
  conversation_id: number | null
  limit: number | null
  remaining_messages: number | null
  requires_member_selection: boolean
  fallback_available: boolean
  engine_mode: 'deterministic' | 'local_hybrid'
  local_llm_available: boolean
  response_source: 'rules' | 'local_model'
  suggested_prompts: string[]
  member: {
    id: number
    full_name: string
    email: string
    riesgo_adherencia: number
    nivel_riesgo: 'low' | 'medium' | 'high'
    siguiente_accion: string
    estado_prescripcion: 'sin_plan' | 'incompleta' | 'lista'
    trainer_asignado_nombre: string | null
    last_checkin: string | null
    unread_notifications: number
  } | null
  summary: {
    active_plan_name: string | null
    active_plan_id: number | null
    today_has_workout: boolean
    today_workout_name: string | null
    resumen_hoy: string
    payment_status: 'paid' | 'pending' | 'late' | null
    days_until_due: number | null
    days_overdue: number | null
    nutrition_goal: string | null
    weekly_sessions_done: number
    streak_asistencia: number
    cumplimiento_semanal: number | null
    inactivity_alert: boolean
    tiene_plan_activo: boolean
    prescripcion_lista: boolean
    risk_reasons: string[]
  } | null
  analysis_context: {
    trainer_name: string | null
    risk_level: 'low' | 'medium' | 'high'
    risk_reasons: string[]
    next_action: string
    payment_status: 'paid' | 'pending' | 'late' | null
    days_until_due: number | null
    days_overdue: number | null
    last_checkin: string | null
    unread_notifications: number
    today_has_workout: boolean
    today_workout_name: string | null
    active_plan_name: string | null
    weekly_sessions_done: number
    streak_asistencia: number
    cumplimiento_semanal: number | null
    nutrition_goal: string | null
    inactivity_alert: boolean
    prescription_status: 'sin_plan' | 'incompleta' | 'lista'
    prescription_readiness: {
      tiene_plan_activo: boolean
      tiene_dias: boolean
      tiene_ejercicios: boolean
      tiene_nutricion: boolean
      tiene_guias: boolean
      esta_lista_para_member: boolean
      estado?: 'sin_plan' | 'incompleta' | 'lista'
    }
    has_today_workout: boolean
  } | null
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

export interface AuthBlockedResponse {
  error: string
  code: 'payment_access_blocked'
  reason: 'payment_overdue_30d'
  days_overdue: number
}
