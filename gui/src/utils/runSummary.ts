import type { ParameterSpec, ProjectModel, SourceValueSpec, StageId } from '../types'

type SweepSpec = Pick<ParameterSpec, 'mode' | 'value' | 'start' | 'stop' | 'step' | 'values'> | SourceValueSpec

function numericListCount(values?: string): number | null {
  if (!values?.trim()) return null
  const parsed = values.split(',').map((value) => Number(value.trim())).filter(Number.isFinite)
  return parsed.length || null
}

export function sweepValueCount(spec: SweepSpec): number | null {
  if (spec.mode === 'Fixed') return Number.isFinite(Number(spec.value)) ? 1 : null
  if (spec.mode === 'List') return numericListCount(spec.values)
  const start = Number(spec.start)
  const stop = Number(spec.stop)
  const step = Number(spec.step)
  if (![start, stop, step].every(Number.isFinite) || step === 0) return null
  const span = stop - start
  if (span === 0) return 1
  if (Math.sign(span) !== Math.sign(step)) return null
  return Math.floor(Math.abs(span / step) + 1e-10) + 1
}

function productCounts(counts: Array<number | null>): number | null {
  if (counts.some((count) => count == null)) return null
  return counts.reduce<number>((product, count) => product * (count ?? 1), 1)
}

export function linearPointCount(project: ProjectModel): number | null {
  return productCounts(project.parameters.map(sweepValueCount))
}

export function harmonicBalancePointCount(project: ProjectModel): number | null {
  return productCounts(project.sources.flatMap((source) => [sweepValueCount(source.frequency), sweepValueCount(source.nonlinearAmplitude)]))
}

export function hasVaryingDeviceParameters(project: ProjectModel): boolean {
  return project.parameters.some((parameter) => parameter.mode !== 'Fixed' && (sweepValueCount(parameter) ?? 0) > 1)
}

export function configuredStageSummary(project: ProjectModel, stage: StageId): string {
  if (stage === 'linear') {
    const count = linearPointCount(project)
    return count == null ? 'Configured device-parameter sweep' : `${count.toLocaleString()} configured device ${count === 1 ? 'configuration' : 'configurations'}`
  }
  if (stage === 'optimization') {
    if (!hasVaryingDeviceParameters(project)) return 'Skipped — no varying device parameters'
    const { optimizerIterations, samplesPerIteration } = project.computation
    return `${optimizerIterations.toLocaleString()} iterations · ${samplesPerIteration.toLocaleString()} samples / iteration`
  }
  const count = harmonicBalancePointCount(project)
  return count == null ? 'Configured nonlinear source sweep' : `${count.toLocaleString()} configured source ${count === 1 ? 'point' : 'points'}`
}
