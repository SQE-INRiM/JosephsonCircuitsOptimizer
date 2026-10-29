// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResultTable, RunResults, SavedTraceData } from '../types'
import {
  PointComparisonPanel, PointSelectionControls, sameTraceAxis, updateComparisonSelection,
} from './PointComparison'

const readSavedTrace = vi.hoisted(() => vi.fn())
vi.mock('../services/jcoAdapter', () => ({
  getJcoAdapter: () => ({ readSavedTrace }),
}))
vi.mock('@mui/x-charts/LineChart', () => ({
  LineChart: ({ series }: { series: Array<{ label: string }> }) =>
    <div data-testid="overlay-chart">{series.map((item) => item.label).join(' | ')}</div>,
}))

const table: ResultTable = {
  columns: ['point_id', 'I0', 'Cg', 'metric'],
  rows: [[1, 1.5e-6, 250e-15, -21], [2, 2e-6, 350e-15, -18]],
  file: 'linear.csv',
}
const hbTable: ResultTable = {
  columns: ['point_id', 'source_1_frequency', 'source_1_amplitude', 'performance', 'converged'],
  rows: [[1, 7, 1e-6, 22, 1], [2, 8, 2e-6, 19, 1]],
  file: 'nonlinear.csv',
}
const catalog = (stage: string) => ({
  schemaVersion: '1', stage,
  points: [1, 2].map((pointId) => ({
    pointId, parameters: { I0: pointId * 1e-6 },
    quantities: [{
      name: 's21', quantityName: 'S21', prefix: 's21',
      arrays: [{ name: 'S21', storage: 'array', length: 3 }],
    }],
  })),
})
const run: RunResults = {
  id: 'run-demo', traces: [],
  savedLinear: catalog('linear'),
  savedNonlinear: catalog('nonlinear'),
}
const trace = (pointId: number, stage: string, x: number[] = [5e9, 6e9, 7e9]): SavedTraceData => ({
  runId: run.id, stage, pointId, quantityName: 'S21', arrayName: 'S21',
  storage: 'array', x, xKind: 'frequency_hz', xLabel: 'Frequency',
  values: [pointId, pointId + 1, pointId + 2],
})

describe('A/B selection', () => {
  afterEach(() => cleanup())

  it('selects up to two points, replaces B, and toggles off existing selections', () => {
    expect(updateComparisonSelection([], 5)).toEqual([5])
    expect(updateComparisonSelection([5], 9)).toEqual([5, 9])
    expect(updateComparisonSelection([5, 9], 12)).toEqual([5, 12])
    expect(updateComparisonSelection([5, 9], 5)).toEqual([9])
    expect(updateComparisonSelection([5, 9], 9)).toEqual([5])
  })

  it('provides a visible Single/Compare control and shows selected labels', () => {
    const onModeChange = vi.fn()
    render(<PointSelectionControls mode="single" onModeChange={onModeChange} pointIds={[]} onClear={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Compare A/B' }))
    expect(onModeChange).toHaveBeenCalledWith('compare')
  })

  it('requires the exact physical X samples for overlays', () => {
    expect(sameTraceAxis(trace(1, 'linear'), trace(2, 'linear'))).toBe(true)
    expect(sameTraceAxis(trace(1, 'linear'), trace(2, 'linear', [5e9, 6.1e9, 7e9]))).toBe(false)
    expect(sameTraceAxis(trace(1, 'linear'), { ...trace(2, 'linear'), xKind: 'index' })).toBe(false)
  })
})

describe('shared A/B result inspector', () => {
  beforeEach(() => {
    readSavedTrace.mockReset()
    readSavedTrace.mockImplementation(async ({ stage, pointId }: { stage: string; pointId: number }) =>
      trace(pointId, stage))
  })
  afterEach(() => cleanup())

  it.each([
    { stage: 'linear' as const, resultTable: table },
    { stage: 'nonlinear' as const, resultTable: hbTable },
  ])('loads the same retained array for both $stage points and overlays their curves', async ({ stage, resultTable }) => {
    render(<PointComparisonPanel run={run} table={resultTable} stage={stage} pointIds={[1, 2]} />)
    expect(screen.getByRole('table', { name: 'Point A/B comparison' })).toBeTruthy()
    expect(screen.getByText('Δ (B − A)')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'S21' }))
    await waitFor(() => expect(screen.getByTestId('overlay-chart').textContent).toContain('A · Point 1 | B · Point 2'))
    expect(readSavedTrace).toHaveBeenCalledTimes(2)
    expect(readSavedTrace).toHaveBeenCalledWith(expect.objectContaining({ runId: 'run-demo', stage, pointId: 1 }))
    expect(readSavedTrace).toHaveBeenCalledWith(expect.objectContaining({ runId: 'run-demo', stage, pointId: 2 }))
  })

  it('refuses to overlay mismatched frequency grids without resampling', async () => {
    readSavedTrace.mockImplementation(async ({ stage, pointId }: { stage: string; pointId: number }) =>
      trace(pointId, stage, pointId === 1 ? [5e9, 6e9, 7e9] : [5e9, 6.1e9, 7e9]))
    render(<PointComparisonPanel run={run} table={table} stage="linear" pointIds={[1, 2]} />)
    fireEvent.click(screen.getByRole('button', { name: 'S21' }))
    await waitFor(() => expect(screen.getByText(/different X samples/)).toBeTruthy())
    expect(screen.queryByTestId('overlay-chart')).toBeNull()
  })

  it('does not try to read retained arrays before B is selected', () => {
    render(<PointComparisonPanel run={run} table={table} stage="linear" pointIds={[1]} />)
    expect(screen.getByText(/Select Point B/)).toBeTruthy()
    expect(readSavedTrace).not.toHaveBeenCalled()
  })
})
