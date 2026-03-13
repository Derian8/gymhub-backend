export const QUERY_KEYS = {
  // Auth
  ME: ['auth', 'me'] as const,

  // Members
  MEMBERS: ['members'] as const,
  MEMBERS_LIST: (params?: Record<string, string>) => ['members', 'list', params] as const,
  MEMBER_DETAIL: (id: number) => ['members', id] as const,
  MEMBER_DASHBOARD: (id: number) => ['members', id, 'dashboard'] as const,

  // Trainer
  TRAINER_OVERVIEW: ['trainer', 'overview'] as const,

  // Plans
  PLANS: ['plans'] as const,
  PLANS_LIST: ['plans', 'list'] as const,
  PLAN_DETAIL: (id: number) => ['plans', id] as const,
  PLAN_TODAY: (id: number) => ['plans', id, 'today'] as const,
  PLAN_WEEKLY: (id: number) => ['plans', id, 'weekly'] as const,
  WORKOUT_DAYS: ['workout-days'] as const,
  EXERCISES: ['exercises'] as const,

  // Attendance
  ATTENDANCE: ['attendance'] as const,
  ATTENDANCE_LIST: (params?: Record<string, string>) => ['attendance', 'list', params] as const,

  // Progress
  PROGRESS_LOGS: ['progress-logs'] as const,
  WORKOUT_SESSIONS: ['workout-sessions'] as const,
  WORKOUT_SESSION_DETAIL: (id: number) => ['workout-sessions', id] as const,
  PROGRESS_BY_EXERCISE: (memberId: number, exerciseId: number) => ['progress', memberId, 'exercise', exerciseId] as const,

  // Billing
  MEMBERSHIP_PLANS: ['membership-plans'] as const,
  PAYMENT_SCHEDULES: ['payment-schedules'] as const,
  PAYMENT_RECORDS: ['payment-records'] as const,
  PAYMENT_METHODS: ['payment-methods'] as const,

  // Alerts
  ALERTS: ['alerts'] as const,
  ALERTS_LIST: (params?: Record<string, string>) => ['alerts', 'list', params] as const,
  NOTIFICATIONS: ['notifications'] as const,

  // Nutrition
  NUTRITION_PROFILES: ['nutrition-profiles'] as const,
  NUTRITION_GUIDELINES: ['nutrition-guidelines'] as const,

  // AI Chat
  AI_CHAT_HISTORY: ['ai-chat', 'history'] as const,

  // Classes
  CLASSES: ['classes'] as const,

  // Charts
  CHART: (type: string) => ['charts', type] as const,
} as const
