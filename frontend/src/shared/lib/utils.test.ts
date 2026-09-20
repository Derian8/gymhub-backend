import { describe, expect, it } from 'vitest'
import { formatPesoSugerido, pesoSugeridoEnKg, pesoSugeridoParaMostrar } from './utils'

describe('peso sugerido', () => {
  it('convierte libras a kg y las vuelve a mostrar en libras', () => {
    const pesoKg = pesoSugeridoEnKg(100, 'lb')

    expect(pesoKg).toBeCloseTo(45.359237)
    expect(pesoSugeridoParaMostrar(pesoKg, 'lb')).toBe(100)
    expect(formatPesoSugerido(pesoKg, 'lb')).toBe('100 lb')
  })
})
