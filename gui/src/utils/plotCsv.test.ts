import { describe, expect, it } from 'vitest'
import { buildPlotCsv, safePlotFilename } from './plotCsv'

describe('plot CSV serialization', () => {
  it('preserves physical Hz frequencies and all A/B samples as separate columns', () => {
    expect(buildPlotCsv({
      x: [5e9, 5.25e9, 6e9],
      xLabel: 'frequency_hz',
      series: [
        { label: 'A · Point 1 (magnitude)', values: [10, 20, 30] },
        { label: 'B · Point 2 (magnitude)', values: [15, 25, 35] },
      ],
    })).toBe([
      'frequency_hz,A · Point 1 (magnitude),B · Point 2 (magnitude)',
      '5000000000,10,15',
      '5250000000,20,25',
      '6000000000,30,35',
      '',
    ].join('\r\n'))
  })

  it('quotes comma, newlines and double quotes in retained-array labels', () => {
    expect(buildPlotCsv({
      x: [0],
      xLabel: 'Index',
      series: [{ label: 'S21, "pumped"\nphase', values: [0.125] }],
    })).toBe('Index,"S21, ""pumped""\nphase"\r\n0,0.125\r\n')
  })

  it('rejects inconsistent plotted data lengths, avoiding invented or misaligned points', () => {
    expect(() => buildPlotCsv({ x: [1, 2], xLabel: 'frequency_hz', series: [{ label: 'A', values: [1] }] }))
      .toThrow(/mismatched X\/Y/)
    expect(() => buildPlotCsv({ x: [], xLabel: 'index', series: [{ label: 'A', values: [] }] }))
      .toThrow(/empty data/)
  })

  it('sanitizes generated filenames without losing scientific CSV precision', () => {
    expect(safePlotFilename('run:1 / A-B / S21 (phase)')).toBe('run_1_A-B_S21_phase')
  })
})
