import { describe, expect, it } from 'vitest'
import type { ResultTable } from '../types'
import {
  bestSample, linearObjectiveSlice, nearestStoredValue, optimizerParameterNames,
  optimizerSamples, runningBest, sampleOnSlice, sameCoordinate, storedValues,
} from './optimizationLandscape'

const optimization: ResultTable = {
  file: 'optimization.h5',
  columns: ['evaluation', 'I0', 'Cg', 'Ladd', 'metric'],
  rows: [
    [3, 1.1e-6, 300e-15, 70e-12, -12],
    [1, 1.4e-6, 200e-15, 70e-12, -8],
    [2, 1.2e-6, 250e-15, 75e-12, -10],
  ],
}
const linear: ResultTable = {
  file: 'uniform.h5',
  columns: ['point_id', 'I0', 'Cg', 'Ladd', 'metric'],
  rows: [
    [1, 1e-6, 200e-15, 70e-12, -3],
    [2, 2e-6, 200e-15, 70e-12, -7],
    [3, 1e-6, 300e-15, 70e-12, -9],
    [4, 2e-6, 300e-15, 70e-12, 1e8],
    [5, 1e-6, 200e-15, 75e-12, -1],
    [6, 2e-6, 200e-15, 75e-12, -2],
    [7, 1e-6, 300e-15, 75e-12, -3],
    [8, 2e-6, 300e-15, 75e-12, -4],
  ],
}

describe('Optimization landscape semantics', () => {
  it('retains optimizer ordering, all parameter coordinates and the running minimum', () => {
    expect(optimizerParameterNames(optimization)).toEqual(['I0', 'Cg', 'Ladd'])
    const history = optimizerSamples(optimization)
    expect(history.map((sample) => sample.evaluation)).toEqual([1, 2, 3])
    expect(history.map((sample) => sample.metric)).toEqual([-8, -10, -12])
    expect(history[1].values).toEqual({ I0: 1.2e-6, Cg: 250e-15, Ladd: 75e-12 })
    expect(bestSample(history)?.evaluation).toBe(3)
    expect(runningBest(history)).toEqual([-8, -10, -12])
  })

  it('represents a non-monotone search with plateaus in running best', () => {
    const history = optimizerSamples({
      ...optimization,
      rows: [[1, 1, 2, 3, -3], [2, 1, 2, 3, 2], [3, 1, 2, 3, -5]],
    })
    expect(runningBest(history)).toEqual([-3, -3, -5])
  })

  it('constructs a true Linear slice, rather than projecting or averaging over Ladd', () => {
    const first = linearObjectiveSlice(linear, 'I0', 'Cg', { Ladd: 70e-12 })
    expect(first.x).toEqual([1e-6, 2e-6])
    expect(first.y).toEqual([200e-15, 300e-15])
    expect(first.values).toEqual([[-3, -7], [-9, null]])

    const second = linearObjectiveSlice(linear, 'I0', 'Cg', { Ladd: 75e-12 })
    expect(second.values).toEqual([[-1, -2], [-3, -4]])
  })

  it('honors persisted filtered Linear rows instead of displaying masked metrics', () => {
    const grid = linearObjectiveSlice({ ...linear, filteredRows: linear.rows.filter((row) => row[0] !== 2) }, 'I0', 'Cg', { Ladd: 70e-12 })
    expect(grid.values).toEqual([[-3, null], [-9, null]])
  })

  it('distinguishes tiny-scale fixed coordinates without 1e-9 absolute tolerance', () => {
    expect(sameCoordinate(70e-12, 70e-12 * (1 + 1e-12))).toBe(true)
    expect(sameCoordinate(70e-12, 75e-12)).toBe(false)
    const samples = optimizerSamples(optimization)
    expect(sampleOnSlice(samples[0], { Ladd: 70e-12 })).toBe(true)
    expect(sampleOnSlice(samples[1], { Ladd: 70e-12 })).toBe(false)
  })

  it('chooses nearest available Linear slice values to the final best optimizer sample', () => {
    const values = storedValues(linear, 'Cg')
    expect(values).toEqual([200e-15, 300e-15])
    expect(nearestStoredValue(values, 240e-15)).toBe(200e-15)
    expect(nearestStoredValue(values, 280e-15)).toBe(300e-15)
  })

  it('avoids inventing a slice when a requested fixed coordinate is absent', () => {
    expect(linearObjectiveSlice(linear, 'I0', 'Cg', { unknown: 1 })).toEqual({ x: [], y: [], values: [] })
  })
})
