import React, { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Activity, ArrowLeft, CalendarClock, CheckCircle, Dumbbell, Flame, Loader2, NotebookTabs, Play, Target } from 'lucide-react'

import { useTodayWorkoutQuery, useWeeklyPlanQuery, useCreateSessionMutation, useCompleteSessionMutation, useBulkExerciseLogsMutation, useRegisterExerciseProgressMutation } from '../hooks/usePlans'
import { EmptyState, Badge } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { SymbolFrame } from '@/shared/components/Brand'
import { DAY_OF_WEEK_LABELS, formatCurrency, formatDate, MUSCLE_LABELS, cn } from '@/shared/lib/utils'
import type { CompleteWorkoutSessionPayload, Exercise, ExerciseLogPayload } from '@/shared/types'
import { getResolvedContext, useAuthStore } from '@/shared/store/authStore'
import { useMemberActivePrescriptionQuery, useMemberDashboardQuery } from '@/modules/members/hooks/useMembers'
import { useOpenRoutineMutation } from '@/modules/attendance/hooks/useAttendance'

interface ExerciseLogEntry {
  exercise_id: number
  sets_completed?: number
  reps_completed?: number
  minutes_completed?: number
  weight_used_kg?: number
  rpe?: number
  notes?: string
}

type MeasurementDraft = {
  body_weight_kg: string
  waist_cm: string
  body_fat_pct: string
  muscle_mass_kg: string
}

function emptyMeasurementDraft(): MeasurementDraft {
  return {
    body_weight_kg: '',
    waist_cm: '',
    body_fat_pct: '',
    muscle_mass_kg: '',
  }
}

