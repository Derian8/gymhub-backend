import { describe, expect, it } from 'vitest'
import { AxiosError } from 'axios'
import { classifyBackendIssue } from './backendStatus'

describe('classifyBackendIssue', () => {
  it('classifies placeholder backend URL as stale bundle', () => {
    const error = new AxiosError('Network Error', 'ERR_NETWORK')

    const issue = classifyBackendIssue(error, 'https://api.tu-dominio.com')

    expect(issue?.kind).toBe('stale_bundle')
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
})
