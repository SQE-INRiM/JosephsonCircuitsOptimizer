// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResultsBundle, RunResults, SavedTraceData } from '../types'
import { HarmonicBalanceResultsNormalized } from './HarmonicBalanceResultsNormalized'

const readSavedTrace = vi.hoisted(() => vi.fn())
const exportPlotCsv = vi.hoisted(() => vi.fn())
vi.mock('../services/jcoAdapter', () => ({
  getJcoAdapter: () => ({ readSavedTrace }),
}))
vi.mock('../utils/plotCsv', () => ({ exportPlotCsv }))
vi.mock('@mui/x-charts/LineChart', () => ({
  LineChart: ({ series }: { series: Array<{ label: string }> }) =>
    <div data-testid="saved-trace-chart">{series.map((item) => item.label).join(' | ')}</div>,
}))
vi.mock('./HeatmapGrid', () => ({
  HeatmapGrid: ({ onCellClick }: { onCellClick: (row: number, col: number) => void }) =>
    <button onClick={() => onCellClick(0, 0)}>Choose first point</button>,
}))

const run: RunResults = {
  id: 'hb-run', traces: [],
  nonlinear: {
    file: 'hb.h5',
    columns: ['point_id', 'source_1_frequency', 'source_1_amplitude', 'performance', 'delta_quantity', 'converged'],
    rows: [
      [1, 7, 1e-6, 20, 1, 1],
      [2, 7, 2e-6, 22, 2, 1],
    ],
  },
  savedNonlinear: {
    schemaVersion: '1', stage: 'nonlinear',
    points: [1, 2].map((pointId) => ({
      pointId, parameters: { I0: 2e-6 },
      quantities: [{ name: 's21', quantityName: 'S21', prefix: 's21', arrays: [
        { name: 'S21', storage: 'array', length: 3 },
      ] }],
    })),
  },
}
const results: ResultsBundle = { schemaVersion: '1', workspace: '', runs: [run] }
const savedTrace: SavedTraceData = {
  runId: 'hb-run', stage: 'nonlinear', pointId: 1, quantityName: 'S21',
  arrayName: 'S21', storage: 'array',
  x: [5e9, 6e9, 7e9], xKind: 'frequency_hz', xLabel: 'Frequency',
  magnitude: [10, 20, 30], real: [1, 2, 3], imag: [4, 5, 6], phaseRad: [0.1, 0.2, 0.3],
}

describe('HB single-point plot CSV', () => {
  beforeEach(() => {
    readSavedTrace.mockReset()
    exportPlotCsv.mockReset()
    readSavedTrace.mockResolvedValue(savedTrace)
  })
  afterEach(() => cleanup())

  it('exports the selected retained-array component at its original Hz samples', async () => {
    render(<HarmonicBalanceResultsNormalized results={results} unitByRun={{ 'hb-run': { 1: 'A' } }} />)
    const add = await screen.findByRole('button', { name: /S21 · 3 pts · Add to plot/ })
    fireEvent.click(add)
    const exportButton = await screen.findByRole('button', { name: 'Export CSV' })
    fireEvent.click(exportButton)
    expect(exportPlotCsv).toHaveBeenCalledWith({
      x: [5e9, 6e9, 7e9],
      xLabel: 'frequency_hz',
      series: [{ label: 'S21 (magnitude)', values: [10, 20, 30] }],
    }, 'hb-run_hb_point_1_frequency_hz')
  })

  it('exports the plotted amplitude-response metrics with their displayed source units', async () => {
    render(<HarmonicBalanceResultsNormalized results={results} unitByRun={{ 'hb-run': { 1: 'A' } }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Amplitude response' }))
    const buttons = screen.getAllByRole('button', { name: 'Export CSV' })
    expect(buttons).toHaveLength(2)
    fireEvent.click(buttons[0])
    expect(exportPlotCsv).toHaveBeenCalledWith({
      x: [1e-6, 2e-6],
      xLabel: 'source_1_amplitude / A',
      series: [{ label: 'performance', values: [20, 22] }],
    }, 'hb-run_hb_response_performance_source_1_amplitude')
  })
})
