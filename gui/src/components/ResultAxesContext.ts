import { createContext } from 'react'
import type { ResultTable } from '../types'

/** Axis choices are scoped to a single stored run and feedback cycle. */
export type ResultAxesPair = { x: string; y: string }
export type ResultsAxesValue = {
  linear?: ResultAxesPair
  optimization?: ResultAxesPair
  onChange: (stage: 'linear' | 'optimization', axes: ResultAxesPair) => void
}

export const ResultsAxesContext = createContext<ResultsAxesValue | null>(null)

/** Use requested axes when both exist, but never repeat a coordinate on X and Y. */
export function preferredResultAxes(
  names: string[],
  defaults: ResultAxesPair,
  preferred?: ResultAxesPair,
): ResultAxesPair {
  const choose = (candidates: Array<string | undefined>, exclude?: string) =>
    candidates.find((candidate) => candidate && candidate !== exclude && names.includes(candidate)) ?? ''
  const x = choose([preferred?.x, defaults.x, ...names])
  const y = choose([preferred?.y, defaults.y, ...names], x)
  return { x, y }
}


/** The first Linear landscape axes, even when the Linear tab has not been opened.
 * Use the exact same selection rule in Linear and Optimization.
 *
 * A one-point optimizer history must not determine the initial XY ordering:
 * it may have no varying parameters although the uniform Linear grid does.
 */
export function initialLinearResultAxes(table: ResultTable, preferred?: ResultAxesPair): ResultAxesPair {
  const pointIndex = table.columns.indexOf('point_id')
  const evaluationIndex = table.columns.indexOf('evaluation')
  const metricIndex = table.columns.indexOf('metric')
  const start = pointIndex >= 0 ? pointIndex + 1 : evaluationIndex >= 0 ? evaluationIndex + 1 : 0
  const stop = metricIndex > start ? metricIndex : table.columns.length
  const parameters = table.columns.slice(start, stop)
  const varying = parameters.filter((name) => {
    const index = table.columns.indexOf(name)
    const values = new Set(table.rows.map((row) => Number(row[index])).filter(Number.isFinite))
    return values.size > 1
  })
  return preferredResultAxes(
    varying.length >= 2 ? varying : parameters,
    { x: varying[0] ?? parameters[0] ?? '', y: varying[1] ?? varying[0] ?? parameters[1] ?? parameters[0] ?? '' },
    preferred,
  )
}
