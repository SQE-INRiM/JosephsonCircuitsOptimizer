import { describe, expect, it } from 'vitest'
import type { ResultTable } from '../types'
import { correlationDimensions, formatChartNumber, linearGrid, pearsonCorrelation, weightedDensityProfiles } from './ConnectedResultsCompact'

const uniformTable: ResultTable = {
  file: 'uniform.h5',
  columns: ['point_id', 'p1', 'p2', 'metric'],
  rows: [
    [1, 0, 10, -10],
    [2, 0, 20, -6],
    [3, 1, 10, -4],
    [4, 1, 20, -2],
  ],
}

const slicedTable: ResultTable = {
  file: 'uniform_3d.h5',
  columns: ['point_id', 'p1', 'p2', 'p3', 'metric', 'ripple'],
  rows: [
    [1, 0, 10, 100, -10, 1.0],
    [2, 0, 20, 100, -8, 1.1],
    [3, 1, 10, 100, -6, 1.2],
    [4, 1, 20, 100, -4, 1.3],
    [5, 0, 10, 200, -3, 2.0],
    [6, 0, 20, 200, -2, 2.1],
    [7, 1, 10, 200, -1, 2.2],
    [8, 1, 20, 200, 0, 2.3],
  ],
}

describe('compact Results analysis helpers', () => {
  it('keeps JCO count / mean(metric) density weighting for the uniform table', () => {
    const [profile] = weightedDensityProfiles(uniformTable, ['p1'], 'metric')
    expect(profile.values).toEqual([0, 1])
    expect(profile.counts).toEqual([2, 2])
    expect(profile.means).toEqual([-8, -3])
    expect(profile.weights[0]).toBeCloseTo(-0.25)
    expect(profile.weights[1]).toBeCloseTo(-2 / 3)
  })

  it('normalizes negative-metric density weights into a bounded 0-1 scale', () => {
    const [profile] = weightedDensityProfiles(uniformTable, ['p1'], 'metric')
    expect(profile.normalized.every((value) => value >= 0 && value <= 1)).toBe(true)
    expect(profile.normalized[0]).toBe(1)
    expect(profile.normalized[1]).toBe(0)
  })

  it('retains sample-count contribution when values are repeated', () => {
    const repeated: ResultTable = {
      ...uniformTable,
      rows: [...uniformTable.rows, [5, 1, 20, -2]],
    }
    const [profile] = weightedDensityProfiles(repeated, ['p1'], 'metric')
    expect(profile.counts).toEqual([2, 3])
    expect(profile.means[0]).toBe(-8)
    expect(profile.means[1]).toBeCloseTo(-8 / 3)
    expect(profile.weights[1]).toBeCloseTo(-1.125)
    expect(profile.normalized.every((value) => value >= 0 && value <= 1)).toBe(true)
  })

  it('slices a higher-dimensional Linear table by exact fixed parameter values', () => {
    const grid = linearGrid(slicedTable, 'p1', 'p2', 'metric', new Set<number>(), { p3: 200 })
    expect(grid.x).toEqual([0, 1])
    expect(grid.y).toEqual([10, 20])
    expect(grid.values).toEqual([[-3, -1], [-2, 0]])
    expect(grid.pointIds).toEqual([[5, 7], [6, 8]])
  })

  it('shows parameters only by default and all metrics when requested', () => {
    expect(correlationDimensions(slicedTable, ['p1', 'p2', 'p3'], false)).toEqual(['p1', 'p2', 'p3'])
    expect(correlationDimensions(slicedTable, ['p1', 'p2', 'p3'], true)).toEqual(['p1', 'p2', 'p3', 'metric', 'ripple'])
  })

  it('can include metrics as correlation dimensions', () => {
    const correlation = pearsonCorrelation(slicedTable, correlationDimensions(slicedTable, ['p1', 'p2', 'p3'], true))
    expect(correlation.columns).toEqual(['p1', 'p2', 'p3', 'metric', 'ripple'])
    expect(correlation.matrix).toHaveLength(5)
    expect(correlation.matrix.every((row) => row.length === 5)).toBe(true)
    expect(correlation.matrix[0][0]).toBe(1)
    expect(correlation.matrix[4][4]).toBe(1)
  })

  it('formats tiny nonzero chart values in scientific notation instead of zero', () => {
    expect(formatChartNumber(1.7e-13)).toBe('1.7000e-13')
    expect(formatChartNumber(-2.4e-7)).toBe('-2.4000e-7')
    expect(formatChartNumber(-10.25)).toBe('-10.25')
    expect(formatChartNumber(0)).toBe('0')
  })
})
