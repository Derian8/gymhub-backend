import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Dumbbell, PlusCircle, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, ConfirmDialog, EmptyState, PageHeader } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { useAuthStore } from '@/shared/store/authStore'
import {
  guardarPublicacionPrescripcion,
  leerPublicacionPrescripcion,
  descripcionPublicacionPrescripcion,
  type TipoPublicacionPrescripcion,
} from '@/shared/lib/prescriptionPublication'
import { MUSCLE_GROUP_OPTIONS, formatDateTime } from '@/shared/lib/utils'
import { useMemberActivePrescriptionQuery, useMemberDetailQuery, useMemberPrescriptionQuery } from '../hooks/useMembers'
import {
  useCreateGymMachineMutation,
  useApplyTrainingTemplateMutation,
  useCreateExerciseMutation,
  useCreatePlanMutation,
  useCreateWorkoutDayMutation,
  useDeleteGymMachineMutation,
  useDeleteTrainingTemplateMutation,
  useDeleteExerciseMutation,
  useDeletePlanMutation,
  useDeleteWorkoutDayMutation,
  useGymMachinesQuery,
  usePlansQuery,
  usePublishPlanMutation,
  useRefreshTrainingTemplateMutation,
  useSavePlanAsTemplateMutation,
  useTrainingTemplatesQuery,
  useUpdateGymMachineMutation,
  useUpdateExerciseMutation,
  useUpdateTrainingTemplateMutation,
  useUpdateWorkoutDayMutation,
  useUpdatePlanMutation,
  useWorkoutDaysByPlanQuery,
} from '@/modules/plans/hooks/usePlans'
import { TrainingPlanWizard } from '@/modules/plans/components/TrainingPlanWizard'
import type {
  DayOfWeek,
  DayLabel,
  ExercisePayload,
  ExerciseType,
  GoalType,
  GymMachine,
  MuscleGroup,
  TrainingPlanPayload,
  TrainingTemplateUpdatePayload,
} from '@/shared/types'

const goalOptions: Array<{ value: GoalType; label: string }> = [
  { value: 'fat_loss', label: 'Perdida de peso' },
  { value: 'muscle_gain', label: 'Ganancia muscular' },
  { value: 'endurance', label: 'Resistencia' },
  { value: 'flexibility', label: 'Movilidad' },
  { value: 'general', label: 'General' },
]

const goalLabels: Record<string, string> = {
  fat_loss: 'Perdida de peso',
  muscle_gain: 'Ganancia muscular',
  endurance: 'Resistencia',
  flexibility: 'Movilidad',
  general: 'General',
  maintenance: 'Mantenimiento',
}

const riskLabels: Record<'low' | 'medium' | 'high', string> = {
  low: 'Riesgo bajo',
  medium: 'Riesgo medio',
  high: 'Riesgo alto',
}

const dayOptions: DayLabel[] = ['A', 'B', 'C', 'D']
const dayOfWeekOptions: Array<{ value: DayOfWeek; label: string }> = [
  { value: 'mon', label: 'Lunes' },
  { value: 'tue', label: 'Martes' },
  { value: 'wed', label: 'Miércoles' },
  { value: 'thu', label: 'Jueves' },
  { value: 'fri', label: 'Viernes' },
  { value: 'sat', label: 'Sábado' },
  { value: 'sun', label: 'Domingo' },
]
const muscleOptions = MUSCLE_GROUP_OPTIONS

const adherenceOptions: Array<{ value: 'low' | 'medium' | 'high'; label: string }> = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
]

function riskVariant(level?: 'low' | 'medium' | 'high') {
  if (level === 'high') {
    return 'error'
  }
  if (level === 'medium') {
    return 'warning'
  }
  return 'success'
}

function formatSituacion(situacion: string) {
  return situacion.replace(/_/g, ' ')
}

function formatTemplateCount(total: number, label: string) {
  if (total === 1) {
    return `1 ${label}`
  }
  return `${total} ${label}s`
}

function buildExercisePayloadByType(exercise: ExercisePayload): ExercisePayload {
  if (exercise.exercise_type === 'timed') {
    return {
      ...exercise,
      sets: null,
      reps_range: '',
      target_minutes: exercise.target_minutes ?? 10,
      weight_suggestion_kg: null,
    }
  }

  return {
    ...exercise,
    sets: exercise.sets ?? 3,
    reps_range: exercise.reps_range || '8-12',
    target_minutes: null,
  }
}

function syncExerciseWithMuscleGroup(exercise: ExercisePayload, muscleGroup: MuscleGroup): ExercisePayload {
  if (muscleGroup === 'cardio') {
    return buildExercisePayloadByType({
      ...exercise,
      muscle_group: muscleGroup,
      exercise_type: 'timed',
    })
  }

  if (exercise.muscle_group === 'cardio' && exercise.exercise_type === 'timed') {
    return buildExercisePayloadByType({
      ...exercise,
      muscle_group: muscleGroup,
      exercise_type: 'strength',
    })
  }

  return {
    ...exercise,
    muscle_group: muscleGroup,
  }
}

function formatExercisePrescription(exercise: {
  exercise_type: ExerciseType
  sets: number | null
  reps_range: string
  target_minutes: number | null
  rest_seconds: number
  weight_suggestion_kg: number | null
}) {
  if (exercise.exercise_type === 'timed') {
    return `${exercise.target_minutes ?? 0} min · descanso ${exercise.rest_seconds}s`
  }

  const weightLabel = exercise.weight_suggestion_kg != null ? ` · ${exercise.weight_suggestion_kg} kg sugeridos` : ''
  return `${exercise.sets ?? 0}x${exercise.reps_range} · descanso ${exercise.rest_seconds}s${weightLabel}`
}

type DeleteTarget =
  | { type: 'plan'; id: number; name: string; planActivo: boolean }
  | { type: 'day'; id: number; name: string }
  | { type: 'exercise'; id: number; name: string; workoutDayId: number }
  | { type: 'machine'; id: number; name: string }
  | { type: 'training_template'; id: number; name: string }

type TrainerProgramPageProps = {
  memberIdOverride?: number
  planIdOverride?: number
  plansContext?: boolean
}

