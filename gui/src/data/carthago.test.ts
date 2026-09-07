import { describe, expect, it } from 'vitest'
import {
  correlationLabels,
  correlationMatrix,
  gainTrace,
  initialStages,
  linearCgValues,
  linearI0Values,
  linearMetric,
} from './carthago'

describe('Carthago preview dataset', () => {
  it('keeps heatmap axes and matrices aligned', () => {
    expect(linearMetric).toHaveLength(linearCgValues.length)
    expect(linearMetric.every((row) => row.length === linearI0Values.length)).toBe(true)
    expect(correlationMatrix).toHaveLength(correlationLabels.length)
    expect(correlationMatrix.every((row) => row.length === correlationLabels.length)).toBe(true)
  })

  it('creates an ordered, frequency-resolved gain trace', () => {
    const trace = gainTrace(1.122)
    expect(trace.x).toHaveLength(trace.y.length)
    expect(trace.x[0]).toBe(5)
    expect(trace.x.at(-1)).toBe(9)
    expect(trace.x.every((value, index) => index === 0 || value > trace.x[index - 1])).toBe(true)
  })

  it('marks optimization as skipped for the fixed single-point input', () => {
    expect(initialStages.find((stage) => stage.id === 'optimization')?.status).toBe('skipped')
    expect(initialStages.find((stage) => stage.id === 'hb')?.status).toBe('ready')
  })
})

