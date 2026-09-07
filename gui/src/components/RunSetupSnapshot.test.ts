import { describe, expect, it } from 'vitest'
import type { RunResults } from '../types'
import { runSetupSections, snapshotRows } from './RunSetupSnapshot'

function run(id: string, sourceAmplitude: number): RunResults {
  return {
    id,
    setupSnapshot: {
      parameters: { Cg: [170e-15] },
      sources: { source_1_non_linear_amplitude: sourceAmplitude },
      simulation: { nonlinear_strong_tone_harmonics: 3 },
      optimizer: { max_optimizer_iterations: 5 },
    },
    traces: [],
  }
}

describe('run setup snapshot', () => {
  it('uses the setup stored with the selected run rather than current Setup state', () => {
    const older = run('output_old', 2e-7)
    const newer = run('output_new', 5e-7)

    const olderSources = runSetupSections(older).find((section) => section.key === 'sources')?.value
    const newerSources = runSetupSections(newer).find((section) => section.key === 'sources')?.value

    expect(olderSources).toEqual({ source_1_non_linear_amplitude: 2e-7 })
    expect(newerSources).toEqual({ source_1_non_linear_amplitude: 5e-7 })
  })

  it('turns stored dictionaries into variable/value rows without changing values', () => {
    expect(snapshotRows({
      Cg: [2e-13, 3e-13],
      source: { frequency: [7e9, 8e9], port: 1 },
    })).toEqual([
      { name: 'Cg', value: [2e-13, 3e-13] },
      { name: 'source.frequency', value: [7e9, 8e9] },
      { name: 'source.port', value: 1 },
    ])
  })
})
