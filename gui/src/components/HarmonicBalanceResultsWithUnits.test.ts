import { describe, expect, it } from 'vitest'
import type { ResultTable } from '../types'
import { convertHbAmplitudeTableForDisplay } from './HarmonicBalanceResultsWithUnits'

describe('HB display units', () => {
  const table: ResultTable = {
    columns: ['point_id', 'source_1_frequency', 'source_1_amplitude', 'performance'],
    rows: [[1, 7e9, 1e-6, 12.5]],
    file: 'df_nonlinear_analysis.h5',
  }

  it('converts source frequencies from Hz to GHz for display', () => {
    const converted = convertHbAmplitudeTableForDisplay(table, 'A', { 1: 50 })
    expect(converted.rows[0][1]).toBe(7)
  })

  it('leaves amplitudes unchanged in A mode', () => {
    const converted = convertHbAmplitudeTableForDisplay(table, 'A', { 1: 50 })
    expect(converted.rows[0][2]).toBe(1e-6)
  })

  it('converts amplitude coordinates to dBm while keeping frequency in GHz', () => {
    const converted = convertHbAmplitudeTableForDisplay(table, 'dBm', { 1: 50 })
    expect(converted.rows[0][0]).toBe(1)
    expect(converted.rows[0][1]).toBe(7)
    expect(Number(converted.rows[0][2])).toBeCloseTo(-70, 10)
    expect(converted.rows[0][3]).toBe(12.5)
  })

  it('uses the source-specific impedance', () => {
    const converted = convertHbAmplitudeTableForDisplay(table, 'dBm', { 1: 100 })
    expect(Number(converted.rows[0][2])).toBeCloseTo(-66.989700043, 9)
  })
})
