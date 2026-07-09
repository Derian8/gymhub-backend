import {
  BackendWarmupError,
  resetBackendWarmupForTests,
  warmBackend,
} from './backendWarmup'

describe('warmBackend', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    resetBackendWarmupForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shares one health request between concurrent callers and caches readiness', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)

    await Promise.all([warmBackend(''), warmBackend('')])
    await warmBackend('')

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('/health/live/', expect.objectContaining({
      credentials: 'omit',
    }))
  })

  it('retries health once before continuing', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockResolvedValueOnce({ ok: true } as Response)

    await warmBackend('')

    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('fails after two unsuccessful health checks', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response)

    await expect(warmBackend('')).rejects.toBeInstanceOf(BackendWarmupError)

    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
