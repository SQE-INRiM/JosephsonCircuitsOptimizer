import { describe, expect, it } from 'vitest'
import { initialStages } from '../data/carthago'
import { useAppStore } from '../store'
import { affectedComputationStage, affectedSourceStage, invalidateFrom, nextRunStage, remainingRunStages } from './runStages'

describe('Run pipeline dependency order', () => {
  const stageStates = (linear: string, optimization: string, hb: string) =>
    initialStages.map((stage, index) => ({ ...stage, status: [linear, optimization, hb][index] as typeof stage.status }))

  it('always selects the first incomplete prerequisite, skipping optimization when configured', () => {
    expect(nextRunStage(stageStates('stale', 'completed', 'completed'))).toBe('linear')
    expect(nextRunStage(stageStates('completed', 'stale', 'completed'))).toBe('optimization')
    expect(nextRunStage(stageStates('completed', 'skipped', 'stale'))).toBe('hb')
    expect(nextRunStage(stageStates('completed', 'completed', 'completed'))).toBeNull()
  })

  it('continues from the earliest unfinished stage and skips fixed-parameter optimization', () => {
    expect(remainingRunStages(stageStates('completed', 'stale', 'ready'))).toEqual(['optimization', 'hb'])
    expect(remainingRunStages(stageStates('completed', 'skipped', 'ready'))).toEqual(['hb'])
    expect(remainingRunStages(stageStates('completed', 'completed', 'completed'))).toEqual([])
    expect(remainingRunStages(stageStates('stale', 'completed', 'completed'))).toEqual(['linear', 'optimization', 'hb'])
  })

  it('invalidates optimizer and HB without invalidating Linear for optimizer-only edits', () => {
    const project = structuredClone(useAppStore.getState().project)
    project.parameters[0] = { ...project.parameters[0], mode: 'Range', start: '1', stop: '2', step: '1' }
    const statuses = invalidateFrom(stageStates('completed', 'completed', 'completed'), project, 'optimization')
    expect(statuses.map((stage) => stage.status)).toEqual(['completed', 'stale', 'stale'])
  })

  it('restores the optimization stage when a formerly fixed parameter becomes a sweep', () => {
    const project = structuredClone(useAppStore.getState().project)
    project.parameters[0] = { ...project.parameters[0], mode: 'Range', start: '1', stop: '2', step: '1' }
    const statuses = invalidateFrom(stageStates('completed', 'skipped', 'completed'), project, 'linear')
    expect(statuses.map((stage) => stage.status)).toEqual(['stale', 'stale', 'stale'])
  })

  it('distinguishes Linear, Optimization and HB computation changes', () => {
    const c = useAppStore.getState().project.computation
    expect(affectedComputationStage(c, { frequencyStartGHz: c.frequencyStartGHz + 1 })).toBe('linear')
    expect(affectedComputationStage(c, { optimizerIterations: c.optimizerIterations + 1 })).toBe('optimization')
    expect(affectedComputationStage(c, { nonlinearStrongToneHarmonics: c.nonlinearStrongToneHarmonics + 1 })).toBe('hb')
    expect(affectedComputationStage(c, { nonlinearStrongToneHarmonics: c.nonlinearStrongToneHarmonics })).toBeNull()
  })

  it('keeps Linear valid for a change only to nonlinear source amplitude', () => {
    const source = useAppStore.getState().project.sources[0]
    expect(affectedSourceStage(source, { ...source, nonlinearAmplitude: { mode: 'Fixed', value: '1e-6' } })).toBe('hb')
    expect(affectedSourceStage(source, { ...source, port: source.port + 1 })).toBe('linear')
  })
})
