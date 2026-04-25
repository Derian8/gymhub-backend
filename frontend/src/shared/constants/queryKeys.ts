export const QUERY_KEYS = {
  // Auth
  ME: ['auth', 'me'] as const,

  // Members
  MEMBERS: ['members'] as const,
  MEMBERS_LIST: (params?: Record<string, string>) => ['members', 'list', params] as const,
  MEMBER_DETAIL: (id: number) => ['members', id] as const,
  MEMBER_DASHBOARD: (id: number) => ['members', id, 'dashboard'] as const,
  MEMBER_PHYSICAL_SUMMARY: (id: number) => ['members', id, 'physical-summary'] as const,
  MEMBER_PRESCRIPTION: (id: number) => ['members', id, 'prescription'] as const,
  MEMBER_ACTIVE_PRESCRIPTION: (id: number) => ['members', id, 'active-prescription'] as const,
  MEMBER_PROGRAM: (id: number) => ['members', id, 'program'] as const,

  // Trainer
  TRAINER_OVERVIEW: ['trainer', 'overview'] as const,

  // Plans
  PLANS: ['plans'] as const,
  PLANS_LIST: (params?: Record<string, string>) => ['plans', 'list', params] as const,
  PLAN_DETAIL: (id: number) => ['plans', id] as const,
  PLAN_TODAY: (id: number) => ['plans', id, 'today'] as const,
  PLAN_WEEKLY: (id: number) => ['plans', id, 'weekly'] as const,
  WORKOUT_DAYS: ['workout-days'] as const,
  WORKOUT_DAYS_BY_PLAN: (planId: number) => ['workout-days', 'plan', planId] as const,
  EXERCISES: ['exercises'] as const,
  EXERCISES_BY_DAY: (workoutDayId: number) => ['exercises', 'day', workoutDayId] as const,
  PLAN_TEMPLATES: ['plan-templates'] as const,

  // Attendance
  ATTENDANCE: ['attendance'] as const,
  ATTENDANCE_LIST: (params?: Record<string, string>) => ['attendance', 'list', params] as const,

  // Progress
  PROGRESS_LOGS: (memberId?: number) => ['progress-logs', memberId ?? 'self'] as const,
  WORKOUT_SESSIONS: ['workout-sessions'] as const,
  WORKOUT_SESSION_DETAIL: (id: number) => ['workout-sessions', id] as const,
  PROGRESS_BY_EXERCISE: (memberId: number, exerciseId: number) => ['progress', memberId, 'exercise', exerciseId] as const,

  // Billing
  MEMBERSHIP_PLANS: ['membership-plans'] as const,
  PAYMENT_SCHEDULES: (params?: Record<string, string>) => ['payment-schedules', params] as const,
  PAYMENT_RECORDS: (params?: Record<string, string>) => ['payment-records', params] as const,
  PAYMENT_METHODS: ['payment-methods'] as const,
  MEMBER_SUBSCRIPTIONS: (params?: Record<string, string>) => ['member-subscriptions', params] as const,

  // Alerts
  ALERTS: ['alerts'] as const,
  ALERTS_LIST: (params?: Record<string, string>) => ['alerts', 'list', params] as const,
  NOTIFICATIONS: ['notifications'] as const,
  NOTIFICATIONS_LIST: (params?: Record<string, string>) => ['notifications', 'list', params] as const,

  // Nutrition
  NUTRITION_PROFILES: (params?: Record<string, string>) => ['nutrition-profiles', params] as const,
  NUTRITION_GUIDELINES: ['nutrition-guidelines'] as const,
  PLAN_NUTRITION_LINKS: (params?: Record<string, string>) => ['plan-nutrition-links', params] as const,
  NUTRITION_TEMPLATES: ['nutrition-templates'] as const,

  // AI Chat
  AI_CHAT_CONTEXT: (memberId?: number) => ['ai-chat', 'context', memberId ?? 'self'] as const,
  AI_CHAT_HISTORY: ['ai-chat', 'history'] as const,
  AI_CHAT_HISTORY_BY_MEMBER: (memberId?: number) => ['ai-chat', 'history', memberId ?? 'self'] as const,

  // Classes
  CLASSES: ['classes'] as const,

  // Charts
  CHART: (type: string) => ['charts', type] as const,
  CHART_OVERVIEW: ['charts', 'overview'] as const,
} as const
