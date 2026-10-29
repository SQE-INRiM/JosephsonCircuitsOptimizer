import { describe, expect, it } from 'vitest'
import type { ResultTable } from '../types'
import {
  convertHbAmplitudeTableForDisplay,
  convertHbFrequencyTableForDisplay,
  runAmplitudeDisplay,
} from './HarmonicBalanceResultsWithUnits'

describe('HB display units', () => {
  const table: ResultTable = {
    columns: ['point_id', 'source_1_frequency', 'source_1_amplitude', 'performance'],
    rows: [[1, 7e9, 1e-6, 12.5]],
    file: 'df_nonlinear_analysis.h5',
  }

  it('converts source frequencies from Hz to GHz for display', () => {
    const converted = convertHbFrequencyTableForDisplay(
      convertHbAmplitudeTableForDisplay(table, 'A', { 1: 50 }),
    )

    expect(converted.rows[0][1]).toBe(7)
  })

  it('leaves amplitudes unchanged in A mode', () => {
    const converted = convertHbAmplitudeTableForDisplay(table, 'A', { 1: 50 })

    expect(converted.rows[0][2]).toBe(1e-6)
  })

  it('converts amplitude coordinates to dBm while keeping frequency in GHz', () => {
    const converted = convertHbFrequencyTableForDisplay(
      convertHbAmplitudeTableForDisplay(table, 'dBm', { 1: 50 }),
    )

    expect(converted.rows[0][0]).toBe(1)
    expect(converted.rows[0][1]).toBe(7)
    expect(Number(converted.rows[0][2])).toBeCloseTo(-70, 10)
    expect(converted.rows[0][3]).toBe(12.5)
  })

  it('uses the source-specific impedance', () => {
    const converted = convertHbAmplitudeTableForDisplay(table, 'dBm', { 1: 100 })

    expect(Number(converted.rows[0][2])).toBeCloseTo(-66.989700043, 9)
  })
  it('uses each source input unit independently when stored in a run', () => {
    const mixed: ResultTable = {
      columns: ['point_id', 'source_1_amplitude', 'source_2_amplitude', 'performance'],
      rows: [[1, 1e-6, 2e-6, 20]],
      file: 'df_nonlinear_analysis.h5',
    }
    const config = runAmplitudeDisplay({
      id: 'run', traces: [], setupSnapshot: {
        sourceDisplay: {
          source_1: { nonlinearAmplitudeUnit: 'dBm', impedanceOhm: 50 },
          source_2: { nonlinearAmplitudeUnit: 'A', impedanceOhm: 100 },
        },
      },
    })
    expect(config.units).toEqual({ 1: 'dBm', 2: 'A' })
    const display = convertHbAmplitudeTableForDisplay(mixed, config.units, config.impedancesOhm)
    expect(Number(display.rows[0][1])).toBeCloseTo(-70, 8)
    expect(display.rows[0][2]).toBe(2e-6)
  })

  it('defaults historical runs without unit snapshots to dBm, not A', () => {
    const config = runAmplitudeDisplay({ id: 'old', traces: [], setupSnapshot: { sources: {} } })
    const shown = convertHbAmplitudeTableForDisplay(table, config.units, config.impedancesOhm)
    expect(Number(shown.rows[0][2])).toBeCloseTo(-70, 8)
  })

  it('binds results to stored run metadata rather than current Setup values', () => {
    const config = runAmplitudeDisplay({
      id: 'stored', traces: [], setupSnapshot: {
        sourceDisplay: { source_1: { nonlinearAmplitudeUnit: 'A', impedanceOhm: 75 } },
      },
    })
    expect(convertHbAmplitudeTableForDisplay(table, config.units, config.impedancesOhm).rows[0][2]).toBe(1e-6)
  })

})