function parseOptionalMeasurement(value: string) {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function getExercisePrescriptionLabel(exercise: Exercise) {
  if (exercise.exercise_type === 'timed') {
    return `${exercise.target_minutes ?? 0} min`
  }
  return `${exercise.sets ?? 0}×${exercise.reps_range}`
}

function TodayWorkoutPageContent() {
  const { id } = useParams<{ id: string }>()
  const requestedPlanId = parseInt(id || '0')
  const { user, activeContext } = useAuthStore()
  const currentContext = getResolvedContext(user, activeContext)
  const isMember = currentContext === 'cliente'
  const routineEntryDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const routineEntryKey = `gymhub-routine-entry:${routineEntryDate}`
  const [routineAccessGranted, setRoutineAccessGranted] = useState(
    () => !isMember || window.sessionStorage.getItem(routineEntryKey) === 'granted',
  )
  const memberId = user?.memberprofile_id || 0
  const {
    data: activePrescription,
    isLoading: isLoadingPrescription,
    isError: isPrescriptionError,
  } = useMemberActivePrescriptionQuery(isMember ? memberId : 0, !isMember || routineAccessGranted)
  const planId = requestedPlanId || activePrescription?.plan_activo?.id || 0
  const {
    data,
    isLoading: isLoadingTodayWorkout,
    isError: isTodayWorkoutError,
  } = useTodayWorkoutQuery(planId, !isMember || routineAccessGranted)
  const {
    data: weeklyView,
    isLoading: isLoadingWeeklyView,
    isError: isWeeklyViewError,
  } = useWeeklyPlanQuery(planId, !isMember || routineAccessGranted)
  const { data: dashboardSummary } = useMemberDashboardQuery(isMember ? memberId : 0)
  const { mutate: createSession, isPending: isCreating } = useCreateSessionMutation()
  const { mutate: completeSession, isPending: isCompleting } = useCompleteSessionMutation()
  const { mutate: bulkLogs, isPending: isSaving } = useBulkExerciseLogsMutation()
  const { mutate: registerExerciseProgress, isPending: isRegisteringExercise } = useRegisterExerciseProgressMutation(planId)
  const openRoutine = useOpenRoutineMutation()

  const [sessionId, setSessionId] = useState<number | null>(null)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [logs, setLogs] = useState<Record<number, ExerciseLogEntry>>({})
  const [overallFeeling, setOverallFeeling] = useState(4)
  const [measurementDraft, setMeasurementDraft] = useState<MeasurementDraft>(emptyMeasurementDraft)
  const [sessionCompletedToday, setSessionCompletedToday] = useState(false)
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<string | null>(null)
  const [isDaySelectorOpen, setIsDaySelectorOpen] = useState(false)
  const [exerciseStates, setExerciseStates] = useState<Record<number, 'realizado' | 'omitido'>>({})
  const [isFinishConfirmOpen, setIsFinishConfirmOpen] = useState(false)

  const workoutDay = useMemo(() => {
    if (data?.id) {
      return data
    }
    return activePrescription?.entrenamiento_hoy ?? null
  }, [activePrescription?.entrenamiento_hoy, data])

  const initializeLogs = (day: typeof workoutDay) => {
    if (!day?.exercises?.length) {
      setLogs({})
      return
    }

    const initialLogs: Record<number, ExerciseLogEntry> = {}
    day.exercises.forEach((exercise) => {
      if (exercise.exercise_type === 'timed') {
        initialLogs[exercise.id] = {
          exercise_id: exercise.id,
          minutes_completed: exercise.target_minutes || undefined,
        }
        return
      }

      initialLogs[exercise.id] = {
        exercise_id: exercise.id,
        sets_completed: exercise.sets || undefined,
        reps_completed: parseInt(exercise.reps_range.split('-')[0]) || 10,
        weight_used_kg: exercise.weight_suggestion_kg || undefined,
        rpe: 7,
      }
    })
    setLogs(initialLogs)
  }

  useEffect(() => {
    if (!workoutDay?.id) {
      setSessionId(null)
      setSessionStarted(false)
      setSessionCompletedToday(false)
      setLogs({})
      return
    }

    if (workoutDay.today_session_completed) {
      setSessionId(workoutDay.today_session_id)
      setSessionStarted(false)
      setSessionCompletedToday(true)
      setExerciseStates(Object.fromEntries((workoutDay.progreso_sesion?.ejercicios || []).map((item) => [item.exercise_id, item.estado])))
      return
    }

    if (workoutDay.today_session_started && workoutDay.today_session_id) {
      setSessionId(workoutDay.today_session_id)
      setSessionStarted(true)
      setSessionCompletedToday(false)
      setExerciseStates(Object.fromEntries((workoutDay.progreso_sesion?.ejercicios || []).map((item) => [item.exercise_id, item.estado])))
      setLogs((current) => (Object.keys(current).length ? current : (() => {
        const initialLogs: Record<number, ExerciseLogEntry> = {}
        workoutDay.exercises?.forEach((exercise) => {
          if (exercise.exercise_type === 'timed') {
            initialLogs[exercise.id] = {
              exercise_id: exercise.id,
              minutes_completed: exercise.target_minutes || undefined,
            }
            return
          }
          initialLogs[exercise.id] = {
            exercise_id: exercise.id,
            sets_completed: exercise.sets || undefined,
            reps_completed: parseInt(exercise.reps_range.split('-')[0]) || 10,
            weight_used_kg: exercise.weight_suggestion_kg || undefined,
            rpe: 7,
          }
        })
        return initialLogs
      })()))
      return
    }

    setSessionCompletedToday(false)
    setExerciseStates({})
  }, [
    workoutDay?.id,
    workoutDay?.today_session_id,
    workoutDay?.today_session_completed,
    workoutDay?.today_session_started,
    workoutDay?.exercises,
  ])

  const handleStartSession = () => {
    if (!workoutDay || sessionCompletedToday) return
    createSession(
      { workout_day_id: workoutDay.id },
      {
        onSuccess: (session) => {
          setSessionId(session.id)
          setSessionStarted(true)
          setSessionCompletedToday(false)
          initializeLogs(workoutDay)
          setExerciseStates({})
        },
      },
    )
  }

  const handleCompleteSession = () => {
    if (!sessionId) return

    const logsArray = Object.values(logs).map<ExerciseLogPayload>((log) => {
      const exercise = workoutDay?.exercises?.find((item) => item.id === log.exercise_id)

      if (exercise?.exercise_type === 'timed') {
        return {
          exercise_id: log.exercise_id,
          minutes_completed: log.minutes_completed,
          notes: log.notes,
        }
      }

      if (isMember) {
        return {
          exercise_id: log.exercise_id,
          weight_used_kg: log.weight_used_kg,
          rpe: log.rpe,
          notes: log.notes,
        }
      }

      return {
        exercise_id: log.exercise_id,
        sets_completed: log.sets_completed,
        reps_completed: log.reps_completed,
        weight_used_kg: log.weight_used_kg,
        rpe: log.rpe,
        notes: log.notes,
      }
    })

    const physicalPayload = {
      body_weight_kg: parseOptionalMeasurement(measurementDraft.body_weight_kg),
      waist_cm: parseOptionalMeasurement(measurementDraft.waist_cm),
      body_fat_pct: parseOptionalMeasurement(measurementDraft.body_fat_pct),
      muscle_mass_kg: parseOptionalMeasurement(measurementDraft.muscle_mass_kg),
    }
    const completionPayload = Object.fromEntries(
      Object.entries({
        overall_feeling: overallFeeling,
        ...physicalPayload,
      }).filter(([, value]) => value !== undefined),
    ) as CompleteWorkoutSessionPayload

    bulkLogs(
      { session_id: sessionId, logs: logsArray },
      {
        onSuccess: () => {
          completeSession(
            { sessionId, payload: completionPayload },
            {
              onSuccess: () => {
                setSessionStarted(false)
                setSessionCompletedToday(true)
                setMeasurementDraft(emptyMeasurementDraft())
              },
            },
          )
        },
      },
    )
  }

  const updateLog = (exerciseId: number, field: keyof ExerciseLogEntry, value: number) => {
    setLogs((prev) => ({
      ...prev,
      [exerciseId]: { ...prev[exerciseId], [field]: value },
    }))
  }

  const resolveClientExercise = (exerciseId: number, estado: 'realizado' | 'omitido') => {
    if (!sessionId || isRegisteringExercise) return
    registerExerciseProgress({ sessionId, payload: { exercise_id: exerciseId, estado } }, {
      onSuccess: (result) => {
        setExerciseStates((current) => ({ ...current, [exerciseId]: estado }))
        if (result.session_completed) {
          setSessionStarted(false)
          setSessionCompletedToday(true)
        }
      },
    })
  }

  const finishClientRoutine = () => {
    if (!sessionId) return
    completeSession({ sessionId, payload: { omitir_pendientes: true } }, {
      onSuccess: () => {
        setSessionStarted(false)
        setSessionCompletedToday(true)
        setIsFinishConfirmOpen(false)
      },
    })
  }

  const diasPrograma = useMemo(
    () => activePrescription?.dias || [],
    [activePrescription?.dias],
  )
  const weeklyDays = useMemo(
    () => weeklyView?.week_days || [],
    [weeklyView?.week_days],
  )
  const tieneProgramaActivo = !!activePrescription?.plan_activo
  const mostrarFallbackSemanal = isMember && !workoutDay?.id && tieneProgramaActivo
  const mostrarEstadoVacioMember = isMember && !workoutDay?.id && !tieneProgramaActivo
  const needsWeeklyContext = isMember && tieneProgramaActivo
  const isInitialLoading = isLoadingTodayWorkout || (isMember && (isLoadingPrescription || (needsWeeklyContext && isLoadingWeeklyView)))
  const hasCriticalQueryError = isMember && (isPrescriptionError || (tieneProgramaActivo && isWeeklyViewError))
  const lacksTrainingContext = isMember && tieneProgramaActivo && !workoutDay?.id && weeklyDays.length === 0 && diasPrograma.length === 0
  const ejercicios = workoutDay?.exercises?.length || 0
  const selectedWeeklyDay = weeklyDays.find((day) => day.day_of_week === selectedDayOfWeek) || weeklyDays[0] || null
  const selectedWorkoutDay = selectedWeeklyDay?.has_workout
    ? diasPrograma.find((day) => day.id === selectedWeeklyDay.workout_day_id)
      || diasPrograma.find((day) => day.day_of_week === selectedWeeklyDay.day_of_week)
      || null
    : null
  const tituloPrincipal = mostrarFallbackSemanal
    ? 'Hoy no tienes bloque puntual'
    : `${DAY_OF_WEEK_LABELS[workoutDay?.day_of_week || 'mon']} · ${workoutDay?.name}`

  useEffect(() => {
    if (!tieneProgramaActivo) {
      setSelectedDayOfWeek(null)
      setIsDaySelectorOpen(false)
      return
    }

    if (!selectedDayOfWeek && weeklyDays.length > 0) {
      const firstAvailableDay = mostrarFallbackSemanal
        ? (weeklyDays.find((day) => day.has_workout) || weeklyDays[0])
        : (
            weeklyDays.find((day) => day.day_of_week !== workoutDay?.day_of_week && day.has_workout)
            || weeklyDays.find((day) => day.day_of_week !== workoutDay?.day_of_week)
            || weeklyDays[0]
          )
      setSelectedDayOfWeek(firstAvailableDay.day_of_week)
    }
  }, [tieneProgramaActivo, mostrarFallbackSemanal, selectedDayOfWeek, weeklyDays, workoutDay?.day_of_week])

  useEffect(() => {
    setIsDaySelectorOpen(mostrarFallbackSemanal)
  }, [mostrarFallbackSemanal])

  if (isMember && !routineAccessGranted) {
    const errorData = (openRoutine.error as { response?: { data?: { message?: string; days_overdue?: number } } } | null)?.response?.data
    return (
      <div className="page-enter mx-auto max-w-3xl">
        <section className="rounded-[2rem] border border-primary/20 bg-white p-8 text-center shadow-sm dark:bg-neutral-950">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Dumbbell size={30} /></div>
          <p className="label-base mt-6">Tu llegada al gimnasio</p>
          <h1 className="mt-2 text-4xl font-heading font-black text-neutral-900 dark:text-white">Ver rutina</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-neutral-500">Validaremos tu membresía y registraremos la entrada de hoy antes de mostrar el entrenamiento.</p>
          {errorData && (
            <div className="mx-auto mt-5 max-w-xl rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
              {errorData.message || 'Tu acceso está bloqueado. Contacta al administrador.'}
              {errorData.days_overdue ? ` Mora registrada: ${errorData.days_overdue} días.` : ''}
            </div>
          )}
          <button
            type="button"
            className="btn-primary mx-auto mt-7 px-8 py-3"
            disabled={openRoutine.isPending}
            onClick={() => openRoutine.mutate(undefined, { onSuccess: () => {
              window.sessionStorage.setItem(routineEntryKey, 'granted')
              setRoutineAccessGranted(true)
            } })}
          >
            {openRoutine.isPending ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
            {openRoutine.isPending ? 'Validando acceso…' : 'Ver rutina y registrar entrada'}
          </button>
        </section>
      </div>
    )
  }

  if (isInitialLoading) {
    return (
      <div className="page-enter space-y-4">
        <p className="sr-only">Cargando vista de entrenamiento</p>
        <div className="h-8 w-32 skeleton rounded mb-6" />
        <CardSkeleton lines={8} />
      </div>
    )
  }

  if (hasCriticalQueryError || lacksTrainingContext || (!isMember && isTodayWorkoutError)) {
    return <MemberTrainingFallback />
  }

  if (!workoutDay?.id && !isMember) {
    return (
      <div data-testid="no-workout-today" className="page-enter">
        <Link to={`/plans/${planId}`} className="mb-6 flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-primary">
          <ArrowLeft size={16} />
          Volver al plan
        </Link>
        <EmptyState
          icon={<CheckCircle size={48} className="text-green-400" />}
          title="Sin entrenamiento hoy"
          description="No hay sesión programada para hoy en este plan."
        />
      </div>
    )
  }

  if (mostrarEstadoVacioMember) {
    return (
      <div data-testid="today-workout-page" className="page-enter mx-auto max-w-4xl space-y-6">
        <section
          data-testid="workout-primary"
          className="rounded-[1.75rem] border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
        >
          <p className="label-base">Entrenamiento de hoy</p>
          <h1 className="text-3xl font-heading font-black text-neutral-900 dark:text-white">
            Aún no tienes un programa activo
          </h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Esta seguirá siendo tu página principal de entrenamiento. Cuando tu trainer publique el plan, aquí verás primero la rutina del día y la semana completa.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/plans/my" className="btn-secondary">Ver mi plan</Link>
            <Link to="/dashboard/member" className="text-sm font-medium text-neutral-500 transition-colors hover:text-primary self-center">
              Ir al resumen
            </Link>
          </div>
        </section>

        <EmptyState
          icon={<Dumbbell size={48} />}
          title="Sin rutina publicada todavía"
          description="Tu trainer aún no ha publicado un plan activo completo para ti."
        />
      </div>
    )
  }

  return (
    <div data-testid="today-workout-page" className="page-enter mx-auto max-w-4xl space-y-6">
      {!isMember ? (
        <Link to={`/plans/${planId}`} className="flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-primary">
          <ArrowLeft size={16} />
          Volver al plan
        </Link>
      ) : null}

      {isMember ? (
        <section
          className="rounded-[1.75rem] border border-primary/25 bg-primary/5 p-5 shadow-sm dark:border-primary/20 dark:bg-primary/10"
          data-testid="today-membership-spotlight"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <SymbolFrame size="md" tone={dashboardSummary?.payment_status === 'late' ? 'danger' : dashboardSummary?.payment_status === 'paid' ? 'success' : 'warning'}>
                <CalendarClock size={18} />
              </SymbolFrame>
              <div>
                <p className="label-base">Mi membresía</p>
                <h2 className="font-heading text-2xl font-black text-neutral-900 dark:text-white">
                  {dashboardSummary?.membership_plan_name || 'Sin membresía asignada'}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={dashboardSummary?.payment_status === 'paid' ? 'success' : dashboardSummary?.payment_status === 'late' ? 'error' : 'warning'}>
                    {dashboardSummary?.payment_status === 'paid' ? 'Vigente' : dashboardSummary?.payment_status === 'late' ? 'Vencida' : 'Pendiente'}
                  </Badge>
                  <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                    {dashboardSummary?.membership_agreed_price ? formatCurrency(dashboardSummary.membership_agreed_price) : 'Precio pendiente'}
                  </span>
                </div>
                <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
                  {dashboardSummary?.days_overdue != null
                    ? `${dashboardSummary.days_overdue} día(s) vencida. Regulariza tu pago para mantener acceso.`
                    : dashboardSummary?.days_until_due != null
                      ? `${dashboardSummary.days_until_due} día(s) restantes antes del vencimiento.`
                      : 'Revisa el detalle completo de tu estado comercial.'}
                </p>
              </div>
            </div>
            <Link to="/membership" className="btn-primary" data-testid="today-membership-link">
              Ver mi membresía
            </Link>
          </div>
        </section>
      ) : null}

      <section
        data-testid="workout-primary"
        className="rounded-[1.75rem] border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="label-base">Bloque del día</p>
            <h1 className="text-3xl font-heading font-black text-neutral-900 dark:text-white">
              {tituloPrincipal}
            </h1>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              {mostrarFallbackSemanal
                ? 'Tu home sigue siendo entrenamiento. Como hoy no hay bloque asignado, aquí te dejamos visible toda tu semana para que mantengas el orden del plan.'
                : 'Entra, sigue este bloque y marca lo que realmente hiciste durante la sesión.'}
            </p>
          </div>
          <Badge variant={sessionCompletedToday ? 'success' : sessionStarted ? 'success' : mostrarFallbackSemanal ? 'warning' : 'info'}>
            {sessionCompletedToday ? 'Completado hoy' : sessionStarted ? 'Sesión activa' : mostrarFallbackSemanal ? 'Sin bloque hoy' : 'Bloque listo'}
          </Badge>
        </div>

        {!mostrarFallbackSemanal ? (
          <div className="mt-6">
            {sessionCompletedToday ? (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                <SymbolFrame size="sm" tone="success">
                  <CheckCircle size={16} />
                </SymbolFrame>
                <div>
                  <p className="text-sm font-semibold">Rutina completada hoy</p>
                  <p className="text-xs opacity-80">Este bloque se habilitará de nuevo cuando vuelva a tocar este día de la semana.</p>
                </div>
              </div>
            ) : !sessionStarted ? (
              <div className="space-y-4">
                {isMember ? (
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300">
                    <p className="label-base mb-2">Antes de comenzar</p>
                    <p>{workoutDay?.descripcion_general || 'Sigue cada ejercicio a tu ritmo. Podrás marcarlo como realizado u omitirlo con un toque.'}</p>
                  </div>
                ) : null}
                <button
                  onClick={handleStartSession}
                  disabled={isCreating}
                  className="btn-primary flex w-full items-center justify-center gap-2 py-4 text-base"
                  data-testid="start-session-btn"
                >
                  {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                  {isCreating ? 'Iniciando...' : isMember ? 'Iniciar rutina' : 'Registrar entrenamiento'}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                <SymbolFrame size="sm" tone="success">
                  <CheckCircle size={16} />
                </SymbolFrame>
                <div>
                  <p className="text-sm font-semibold">Sesión activa</p>
                  <p className="text-xs opacity-80">Marca la carga usada o los minutos completados mientras avanzas por la rutina.</p>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </section>

      {!mostrarFallbackSemanal ? (
        isMember && sessionStarted ? (
          <ClientRoutineFlow
            exercises={workoutDay?.exercises || []}
            states={exerciseStates}
            isSaving={isRegisteringExercise || isCompleting}
            isFinishConfirmOpen={isFinishConfirmOpen}
            onResolve={resolveClientExercise}
            onOpenFinish={() => setIsFinishConfirmOpen(true)}
            onCancelFinish={() => setIsFinishConfirmOpen(false)}
            onFinish={finishClientRoutine}
          />
        ) : !isMember ? <section className="space-y-4" data-testid="exercise-checklist">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="label-base">Lo que haces hoy</p>
              <h2 className="text-2xl font-heading font-bold text-neutral-900 dark:text-white">
                Checklist del entrenamiento
              </h2>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                Cada ejercicio ya trae máquina, prescripción, descanso y peso sugerido para que no tengas que salir de esta pantalla.
              </p>
            </div>
            {isMember ? (
              <Link
                to="/dashboard/member"
                className="text-sm font-medium text-neutral-500 transition-colors hover:text-primary"
              >
                Ir al resumen
              </Link>
            ) : null}
          </div>

          <div className="space-y-4">
            {workoutDay?.exercises?.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                log={logs[exercise.id]}
                active={sessionStarted}
                onUpdate={(field, value) => updateLog(exercise.id, field as keyof ExerciseLogEntry, value)}
              />
            ))}
          </div>
        </section> : null
      ) : null}

      {sessionStarted && !isMember ? (
          <div className="rounded-[1.75rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <h3 className="font-heading text-lg font-bold text-neutral-900 dark:text-white">Finalizar sesión</h3>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Cierra el bloque con una percepción general para que el progreso quede mejor registrado.
            </p>
            <div className="mt-4">
              <label className="label-base mb-2 block">
                ¿Cómo te sentiste? ({overallFeeling}/5)
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={overallFeeling}
                onChange={(e) => setOverallFeeling(parseInt(e.target.value))}
                className="w-full accent-primary"
                data-testid="feeling-slider"
              />
              <div className="mt-1 flex justify-between text-xs text-neutral-400">
                <span>Muy difícil</span>
                <span>Excelente</span>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MeasurementInput
                label="Peso corporal (kg)"
                value={measurementDraft.body_weight_kg}
                onChange={(value) => setMeasurementDraft((current) => ({ ...current, body_weight_kg: value }))}
                testId="body-weight-input"
              />
              <MeasurementInput
                label="Cintura (cm)"
                value={measurementDraft.waist_cm}
                onChange={(value) => setMeasurementDraft((current) => ({ ...current, waist_cm: value }))}
                testId="waist-input"
              />
              <MeasurementInput
                label="Grasa corporal (%)"
                value={measurementDraft.body_fat_pct}
                onChange={(value) => setMeasurementDraft((current) => ({ ...current, body_fat_pct: value }))}
                testId="body-fat-input"
              />
              <MeasurementInput
                label="Masa muscular (kg)"
                value={measurementDraft.muscle_mass_kg}
                onChange={(value) => setMeasurementDraft((current) => ({ ...current, muscle_mass_kg: value }))}
                testId="muscle-mass-input"
              />
            </div>
            <button
              onClick={handleCompleteSession}
              disabled={isCompleting || isSaving}
              className="btn-primary mt-5 flex w-full items-center justify-center gap-2"
              data-testid="complete-session-btn"
            >
              {isCompleting || isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle size={16} />
              )}
              {isCompleting || isSaving ? 'Guardando...' : 'COMPLETAR SESIÓN'}
            </button>
          </div>
      ) : null}

      <section
        className="rounded-[1.75rem] border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
        data-testid="training-context"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
            <p className="text-[11px] uppercase tracking-wide text-neutral-500">Plan activo</p>
            <p className="mt-2 text-sm font-semibold text-neutral-900 dark:text-white">
              {activePrescription?.plan_activo?.name || 'Programa activo'}
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
            <p className="text-[11px] uppercase tracking-wide text-neutral-500">Trainer</p>
            <p className="mt-2 text-sm font-semibold text-neutral-900 dark:text-white">
              {activePrescription?.trainer?.nombre || 'Trainer no asignado'}
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
            <p className="text-[11px] uppercase tracking-wide text-neutral-500">Formato de registro</p>
            <p className="mt-2 text-sm font-semibold text-neutral-900 dark:text-white">
              {mostrarFallbackSemanal ? 'Semana visible y ordenada' : 'Peso, RPE o minutos'}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <InlinePill icon={<Dumbbell size={14} />} label={mostrarFallbackSemanal ? `${diasPrograma.length} bloques esta semana` : `${ejercicios} ejercicios hoy`} />
          <InlinePill icon={<Target size={14} />} label="Orden ya definido" />
          <InlinePill icon={<Flame size={14} />} label={mostrarFallbackSemanal ? 'Consulta semanal activa' : 'Carga sugerida visible'} />
        </div>

        {isMember && tieneProgramaActivo ? (
          <div className="mt-6 space-y-5" data-testid="day-selector-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="label-base">{mostrarFallbackSemanal ? 'Escoge un día' : 'Consulta semanal'}</p>
                <h2 className="text-2xl font-heading font-bold text-neutral-900 dark:text-white">
                  Revisa exactamente qué toca en cada día
                </h2>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  {mostrarFallbackSemanal
                    ? 'Puedes consultar cualquier bloque semanal desde aquí. Solo el día real de hoy puede iniciar sesión.'
                    : 'Abre el panel para consultar otros días sin quitarle el foco a la rutina real de hoy.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDaySelectorOpen((current) => !current)}
                className="btn-secondary"
                data-testid="toggle-day-selector-btn"
              >
                {isDaySelectorOpen ? 'Ocultar otros días' : 'Ver otro día'}
              </button>
            </div>

            {isDaySelectorOpen ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {weeklyDays.map((day) => (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => setSelectedDayOfWeek(day.day_of_week)}
                      className={cn(
                        'rounded-[1.25rem] border p-4 text-left transition-colors',
                        selectedWeeklyDay?.day_of_week === day.day_of_week
                          ? 'border-primary bg-primary/5'
                          : 'border-neutral-200 bg-neutral-50/70 hover:border-primary/30 dark:border-neutral-800 dark:bg-neutral-900/60',
                      )}
                      data-testid={`day-selector-${day.day_of_week}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                            {day.has_workout ? `${DAY_OF_WEEK_LABELS[day.day_of_week]} · ${day.workout_day_name}` : `${DAY_OF_WEEK_LABELS[day.day_of_week]} · Descanso`}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {day.has_workout
                              ? `${day.day_label ? `Día ${day.day_label} · ` : ''}${day.is_completed ? 'Completado' : 'Disponible para consulta'}`
                              : 'Recuperación o descanso programado'}
                          </p>
                        </div>
                        <Badge variant={day.has_workout ? (selectedWeeklyDay?.day_of_week === day.day_of_week ? 'info' : 'neutral') : 'neutral'}>
                          {day.has_workout ? 'Ver' : 'Descanso'}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>

                {selectedWeeklyDay ? (
                  <SelectedDayDetail
                    day={selectedWeeklyDay}
                    workoutDay={selectedWorkoutDay}
                  />
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </section>

      {isMember && tieneProgramaActivo ? (
        <section className="space-y-4" data-testid="weekly-program-section">
          <div className="flex items-center gap-3">
            <SymbolFrame size="sm" tone="primary" className="rounded-xl">
              <NotebookTabs size={18} />
            </SymbolFrame>
            <div>
              <p className="label-base">Programa semanal</p>
              <h2 className="text-2xl font-heading font-bold text-neutral-900 dark:text-white">
                La semana completa de tu rutina
              </h2>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                Aquí mantienes el contexto general del plan sin salir de la página principal de entrenamiento.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {(weeklyView?.week_days || []).map((day) => (
              <WeeklyStatusCard
                key={day.date}
                day={day}
                planId={planId}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/plans/my" className="btn-secondary" data-testid="view-weekly-program-link">
              Ver mi plan semanal
            </Link>
          </div>
        </section>
      ) : null}

      {isMember ? (
        <section className="space-y-4 border-t border-neutral-200 pt-8 dark:border-neutral-800" data-testid="member-essential-summary">
          <div>
            <p className="label-base">Tu seguimiento</p>
            <h2 className="text-xl font-heading font-bold text-neutral-900 dark:text-white">
              Progreso y membresía
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <SupportCard
              title="Progreso"
              icon={<Activity size={18} className="text-primary" />}
              to="/progress"
              testId="card-progress"
            >
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                {dashboardSummary?.weekly_sessions_done || 0} sesión(es) esta semana
              </p>
              <p className="text-xs text-neutral-500">
                {dashboardSummary?.cumplimiento_semanal ?? 0}% de cumplimiento del plan semanal.
              </p>
            </SupportCard>

            <div className="rounded-[1.5rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950" data-testid="card-membership">
              <div className="mb-3 flex items-center gap-3">
                <SymbolFrame size="sm" tone="default" className="rounded-xl">
                  <CalendarClock size={18} />
                </SymbolFrame>
                <div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">Membresía actual</p>
                  <p className="text-xs text-neutral-500">{dashboardSummary?.membership_plan_name || 'Sin plan asignado'}</p>
                </div>
              </div>
              <Badge variant={dashboardSummary?.payment_status === 'paid' ? 'success' : dashboardSummary?.payment_status === 'late' ? 'error' : 'warning'}>
                {dashboardSummary?.payment_status === 'paid' ? 'Vigente' : dashboardSummary?.payment_status === 'late' ? 'Vencida' : 'Pendiente'}
              </Badge>
              <p className="mt-3 text-sm font-semibold text-neutral-900 dark:text-white">
                {dashboardSummary?.membership_expires_at
                  ? `Vence el ${formatDate(dashboardSummary.membership_expires_at)}`
                  : 'Fecha de vencimiento no disponible'}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                {dashboardSummary?.days_overdue != null
                  ? `${dashboardSummary.days_overdue} día(s) vencida`
                  : dashboardSummary?.days_until_due != null
                    ? `${dashboardSummary.days_until_due} día(s) restantes`
                    : 'Sin aviso de vencimiento pendiente.'}
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}

export function TodayWorkoutPage() {
  return (
    <TrainingPageErrorBoundary>
      <TodayWorkoutPageContent />
    </TrainingPageErrorBoundary>
  )
}

function MemberTrainingFallback() {
  const navigate = useNavigate()
  const { user, activeContext } = useAuthStore()
  const currentContext = getResolvedContext(user, activeContext)

  useEffect(() => {
    const target = currentContext === 'cliente' ? '/dashboard/member' : '/plans'
    const timer = window.setTimeout(() => {
      navigate(target, { replace: true, state: { trainingFallback: true } })
    }, 250)

    return () => window.clearTimeout(timer)
  }, [currentContext, navigate])

  return (
    <div data-testid="training-fallback" className="page-enter mx-auto max-w-3xl space-y-6">
      <section className="rounded-[1.75rem] border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <p className="label-base">Entrenamiento</p>
        <h1 className="text-3xl font-heading font-black text-neutral-900 dark:text-white">
          No se pudo cargar esta vista
        </h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Estamos abriendo una vista más estable para que no te quedes con la pantalla en negro.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to={currentContext === 'cliente' ? '/dashboard/member' : '/plans'} className="btn-secondary">
            Ir ahora
          </Link>
        </div>
      </section>
    </div>
  )
}

class TrainingPageErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('TodayWorkoutPage render failed', error)
  }

  render() {
    if (this.state.hasError) {
      return <MemberTrainingFallback />
    }

    return this.props.children
  }
}

function InlinePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/85 px-3 py-1.5 text-sm text-neutral-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-200">
      {icon}
      <span>{label}</span>
    </div>
  )
}

function SupportCard({
  title,
  icon,
  to,
  testId,
  children,
}: {
  title: string
  icon: React.ReactNode
  to: string
  testId: string
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className="block rounded-[1.5rem] border border-neutral-200 bg-white p-5 shadow-sm transition-colors hover:border-primary/30 dark:border-neutral-800 dark:bg-neutral-950"
      data-testid={testId}
    >
      <div className="mb-3 flex items-center gap-3">
        <SymbolFrame size="sm" tone="default" className="rounded-xl">
          {icon}
        </SymbolFrame>
        <p className="text-sm font-semibold text-neutral-900 dark:text-white">{title}</p>
      </div>
      {children}
    </Link>
  )
}

function WeeklyStatusCard({
  day,
  planId,
}: {
  day: {
    date: string
    workout_day_name: string | null
    workout_day_id: number | null
    day_of_week: string
    day_label: string | null
    has_workout: boolean
    is_rest_day: boolean
    session_id: number | null
    is_completed: boolean
  }
  planId: number
}) {
  const weekdayLabel = DAY_OF_WEEK_LABELS[day.day_of_week] || day.day_of_week
  const detailHref = day.has_workout && day.workout_day_id ? `/plans/${planId}/days/${day.workout_day_id}` : null

  return (
    <div
      className="rounded-[1.5rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
      data-testid={`weekly-status-${day.day_of_week}`}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-neutral-900 dark:text-white">
            {day.has_workout ? `${weekdayLabel} · ${day.workout_day_name}` : `${weekdayLabel} · Descanso`}
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {day.has_workout
              ? `${day.day_label ? `Día ${day.day_label} · ` : ''}${day.is_completed ? 'Sesión completada' : 'Bloque asignado'}`
              : 'Recuperación o descanso programado'}
          </p>
        </div>
        <Badge variant={day.has_workout ? (day.is_completed ? 'success' : 'info') : 'neutral'}>
          {day.has_workout ? (day.is_completed ? 'Completado' : 'Activo') : 'Descanso'}
        </Badge>
      </div>
      {detailHref ? (
        <Link
          to={detailHref}
          className="mt-3 inline-flex text-sm font-semibold text-primary transition-colors hover:text-primary-hover"
          data-testid={`weekly-day-detail-link-${day.day_of_week}`}
        >
          Ver día
        </Link>
      ) : null}
    </div>
  )
}

function SelectedDayDetail({
  day,
  workoutDay,
}: {
  day: {
    date: string
    workout_day_name: string | null
    workout_day_id: number | null
    day_of_week: string
    day_label: string | null
    has_workout: boolean
    is_rest_day: boolean
    session_id: number | null
    is_completed: boolean
  }
  workoutDay: {
    id: number
    plan: number
    name: string
    day_label: string
    day_of_week: string
    order: number
    exercises: Exercise[]
  } | null
}) {
  const weekdayLabel = DAY_OF_WEEK_LABELS[day.day_of_week] || day.day_of_week

  if (!day.has_workout || !workoutDay) {
    return (
      <div
        className="rounded-[1.5rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
        data-testid="selected-day-detail"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="label-base">Detalle del día</p>
            <h3 className="text-xl font-heading font-bold text-neutral-900 dark:text-white">
              {weekdayLabel} · Descanso
            </h3>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              No hay bloque asignado para este día en el plan actual.
            </p>
          </div>
          <Badge variant="neutral">Descanso</Badge>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-[1.5rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
      data-testid="selected-day-detail"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-base">Detalle del día</p>
          <h3 className="text-xl font-heading font-bold text-neutral-900 dark:text-white">
            {weekdayLabel} · {workoutDay.name}
          </h3>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Consulta este bloque en modo lectura. Solo el día real correspondiente permite iniciar sesión.
          </p>
        </div>
        <Badge variant={day.is_completed ? 'success' : 'info'}>
          {day.is_completed ? 'Completado' : 'Consulta'}
        </Badge>
      </div>

      <div className="mt-4">
        <Link
          to={`/plans/${workoutDay.plan}/days/${workoutDay.id}`}
          className="btn-secondary inline-flex w-full items-center justify-center sm:w-auto"
          data-testid="selected-day-detail-link"
        >
          Ver plan completo del día
        </Link>
      </div>

      <div className="mt-5 space-y-4">
        {workoutDay.exercises.length ? (
          workoutDay.exercises.map((exercise) => (
            <div
              key={exercise.id}
              className="rounded-[1.25rem] border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"
              data-testid={`selected-exercise-${exercise.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-neutral-900 dark:text-white">{exercise.name}</h4>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    {MUSCLE_LABELS[exercise.muscle_group]} · {exercise.machine_detail?.name || 'Ejercicio libre'}
                  </p>
                </div>
                <Badge variant="neutral">{getExercisePrescriptionLabel(exercise)}</Badge>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StaticMetric label="Máquina" value={exercise.machine_detail?.name || 'Libre'} />
                <StaticMetric
                  label="Prescripción"
                  value={exercise.exercise_type === 'timed' ? `${exercise.target_minutes ?? 0} min` : `${exercise.sets ?? 0}×${exercise.reps_range}`}
                />
                <StaticMetric label="Descanso" value={`${exercise.rest_seconds}s`} />
                <StaticMetric
                  label="Peso sugerido"
                  value={exercise.weight_suggestion_kg != null ? `${exercise.weight_suggestion_kg}kg` : 'Libre'}
                />
              </div>

              {exercise.technique_notes ? (
                <p className="mt-3 text-xs italic text-neutral-500 dark:text-neutral-400">{exercise.technique_notes}</p>
              ) : null}
            </div>
          ))
        ) : (
          <EmptyState
            icon={<Dumbbell size={32} />}
            title="Este bloque no tiene ejercicios cargados"
            description="Tu trainer asignó el día, pero aún no ha cargado ejercicios en ese bloque."
          />
        )}
      </div>
    </div>
  )
}

interface ExerciseCardProps {
  exercise: Exercise
  log?: ExerciseLogEntry
  active: boolean
  onUpdate: (field: string, value: number) => void
}

function ClientRoutineFlow({
  exercises,
  states,
  isSaving,
  isFinishConfirmOpen,
  onResolve,
  onOpenFinish,
  onCancelFinish,
  onFinish,
}: {
  exercises: Exercise[]
  states: Record<number, 'realizado' | 'omitido'>
  isSaving: boolean
  isFinishConfirmOpen: boolean
  onResolve: (exerciseId: number, estado: 'realizado' | 'omitido') => void
  onOpenFinish: () => void
  onCancelFinish: () => void
  onFinish: () => void
}) {
  const resueltos = Object.keys(states).length
  const actual = exercises.find((exercise) => !states[exercise.id])
  const porcentaje = exercises.length ? Math.round((resueltos / exercises.length) * 100) : 0

  if (!actual) return null
  const mediaUrl = actual.catalogo_detalle?.animacion_url || actual.catalogo_detalle?.imagen_url
  const esTiempo = actual.exercise_type === 'timed'

  return (
    <section className="space-y-4" data-testid="client-routine-flow">
      <div className="rounded-[1.5rem] border border-primary/20 bg-primary/5 p-5 dark:bg-primary/10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="label-base">Progreso de la rutina</p>
            <p className="mt-1 text-sm font-semibold text-neutral-800 dark:text-neutral-100">{resueltos} de {exercises.length} ejercicios resueltos</p>
          </div>
          <span className="font-heading text-xl font-black text-primary">{porcentaje}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-primary/15"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${porcentaje}%` }} /></div>
      </div>

      <article className="rounded-[1.75rem] border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950" data-testid={`current-exercise-${actual.id}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="label-base">Ejercicio {resueltos + 1} de {exercises.length}</p>
            <h2 className="mt-1 text-3xl font-heading font-black text-neutral-900 dark:text-white">{actual.name}</h2>
            <p className="mt-1 text-sm text-neutral-500">{MUSCLE_LABELS[actual.muscle_group]}</p>
          </div>
          <Badge variant="info">{getExercisePrescriptionLabel(actual)}</Badge>
        </div>

        {mediaUrl ? <img className="mt-5 h-56 w-full rounded-2xl object-cover sm:h-72" src={mediaUrl} alt={`Demostración de ${actual.name}`} /> : null}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {esTiempo ? <StaticMetric label="Duración" value={`${actual.target_minutes ?? 0} min`} /> : <><StaticMetric label="Series" value={String(actual.sets ?? 0)} /><StaticMetric label="Repeticiones" value={actual.reps_range} /></>}
          <StaticMetric label="Descanso" value={`${actual.rest_seconds}s`} />
          <StaticMetric label="Equipo" value={actual.machine_detail?.name || 'Ejercicio libre'} />
          {!esTiempo ? <StaticMetric label="Peso sugerido" value={actual.weight_suggestion_kg ? `${actual.weight_suggestion_kg} kg` : 'Según indicación'} /> : null}
        </div>
        {(actual.catalogo_detalle?.instrucciones_es || actual.technique_notes) ? <div className="mt-5 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300"><p className="font-semibold text-neutral-900 dark:text-white">Cómo hacerlo</p><p className="mt-2">{actual.catalogo_detalle?.instrucciones_es || actual.technique_notes}</p></div> : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button type="button" disabled={isSaving} onClick={() => onResolve(actual.id, 'realizado')} className="btn-primary min-h-14 justify-center text-base" data-testid="mark-exercise-done">{isSaving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />} Realizado</button>
          <button type="button" disabled={isSaving} onClick={() => onResolve(actual.id, 'omitido')} className="btn-secondary min-h-14 justify-center text-base" data-testid="skip-exercise">Omitir</button>
        </div>
      </article>

      {isFinishConfirmOpen ? <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30"><p className="font-semibold text-amber-900 dark:text-amber-200">¿Finalizar ahora?</p><p className="mt-1 text-sm text-amber-800 dark:text-amber-300">Los ejercicios pendientes se marcarán como omitidos.</p><div className="mt-4 flex gap-3"><button type="button" className="btn-secondary" onClick={onCancelFinish}>Continuar</button><button type="button" disabled={isSaving} className="btn-primary" onClick={onFinish}>Omitir y finalizar</button></div></div> : <button type="button" disabled={isSaving} onClick={onOpenFinish} className="w-full py-3 text-sm font-semibold text-neutral-500 hover:text-primary">Finalizar rutina</button>}
    </section>
  )
}

function ExerciseCard({ exercise, log, active, onUpdate }: ExerciseCardProps) {
  const isTimed = exercise.exercise_type === 'timed'
  const mediaUrl = exercise.catalogo_detalle?.animacion_url || exercise.catalogo_detalle?.imagen_url

  return (
    <div
      className={cn(
        'rounded-[1.6rem] border border-neutral-200 bg-white p-5 shadow-sm transition-all dark:border-neutral-800 dark:bg-neutral-950',
        active && 'border-primary/30',
      )}
      data-testid={`exercise-card-${exercise.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-neutral-900 dark:text-white">{exercise.name}</h4>
          <span className="text-xs text-neutral-400">{MUSCLE_LABELS[exercise.muscle_group]}</span>
        </div>
        <Badge variant="info">{getExercisePrescriptionLabel(exercise)}</Badge>
      </div>

      {exercise.catalogo_detalle && (
        <div className="mt-4 grid gap-4 rounded-2xl border border-neutral-200 p-4 md:grid-cols-[180px_1fr] dark:border-neutral-800">
          {mediaUrl ? (
            <img className="h-[180px] w-[180px] rounded-xl object-cover" src={mediaUrl} alt={`Ilustración de ${exercise.name}`} />
          ) : null}
          <div>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">{exercise.catalogo_detalle.instrucciones_es}</p>
            {!!exercise.catalogo_detalle.pasos_es.length && (
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-neutral-500">
                {exercise.catalogo_detalle.pasos_es.map((paso, index) => <li key={index}>{paso}</li>)}
              </ol>
            )}
            {exercise.catalogo_detalle.atribucion_media ? (
              <a className="mt-3 inline-block text-[11px] text-neutral-400 underline" href="https://repdb.co" target="_blank" rel="noreferrer">
                {exercise.catalogo_detalle.atribucion_media}
              </a>
            ) : null}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">Prescripción del trainer</p>
          {isTimed ? (
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <StaticMetric label="Duración objetivo" value={`${exercise.target_minutes ?? 0} min`} />
              <StaticMetric label="Máquina" value={exercise.machine_detail?.name || 'Libre'} />
              <StaticMetric label="Descanso" value={`${exercise.rest_seconds}s`} />
              <StaticMetric label="Tipo" value="Cardio por tiempo" />
              <StaticMetric label="Carga" value="No aplica" />
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <StaticMetric label="Series" value={String(exercise.sets ?? 0)} />
              <StaticMetric label="Repeticiones" value={exercise.reps_range} />
              <StaticMetric label="Máquina" value={exercise.machine_detail?.name || 'Libre'} />
              <StaticMetric label="Descanso" value={`${exercise.rest_seconds}s`} />
              <StaticMetric label="Peso sugerido" value={exercise.weight_suggestion_kg ? `${exercise.weight_suggestion_kg}kg` : 'Libre'} />
            </div>
          )}
          {exercise.technique_notes ? (
            <p className="mt-3 text-xs italic text-neutral-500 dark:text-neutral-400">{exercise.technique_notes}</p>
          ) : null}
          <PreviousExerciseLogSummary exercise={exercise} />
        </div>

        <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">Tu registro</p>
          {!active || !log ? (
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
              {isTimed
                ? 'Inicia la sesión para registrar los minutos que realmente completaste.'
                : 'Inicia la sesión para registrar tu peso usado y percepción de esfuerzo.'}
            </p>
          ) : (
            isTimed ? (
              <div className="mt-3 grid grid-cols-1 gap-3">
                <LogStepper
                  label="Minutos realizados"
                  value={log.minutes_completed || exercise.target_minutes || 0}
                  onChange={(value) => onUpdate('minutes_completed', value)}
                  step={1}
                  min={0}
                  testId={`minutes-input-${exercise.id}`}
                />
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <LogStepper
                  label="Peso (kg)"
                  value={log.weight_used_kg || 0}
                  onChange={(value) => onUpdate('weight_used_kg', value)}
                  step={2.5}
                  testId={`weight-input-${exercise.id}`}
                />
                <LogStepper
                  label="RPE"
                  value={log.rpe || 7}
                  onChange={(value) => onUpdate('rpe', value)}
                  step={1}
                  min={1}
                  max={10}
                  testId={`rpe-input-${exercise.id}`}
                />
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

function PreviousExerciseLogSummary({ exercise }: { exercise: Exercise }) {
  const previous = exercise.previous_log
  if (!previous) {
    return (
      <div className="mt-3 rounded-2xl border border-dashed border-neutral-200 p-3 text-xs text-neutral-500 dark:border-neutral-800">
        Sin historial previo para este ejercicio.
      </div>
    )
  }

  const isTimed = exercise.exercise_type === 'timed'
  const delta = previous.weight_delta_kg
  const deltaLabel = delta == null || isTimed
    ? null
    : `${delta > 0 ? '+' : ''}${delta} kg vs peso sugerido`

  return (
    <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-xs text-neutral-600 dark:text-neutral-300" data-testid={`previous-log-${exercise.id}`}>
      <p className="font-semibold text-neutral-900 dark:text-white">Última vez · {formatDate(previous.date)}</p>
      <p className="mt-1">
        {isTimed
          ? `${previous.minutes_completed ?? 0} min completados`
          : `${previous.weight_used_kg ?? 0} kg · ${previous.reps_completed} reps · RPE ${previous.rpe ?? '-'}`
        }
      </p>
      {deltaLabel ? <p className="mt-1 text-primary">{deltaLabel}</p> : null}
    </div>
  )
}

function MeasurementInput({
  label,
  value,
  onChange,
  testId,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  testId: string
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <input
        className="input"
        type="number"
        min={0}
        step="0.1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        data-testid={testId}
      />
    </label>
  )
}

function StaticMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-neutral-800 dark:text-neutral-200">{value}</p>
    </div>
  )
}

function LogStepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  testId,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  testId?: string
}) {
  const handleChange = (nextValue: number) => {
    const bounded = Math.max(min, max != null ? Math.min(max, nextValue) : nextValue)
    onChange(bounded)
  }

  return (
    <div className="rounded-2xl bg-neutral-50 px-3 py-3 text-center dark:bg-neutral-900/70" data-testid={testId}>
      <label className="label-base mb-2 block">{label}</label>
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => handleChange(value - step)}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-200 text-neutral-500 transition-colors hover:border-primary/40 hover:text-primary dark:border-neutral-700"
        >
          -
        </button>
        <span className="w-14 text-center font-heading text-xl font-bold text-neutral-900 dark:text-white">
          {Number.isInteger(value) ? value : value.toFixed(1)}
        </span>
        <button
          type="button"
          onClick={() => handleChange(value + step)}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-200 text-neutral-500 transition-colors hover:border-primary/40 hover:text-primary dark:border-neutral-700"
        >
          +
        </button>
      </div>
    </div>
  )
}
