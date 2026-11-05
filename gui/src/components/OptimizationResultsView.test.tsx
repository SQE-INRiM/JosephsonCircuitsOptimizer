// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ResultTable, RunResults } from '../types'
import { OptimizationResultsView } from './OptimizationResultsView'
import { ResultsAxesContext } from './ResultAxesContext'

vi.mock('@mui/x-charts/LineChart', () => ({
  LineChart: ({ series, height }: { series: Array<{ label: string }>; height: number }) =>
    <div data-testid="optimizer-history-chart" data-height={height} data-series={series.map((item) => item.label).join(',')} />,
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

describe('Optimization Results landscape and history views', () => {
  afterEach(() => cleanup())

  it('separates Landscape from History and puts objective before every parameter chart', () => {
    render(<OptimizationResultsView run={run()} table={optimization} />)
    expect(screen.getByRole('heading', { name: 'Optimization landscape' })).toBeTruthy()
    expect(screen.getByText('3 evaluations')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Objective' })).toBeNull()
    expect(screen.queryAllByTestId('optimizer-history-chart')).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    expect(screen.queryByRole('heading', { name: 'Optimization landscape' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Objective' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Parameters' })).toBeTruthy()
    const charts = screen.getAllByTestId('optimizer-history-chart')
    expect(charts).toHaveLength(4)
    expect(charts[0].getAttribute('data-series')).toBe('Evaluated objective,Best so far')
    expect(charts.slice(1).map((chart) => chart.getAttribute('data-series'))).toEqual(['I0', 'Cg', 'Ladd'])
    expect(charts.map((chart) => Number(chart.getAttribute('data-height')))).toEqual([290, 215, 215, 215])

    fireEvent.click(screen.getByRole('button', { name: 'Landscape' }))
    expect(screen.getByRole('heading', { name: 'Optimization landscape' })).toBeTruthy()
    expect(screen.queryAllByTestId('optimizer-history-chart')).toHaveLength(0)
  })

  it('shows a valid exact Linear slice and identifies optimizer evaluations outside that slice', () => {
    render(<OptimizationResultsView run={run()} table={optimization} />)
    expect((screen.getByRole('button', { name: 'Slice · Linear' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText(/Pale: off-slice/)).toBeTruthy()
    expect(screen.getByTestId('optimizer-trajectory')).toBeTruthy()
    expect(screen.getByTestId('linear-slice-minimum')).toBeTruthy()
    expect(screen.getByText('◆ Linear slice min')).toBeTruthy()
    expect(screen.queryByText('Start')).toBeNull()
    expect(screen.queryByText('Latest')).toBeNull()
    expect(screen.getByText(/Evaluation order/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Trajectory' }))
    expect(screen.queryByTestId('optimizer-trajectory')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Trajectory' }))
    expect(screen.getByTestId('optimizer-trajectory')).toBeTruthy()
    expect(screen.getByRole('slider', { name: 'Evaluations shown' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Evaluation 2, objective/ }))
    expect(screen.getByText(/Selected evaluation 2/)).toBeTruthy()
    expect(screen.getByText('Projected (off slice)')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Projection' }))
    expect(screen.getByRole('button', { name: 'Projection' }).getAttribute('class')).toContain('contained')
    expect(screen.queryByTestId('linear-slice-minimum')).toBeNull()
  })

  it('inherits Linear axes but keeps Optimization edits independent', () => {
    const onChange = vi.fn()
    render(<ResultsAxesContext.Provider value={{ linear: { x: 'Cg', y: 'I0' }, onChange }}>
      <OptimizationResultsView run={run()} table={optimization} />
    </ResultsAxesContext.Provider>)

    expect(screen.getByRole('combobox', { name: 'X axis' }).textContent).toContain('Cg')
    expect(screen.getByRole('combobox', { name: 'Y axis' }).textContent).toContain('I0')

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'X axis' }))
    fireEvent.click(screen.getByRole('option', { name: 'Ladd' }))
    expect(onChange).toHaveBeenCalledWith('optimization', { x: 'Ladd', y: 'I0' })
    expect(screen.getByRole('combobox', { name: 'X axis' }).textContent).toContain('Ladd')
  })

  it('shows fixed parameters compactly and reveals their editors on demand', () => {
    render(<OptimizationResultsView run={run()} table={optimization} />)
    expect(screen.getByText(/Ladd=/)).toBeTruthy()
    expect(screen.queryByRole('combobox', { name: 'Ladd' })).toBeNull()
    const toggle = screen.getByRole('button', { name: /Fixed values/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(screen.getByRole('combobox', { name: 'Ladd' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Hide fixed/ }))
    expect(screen.queryByRole('combobox', { name: 'Ladd' })).toBeNull()
  })

  it('keeps objective and parameter histories available in runs without a Linear table', () => {
    render(<OptimizationResultsView run={run(false)} table={optimization} />)
    expect((screen.getByRole('button', { name: 'Slice · Linear' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/Linear slice unavailable for these axes/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    expect(screen.getAllByTestId('optimizer-history-chart')).toHaveLength(4)
  })

  it('disables History for a single evaluated point without displaying a masked-objective warning', () => {
    const single: ResultTable = { ...optimization, rows: [optimization.rows[0]] }
    render(<OptimizationResultsView run={{ ...run(), optimization: single }} table={single} />)
    const history = screen.getByRole('button', { name: 'History' }) as HTMLButtonElement
    expect(history.disabled).toBe(true)
    expect(screen.queryByText(/All objective evaluations are masked/)).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Objective' })).toBeNull()
  })

  it('disables History when only one evaluation survives the objective mask', () => {
    const masked: ResultTable = {
      ...optimization,
      rows: [optimization.rows[0], [2, 1.3e-6, 280e-15, 70e-12, 1e8]],
    }
    render(<OptimizationResultsView run={{ ...run(), optimization: masked }} table={masked} />)
    expect((screen.getByRole('button', { name: 'History' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText(/All objective evaluations are masked/)).toBeNull()
  })

  it('includes constant parameter columns in the plotted histories', () => {
    const constant: ResultTable = { ...optimization, rows: optimization.rows.map((row) => [row[0], row[1], row[2], 70e-12, row[4]]) }
    render(<OptimizationResultsView run={{ ...run(false), optimization: constant }} table={constant} />)
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    expect(screen.getAllByTestId('optimizer-history-chart')).toHaveLength(4)
    expect(screen.getByRole('heading', { name: 'Ladd' })).toBeTruthy()
  })
})
