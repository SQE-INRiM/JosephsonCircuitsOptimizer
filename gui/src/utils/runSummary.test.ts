import { describe, expect, it } from 'vitest'
import { configuredStageSummary, harmonicBalancePointCount, linearPointCount, sweepValueCount } from './runSummary'
import type { ProjectModel } from '../types'

const project: ProjectModel = {
  name: 'test', filename: 'test.jco', schemaVersion: 'jco.project/1', circuitCode: '', metricsCode: '', helpersCode: '',
  parameters: [
    { id: 'a', name: 'a', mode: 'Range', start: '1', step: '1', stop: '3', unit: '—', role: 'Design' },
    { id: 'b', name: 'b', mode: 'List', values: '10, 20', unit: '—', role: 'Design' },
  ],
  sources: [
    { id: 'source_1', name: 'Source 1', port: 1, isDc: false, frequency: { mode: 'List', values: '7, 8' }, linearAmplitude: { mode: 'Fixed', value: '0' }, nonlinearAmplitude: { mode: 'Range', start: '1e-6', step: '1e-6', stop: '3e-6' } },
  ],
  metrics: [],
  computation: { frequencyStartGHz: 0, frequencyStopGHz: 10, frequencyStepMHz: 1, linearStrongToneHarmonics: 1, linearModulationHarmonics: 1, nonlinearStrongToneHarmonics: 8, nonlinearModulationHarmonics: 4, maxSimulatorIterations: 200, solverFtol: 1e-8, switchOffLineSearchTolerance: 1e-5, alphaMin: 1e-4, maxIntermodOrder: 'Inf', solverBatches: 0, nodeSorting: 'number', optimizerIterations: 8, samplesPerIteration: 4, surrogate: 'Kriging', strategy: 'SRBF', sampler: 'Random', randomSeed: 1, threeWaveMixing: false, fourWaveMixing: true, nonlinearCorrectionCycles: 0 },
}

describe('run stage summaries', () => {
  it('counts fixed, list and inclusive range sweep values', () => {
    expect(sweepValueCount({ mode: 'Fixed', value: '7' })).toBe(1)
    expect(sweepValueCount({ mode: 'List', values: '7, 8, 9' })).toBe(3)
    expect(sweepValueCount({ mode: 'Range', start: '1', step: '0.5', stop: '2' })).toBe(3)
  })

  it('derives Linear and HB point counts from the current project', () => {
    expect(linearPointCount(project)).toBe(6)
    expect(harmonicBalancePointCount(project)).toBe(6)
    expect(configuredStageSummary(project, 'linear')).toContain('6 configured device configurations')
    expect(configuredStageSummary(project, 'optimization')).toBe('8 iterations · 4 samples / iteration')
    expect(configuredStageSummary(project, 'hb')).toContain('6 configured source points')
  })
})
