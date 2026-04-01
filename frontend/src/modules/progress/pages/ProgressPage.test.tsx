import { waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { ProgressPage } from './ProgressPage'
import { progressApi } from '../api/progressApi'

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
    sessions: vi.fn(),
  },
}))

describe('ProgressPage', () => {
  it('renders progress logs, sessions and chart when data exists', async () => {
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
  })
})
