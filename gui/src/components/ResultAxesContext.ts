import { createContext } from 'react'

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
