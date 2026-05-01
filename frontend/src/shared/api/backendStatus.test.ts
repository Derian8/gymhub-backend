import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError } from 'axios'
import { classifyBackendIssue, diagnoseBackendIssue } from './backendStatus'

describe('classifyBackendIssue', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('classifies placeholder backend URL as stale bundle', () => {
    const error = new AxiosError('Network Error', 'ERR_NETWORK')

    const issue = classifyBackendIssue(error, 'https://api.tu-dominio.com')

    expect(issue?.kind).toBe('stale_bundle')
  })

  it('classifies empty backend URL as same-origin network issue, not stale bundle', () => {
    const error = new AxiosError('Network Error', 'ERR_NETWORK')

    const issue = classifyBackendIssue(error, '')

    expect(issue?.kind).toBe('network')
  })

  it('classifies network errors as backend unreachable', () => {
    const error = new AxiosError('Network Error', 'ERR_NETWORK')

    const issue = classifyBackendIssue(error, 'https://proyectoappgym-backend.vercel.app')

    expect(issue?.kind).toBe('network')
    expect(issue?.backendUrl).toBe('https://proyectoappgym-backend.vercel.app')
  })

  it('classifies 500 responses as backend errors', () => {
    const error = new AxiosError('Server Error', 'ERR_BAD_RESPONSE', undefined, undefined, {
      status: 500,
      statusText: 'Internal Server Error',
      headers: {},
      config: {} as never,
      data: {},
    })

    const issue = classifyBackendIssue(error, 'https://proyectoappgym-backend.vercel.app')

    expect(issue?.kind).toBe('backend_error')
  })

  it('classifies HTML platform responses separately from backend errors', () => {
    const error = new AxiosError('Server Error', 'ERR_BAD_RESPONSE', undefined, undefined, {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'text/html; charset=utf-8' },
      config: {} as never,
      data: '<!doctype html><html><title>Authentication Required</title>Vercel Authentication</html>',
    })

    const issue = classifyBackendIssue(error, '')

    expect(issue?.kind).toBe('platform_error')
  })

  it('keeps Django HTML 500 responses as backend errors', () => {
    const error = new AxiosError('Server Error', 'ERR_BAD_RESPONSE', undefined, undefined, {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'text/html; charset=utf-8' },
      config: {} as never,
      data: '<!doctype html><html><title>Server Error (500)</title><body><h1>Server Error (500)</h1></body></html>',
    })

    const issue = classifyBackendIssue(error, '')

    expect(issue?.kind).toBe('backend_error')
  })

  it('classifies timeout with healthy backend as backend_slow', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true }))

    const error = new AxiosError('timeout', 'ECONNABORTED')

    const issue = await diagnoseBackendIssue(error, 'https://proyectoappgym-backend.vercel.app')

    expect(issue?.kind).toBe('backend_slow')
  })

  it('classifies timeout with failing readiness as backend_not_ready', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false }))

    const error = new AxiosError('timeout', 'ECONNABORTED')

    const issue = await diagnoseBackendIssue(error, 'https://proyectoappgym-backend.vercel.app')

    expect(issue?.kind).toBe('backend_not_ready')
  })
})
