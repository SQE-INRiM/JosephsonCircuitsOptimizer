// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ResultTable, RunResults } from '../types'
import { OptimizationResultsView } from './OptimizationResultsView'

vi.mock('@mui/x-charts/LineChart', () => ({
  LineChart: ({ series }: { series: Array<{ label: string }> }) =>
    <div data-testid="optimizer-history-chart" data-series={series.map((item) => item.label).join(',')} />,
}))

const optimization: ResultTable = {
  file: 'df_optimization_analysis.h5',
  columns: ['evaluation', 'I0', 'Cg', 'Ladd', 'metric'],
  rows: [
    [1, 1e-6, 200e-15, 70e-12, -8],
    [2, 1.5e-6, 250e-15, 75e-12, -9],
    [3, 2e-6, 300e-15, 70e-12, -12],
  ],
}
const linear: ResultTable = {
  file: 'df_uniform_analysis.h5',
  columns: ['point_id', 'I0', 'Cg', 'Ladd', 'metric'],
  rows: [
    [1, 1e-6, 200e-15, 70e-12, -6],
    [2, 2e-6, 200e-15, 70e-12, -7],
    [3, 1e-6, 300e-15, 70e-12, -11],
    [4, 2e-6, 300e-15, 70e-12, -12],
    [5, 1e-6, 200e-15, 75e-12, -3],
    [6, 2e-6, 200e-15, 75e-12, -4],
    [7, 1e-6, 300e-15, 75e-12, -5],
    [8, 2e-6, 300e-15, 75e-12, -6],
  ],
}
function run(withLinear = true): RunResults {
  return { id: 'run-opt', traces: [], optimization, linear: withLinear ? linear : null }
}

describe('Optimization Results unified dashboard', () => {
  afterEach(() => cleanup())

  it('shows the landscape, evaluated objective, running best and all parameter charts together', () => {
    render(<OptimizationResultsView run={run()} table={optimization} />)
    expect(screen.getByRole('heading', { name: 'Optimization landscape' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Best sampled objective' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Parameter history' })).toBeTruthy()
    const charts = screen.getAllByTestId('optimizer-history-chart')
    expect(charts).toHaveLength(4)
    expect(charts[0].getAttribute('data-series')).toBe('Evaluated objective,Best so far')
    expect(charts.slice(1).map((chart) => chart.getAttribute('data-series'))).toEqual(['I0', 'Cg', 'Ladd'])
    expect(screen.queryByRole('button', { name: 'Parameter history' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Best objective' })).toBeNull()
  })

  it('shows a valid exact Linear slice and identifies optimizer evaluations outside that slice', () => {
    render(<OptimizationResultsView run={run()} table={optimization} />)
    expect((screen.getByRole('button', { name: 'Slice · Linear' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText(/Exact stored Linear metric cells/)).toBeTruthy()
    expect(screen.getByRole('slider', { name: 'Evaluations shown' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Evaluation 2, objective/ }))
    expect(screen.getByText(/Selected evaluation 2/)).toBeTruthy()
    expect(screen.getByText('Projected (off slice)')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Projection' }))
    expect(screen.getByText(/no surrogate surface is assumed/)).toBeTruthy()
  })

  it('keeps objective and parameter histories available in runs without a Linear table', () => {
    render(<OptimizationResultsView run={run(false)} table={optimization} />)
    expect((screen.getByRole('button', { name: 'Slice · Linear' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/compatible two-parameter Linear grid is unavailable/)).toBeTruthy()
    expect(screen.getAllByTestId('optimizer-history-chart')).toHaveLength(4)
  })

  it('includes constant parameter columns in the plotted histories', () => {
    const constant: ResultTable = { ...optimization, rows: optimization.rows.map((row) => [row[0], row[1], row[2], 70e-12, row[4]]) }
    render(<OptimizationResultsView run={{ ...run(false), optimization: constant }} table={constant} />)
    expect(screen.getAllByTestId('optimizer-history-chart')).toHaveLength(4)
    expect(screen.getByRole('heading', { name: 'Ladd' })).toBeTruthy()
  })
})
