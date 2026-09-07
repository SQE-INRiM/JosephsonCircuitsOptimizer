import { describe, expect, it } from 'vitest'
import { customAxisCompatible } from './HarmonicBalanceResults'

describe('HB retained-data x axis', () => {
  it('accepts a retained array with the same sample count', () => {
    expect(customAxisCompatible(401, 401)).toBe(true)
  })

  it('rejects empty or differently sized axes', () => {
    expect(customAxisCompatible(0, 0)).toBe(false)
    expect(customAxisCompatible(401, 400)).toBe(false)
  })
})
