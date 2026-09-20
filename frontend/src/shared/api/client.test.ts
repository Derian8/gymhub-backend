import { describe, expect, it } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'
import { adjuntar_contexto_cliente } from './client'

function config_inicial(): InternalAxiosRequestConfig {
  return {
    headers: {},
  } as InternalAxiosRequestConfig
}

describe('adjuntar_contexto_cliente', () => {
  it('identifica las solicitudes del perfil Cliente para el backend', () => {
    const config = adjuntar_contexto_cliente(config_inicial(), 'cliente')

    expect(config.params).toEqual({ scope: 'self' })
    expect(config.headers['X-GymHub-Context']).toBe('cliente')
  })

  it('conserva las solicitudes técnicas sin el contexto Cliente', () => {
    const config = adjuntar_contexto_cliente(config_inicial(), 'instructor')

    expect(config.params).toBeUndefined()
    expect(config.headers['X-GymHub-Context']).toBeUndefined()
  })
})
