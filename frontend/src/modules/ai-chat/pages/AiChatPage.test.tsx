import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@/test/utils'
import { useAuthStore } from '@/shared/store/authStore'
import { AiChatPage } from './AiChatPage'

const enviarMensaje = vi.fn()
const enviarMensajeTrainer = vi.fn()
const useAiChatContextQuery = vi.fn()
const useAiChatHistoryQuery = vi.fn()
const useMembersQuery = vi.fn()

vi.mock('../hooks/useAiChat', () => ({
  useAiChatContextQuery: (...args: unknown[]) => useAiChatContextQuery(...args),
  useAiChatHistoryQuery: (...args: unknown[]) => useAiChatHistoryQuery(...args),
  useAiChatMutation: () => ({
    mutate: enviarMensaje,
    isPending: false,
    data: { fallback_used: false, engine_mode: 'deterministic', response_source: 'rules' },
  }),
  useAiChatSendMessageMutation: () => ({
    mutate: enviarMensajeTrainer,
    isPending: false,
  }),
}))

vi.mock('@/modules/members/hooks/useMembers', () => ({
  useMembersQuery: (...args: unknown[]) => useMembersQuery(...args),
}))

describe('AiChatPage', () => {
  beforeEach(() => {
    enviarMensaje.mockReset()
    enviarMensajeTrainer.mockReset()
    useAiChatContextQuery.mockReset()
    useAiChatHistoryQuery.mockReset()
    useMembersQuery.mockReset()
    HTMLElement.prototype.scrollIntoView = vi.fn()
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
    localStorage.clear()
  })

  it('renders member context and sends a contextualized message', async () => {
    useAuthStore.setState({
      user: {
        id: 1,
        email: 'member@test.com',
        username: 'member',
        first_name: 'Ana',
        last_name: 'Member',
        role: 'member',
        is_staff: false,
        memberprofile_id: 10,
        trainerprofile_id: null,
      },
      isAuthenticated: true,
      authResolved: true,
      theme: 'dark',
    })

    useAiChatContextQuery.mockReturnValue({
      data: {
        mode: 'member',
        conversation_id: 99,
        limit: 20,
        remaining_messages: 17,
        requires_member_selection: false,
        fallback_available: true,
        engine_mode: 'deterministic',
        local_llm_available: false,
        response_source: 'rules',
        suggested_prompts: ['¿Qué debería priorizar hoy en mi plan actual?'],
        member: {
          id: 10,
          full_name: 'Ana Member',
          email: 'member@test.com',
          riesgo_adherencia: 40,
          nivel_riesgo: 'medium',
          siguiente_accion: 'Completa tu entrenamiento de hoy.',
          estado_prescripcion: 'lista',
          trainer_asignado_nombre: 'Carlos Trainer',
          last_checkin: '2026-03-09T09:00:00Z',
          unread_notifications: 2,
        },
        summary: {
          active_plan_name: 'Hipertrofia',
          active_plan_id: 5,
          today_has_workout: true,
          today_workout_name: 'Torso superior',
          resumen_hoy: 'Hoy toca torso superior.',
          payment_status: 'pending',
          days_until_due: 2,
          days_overdue: null,
          nutrition_goal: 'muscle_gain',
          weekly_sessions_done: 3,
          streak_asistencia: 4,
          cumplimiento_semanal: 75,
          inactivity_alert: false,
          tiene_plan_activo: true,
          prescripcion_lista: true,
          risk_reasons: ['inasistencia reciente'],
        },
        analysis_context: {
          trainer_name: 'Carlos Trainer',
          risk_level: 'medium',
          risk_reasons: ['inasistencia reciente'],
          next_action: 'Completa tu entrenamiento de hoy.',
          payment_status: 'pending',
          days_until_due: 2,
          days_overdue: null,
          last_checkin: '2026-03-09T09:00:00Z',
          unread_notifications: 2,
          today_has_workout: true,
          today_workout_name: 'Torso superior',
          active_plan_name: 'Hipertrofia',
          weekly_sessions_done: 3,
          streak_asistencia: 4,
          cumplimiento_semanal: 75,
          nutrition_goal: 'muscle_gain',
          inactivity_alert: false,
          prescription_status: 'lista',
          prescription_readiness: {
            tiene_plan_activo: true,
            tiene_dias: true,
            tiene_ejercicios: true,
            tiene_nutricion: true,
            tiene_guias: true,
            esta_lista_para_member: true,
            estado: 'lista',
          },
          has_today_workout: true,
        },
      },
      isLoading: false,
    })
    useAiChatHistoryQuery.mockReturnValue({
      data: [
        {
          id: 81,
          member: 10,
          conversation_id: 99,
          mode: 'member',
          role: 'assistant',
          content: 'Hola, vamos a organizar tu entrenamiento.',
          created_at: '2026-03-10T10:00:00Z',
          tokens_used: 10,
        },
      ],
      isLoading: false,
    })
    useMembersQuery.mockReturnValue({ data: { results: [] } })

    const user = userEvent.setup()
    enviarMensaje.mockImplementation((_payload, options) => {
      options?.onSuccess?.({
        content: 'Prioriza tu sesión de torso y registra la carga.',
        fallback_used: false,
        engine_mode: 'deterministic',
        local_llm_used: false,
        response_source: 'rules',
      })
    })

    const { getByTestId, getByText } = renderWithProviders(<AiChatPage />)

    await waitFor(() => {
      expect(getByTestId('chat-context-panel')).toBeInTheDocument()
      expect(getByText('Hipertrofia')).toBeInTheDocument()
      expect(getByText('Hola, vamos a organizar tu entrenamiento.')).toBeInTheDocument()
      expect(getByText('Asistente contextual')).toBeInTheDocument()
      expect(getByText('Pago pendiente (2 días)')).toBeInTheDocument()
      expect(getByText(/Señales clave:/)).toBeInTheDocument()
    })

    await user.type(getByTestId('chat-input'), 'Necesito ayuda con mi rutina')
    await user.click(getByTestId('chat-send'))

    expect(enviarMensaje).toHaveBeenCalledWith(
      { message: 'Necesito ayuda con mi rutina', member_id: undefined, conversation_id: 99 },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    )

    await waitFor(() => {
      expect(getByText('Necesito ayuda con mi rutina')).toBeInTheDocument()
      expect(getByText('Prioriza tu sesión de torso y registra la carga.')).toBeInTheDocument()
    })
  })

  it('shows trainer member selection before opening the copiloto', async () => {
    useAuthStore.setState({
      user: {
        id: 2,
        email: 'trainer@test.com',
        username: 'trainer',
        first_name: 'Luis',
        last_name: 'Trainer',
        role: 'trainer',
        is_staff: false,
        memberprofile_id: null,
        trainerprofile_id: 7,
      },
      isAuthenticated: true,
      authResolved: true,
      theme: 'dark',
    })

    useAiChatContextQuery.mockReturnValue({
      data: {
        mode: 'trainer_member',
        conversation_id: null,
        limit: 60,
        remaining_messages: 60,
        requires_member_selection: true,
        fallback_available: true,
        engine_mode: 'deterministic',
        local_llm_available: false,
        response_source: 'rules',
        suggested_prompts: [],
        member: null,
        summary: null,
        analysis_context: null,
      },
      isLoading: false,
    })
    useAiChatHistoryQuery.mockReturnValue({ data: [], isLoading: false })
    useMembersQuery.mockReturnValue({
      data: {
        results: [
          { id: 10, full_name: 'Ana Member', email: 'ana@test.com', nivel_riesgo: 'medium' },
        ],
      },
    })

    const { getByTestId, getByText } = renderWithProviders(<AiChatPage />, { route: '/ai-chat', path: '/ai-chat' })

    await waitFor(() => {
      expect(getByText('Selecciona un cliente')).toBeInTheDocument()
      expect(getByTestId('chat-member-option-10')).toBeInTheDocument()
    })
  })

  it('renders a sendable trainer message and sends it to the member', async () => {
    useAuthStore.setState({
      user: {
        id: 2,
        email: 'trainer@test.com',
        username: 'trainer',
        first_name: 'Luis',
        last_name: 'Trainer',
        role: 'trainer',
        is_staff: false,
        memberprofile_id: null,
        trainerprofile_id: 7,
      },
      isAuthenticated: true,
      authResolved: true,
      theme: 'dark',
    })

    useAiChatContextQuery.mockReturnValue({
      data: {
        mode: 'trainer_member',
        conversation_id: 55,
        limit: 60,
        remaining_messages: 48,
        requires_member_selection: false,
        fallback_available: true,
        engine_mode: 'deterministic',
        local_llm_available: false,
        response_source: 'rules',
        suggested_prompts: ['Escribe un mensaje corto para corregir su adherencia'],
        member: {
          id: 10,
          full_name: 'Ana Member',
          email: 'ana@test.com',
          riesgo_adherencia: 72,
          nivel_riesgo: 'high',
          siguiente_accion: 'Completa tu entrenamiento de hoy.',
          estado_prescripcion: 'lista',
          trainer_asignado_nombre: 'Luis Trainer',
          last_checkin: '2026-03-08T09:00:00Z',
          unread_notifications: 1,
        },
        summary: {
          active_plan_name: 'Hipertrofia',
          active_plan_id: 5,
          today_has_workout: true,
          today_workout_name: 'Torso superior',
          resumen_hoy: 'Hoy toca torso superior.',
          payment_status: 'late',
          days_until_due: null,
          days_overdue: 4,
          nutrition_goal: 'muscle_gain',
          weekly_sessions_done: 1,
          streak_asistencia: 1,
          cumplimiento_semanal: 25,
          inactivity_alert: true,
          tiene_plan_activo: true,
          prescripcion_lista: true,
          risk_reasons: ['inasistencia reciente', 'caída de adherencia'],
        },
        analysis_context: {
          trainer_name: 'Luis Trainer',
          risk_level: 'high',
          risk_reasons: ['inasistencia reciente', 'caída de adherencia'],
          next_action: 'Completa tu entrenamiento de hoy.',
          payment_status: 'late',
          days_until_due: null,
          days_overdue: 4,
          last_checkin: '2026-03-08T09:00:00Z',
          unread_notifications: 1,
          today_has_workout: true,
          today_workout_name: 'Torso superior',
          active_plan_name: 'Hipertrofia',
          weekly_sessions_done: 1,
          streak_asistencia: 1,
          cumplimiento_semanal: 25,
          nutrition_goal: 'muscle_gain',
          inactivity_alert: true,
          prescription_status: 'lista',
          prescription_readiness: {
            tiene_plan_activo: true,
            tiene_dias: true,
            tiene_ejercicios: true,
            tiene_nutricion: true,
            tiene_guias: true,
            esta_lista_para_member: true,
            estado: 'lista',
          },
          has_today_workout: true,
        },
      },
      isLoading: false,
    })
    useAiChatHistoryQuery.mockReturnValue({ data: [], isLoading: false })
    useMembersQuery.mockReturnValue({ data: { results: [{ id: 10, full_name: 'Ana Member', email: 'ana@test.com', nivel_riesgo: 'high' }] } })

    const user = userEvent.setup()
    enviarMensaje.mockImplementation((_payload, options) => {
      options?.onSuccess?.({
        content: 'Lectura del caso: bloqueo financiero.\n\nFactores clave: pago vencido.\n\nRiesgos o fricciones: mora activa.\n\nAcción recomendada: separa cobro y adherencia.\n\nMensaje sugerido: Regulariza tu pago hoy.',
        message_id: 900,
        conversation_id: 55,
        sendable: true,
        message_text: 'Regulariza tu pago hoy para que retomemos tu ritmo.',
        priority_detected: 'payment',
        intent_detected: 'client_message',
        fallback_used: false,
        engine_mode: 'deterministic',
        local_llm_used: false,
        response_source: 'rules',
      })
    })

    const { getByTestId, getByText } = renderWithProviders(<AiChatPage />, {
      route: '/ai-chat?member=10',
      path: '/ai-chat',
    })

    await user.type(getByTestId('chat-input'), 'Escribe un mensaje corto para este cliente')
    await user.click(getByTestId('chat-send'))

    await waitFor(() => {
      expect(getByTestId('sendable-message-card')).toBeInTheDocument()
      expect(getByText('Regulariza tu pago hoy para que retomemos tu ritmo.')).toBeInTheDocument()
      expect(getByText('Al enviarlo, el member lo verá en su bandeja de mensajes del trainer.')).toBeInTheDocument()
    })

    await user.click(getByTestId('sendable-message-send'))

    expect(enviarMensajeTrainer).toHaveBeenCalledWith(
      {
        member_id: 10,
        message_text: 'Regulariza tu pago hoy para que retomemos tu ritmo.',
        conversation_id: 55,
        source_message_id: 900,
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })
})
