import apiClient from '@/shared/api/client'
import { warmBackend } from '@/shared/api/backendWarmup'
import { authApi } from './authApi'

vi.mock('@/shared/api/client', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
  },
  BASE_URL: '',
}))

vi.mock('@/shared/api/backendWarmup', () => ({
  warmBackend: vi.fn(),
}))

describe('authApi.login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(warmBackend).mockResolvedValue()
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { user: { id: 1, role: 'member' }, message: 'ok' },
    })
  })

  it('warms the backend before sending credentials once', async () => {
    await authApi.login({ email: 'member@test.com', password: 'secret' })

    expect(warmBackend).toHaveBeenCalledWith('')
    expect(apiClient.post).toHaveBeenCalledTimes(1)
    expect(apiClient.post).toHaveBeenCalledWith('/auth/login/', {
      email: 'member@test.com',
      password: 'secret',
    })
    expect(vi.mocked(warmBackend).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(apiClient.post).mock.invocationCallOrder[0],
    )
  })

  it('does not send credentials when backend preparation fails', async () => {
    vi.mocked(warmBackend).mockRejectedValue(new Error('offline'))

    await expect(
      authApi.login({ email: 'member@test.com', password: 'secret' }),
    ).rejects.toThrow('offline')
    expect(apiClient.post).not.toHaveBeenCalled()
  })
})
