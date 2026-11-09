import type { ComputationConfig, ProjectModel, SourceSpec, StageId, StageState } from '../types'
import { hasVaryingDeviceParameters } from './runSummary'

const ORDER: StageId[] = ['linear', 'optimization', 'hb']

/** Reset stages that will be attempted before Julia launches. Previous completions
 * must not survive a cancelled re-run, even if no STAGE event was received yet. */
export function prepareStagesForRun(stages: StageState[], project: ProjectModel, requested: StageId[]): StageState[] {
  const first = ORDER.find((id) => requested.includes(id))
  if (!first) return stages
  const invalidated = invalidateFrom(stages, project, first)
  return invalidated.map((stage) => {
    if (stage.status === 'skipped' || !requested.includes(stage.id)) return stage
    return { ...stage, status: 'ready', progress: 0, completedAt: undefined, duration: undefined }
  })
}

/** A stopped process may end before its first stage event. Mark the first stage
 * that has not explicitly finished, and preserve only earlier completed stages. */
export function finishRunStages(
  stages: StageState[],
  requested: StageId[],
  outcome: 'completed' | 'failed' | 'cancelled',
): StageState[] {
  const outstanding = ORDER.find((id) => requested.includes(id) &&
    !['completed', 'skipped'].includes(stages.find((stage) => stage.id === id)?.status ?? 'not_ready'))
  if (!outstanding) return stages
  const index = ORDER.indexOf(outstanding)
  return stages.map((stage) => {
    if (stage.id === outstanding) {
      return { ...stage, status: outcome === 'completed' ? 'failed' : outcome, completedAt: undefined }
    }
    if (ORDER.indexOf(stage.id) > index && stage.status !== 'skipped') {
      return { ...stage, status: 'stale', progress: 0, completedAt: undefined, duration: undefined }
    }
    return stage
  })
}

/** A full Run always starts from Linear; the next-step action never skips a stale prerequisite. */
export function nextRunStage(stages: StageState[]): StageId | null {
  for (const id of ORDER) {
    const status = stages.find((stage) => stage.id === id)?.status
    if (status === 'skipped') continue
    if (status !== 'completed') return id
  }
  return null
}

/** Resume from the first unfinished stage; do not re-run valid earlier stages. */
export function remainingRunStages(stages: StageState[]): StageId[] {
  const next = nextRunStage(stages)
  return next ? ORDER.slice(ORDER.indexOf(next)).filter((id) =>
    stages.find((stage) => stage.id === id)?.status !== 'skipped') : []
}

export function invalidateFrom(stages: StageState[], project: ProjectModel, first: StageId): StageState[] {
  const start = ORDER.indexOf(first)
  const skipOptimization = !hasVaryingDeviceParameters(project)
  return stages.map((stage) => {
    if (stage.status === 'running') return stage
    if (stage.id === 'optimization' && skipOptimization) return { ...stage, status: 'skipped', progress: 0 }
    const previouslySkipped = stage.id === 'optimization' && stage.status === 'skipped'
    if (ORDER.indexOf(stage.id) >= start || previouslySkipped) return { ...stage, status: 'stale', progress: 0 }
    return stage
  })
}

const OPTIMIZER_FIELDS: (keyof ComputationConfig)[] = [
  'optimizerIterations', 'samplesPerIteration', 'surrogate', 'strategy', 'sampler', 'randomSeed',
]
const NONLINEAR_FIELDS: (keyof ComputationConfig)[] = [
  'nonlinearStrongToneHarmonics', 'nonlinearModulationHarmonics',
  'threeWaveMixing', 'fourWaveMixing', 'nonlinearCorrectionCycles',
]

/** Unknown simulation settings are treated conservatively as Linear dependencies. */
export function affectedComputationStage(
  current: ComputationConfig,
  patch: Partial<ComputationConfig>,
): StageId | null {
  const changed = (Object.keys(patch) as (keyof ComputationConfig)[])
    .filter((key) => current[key] !== patch[key])
  if (!changed.length) return null
  if (changed.some((key) => !OPTIMIZER_FIELDS.includes(key) && !NONLINEAR_FIELDS.includes(key))) return 'linear'
  if (changed.some((key) => OPTIMIZER_FIELDS.includes(key))) return 'optimization'
  return 'hb'
}

export function affectedSourceStage(current: SourceSpec, next: SourceSpec): StageId | null {
  const linearFields: (keyof SourceSpec)[] = [
    'port', 'isDc', 'frequency', 'linearAmplitude', 'linearAmplitudeUnit', 'impedanceOhm', 'extras',
  ]
  const nonlinearFields: (keyof SourceSpec)[] = ['nonlinearAmplitude', 'nonlinearAmplitudeUnit']
  const changed = (key: keyof SourceSpec) => JSON.stringify(current[key]) !== JSON.stringify(next[key])
  if (linearFields.some(changed)) return 'linear'
  if (nonlinearFields.some(changed)) return 'hb'
  return null
}
