import { describe, expect, it } from 'vitest'
import type { ResultTable } from '../types'
import { buildHbGrid } from './EnhancedStageResults'

const hbTable: ResultTable = {
  file: 'df_nonlinear_analysis.h5',
  columns: ['point_id', 'source_1_frequency', 'source_1_amplitude', 'source_2_frequency', 'source_2_amplitude', 'performance', 'delta_quantity', 'converged'],
  rows: [
    [1, 8e9, 1e-6, 0, 2e-6, 10, 1, 1],
    [2, 8e9, 2e-6, 0, 2e-6, 20, 2, 1],
    [3, 9e9, 1e-6, 0, 2e-6, 30, 3, 0],
    [4, 9e9, 2e-6, 0, 2e-6, 40, 4, 1],
    [5, 8e9, 1e-6, 0, 3e-6, 50, 5, 1],
    [6, 8e9, 2e-6, 0, 3e-6, 60, 6, 1],
  ],
}

describe('Harmonic Balance Results helpers', () => {
  it('builds an exact source-space slice without averaging hidden coordinates', () => {
    const grid = buildHbGrid(hbTable, 'source_1_frequency', 'source_1_amplitude', 'performance', { source_2_frequency: 0, source_2_amplitude: 2e-6 }, 'all')
    expect(grid.x).toEqual([8e9, 9e9])
    expect(grid.y).toEqual([1e-6, 2e-6])
    expect(grid.values).toEqual([[10, 30], [20, 40]])
    expect(grid.pointIds).toEqual([[1, 3], [2, 4]])
  })

  it('filters the same slice by convergence status', () => {
    const converged = buildHbGrid(hbTable, 'source_1_frequency', 'source_1_amplitude', 'performance', { source_2_frequency: 0, source_2_amplitude: 2e-6 }, 'converged')
    expect(converged.values).toEqual([[10, null], [20, 40]])
    const failed = buildHbGrid(hbTable, 'source_1_frequency', 'source_1_amplitude', 'performance', { source_2_frequency: 0, source_2_amplitude: 2e-6 }, 'nonconverged')
    expect(failed.x).toEqual([9e9])
    expect(failed.y).toEqual([1e-6])
    expect(failed.values).toEqual([[30]])
    expect(failed.pointIds).toEqual([[3]])
  })
})
