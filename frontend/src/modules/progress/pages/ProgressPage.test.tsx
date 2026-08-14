import { waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { ProgressPage } from './ProgressPage'
import { progressApi } from '../api/progressApi'
import { useAuthStore } from '@/shared/store/authStore'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="recharts-container">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}))

vi.mock('../api/progressApi', () => ({
  progressApi: {
    logs: vi.fn(),
    summary: vi.fn(),
    sessions: vi.fn(),
  },
}))

describe('ProgressPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 9,
        email: 'member@test.com',
        username: 'member',
        first_name: 'Ana',
        last_name: 'Cliente',
        role: 'member',
        is_staff: false,
        memberprofile_id: 9,
        trainerprofile_id: null,
      },
      activeContext: 'cliente',
      isAuthenticated: true,
      authResolved: true,
    })
  })

  it('renders progress logs, sessions and chart when data exists', async () => {
    vi.mocked(progressApi.summary).mockResolvedValue({
      latest_log_id: 41,
      latest_recorded_at: '2026-03-10T10:00:00Z',
      current_weight_kg: 82,
      previous_weight_kg: 83,
      weight_change_kg: -1,
      height_cm: 176,
      body_fat_pct: 18,
      muscle_mass_kg: 35,
      waist_cm: 84,
      bmi: 26.5,
      notes: 'Buen avance',
    })
    vi.mocked(progressApi.logs).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 41,
          member: 9,
          recorded_at: '2026-03-10T10:00:00Z',
          weight_kg: 82,
          height_cm: 176,
          body_fat_pct: 18,
          muscle_mass_kg: 35,
          waist_cm: 84,
          notes: 'Buen avance',
          source: 'trainer',
        },
      ],
    })
    vi.mocked(progressApi.sessions).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 51,
          member: 9,
          workout_day: 101,
          attendance: null,
          started_at: '2026-03-11T08:00:00Z',
          completed_at: '2026-03-11T09:00:00Z',
          is_completed: true,
          overall_feeling: 4,
          trainer_notes: '',
        },
      ],
    })

    const { getByTestId, getByText } = renderWithProviders(<ProgressPage />)

    await waitFor(() => {
      expect(getByTestId('progress-page')).toBeInTheDocument()
      expect(getByTestId('weight-chart')).toBeInTheDocument()
      expect(getByTestId('progress-row-41')).toBeInTheDocument()
      expect(getByTestId('session-row-51')).toBeInTheDocument()
    })

    expect(getByText('Buen avance')).toBeInTheDocument()
    expect(getByText('4/5')).toBeInTheDocument()
    expect(getByText('176 cm')).toBeInTheDocument()
    expect(getByText('26.5')).toBeInTheDocument()
  })
})
