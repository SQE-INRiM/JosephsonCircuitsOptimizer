import type { ResultTable } from '../types'

export type OptimizerSample = {
  evaluation: number
  metric: number
  values: Record<string, number>
}

export interface LinearSlice {
  x: number[]
  y: number[]
  values: Array<Array<number | null>>
}

export function optimizerParameterNames(table: ResultTable): string[] {
  const evaluation = table.columns.indexOf('evaluation')
  const metric = table.columns.indexOf('metric')
  if (metric < 0) return []
  return table.columns.slice(evaluation >= 0 ? evaluation + 1 : 0, metric)
    .filter((column) => column !== 'point_id' && column !== 'converged')
}

export function optimizerSamples(table: ResultTable): OptimizerSample[] {
  const metric = table.columns.indexOf('metric')
  const evaluation = table.columns.indexOf('evaluation')
  const names = optimizerParameterNames(table)
  if (metric < 0) return []
  return table.rows.map((row, index) => ({
    evaluation: evaluation >= 0 ? Number(row[evaluation]) : index + 1,
    metric: Number(row[metric]),
    values: Object.fromEntries(names.map((name) => [name, Number(row[table.columns.indexOf(name)])])),
  })).filter((sample) => Number.isFinite(sample.metric) && Number.isFinite(sample.evaluation))
    .sort((a, b) => a.evaluation - b.evaluation)
}

export function bestSample(samples: OptimizerSample[]): OptimizerSample | null {
  return samples.reduce<OptimizerSample | null>((best, sample) => !best || sample.metric < best.metric ? sample : best, null)
}

export function runningBest(samples: OptimizerSample[]): number[] {
  let minimum = Number.POSITIVE_INFINITY
  return samples.map((sample) => {
    minimum = Math.min(minimum, sample.metric)
    return minimum
  })
}

// Preserve the evaluation timeline but do not let masked objective penalties
// (the >= 1e8 sentinel) determine the History plot's vertical scale.
export function objectiveHistoryForPlot(samples: OptimizerSample[]): { evaluated: Array<number | null>; bestSoFar: Array<number | null> } {
  let best: number | null = null
  const evaluated = samples.map((sample) => Number.isFinite(sample.metric) && sample.metric < 1e8 ? sample.metric : null)
  const bestSoFar = evaluated.map((metric) => {
    if (metric !== null) best = best === null ? metric : Math.min(best, metric)
    return best
  })
  return { evaluated, bestSoFar }
}

export function storedValues(table: ResultTable, name: string): number[] {
  const index = table.columns.indexOf(name)
  if (index < 0) return []
  return [...new Set(table.rows.map((row) => Number(row[index])).filter(Number.isFinite))]
    .sort((a, b) => a - b)
}

export function nearestStoredValue(options: number[], target: number | undefined): number | undefined {
  if (!options.length) return undefined
  if (target == null || !Number.isFinite(target)) return options[0]
  return options.reduce((nearest, value) => Math.abs(value - target) < Math.abs(nearest - target) ? value : nearest, options[0])
}

// A small *relative* tolerance avoids treating different femto/pico-scale
// physical parameters as equal while accommodating floating-point roundoff.
export function sameCoordinate(a: number, b: number): boolean {
  return Number.isFinite(a) && Number.isFinite(b)
    && Math.abs(a - b) <= 1e-10 * Math.max(Math.abs(a), Math.abs(b), 1e-15)
}

export function sampleOnSlice(sample: OptimizerSample, fixed: Record<string, number>): boolean {
  return Object.entries(fixed).every(([name, value]) => sameCoordinate(sample.values[name], value))
}

// Match Linear Results: exact stored slices, masked cells left blank and no
// interpolation or averaging over dimensions that are not on the axes.
export function linearObjectiveSlice(table: ResultTable, xName: string, yName: string, fixed: Record<string, number>): LinearSlice {
  const ix = table.columns.indexOf(xName)
  const iy = table.columns.indexOf(yName)
  const im = table.columns.indexOf('metric')
  const ip = table.columns.indexOf('point_id')
  if (ix < 0 || iy < 0 || im < 0 || ix === iy) return { x: [], y: [], values: [] }

  const fixedIndices = Object.entries(fixed).map(([name, value]) => ({ index: table.columns.indexOf(name), value }))
  if (fixedIndices.some(({ index }) => index < 0)) return { x: [], y: [], values: [] }
  const rows = table.rows.map((row) => row.map(Number))
    .filter((row) => Number.isFinite(row[ix]) && Number.isFinite(row[iy])
      && fixedIndices.every(({ index, value }) => sameCoordinate(row[index], value)))

  const x = [...new Set(rows.map((row) => row[ix]))].sort((a, b) => a - b)
  const y = [...new Set(rows.map((row) => row[iy]))].sort((a, b) => a - b)
  const byCoordinate = new Map(rows.map((row) => [String(row[ix]) + '|' + String(row[iy]), row]))
  const retainedIds = ip >= 0 && table.filteredRows
    ? new Set(table.filteredRows.map((row) => Number(row[ip]))) : null

  const values = y.map((yv) => x.map((xv) => {
    const row = byCoordinate.get(String(xv) + '|' + String(yv))
    if (!row || !Number.isFinite(row[im])) return null
    if (retainedIds && !retainedIds.has(row[ip])) return null
    if (row[im] >= 1e8) return null
    return row[im]
  }))
  return { x, y, values }
}
