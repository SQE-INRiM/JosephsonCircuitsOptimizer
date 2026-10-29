import { describe, expect, it } from 'vitest'
import { sourceCoordinateLabel, sourceCoordinateUnit } from './resultUnits'

describe('per-source Results amplitude labels', () => {
  it('labels mixed HB sources independently', () => {
    const units = { 1: 'dBm', 2: 'A' } as const
    expect(sourceCoordinateLabel('source_1_amplitude', units)).toBe('source_1_amplitude / dBm')
    expect(sourceCoordinateLabel('source_2_amplitude', units)).toBe('source_2_amplitude / A')
    expect(sourceCoordinateUnit('source_2_frequency', units)).toBe('GHz')
  })

  it('uses dBm for historical sources absent from display metadata', () => {
    expect(sourceCoordinateLabel('source_3_amplitude', {})).toBe('source_3_amplitude / dBm')
  })
})
