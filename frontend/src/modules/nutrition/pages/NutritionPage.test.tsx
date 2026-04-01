import { renderWithProviders } from '@/test/utils'
import { NutritionPage } from './NutritionPage'
import { useAuthStore } from '@/shared/store/authStore'

vi.mock('../hooks/useNutrition', () => ({
  useNutritionProfilesQuery: () => ({
    data: {
      results: [
        {
          id: 21,
          goal_type: 'fat_loss',
          calorie_range_min: 1800,
          calorie_range_max: 2100,
          protein_focus: '140g al dia',
          carb_strategy: 'Moderado',
          hydration_recommendation: '3 litros diarios',
        },
      ],
    },
    isLoading: false,
  }),
  useNutritionGuidelinesQuery: () => ({
    data: {
      results: [
        {
          id: 31,
          title: 'Prioriza proteina',
          goal_type: 'fat_loss',
          description: 'Incluye proteina magra en cada comida.',
          recommended_foods: 'Pollo, huevos, yogur',
          foods_to_limit: 'Ultraprocesados',
          timing_suggestions: 'Consume proteina despues de entrenar',
        },
      ],
    },
    isLoading: false,
  }),
}))

vi.mock('@/modules/members/hooks/useMembers', () => ({
  useMemberActivePrescriptionQuery: () => ({
    data: {
      perfil_nutricional: {
        id: 21,
        training_plan: 12,
        goal_type: 'fat_loss',
        calorie_range_min: 1800,
        calorie_range_max: 2100,
        protein_focus: '140g al dia',
        carb_strategy: 'Moderado',
        hydration_recommendation: '3 litros diarios',
      },
      guias_vinculadas: [
        {
          id: 41,
          plan: 12,
          priority_order: 1,
          guideline: {
            id: 31,
            title: 'Prioriza proteina',
            goal_type: 'fat_loss',
            description: 'Incluye proteina magra en cada comida.',
            recommended_foods: 'Pollo, huevos, yogur',
            foods_to_limit: 'Ultraprocesados',
            timing_suggestions: 'Consume proteina despues de entrenar',
          },
        },
      ],
    },
    isLoading: false,
  }),
}))

describe('NutritionPage', () => {
  beforeEach(() => {
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
  })

  it('renders nutrition profile and guideline details', () => {
    const { getByTestId, getByText } = renderWithProviders(<NutritionPage />)

    expect(getByTestId('nutrition-page')).toBeInTheDocument()
    expect(getByTestId('nutrition-profile-21')).toBeInTheDocument()
    expect(getByText('1800-2100 kcal')).toBeInTheDocument()
    expect(getByText('140g al dia')).toBeInTheDocument()
    expect(getByTestId('guideline-31')).toBeInTheDocument()
    expect(getByText('Prioriza proteina')).toBeInTheDocument()
    expect(getByText(/Pollo, huevos, yogur/)).toBeInTheDocument()
  })
})
