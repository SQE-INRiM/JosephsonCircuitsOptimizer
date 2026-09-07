import { describe, expect, it } from 'vitest'
import { convertSourceValueSpec, currentToDbm, dBmToCurrent } from './sourceUnits'

describe('source amplitude units', () => {
  it('matches the JCO Ip/dBm convention at 50 ohm', () => {
    expect(dBmToCurrent(-70, 50)).toBeCloseTo(1e-6, 12)
    expect(currentToDbm(1e-6, 50)).toBeCloseTo(-70, 10)
  })

  it('maps an off-state between 0 A and -Inf dBm', () => {
    expect(currentToDbm(0, 50)).toBe(Number.NEGATIVE_INFINITY)
    expect(dBmToCurrent(Number.NEGATIVE_INFINITY, 50)).toBe(0)
  })

  it('converts every dBm range point and changes the representation to a list', () => {
    const converted = convertSourceValueSpec(
      { mode: 'Range', start: '-90', stop: '-80', step: '5' },
      'dBm',
      'A',
      50,
    )
    expect(converted.mode).toBe('List')
    expect(converted.values?.split(',')).toHaveLength(3)
    const values = converted.values!.split(',').map(Number)
    expect(values[0]).toBeCloseTo(dBmToCurrent(-90, 50), 12)
    expect(values[1]).toBeCloseTo(dBmToCurrent(-85, 50), 12)
    expect(values[2]).toBeCloseTo(dBmToCurrent(-80, 50), 12)
  })
})