export function TrainerProgramPage({ memberIdOverride, planIdOverride, plansContext = false }: TrainerProgramPageProps = {}) {
  const { id } = useParams<{ id: string }>()
  const memberId = memberIdOverride ?? Number(id || '0')
  const { user } = useAuthStore()

  const { data: member, isLoading: memberLoading } = useMemberDetailQuery(memberId)
  const { data: prescription, isLoading: prescriptionLoading } = useMemberPrescriptionQuery(memberId)
  const { data: activePrescription } = useMemberActivePrescriptionQuery(memberId)
  const { data: plansData, isLoading: plansLoading } = usePlansQuery({ member: String(memberId) })
  const { data: trainingTemplatesData } = useTrainingTemplatesQuery()
  const publishPlan = usePublishPlanMutation()

  const activePlan = useMemo(
    () => plansData?.results.find((plan) => plan.id === planIdOverride)
      ?? plansData?.results.find((plan) => plan.is_active)
      ?? plansData?.results[0]
      ?? null,
    [planIdOverride, plansData],
  )

  const { data: daysData, isLoading: daysLoading } = useWorkoutDaysByPlanQuery(activePlan?.id ?? 0)
  const { data: gymMachinesData } = useGymMachinesQuery()
  const trainingTemplates = useMemo(
    () => trainingTemplatesData?.results ?? [],
    [trainingTemplatesData],
  )

  const [selectedWorkoutDayId, setSelectedWorkoutDayId] = useState<number>(0)
  const [trainingTemplateGoalFilter, setTrainingTemplateGoalFilter] = useState<'all' | string>('all')
  const [trainingTemplateRiskFilter, setTrainingTemplateRiskFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all')
  const [selectedTrainingTemplateId, setSelectedTrainingTemplateId] = useState<number | null>(null)
  const [planForm, setPlanForm] = useState<TrainingPlanPayload>({
    member: memberId,
    name: '',
    goal: 'general',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: null,
    weeks_duration: 8,
    days_per_week: 3,
    is_active: true,
  })
  const [templatePlanForm, setTemplatePlanForm] = useState({
    nombre: '',
    descripcion: '',
    nivel_adherencia_recomendado: 'medium',
  })
  const [templateEditForm, setTemplateEditForm] = useState<TrainingTemplateUpdatePayload>({
    nombre: '',
    descripcion: '',
    objetivo: 'general',
    nivel_adherencia_recomendado: 'medium',
    dias_por_semana_sugeridos: 3,
    esta_activa: true,
  })
  const [dayForm, setDayForm] = useState({
    name: '',
    day_label: 'A' as DayLabel,
    day_of_week: 'mon' as DayOfWeek,
    order: 0,
  })
  const [editingDayId, setEditingDayId] = useState<number | null>(null)
  const [editingDayForm, setEditingDayForm] = useState({
    name: '',
    day_label: 'A' as DayLabel,
    day_of_week: 'mon' as DayOfWeek,
    order: 0,
  })
  const [exerciseForm, setExerciseForm] = useState<ExercisePayload>({
    workout_day: 0,
    name: '',
    muscle_group: 'full_body',
    exercise_type: 'strength',
    sets: 3,
    reps_range: '8-12',
    target_minutes: null,
    machine: null,
    weight_suggestion_kg: null,
    rest_seconds: 60,
    technique_notes: '',
    order: 0,
  })
  const [editingExerciseId, setEditingExerciseId] = useState<number | null>(null)
  const [editingExerciseForm, setEditingExerciseForm] = useState<ExercisePayload>({
    workout_day: 0,
    name: '',
    muscle_group: 'full_body',
    exercise_type: 'strength',
    sets: 3,
    reps_range: '8-12',
    target_minutes: null,
    machine: null,
    weight_suggestion_kg: null,
    rest_seconds: 60,
    technique_notes: '',
    order: 0,
  })
  const [machineForm, setMachineForm] = useState({
    name: '',
    category: '',
    notes: '',
    is_active: true,
  })
  const [editingMachineId, setEditingMachineId] = useState<number | null>(null)
  const [editingMachineForm, setEditingMachineForm] = useState({
    name: '',
    category: '',
    notes: '',
    is_active: true,
  })
  const [publicationBanner, setPublicationBanner] = useState<string | null>(null)
  const [lastPublication, setLastPublication] = useState(() => leerPublicacionPrescripcion(memberId))
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [refreshTemplateId, setRefreshTemplateId] = useState<number | null>(null)
  const [createPlanWizardOpen, setCreatePlanWizardOpen] = useState(false)

  const createPlan = useCreatePlanMutation()
  const updatePlan = useUpdatePlanMutation()
  const deletePlan = useDeletePlanMutation()
  const createWorkoutDay = useCreateWorkoutDayMutation(activePlan?.id, memberId)
  const updateWorkoutDay = useUpdateWorkoutDayMutation(activePlan?.id, memberId)
  const deleteWorkoutDay = useDeleteWorkoutDayMutation(activePlan?.id, memberId)
  const createExercise = useCreateExerciseMutation(memberId)
  const updateExercise = useUpdateExerciseMutation(activePlan?.id, memberId)
  const deleteExercise = useDeleteExerciseMutation(activePlan?.id, memberId)
  const createGymMachine = useCreateGymMachineMutation()
  const updateGymMachine = useUpdateGymMachineMutation()
  const deleteGymMachine = useDeleteGymMachineMutation()
  const savePlanAsTemplate = useSavePlanAsTemplateMutation(memberId)
  const applyTrainingTemplate = useApplyTrainingTemplateMutation(memberId)
  const updateTrainingTemplate = useUpdateTrainingTemplateMutation()
  const deleteTrainingTemplate = useDeleteTrainingTemplateMutation()
  const refreshTrainingTemplate = useRefreshTrainingTemplateMutation()
  const publicationSignatureRef = useRef<string>('')

  const filteredTrainingTemplates = useMemo(() => {
    return trainingTemplates.filter((template) => {
      const matchesGoal = trainingTemplateGoalFilter === 'all' || template.objetivo === trainingTemplateGoalFilter
      const matchesRisk =
        trainingTemplateRiskFilter === 'all' || template.nivel_adherencia_recomendado === trainingTemplateRiskFilter
      return matchesGoal && matchesRisk
    })
  }, [trainingTemplates, trainingTemplateGoalFilter, trainingTemplateRiskFilter])

  const gymMachines = gymMachinesData?.results ?? []

  const selectedTrainingTemplate = useMemo(
    () => filteredTrainingTemplates.find((template) => template.id === selectedTrainingTemplateId) ?? filteredTrainingTemplates[0] ?? null,
    [filteredTrainingTemplates, selectedTrainingTemplateId],
  )

  useEffect(() => {
    if (!activePlan) {
      setPlanForm((current) => ({
        ...current,
        member: memberId,
        days_per_week: prescription?.recommended_days_per_week ?? current.days_per_week,
        goal:
          prescription?.recommended_goal && prescription.recommended_goal in goalLabels
            ? (prescription.recommended_goal as GoalType)
            : current.goal,
      }))
      return
    }
    setPlanForm({
      member: memberId,
      name: activePlan.name,
      goal: activePlan.goal,
      start_date: activePlan.start_date,
      end_date: activePlan.end_date,
      weeks_duration: activePlan.weeks_duration,
      days_per_week: activePlan.days_per_week,
      is_active: activePlan.is_active,
    })
  }, [activePlan, memberId, prescription])

  useEffect(() => {
    if (!daysData?.results.length) {
      setSelectedWorkoutDayId(0)
      return
    }
    setSelectedWorkoutDayId((current) => current || daysData.results[0].id)
  }, [daysData])

  useEffect(() => {
    if (!selectedWorkoutDayId) {
      return
    }
    const selectedDay = daysData?.results.find((day) => day.id === selectedWorkoutDayId)
    setExerciseForm((current) => ({
      ...current,
      workout_day: selectedWorkoutDayId,
      order: selectedDay?.exercises.length ?? 0,
    }))
  }, [selectedWorkoutDayId, daysData])

  useEffect(() => {
    if (!selectedWorkoutDayId) {
      setEditingDayId(null)
      setEditingExerciseId(null)
    }
  }, [selectedWorkoutDayId])

  useEffect(() => {
    if (!activePlan) {
      return
    }
    setTemplatePlanForm((current) => ({
      ...current,
      nombre: current.nombre || `Base ${activePlan.name}`,
    }))
  }, [activePlan])

  useEffect(() => {
    if (!filteredTrainingTemplates.length) {
      setSelectedTrainingTemplateId(null)
      return
    }
    setSelectedTrainingTemplateId((current) => {
      if (current && filteredTrainingTemplates.some((template) => template.id === current)) {
        return current
      }
      return filteredTrainingTemplates[0].id
    })
  }, [filteredTrainingTemplates])

  useEffect(() => {
    if (!selectedTrainingTemplate) {
      setTemplateEditForm({
        nombre: '',
        descripcion: '',
        objetivo: 'general',
        nivel_adherencia_recomendado: 'medium',
        dias_por_semana_sugeridos: 3,
        esta_activa: true,
      })
      return
    }
    setTemplateEditForm({
      nombre: selectedTrainingTemplate.nombre,
      descripcion: selectedTrainingTemplate.descripcion,
      objetivo: selectedTrainingTemplate.objetivo,
      nivel_adherencia_recomendado: selectedTrainingTemplate.nivel_adherencia_recomendado,
      dias_por_semana_sugeridos: selectedTrainingTemplate.dias_por_semana_sugeridos,
      esta_activa: selectedTrainingTemplate.esta_activa,
    })
  }, [selectedTrainingTemplate])

  useEffect(() => {
    const transitions: Array<[boolean, string, TipoPublicacionPrescripcion]> = [
      [createPlan.isSuccess, 'Plan activo publicado para este member.', 'plan'],
      [updatePlan.isSuccess, 'Cambios del plan publicados para este member.', 'plan'],
      [createWorkoutDay.isSuccess, 'El plan activo ya incluye un nuevo día para este member.', 'dia'],
      [updateWorkoutDay.isSuccess, 'Los cambios del dia ya quedaron publicados para este member.', 'dia'],
      [createExercise.isSuccess, 'La rutina del member ya incluye el nuevo ejercicio.', 'ejercicio'],
      [updateExercise.isSuccess, 'Los cambios del ejercicio ya quedaron publicados para este member.', 'ejercicio'],
      [applyTrainingTemplate.isSuccess, 'La base de entrenamiento quedó publicada para este member.', 'entrenamiento'],
    ]

    const match = transitions.find(([isSuccess]) => isSuccess)
    if (!match) {
      return
    }

    const [, message, tipo] = match
    const signature = transitions.map(([isSuccess]) => (isSuccess ? '1' : '0')).join('')
    if (publicationSignatureRef.current === signature) {
      return
    }
    publicationSignatureRef.current = signature
    guardarPublicacionPrescripcion(memberId, tipo)
    setLastPublication(leerPublicacionPrescripcion(memberId))
    setPublicationBanner(message)
  }, [
    applyTrainingTemplate.isSuccess,
    createExercise.isSuccess,
    createPlan.isSuccess,
    createWorkoutDay.isSuccess,
    memberId,
    updateExercise.isSuccess,
    updateWorkoutDay.isSuccess,
    updatePlan.isSuccess,
  ])

  const canEditProgram = !!member && (
    user?.is_staff ||
    (member.trainer_asignado !== null && member.trainer_asignado === user?.trainerprofile_id)
  )

  const handlePlanSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (activePlan) {
      updatePlan.mutate({ id: activePlan.id, payload: planForm })
      return
    }
    createPlan.mutate(planForm)
  }

  const handleDaySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activePlan) {
      return
    }
    createWorkoutDay.mutate({
      ...dayForm,
      plan: activePlan.id,
    })
    setDayForm({
      name: '',
      day_label: 'A',
      day_of_week: 'mon',
      order: daysData?.results.length ?? 0,
    })
  }

  const handleExerciseSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedWorkoutDayId) {
      return
    }
    createExercise.mutate({
      ...buildExercisePayloadByType(exerciseForm),
      workout_day: selectedWorkoutDayId,
    })
    setExerciseForm((current) => buildExercisePayloadByType({
      ...current,
      name: '',
      target_minutes: current.exercise_type === 'timed' ? current.target_minutes ?? 10 : null,
      weight_suggestion_kg: null,
      technique_notes: '',
    }))
  }

  const startDayEdit = (day: { id: number; name: string; day_label: DayLabel; day_of_week: DayOfWeek; order: number }) => {
    setSelectedWorkoutDayId(day.id)
    setEditingExerciseId(null)
    setEditingDayId(day.id)
    setEditingDayForm({
      name: day.name,
      day_label: day.day_label,
      day_of_week: day.day_of_week,
      order: day.order,
    })
  }

  const handleDayUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingDayId || !activePlan) {
      return
    }
    updateWorkoutDay.mutate(
      {
        id: editingDayId,
        payload: {
          plan: activePlan.id,
          ...editingDayForm,
        },
      },
      { onSuccess: () => setEditingDayId(null) },
    )
  }

  const startExerciseEdit = (exercise: ExercisePayload & { id: number }) => {
    setEditingDayId(null)
    setEditingExerciseId(exercise.id)
    setEditingExerciseForm({
      workout_day: exercise.workout_day,
      name: exercise.name,
      muscle_group: exercise.muscle_group,
      exercise_type: exercise.exercise_type,
      sets: exercise.sets,
      reps_range: exercise.reps_range,
      target_minutes: exercise.target_minutes ?? null,
      weight_suggestion_kg: exercise.weight_suggestion_kg ?? null,
      machine: exercise.machine ?? null,
      rest_seconds: exercise.rest_seconds,
      technique_notes: exercise.technique_notes ?? '',
      order: exercise.order,
    })
  }

  const handleExerciseUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingExerciseId) {
      return
    }
    updateExercise.mutate(
      {
        id: editingExerciseId,
        payload: buildExercisePayloadByType(editingExerciseForm),
      },
      { onSuccess: () => setEditingExerciseId(null) },
    )
  }

  const handleMoveDay = (dayId: number, direction: 'up' | 'down') => {
    if (!daysData?.results.length || !activePlan) {
      return
    }
    const orderedDays = [...daysData.results].sort((a, b) => a.order - b.order)
    const currentIndex = orderedDays.findIndex((day) => day.id === dayId)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedDays.length) {
      return
    }
    const currentDay = orderedDays[currentIndex]
    const targetDay = orderedDays[targetIndex]

    updateWorkoutDay.mutate({
      id: currentDay.id,
      payload: { plan: activePlan.id, name: currentDay.name, day_label: currentDay.day_label, day_of_week: currentDay.day_of_week, order: targetDay.order },
      silent: true,
    })
    updateWorkoutDay.mutate({
      id: targetDay.id,
      payload: { plan: activePlan.id, name: targetDay.name, day_label: targetDay.day_label, day_of_week: targetDay.day_of_week, order: currentDay.order },
      silent: true,
    })
    toast.success('Orden de dias actualizado')
  }

  const handleMoveExercise = (
    day: { id: number; exercises: Array<{ id: number; name: string; muscle_group: MuscleGroup; exercise_type: ExerciseType; sets: number | null; reps_range: string; target_minutes: number | null; weight_suggestion_kg: number | null; rest_seconds: number; technique_notes: string; order: number }> },
    exerciseId: number,
    direction: 'up' | 'down',
  ) => {
    const orderedExercises = [...day.exercises].sort((a, b) => a.order - b.order)
    const currentIndex = orderedExercises.findIndex((exercise) => exercise.id === exerciseId)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedExercises.length) {
      return
    }
    const currentExercise = orderedExercises[currentIndex]
    const targetExercise = orderedExercises[targetIndex]

    updateExercise.mutate({
      id: currentExercise.id,
      payload: { ...currentExercise, workout_day: day.id, order: targetExercise.order },
      silent: true,
    })
    updateExercise.mutate({
      id: targetExercise.id,
      payload: { ...targetExercise, workout_day: day.id, order: currentExercise.order },
      silent: true,
    })
    toast.success('Orden de ejercicios actualizado')
  }

  const handleDuplicateDay = (
    day: { id: number; name: string; day_label: DayLabel; day_of_week: DayOfWeek; order: number; exercises: Array<{ name: string; muscle_group: MuscleGroup; exercise_type: ExerciseType; sets: number | null; reps_range: string; target_minutes: number | null; machine?: number | null; weight_suggestion_kg: number | null; rest_seconds: number; technique_notes: string; order: number }> },
  ) => {
    if (!activePlan || !daysData?.results.length) {
      return
    }
    const duplicatedDayOrder = Math.max(...daysData.results.map((item) => item.order)) + 1

    createWorkoutDay.mutate(
      {
        plan: activePlan.id,
        name: `${day.name} (copia)`,
        day_label: day.day_label,
        day_of_week: day.day_of_week,
        order: duplicatedDayOrder,
      },
      {
        onSuccess: (newDay) => {
          day.exercises
            .slice()
            .sort((a, b) => a.order - b.order)
            .forEach((exercise) => {
              createExercise.mutate({
                workout_day: newDay.id,
                name: `${exercise.name} (copia)`,
                muscle_group: exercise.muscle_group,
                exercise_type: exercise.exercise_type,
                sets: exercise.sets,
                reps_range: exercise.reps_range,
                target_minutes: exercise.target_minutes ?? null,
                machine: exercise.machine ?? null,
                weight_suggestion_kg: exercise.weight_suggestion_kg ?? null,
                rest_seconds: exercise.rest_seconds,
                technique_notes: exercise.technique_notes ?? '',
                order: exercise.order,
              })
            })
          setSelectedWorkoutDayId(newDay.id)
          toast.success('Dia duplicado con sus ejercicios')
        },
      },
    )
  }

  const handleDuplicateExercise = (
    day: { id: number; exercises: Array<{ order: number }> },
    exercise: { name: string; muscle_group: MuscleGroup; exercise_type: ExerciseType; sets: number | null; reps_range: string; target_minutes: number | null; machine?: number | null; weight_suggestion_kg: number | null; rest_seconds: number; technique_notes: string; order: number },
  ) => {
    const nextOrder = day.exercises.length ? Math.max(...day.exercises.map((item) => item.order)) + 1 : 0
    createExercise.mutate({
      workout_day: day.id,
      name: `${exercise.name} (copia)`,
      muscle_group: exercise.muscle_group,
      exercise_type: exercise.exercise_type,
      sets: exercise.sets,
      reps_range: exercise.reps_range,
      target_minutes: exercise.target_minutes ?? null,
      machine: exercise.machine ?? null,
      weight_suggestion_kg: exercise.weight_suggestion_kg ?? null,
      rest_seconds: exercise.rest_seconds,
      technique_notes: exercise.technique_notes ?? '',
      order: nextOrder,
    })
  }

  const handleMachineSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createGymMachine.mutate(machineForm, {
      onSuccess: () => {
        setMachineForm({
          name: '',
          category: '',
          notes: '',
          is_active: true,
        })
      },
    })
  }

  const startMachineEdit = (machine: GymMachine) => {
    setEditingMachineId(machine.id)
    setEditingMachineForm({
      name: machine.name,
      category: machine.category,
      notes: machine.notes,
      is_active: machine.is_active,
    })
  }

  const handleMachineUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingMachineId) {
      return
    }
    updateGymMachine.mutate(
      {
        id: editingMachineId,
        payload: editingMachineForm,
      },
      { onSuccess: () => setEditingMachineId(null) },
    )
  }

  const handleSaveTrainingTemplate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activePlan) {
      return
    }
    savePlanAsTemplate.mutate({
      planId: activePlan.id,
      payload: templatePlanForm,
    })
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget) {
      return
    }

    if (deleteTarget.type === 'plan') {
      deletePlan.mutate(
        { id: deleteTarget.id, memberId },
        { onSuccess: () => setDeleteTarget(null) },
      )
      return
    }

    if (deleteTarget.type === 'day') {
      deleteWorkoutDay.mutate(
        { id: deleteTarget.id },
        { onSuccess: () => setDeleteTarget(null) },
      )
      return
    }

    if (deleteTarget.type === 'training_template') {
      deleteTrainingTemplate.mutate(
        { templateId: deleteTarget.id },
        { onSuccess: () => setDeleteTarget(null) },
      )
      return
    }

    if (deleteTarget.type === 'machine') {
      deleteGymMachine.mutate(
        { id: deleteTarget.id },
        { onSuccess: () => setDeleteTarget(null) },
      )
      return
    }

    deleteExercise.mutate(
      { id: deleteTarget.id, workoutDayId: deleteTarget.workoutDayId },
      { onSuccess: () => setDeleteTarget(null) },
    )
  }

  const deleteDialogDescription = deleteTarget
    ? deleteTarget.type === 'plan'
      ? `Se eliminara el plan completo "${deleteTarget.name}" y todo su contenido. Esta accion no se puede deshacer.${deleteTarget.planActivo ? ' El member se quedara sin este plan activo.' : ''}`
      : deleteTarget.type === 'day'
        ? `Se eliminara el dia "${deleteTarget.name}" y todos sus ejercicios.`
        : deleteTarget.type === 'exercise'
          ? `Se eliminara el ejercicio "${deleteTarget.name}" de la rutina del member.`
          : deleteTarget.type === 'machine'
            ? `Se eliminara la máquina "${deleteTarget.name}" del catálogo compartido del gym.`
          : `Se eliminara la plantilla "${deleteTarget.name}". Esta accion solo borra la base reutilizable del trainer y no modifica el plan activo del member.`
    : ''
  const isDeleting =
    deletePlan.isPending ||
    deleteWorkoutDay.isPending ||
    deleteExercise.isPending ||
    deleteGymMachine.isPending ||
    deleteTrainingTemplate.isPending

  const handleTrainingTemplateUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedTrainingTemplate) {
      return
    }
    updateTrainingTemplate.mutate({
      templateId: selectedTrainingTemplate.id,
      payload: templateEditForm,
    })
  }

  const handleConfirmRefreshTemplate = () => {
    if (!refreshTemplateId || !activePlan) {
      return
    }
    refreshTrainingTemplate.mutate(
      {
        templateId: refreshTemplateId,
        payload: { plan_id: activePlan.id },
      },
      { onSuccess: () => setRefreshTemplateId(null) },
    )
  }

  if (memberLoading || plansLoading || prescriptionLoading) {
    return (
      <div className="page-enter space-y-4">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={6} />
        <CardSkeleton lines={6} />
      </div>
    )
  }

  if (!member) {
    return (
      <EmptyState
        icon={<Dumbbell size={40} />}
        title="Cliente no encontrado"
        description="No fue posible cargar el cliente solicitado."
      />
    )
  }

  if (!canEditProgram) {
    return (
      <div className="page-enter space-y-4">
        <Link to={plansContext ? '/plans' : `/members/${member.id}`} className="flex items-center gap-2 text-sm text-neutral-500 hover:text-primary">
          <ArrowLeft size={16} />
          {plansContext ? 'Volver a planes' : 'Volver al cliente'}
        </Link>
        <EmptyState
          icon={<Dumbbell size={40} />}
          title="Primero asigna este cliente"
          description="El trainer solo puede crear entrenamientos para clientes que tiene asignados."
        />
      </div>
    )
  }

  return (
    <div className="page-enter space-y-6" data-testid="trainer-program-page">
      <Link to={plansContext ? '/plans' : `/members/${member.id}`} className="flex items-center gap-2 text-sm text-neutral-500 hover:text-primary">
        <ArrowLeft size={16} />
        {plansContext ? 'Volver a planes' : 'Volver al cliente'}
      </Link>

      <PageHeader
        title={plansContext && activePlan ? `Configurar ${activePlan.name}` : `Asignacion para ${member.full_name}`}
        subtitle={plansContext
          ? `Edita la rutina asignada a ${member.full_name} desde el módulo de Planes.`
          : 'Aqui defines y publicas el entrenamiento que el miembro vera como su programa activo.'}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={activePlan?.status === 'active' ? 'success' : 'warning'}>
              {activePlan?.status === 'active' ? `Publicado · versión ${activePlan.numero_version ?? 1}` : activePlan ? 'Borrador no visible' : 'Sin plan de entrenamiento'}
            </Badge>
            {activePlan?.status === 'draft' ? <button type="button" className="btn-primary" disabled={publishPlan.isPending} onClick={() => publishPlan.mutate(activePlan.id)}>Publicar para el miembro</button> : null}
            {!plansContext && (
              <button type="button" className="btn-primary" onClick={() => setCreatePlanWizardOpen(true)} data-testid="open-member-create-plan-wizard">
                Crear plan
              </button>
            )}
          </div>
        }
      />

      <section className="card p-6 space-y-4" data-testid="assignment-flow-card">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="label-base">Flujo de asignacion</p>
            <h2 className="font-heading font-bold text-xl text-neutral-900 dark:text-white">Publica una prescripcion clara para este member</h2>
            <p className="text-sm text-neutral-500 mt-1">
              Primero define la base del entrenamiento y luego completa sus dias y ejercicios.
            </p>
          </div>
          <div className="rounded-sm border border-neutral-200 p-4 text-sm dark:border-neutral-800">
            <p className="font-semibold text-neutral-900 dark:text-white">Trainer responsable</p>
            <p className="text-neutral-500">
              {activePrescription?.trainer?.nombre || member.trainer_asignado_nombre || 'Aun sin trainer responsable'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <SummaryStat label="Paso 1" value="Elegir base de entrenamiento" />
          <SummaryStat label="Paso 2" value="Cargar dias y ejercicios" />
        </div>
        {lastPublication && (
          <div
            className="rounded-sm border border-neutral-200 p-4 dark:border-neutral-800"
            data-testid="last-publication-card"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Ultima publicacion</p>
            <p className="mt-1 text-sm font-medium text-neutral-900 dark:text-white">
              {descripcionPublicacionPrescripcion(lastPublication.tipo)} publicada el {formatDateTime(lastPublication.fechaIso)}
            </p>
          </div>
        )}
        {publicationBanner && (
          <div
            className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 p-4"
            data-testid="publication-banner"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Publicado
                </p>
                <p className="mt-1 text-sm font-medium text-emerald-900 dark:text-emerald-100">{publicationBanner}</p>
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100"
                onClick={() => setPublicationBanner(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </section>

      {prescription && (
        <section className="card p-6 space-y-5" data-testid="prescription-summary-card">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={18} className="text-primary" />
                <h2 className="font-heading font-bold text-xl text-neutral-900 dark:text-white">Resumen prescriptivo</h2>
              </div>
              <p className="text-sm text-neutral-500">
                Situacion actual: <span className="font-semibold capitalize text-neutral-700 dark:text-neutral-200">{formatSituacion(prescription.situacion_prescriptiva)}</span>
              </p>
            </div>
            <Badge variant={riskVariant(prescription.nivel_riesgo)}>
              {riskLabels[prescription.nivel_riesgo]} · score {prescription.riesgo_adherencia}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <SummaryStat label="Objetivo sugerido" value={goalLabels[prescription.recommended_goal] ?? prescription.recommended_goal} />
            <SummaryStat label="Frecuencia sugerida" value={`${prescription.recommended_days_per_week} dias/semana`} />
          </div>

          {!!prescription.motivos_riesgo.length && (
            <div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-white mb-2">Motivos detectados</p>
              <div className="flex flex-wrap gap-2">
                {prescription.motivos_riesgo.map((reason) => (
                  <Badge key={reason} variant="neutral">{reason}</Badge>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <InsightList
              title="Recomendaciones"
              icon={<Sparkles size={16} className="text-primary" />}
              items={prescription.recomendaciones}
              emptyText="No hay recomendaciones especiales."
            />
            <InsightList
              title="Advertencias"
              icon={<AlertTriangle size={16} className="text-amber-500" />}
              items={prescription.advertencias}
              emptyText="Sin advertencias operativas."
            />
          </div>
        </section>
      )}

      <section className="card p-6 space-y-4" data-testid="prescription-status-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-heading font-bold text-xl text-neutral-900 dark:text-white">Estado de prescripcion</h2>
            <p className="text-sm text-neutral-500">Confirma que el miembro recibira una rutina completa con dias y ejercicios.</p>
          </div>
          <Badge variant={activePrescription?.estado_prescripcion.esta_lista_para_member ? 'success' : 'warning'}>
            {activePrescription?.estado_prescripcion.esta_lista_para_member ? 'Lista para member' : 'Incompleta'}
          </Badge>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <StatusFlag label="Trainer asignado" isReady={member.trainer_asignado != null} />
          <StatusFlag label="Plan activo" isReady={!!activePrescription?.estado_prescripcion.tiene_plan_activo} />
          <StatusFlag label="Dias configurados" isReady={!!activePrescription?.estado_prescripcion.tiene_dias} />
          <StatusFlag label="Ejercicios cargados" isReady={!!activePrescription?.estado_prescripcion.tiene_ejercicios} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="card p-6 space-y-4" data-testid="training-templates-card">
          <div className="flex items-center gap-2">
            <Dumbbell size={18} className="text-primary" />
            <h2 className="font-heading font-bold text-xl text-neutral-900 dark:text-white">1. Elegir base de entrenamiento</h2>
          </div>
          <p className="text-sm text-neutral-500">
            Aplica una plantilla existente o usa el bloque de plan activo para construir una prescripcion desde cero.
          </p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Filtrar por objetivo">
              <OptionGroup
                value={trainingTemplateGoalFilter}
                onChange={(value) => setTrainingTemplateGoalFilter(value)}
                options={[{ value: 'all', label: 'Todos' }, ...Object.entries(goalLabels)
                  .filter(([key]) => key !== 'maintenance')
                  .map(([key, label]) => ({ value: key, label }))]}
                data-testid="training-template-goal-filter"
              />
            </Field>
            <Field label="Filtrar por adherencia">
              <OptionGroup
                value={trainingTemplateRiskFilter}
                onChange={(value) => setTrainingTemplateRiskFilter(value as 'all' | 'low' | 'medium' | 'high')}
                options={[{ value: 'all', label: 'Todas' }, ...adherenceOptions]}
                data-testid="training-template-risk-filter"
              />
            </Field>
          </div>

          {!trainingTemplates.length ? (
            <p className="text-sm text-neutral-500">Todavia no hay plantillas guardadas.</p>
          ) : !filteredTrainingTemplates.length ? (
            <p className="text-sm text-neutral-500">No hay plantillas que coincidan con los filtros activos.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <div className="space-y-3">
                <p className="text-sm text-neutral-500">
                  {formatTemplateCount(filteredTrainingTemplates.length, 'plantilla')} visible para esta seleccion.
                </p>
                {filteredTrainingTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={`w-full rounded-sm border p-4 text-left transition-all ${
                      selectedTrainingTemplate?.id === template.id
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-neutral-200 dark:border-neutral-800'
                    }`}
                    onClick={() => setSelectedTrainingTemplateId(template.id)}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-neutral-900 dark:text-white">{template.nombre}</p>
                          {selectedTrainingTemplate?.id === template.id && (
                            <Badge variant="info">Seleccionada</Badge>
                          )}
                          {prescription && template.objetivo === prescription.recommended_goal && (
                            <Badge variant="success">Alineada al objetivo sugerido</Badge>
                          )}
                        </div>
                        <p className="text-sm text-neutral-500">{template.descripcion || 'Sin descripcion adicional.'}</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="info">{goalLabels[template.objetivo] ?? template.objetivo}</Badge>
                          <Badge variant={riskVariant(template.nivel_adherencia_recomendado)}>
                            {riskLabels[template.nivel_adherencia_recomendado]}
                          </Badge>
                          <Badge variant="neutral">{template.dias_por_semana_sugeridos} dias sugeridos</Badge>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {selectedTrainingTemplate && (
                <div className="rounded-sm border border-neutral-200 p-4 dark:border-neutral-800" data-testid="training-template-preview">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-neutral-500">Previsualizacion</p>
                      <p className="font-semibold text-neutral-900 dark:text-white">{selectedTrainingTemplate.nombre}</p>
                      <p className="text-sm text-neutral-500">{selectedTrainingTemplate.descripcion || 'Sin descripcion adicional.'}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="info">{goalLabels[selectedTrainingTemplate.objetivo] ?? selectedTrainingTemplate.objetivo}</Badge>
                        <Badge variant={riskVariant(selectedTrainingTemplate.nivel_adherencia_recomendado)}>
                          {riskLabels[selectedTrainingTemplate.nivel_adherencia_recomendado]}
                        </Badge>
                        <Badge variant="neutral">{selectedTrainingTemplate.dias_por_semana_sugeridos} dias sugeridos</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => applyTrainingTemplate.mutate({ templateId: selectedTrainingTemplate.id, payload: { member_id: member.id } })}
                        disabled={applyTrainingTemplate.isPending}
                        data-testid="apply-training-template-button"
                      >
                        Publicar esta base al miembro
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setRefreshTemplateId(selectedTrainingTemplate.id)}
                        disabled={!activePlan || refreshTrainingTemplate.isPending}
                        title={activePlan ? 'Reemplaza la estructura de esta plantilla con el plan activo del member.' : 'Necesitas un plan activo para actualizar la plantilla.'}
                        data-testid="refresh-training-template-button"
                      >
                        Actualizar desde plan activo
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => setDeleteTarget({
                          type: 'training_template',
                          id: selectedTrainingTemplate.id,
                          name: selectedTrainingTemplate.nombre,
                        })}
                        disabled={deleteTrainingTemplate.isPending}
                        data-testid="delete-training-template-button"
                      >
                        Eliminar plantilla
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                      {formatTemplateCount(selectedTrainingTemplate.dias.length, 'dia')} y{' '}
                      {selectedTrainingTemplate.dias.reduce((total, day) => total + day.ejercicios.length, 0)} ejercicios base
                    </p>
                    {!selectedTrainingTemplate.dias.length ? (
                      <p className="text-sm text-neutral-500">Esta plantilla aun no tiene estructura detallada visible.</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedTrainingTemplate.dias.map((day) => (
                          <div key={day.id} className="rounded-sm bg-neutral-50 p-3 dark:bg-neutral-900/60">
                            <p className="font-semibold text-neutral-900 dark:text-white">{day.etiqueta_dia} · {day.nombre}</p>
                            <p className="text-xs text-neutral-500">{formatTemplateCount(day.ejercicios.length, 'ejercicio')}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <form className="mt-5 space-y-4 border-t border-neutral-200 pt-4 dark:border-neutral-800" onSubmit={handleTrainingTemplateUpdate}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-neutral-900 dark:text-white">Editar ficha de esta base</p>
                        <p className="text-sm text-neutral-500">Ajusta metadatos y criterios de uso. La estructura se actualiza desde el plan activo.</p>
                      </div>
                      <Badge variant={templateEditForm.esta_activa ? 'success' : 'neutral'}>
                        {templateEditForm.esta_activa ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Field label="Nombre">
                        <input
                          className="input"
                          value={templateEditForm.nombre}
                          onChange={(event) => setTemplateEditForm((current) => ({ ...current, nombre: event.target.value }))}
                          data-testid="training-template-name-input"
                        />
                      </Field>
                      <Field label="Dias sugeridos">
                        <input
                          className="input"
                          type="number"
                          min={1}
                          max={7}
                          value={templateEditForm.dias_por_semana_sugeridos}
                          onChange={(event) => setTemplateEditForm((current) => ({
                            ...current,
                            dias_por_semana_sugeridos: Number(event.target.value) || 1,
                          }))}
                          data-testid="training-template-days-input"
                        />
                      </Field>
                    </div>
                    <Field label="Descripcion">
                      <textarea
                        className="input min-h-[96px]"
                        value={templateEditForm.descripcion}
                        onChange={(event) => setTemplateEditForm((current) => ({ ...current, descripcion: event.target.value }))}
                        data-testid="training-template-description-input"
                      />
                    </Field>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <Field label="Objetivo">
                        <OptionGroup
                          value={templateEditForm.objetivo}
                          onChange={(value) => setTemplateEditForm((current) => ({ ...current, objetivo: value as GoalType }))}
                          options={goalOptions}
                          data-testid="training-template-goal-input"
                        />
                      </Field>
                      <Field label="Adherencia">
                        <OptionGroup
                          value={templateEditForm.nivel_adherencia_recomendado}
                          onChange={(value) => setTemplateEditForm((current) => ({
                            ...current,
                            nivel_adherencia_recomendado: value as 'low' | 'medium' | 'high',
                          }))}
                          options={adherenceOptions}
                          data-testid="training-template-adherence-input"
                        />
                      </Field>
                      <Field label="Estado">
                        <OptionGroup
                          value={templateEditForm.esta_activa ? 'active' : 'inactive'}
                          onChange={(value) => setTemplateEditForm((current) => ({ ...current, esta_activa: value === 'active' }))}
                          options={[
                            { value: 'active', label: 'Activa' },
                            { value: 'inactive', label: 'Inactiva' },
                          ]}
                          data-testid="training-template-status-input"
                        />
                      </Field>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={updateTrainingTemplate.isPending}
                        data-testid="save-training-template-button"
                      >
                        Guardar cambios de la base
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          <form className="grid grid-cols-1 gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800" onSubmit={handleSaveTrainingTemplate}>
            <p className="text-sm font-semibold text-neutral-900 dark:text-white">Guardar plan actual como plantilla</p>
            <Field label="Nombre de la plantilla">
              <input
                className="input"
                value={templatePlanForm.nombre}
                onChange={(e) => setTemplatePlanForm({ ...templatePlanForm, nombre: e.target.value })}
                disabled={!activePlan}
                required
              />
            </Field>
            <Field label="Descripcion">
              <textarea
                className="input min-h-24"
                value={templatePlanForm.descripcion}
                onChange={(e) => setTemplatePlanForm({ ...templatePlanForm, descripcion: e.target.value })}
                disabled={!activePlan}
              />
            </Field>
            <Field label="Adherencia recomendada">
              <OptionGroup
                value={templatePlanForm.nivel_adherencia_recomendado}
                onChange={(value) => setTemplatePlanForm({ ...templatePlanForm, nivel_adherencia_recomendado: value })}
                options={adherenceOptions}
                disabled={!activePlan}
              />
            </Field>
            <div className="flex justify-end">
              <button className="btn-primary" type="submit" disabled={!activePlan || savePlanAsTemplate.isPending}>
                Guardar plantilla
              </button>
            </div>
          </form>
        </div>

      </section>

      <section className="card p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="font-heading font-bold text-xl text-neutral-900 dark:text-white">1. Crear o editar plan activo</h2>
            <p className="text-sm text-neutral-500">Publica el plan principal del member o eliminelo por completo si necesitas rehacerlo desde cero.</p>
          </div>
          {activePlan && (
            <button
              type="button"
              className="btn-danger"
              onClick={() => setDeleteTarget({ type: 'plan', id: activePlan.id, name: activePlan.name, planActivo: activePlan.is_active })}
              data-testid="delete-plan-button"
            >
              Borrar plan completo
            </button>
          )}
        </div>
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handlePlanSubmit}>
          <Field label="Nombre del plan">
            <input className="input" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} required />
          </Field>
          <Field label="Objetivo">
            <OptionGroup
              value={planForm.goal}
              onChange={(value) => setPlanForm({ ...planForm, goal: value as GoalType })}
              options={goalOptions}
              data-testid="plan-goal-group"
            />
          </Field>
          <Field label="Inicio">
            <input className="input" type="date" value={planForm.start_date} onChange={(e) => setPlanForm({ ...planForm, start_date: e.target.value })} required />
          </Field>
          <Field label="Fin">
            <input className="input" type="date" value={planForm.end_date ?? ''} onChange={(e) => setPlanForm({ ...planForm, end_date: e.target.value || null })} />
          </Field>
          <Field label="Duracion en semanas">
            <input className="input" type="number" min={1} max={52} value={planForm.weeks_duration} onChange={(e) => setPlanForm({ ...planForm, weeks_duration: Number(e.target.value) })} required />
          </Field>
          <Field label="Dias por semana">
            <input className="input" type="number" min={1} max={7} value={planForm.days_per_week} onChange={(e) => setPlanForm({ ...planForm, days_per_week: Number(e.target.value) })} required />
          </Field>
          <div className="md:col-span-2 flex justify-end">
            <button className="btn-primary" type="submit" disabled={createPlan.isPending || updatePlan.isPending}>
              {activePlan ? 'Guardar borrador' : 'Crear borrador'}
            </button>
          </div>
        </form>
      </section>

      <section className="card p-6 space-y-5" data-testid="machine-catalog-card">
        <div className="flex items-center gap-2">
          <Dumbbell size={18} className="text-primary" />
          <h2 className="font-heading font-bold text-xl text-neutral-900 dark:text-white">2. Catálogo compartido de máquinas</h2>
        </div>
        <p className="text-sm text-neutral-500">
          Solo trainers y staff pueden cambiar las máquinas disponibles. Este catálogo lo usa todo el gym para armar rutinas.
        </p>

        <form className="grid grid-cols-1 gap-3 md:grid-cols-4" onSubmit={handleMachineSubmit}>
          <Field label="Nombre">
            <input className="input" value={machineForm.name} onChange={(e) => setMachineForm({ ...machineForm, name: e.target.value })} required />
          </Field>
          <Field label="Categoría">
            <input className="input" value={machineForm.category} onChange={(e) => setMachineForm({ ...machineForm, category: e.target.value })} />
          </Field>
          <Field label="Notas">
            <input className="input" value={machineForm.notes} onChange={(e) => setMachineForm({ ...machineForm, notes: e.target.value })} />
          </Field>
          <div className="flex items-end justify-end">
            <button className="btn-secondary w-full md:w-auto" type="submit" disabled={createGymMachine.isPending}>
              Agregar máquina
            </button>
          </div>
        </form>

        {!gymMachines.length ? (
          <p className="text-sm text-neutral-500">Todavía no hay máquinas cargadas.</p>
        ) : (
          <div className="space-y-3">
            {gymMachines.map((machine) => (
              <div key={machine.id} className="rounded-sm border border-neutral-200 p-4 dark:border-neutral-800" data-testid={`machine-row-${machine.id}`}>
                {editingMachineId === machine.id ? (
                  <form className="grid grid-cols-1 gap-3 md:grid-cols-4" onSubmit={handleMachineUpdate}>
                    <Field label="Nombre">
                      <input className="input" value={editingMachineForm.name} onChange={(e) => setEditingMachineForm({ ...editingMachineForm, name: e.target.value })} required />
                    </Field>
                    <Field label="Categoría">
                      <input className="input" value={editingMachineForm.category} onChange={(e) => setEditingMachineForm({ ...editingMachineForm, category: e.target.value })} />
                    </Field>
                    <Field label="Notas">
                      <input className="input" value={editingMachineForm.notes} onChange={(e) => setEditingMachineForm({ ...editingMachineForm, notes: e.target.value })} />
                    </Field>
                    <div className="flex items-end justify-end gap-2">
                      <button type="button" className="btn-secondary" onClick={() => setEditingMachineId(null)}>Cancelar</button>
                      <button type="submit" className="btn-primary" disabled={updateGymMachine.isPending}>Guardar</button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-neutral-900 dark:text-white">{machine.name}</p>
                      <p className="text-sm text-neutral-500">{machine.category || 'Sin categoría'}{machine.notes ? ` · ${machine.notes}` : ''}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={machine.is_active ? 'success' : 'neutral'}>{machine.is_active ? 'Activa' : 'Inactiva'}</Badge>
                      <button type="button" className="text-xs font-semibold uppercase tracking-wide text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white" onClick={() => startMachineEdit(machine)}>
                        Editar
                      </button>
                      <button type="button" className="text-xs font-semibold uppercase tracking-wide text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" onClick={() => setDeleteTarget({ type: 'machine', id: machine.id, name: machine.name })}>
                        Borrar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-6 space-y-5" data-testid="program-editor-card">
        <div className="flex items-center gap-2">
          <PlusCircle size={18} className="text-primary" />
          <h2 className="font-heading font-bold text-xl text-neutral-900 dark:text-white">3. Días y ejercicios del plan activo</h2>
        </div>
        <p className="text-sm text-neutral-500">
          Organiza la rutina por día real de la semana y edita cada ejercicio en el mismo contexto. El member verá este mismo orden de lunes a domingo.
        </p>

        {!activePlan ? (
          <p className="text-sm text-neutral-500">Crea primero un plan activo para empezar a estructurar la rutina.</p>
        ) : (
          <>
            <form className="grid grid-cols-1 gap-3 border-b border-neutral-200 pb-5 md:grid-cols-5 dark:border-neutral-800" onSubmit={handleDaySubmit}>
              <Field label="Nuevo dia">
                <input className="input" value={dayForm.name} onChange={(e) => setDayForm({ ...dayForm, name: e.target.value })} required />
              </Field>
              <Field label="Etiqueta secundaria">
                <OptionGroup
                  value={dayForm.day_label}
                  onChange={(value) => setDayForm({ ...dayForm, day_label: value as DayLabel })}
                  options={dayOptions.map((label) => ({ value: label, label }))}
                  data-testid="day-label-group"
                />
              </Field>
                  <Field label="Día real de la semana">
                <OptionGroup
                  value={dayForm.day_of_week}
                  onChange={(value) => setDayForm({ ...dayForm, day_of_week: value as DayOfWeek })}
                  options={dayOfWeekOptions}
                />
              </Field>
              <Field label="Orden">
                <input className="input" type="number" min={0} value={dayForm.order} onChange={(e) => setDayForm({ ...dayForm, order: Number(e.target.value) })} required />
              </Field>
              <div className="flex items-end justify-end">
                <button className="btn-secondary w-full md:w-auto" type="submit" disabled={createWorkoutDay.isPending}>
                  Agregar bloque
                </button>
              </div>
            </form>

            {daysLoading ? (
              <CardSkeleton lines={6} />
            ) : !daysData?.results.length ? (
              <p className="text-sm text-neutral-500">Todavia no hay dias configurados. Agrega el primero para empezar a cargar ejercicios.</p>
            ) : (
              <div className="space-y-4">
                {[...daysData.results]
                  .sort((a, b) => a.order - b.order)
                  .map((day, dayIndex, orderedDays) => {
                    const isOpen = selectedWorkoutDayId === day.id
                    const orderedExercises = [...day.exercises].sort((a, b) => a.order - b.order)

                    return (
                      <div
                        key={day.id}
                        className={`rounded-sm border p-4 transition-colors ${
                          isOpen ? 'border-primary bg-primary/5' : 'border-neutral-200 dark:border-neutral-800'
                        }`}
                        data-testid={`workout-day-editor-${day.id}`}
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-semibold text-neutral-900 dark:text-white">
                              {dayOfWeekOptions.find((option) => option.value === day.day_of_week)?.label} · {day.name}
                            </p>
                            <p className="text-sm text-neutral-500">
                              {day.day_label ? `Día ${day.day_label} · ` : ''}{formatTemplateCount(day.exercises.length, 'ejercicio')} cargado para este día
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="neutral">Orden {day.order}</Badge>
                            <button
                              type="button"
                              className="text-xs font-semibold uppercase tracking-wide text-primary hover:text-primary-hover"
                              onClick={() => setSelectedWorkoutDayId(day.id)}
                              data-testid={`select-day-${day.id}`}
                            >
                              {isOpen ? 'Bloque abierto' : 'Abrir'}
                            </button>
                            <button
                              type="button"
                              className="text-xs font-semibold uppercase tracking-wide text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
                              onClick={() => handleMoveDay(day.id, 'up')}
                              disabled={dayIndex === 0 || updateWorkoutDay.isPending}
                              data-testid={`move-day-up-${day.id}`}
                            >
                              Subir
                            </button>
                            <button
                              type="button"
                              className="text-xs font-semibold uppercase tracking-wide text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
                              onClick={() => handleMoveDay(day.id, 'down')}
                              disabled={dayIndex === orderedDays.length - 1 || updateWorkoutDay.isPending}
                              data-testid={`move-day-down-${day.id}`}
                            >
                              Bajar
                            </button>
                            <button
                              type="button"
                              className="text-xs font-semibold uppercase tracking-wide text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
                              onClick={() => startDayEdit(day)}
                              data-testid={`edit-day-${day.id}`}
                            >
                              Editar bloque
                            </button>
                            <button
                              type="button"
                              className="text-xs font-semibold uppercase tracking-wide text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
                              onClick={() => handleDuplicateDay(day)}
                              disabled={createWorkoutDay.isPending || createExercise.isPending}
                              data-testid={`duplicate-day-${day.id}`}
                            >
                              Duplicar bloque
                            </button>
                            <button
                              type="button"
                              className="text-xs font-semibold uppercase tracking-wide text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              onClick={() => setDeleteTarget({ type: 'day', id: day.id, name: `${day.day_label} · ${day.name}` })}
                              data-testid={`delete-day-${day.id}`}
                            >
                              Borrar bloque
                            </button>
                          </div>
                        </div>

                        {isOpen && (
                          <div className="mt-4 space-y-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                            {editingDayId === day.id ? (
                              <form className="grid grid-cols-1 gap-3 md:grid-cols-5" onSubmit={handleDayUpdate}>
                                <Field label="Nombre del bloque">
                                  <input className="input" value={editingDayForm.name} onChange={(e) => setEditingDayForm({ ...editingDayForm, name: e.target.value })} required />
                                </Field>
                                <Field label="Etiqueta secundaria">
                                  <OptionGroup
                                    value={editingDayForm.day_label}
                                    onChange={(value) => setEditingDayForm({ ...editingDayForm, day_label: value as DayLabel })}
                                    options={dayOptions.map((label) => ({ value: label, label }))}
                                  />
                                </Field>
                                <Field label="Día real de la semana">
                                  <OptionGroup
                                    value={editingDayForm.day_of_week}
                                    onChange={(value) => setEditingDayForm({ ...editingDayForm, day_of_week: value as DayOfWeek })}
                                    options={dayOfWeekOptions}
                                  />
                                </Field>
                                <Field label="Orden">
                                  <input className="input" type="number" min={0} value={editingDayForm.order} onChange={(e) => setEditingDayForm({ ...editingDayForm, order: Number(e.target.value) })} required />
                                </Field>
                                <div className="flex items-end justify-end gap-2">
                                  <button type="button" className="btn-secondary" onClick={() => setEditingDayId(null)}>
                                    Cancelar
                                  </button>
                                  <button type="submit" className="btn-primary" disabled={updateWorkoutDay.isPending}>
                                    Guardar bloque
                                  </button>
                                </div>
                              </form>
                            ) : null}

                            {!orderedExercises.length ? (
                              <p className="text-sm text-neutral-500">Este dia aun no tiene ejercicios cargados.</p>
                            ) : (
                              <div className="space-y-3">
                                {orderedExercises.map((exercise, exerciseIndex) => (
                                  <div key={exercise.id} className="rounded-sm border border-neutral-200 p-3 dark:border-neutral-800" data-testid={`exercise-card-${exercise.id}`}>
                                    {editingExerciseId === exercise.id ? (
                                      <form className="grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={handleExerciseUpdate}>
                                        <Field label="Nombre del ejercicio">
                                          <input className="input" value={editingExerciseForm.name} onChange={(e) => setEditingExerciseForm({ ...editingExerciseForm, name: e.target.value })} required />
                                        </Field>
                                        <Field label="Tipo de ejercicio">
                                          <OptionGroup
                                            value={editingExerciseForm.exercise_type}
                                            onChange={(value) => setEditingExerciseForm(buildExercisePayloadByType({ ...editingExerciseForm, exercise_type: value as ExerciseType }))}
                                            options={[
                                              { value: 'strength', label: 'Fuerza' },
                                              { value: 'timed', label: 'Por tiempo' },
                                            ]}
                                            disabled={editingExerciseForm.muscle_group === 'cardio'}
                                          />
                                        </Field>
                                        <Field label="Grupo muscular">
                                          <OptionGroup
                                            value={editingExerciseForm.muscle_group}
                                            onChange={(value) => setEditingExerciseForm(syncExerciseWithMuscleGroup(editingExerciseForm, value as MuscleGroup))}
                                            options={muscleOptions}
                                          />
                                        </Field>
                                        <Field label="Máquina del gym">
                                          <select className="input" value={editingExerciseForm.machine ?? ''} onChange={(e) => setEditingExerciseForm({ ...editingExerciseForm, machine: e.target.value ? Number(e.target.value) : null })}>
                                            <option value="">Sin máquina específica</option>
                                            {gymMachines.filter((machine) => machine.is_active).map((machine) => (
                                              <option key={machine.id} value={machine.id}>{machine.name}</option>
                                            ))}
                                          </select>
                                        </Field>
                                        {editingExerciseForm.muscle_group === 'cardio' ? (
                                          <div className="md:col-span-2 rounded-sm border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-neutral-600 dark:border-primary/30 dark:bg-primary/10 dark:text-neutral-300">
                                            Cardio se programa automáticamente por tiempo. Aquí defines minutos objetivo, no repeticiones ni peso.
                                          </div>
                                        ) : null}
                                        {editingExerciseForm.exercise_type === 'timed' ? (
                                          <Field label="Minutos objetivo">
                                            <input
                                              className="input"
                                              type="number"
                                              min={1}
                                              value={editingExerciseForm.target_minutes ?? ''}
                                              onChange={(e) => setEditingExerciseForm({ ...editingExerciseForm, target_minutes: e.target.value ? Number(e.target.value) : null })}
                                              required
                                            />
                                          </Field>
                                        ) : (
                                          <>
                                            <Field label="Series">
                                              <input className="input" type="number" min={1} value={editingExerciseForm.sets ?? ''} onChange={(e) => setEditingExerciseForm({ ...editingExerciseForm, sets: e.target.value ? Number(e.target.value) : null })} required />
                                            </Field>
                                            <Field label="Rango de repeticiones">
                                              <input className="input" value={editingExerciseForm.reps_range} onChange={(e) => setEditingExerciseForm({ ...editingExerciseForm, reps_range: e.target.value })} required />
                                            </Field>
                                          </>
                                        )}
                                        <Field label="Descanso en segundos">
                                          <input className="input" type="number" min={15} value={editingExerciseForm.rest_seconds} onChange={(e) => setEditingExerciseForm({ ...editingExerciseForm, rest_seconds: Number(e.target.value) })} required />
                                        </Field>
                                        {editingExerciseForm.exercise_type === 'strength' ? (
                                          <Field label="Peso sugerido (kg)">
                                            <input className="input" type="number" min={0} value={editingExerciseForm.weight_suggestion_kg ?? ''} onChange={(e) => setEditingExerciseForm({ ...editingExerciseForm, weight_suggestion_kg: e.target.value ? Number(e.target.value) : null })} />
                                          </Field>
                                        ) : (
                                          <Field label="Peso sugerido (kg)">
                                            <input className="input" value="No aplica" disabled />
                                          </Field>
                                        )}
                                        <Field label="Orden">
                                          <input className="input" type="number" min={0} value={editingExerciseForm.order} onChange={(e) => setEditingExerciseForm({ ...editingExerciseForm, order: Number(e.target.value) })} required />
                                        </Field>
                                        <Field label="Notas tecnicas">
                                          <textarea className="input min-h-24" value={editingExerciseForm.technique_notes ?? ''} onChange={(e) => setEditingExerciseForm({ ...editingExerciseForm, technique_notes: e.target.value })} />
                                        </Field>
                                        <div className="md:col-span-2 flex justify-end gap-2">
                                          <button type="button" className="btn-secondary" onClick={() => setEditingExerciseId(null)}>
                                            Cancelar
                                          </button>
                                          <button type="submit" className="btn-primary" disabled={updateExercise.isPending}>
                                            Guardar ejercicio
                                          </button>
                                        </div>
                                      </form>
                                    ) : (
                                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div>
                                          <p className="font-medium text-neutral-900 dark:text-white">{exercise.name} · {formatExercisePrescription(exercise)}</p>
                                          <p className="text-sm text-neutral-500">
                                            {muscleOptions.find((option) => option.value === exercise.muscle_group)?.label ?? exercise.muscle_group}
                                          </p>
                                          {exercise.machine_detail?.name ? (
                                            <p className="text-sm text-primary">{exercise.machine_detail.name}</p>
                                          ) : null}
                                          {exercise.technique_notes ? (
                                            <p className="mt-1 text-sm text-neutral-500">{exercise.technique_notes}</p>
                                          ) : null}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Badge variant="neutral">Orden {exercise.order}</Badge>
                                          <button
                                            type="button"
                                            className="text-xs font-semibold uppercase tracking-wide text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
                                            onClick={() => handleMoveExercise(day, exercise.id, 'up')}
                                            disabled={exerciseIndex === 0 || updateExercise.isPending}
                                            data-testid={`move-exercise-up-${exercise.id}`}
                                          >
                                            Subir
                                          </button>
                                          <button
                                            type="button"
                                            className="text-xs font-semibold uppercase tracking-wide text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
                                            onClick={() => handleMoveExercise(day, exercise.id, 'down')}
                                            disabled={exerciseIndex === orderedExercises.length - 1 || updateExercise.isPending}
                                            data-testid={`move-exercise-down-${exercise.id}`}
                                          >
                                            Bajar
                                          </button>
                                          <button
                                            type="button"
                                            className="text-xs font-semibold uppercase tracking-wide text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
                                            onClick={() => startExerciseEdit(exercise)}
                                            data-testid={`edit-exercise-${exercise.id}`}
                                          >
                                            Editar
                                          </button>
                                          <button
                                            type="button"
                                            className="text-xs font-semibold uppercase tracking-wide text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
                                            onClick={() => handleDuplicateExercise(day, exercise)}
                                            disabled={createExercise.isPending}
                                            data-testid={`duplicate-exercise-${exercise.id}`}
                                          >
                                            Duplicar
                                          </button>
                                          <button
                                            type="button"
                                            className="text-xs font-semibold uppercase tracking-wide text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                            onClick={() => setDeleteTarget({ type: 'exercise', id: exercise.id, name: exercise.name, workoutDayId: day.id })}
                                            data-testid={`delete-exercise-${exercise.id}`}
                                          >
                                            Borrar
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            <form className="grid grid-cols-1 gap-3 rounded-sm bg-neutral-50 p-4 md:grid-cols-2 dark:bg-neutral-900/50" onSubmit={handleExerciseSubmit}>
                              <div className="md:col-span-2">
                                <p className="font-semibold text-neutral-900 dark:text-white">Agregar ejercicio a {day.day_label} · {day.name}</p>
                                <p className="text-sm text-neutral-500">Todo lo que cargues aqui se publica directamente en este dia del plan activo.</p>
                              </div>
                              <Field label="Nombre del ejercicio">
                                <input className="input" value={exerciseForm.name} onChange={(e) => setExerciseForm({ ...exerciseForm, name: e.target.value })} required />
                              </Field>
                              <Field label="Tipo de ejercicio">
                                <OptionGroup
                                  value={exerciseForm.exercise_type}
                                  onChange={(value) => setExerciseForm(buildExercisePayloadByType({ ...exerciseForm, exercise_type: value as ExerciseType }))}
                                  options={[
                                    { value: 'strength', label: 'Fuerza' },
                                    { value: 'timed', label: 'Por tiempo' },
                                  ]}
                                  disabled={exerciseForm.muscle_group === 'cardio'}
                                />
                              </Field>
                              <Field label="Grupo muscular">
                                <OptionGroup
                                  value={exerciseForm.muscle_group}
                                  onChange={(value) => setExerciseForm(syncExerciseWithMuscleGroup(exerciseForm, value as MuscleGroup))}
                                  options={muscleOptions}
                                  data-testid="muscle-group-options"
                                />
                              </Field>
                              <Field label="Máquina del gym">
                                <select className="input" value={exerciseForm.machine ?? ''} onChange={(e) => setExerciseForm({ ...exerciseForm, machine: e.target.value ? Number(e.target.value) : null })}>
                                  <option value="">Sin máquina específica</option>
                                  {gymMachines.filter((machine) => machine.is_active).map((machine) => (
                                    <option key={machine.id} value={machine.id}>{machine.name}</option>
                                  ))}
                                </select>
                              </Field>
                              {exerciseForm.muscle_group === 'cardio' ? (
                                <div className="md:col-span-2 rounded-sm border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-neutral-600 dark:border-primary/30 dark:bg-primary/10 dark:text-neutral-300">
                                  Cardio se carga por minutos objetivo. Series, repeticiones y peso no aplican a este bloque.
                                </div>
                              ) : null}
                              {exerciseForm.exercise_type === 'timed' ? (
                                <Field label="Minutos objetivo">
                                  <input className="input" type="number" min={1} value={exerciseForm.target_minutes ?? ''} onChange={(e) => setExerciseForm({ ...exerciseForm, target_minutes: e.target.value ? Number(e.target.value) : null })} required />
                                </Field>
                              ) : (
                                <>
                                  <Field label="Series">
                                    <input className="input" type="number" min={1} value={exerciseForm.sets ?? ''} onChange={(e) => setExerciseForm({ ...exerciseForm, sets: e.target.value ? Number(e.target.value) : null })} required />
                                  </Field>
                                  <Field label="Rango de repeticiones">
                                    <input className="input" value={exerciseForm.reps_range} onChange={(e) => setExerciseForm({ ...exerciseForm, reps_range: e.target.value })} required />
                                  </Field>
                                </>
                              )}
                              <Field label="Descanso en segundos">
                                <input className="input" type="number" min={15} value={exerciseForm.rest_seconds} onChange={(e) => setExerciseForm({ ...exerciseForm, rest_seconds: Number(e.target.value) })} required />
                              </Field>
                              {exerciseForm.exercise_type === 'strength' ? (
                                <Field label="Peso sugerido (kg)">
                                  <input className="input" type="number" min={0} value={exerciseForm.weight_suggestion_kg ?? ''} onChange={(e) => setExerciseForm({ ...exerciseForm, weight_suggestion_kg: e.target.value ? Number(e.target.value) : null })} />
                                </Field>
                              ) : (
                                <Field label="Peso sugerido (kg)">
                                  <input className="input" value="No aplica" disabled />
                                </Field>
                              )}
                              <Field label="Orden">
                                <input className="input" type="number" min={0} value={exerciseForm.order} onChange={(e) => setExerciseForm({ ...exerciseForm, order: Number(e.target.value) })} required />
                              </Field>
                              <Field label="Notas tecnicas">
                                <textarea className="input min-h-24" value={exerciseForm.technique_notes ?? ''} onChange={(e) => setExerciseForm({ ...exerciseForm, technique_notes: e.target.value })} />
                              </Field>
                              <div className="md:col-span-2 flex justify-end">
                                <button className="btn-secondary" type="submit" disabled={createExercise.isPending} data-testid="add-exercise-inline-button">
                                  Agregar ejercicio a este dia
                                </button>
                              </div>
                            </form>
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}
          </>
        )}
      </section>


      <ConfirmDialog
        open={refreshTemplateId !== null}
        title="Actualizar plantilla desde plan activo"
        description="Se reemplazara los dias y ejercicios guardados en esta plantilla por la estructura actual del plan activo del member. Esta accion no cambia el plan publicado hasta que vuelvas a aplicarla."
        confirmLabel="Actualizar plantilla"
        isPending={refreshTrainingTemplate.isPending}
        onCancel={() => setRefreshTemplateId(null)}
        onConfirm={handleConfirmRefreshTemplate}
        data-testid="refresh-template-confirm-dialog"
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={
          deleteTarget?.type === 'plan'
            ? 'Borrar plan completo'
            : deleteTarget?.type === 'day'
              ? 'Borrar dia del plan'
            : deleteTarget?.type === 'training_template'
              ? 'Borrar plantilla de entrenamiento'
              : 'Borrar ejercicio'
        }
        description={deleteDialogDescription}
        confirmLabel={
          deleteTarget?.type === 'plan'
            ? 'Borrar plan'
            : deleteTarget?.type === 'day'
              ? 'Borrar dia'
            : deleteTarget?.type === 'training_template'
                ? 'Borrar plantilla'
                : 'Borrar ejercicio'
        }
        isPending={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        data-testid="delete-confirm-dialog"
      />

      <TrainingPlanWizard
        open={createPlanWizardOpen}
        onClose={() => setCreatePlanWizardOpen(false)}
        preselectedMember={member}
      />
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-lg font-heading font-bold text-neutral-900 dark:text-white">{value}</p>
    </div>
  )
}

function InsightList({
  title,
  icon,
  items,
  emptyText,
}: {
  title: string
  icon: ReactNode
  items: string[]
  emptyText: string
}) {
  return (
    <div className="rounded-sm border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <p className="font-semibold text-neutral-900 dark:text-white">{title}</p>
      </div>
      {!items.length ? (
        <p className="text-sm text-neutral-500">{emptyText}</p>
      ) : (
        <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StatusFlag({ label, isReady }: { label: string; isReady: boolean }) {
  return (
    <div className="rounded-sm border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-neutral-900 dark:text-white">{label}</span>
        <Badge variant={isReady ? 'success' : 'warning'}>{isReady ? 'OK' : 'Pendiente'}</Badge>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
      {children}
    </label>
  )
}

function OptionGroup({
  value,
  onChange,
  options,
  disabled = false,
  'data-testid': testId,
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  disabled?: boolean
  'data-testid'?: string
}) {
  return (
    <div className="option-group" data-testid={testId}>
      {options.map((option) => {
        const isActive = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            className={`option-chip ${isActive ? 'option-chip-active' : ''}`}
            aria-pressed={isActive}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
