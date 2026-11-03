// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ResultTable, ResultsBundle } from '../types'
import { ConnectedResults } from './ConnectedResultsCompact'

vi.mock('@mui/x-charts/LineChart', () => ({ LineChart: () => null }))

function dataset(rows: Array<Array<number>>): ResultsBundle {
  const table: ResultTable = { columns: ['point_id', 'Cg', 'metric'], rows, file: 'linear.h5' }
  return {
    schemaVersion: 'jco.results/1', workspace: '/tmp/jco-test',
    runs: [{ id: 'linear-run', linear: table, traces: [] }],
  }
}

describe('Linear results analysis availability', () => {
  afterEach(() => cleanup())

  it('disables Correlation and 1D density but retains the single-point inspector', () => {
    render(<ConnectedResults results={dataset([[1, 250, -20]])} stage="linear" onResultsChanged={() => {}} />)
    expect((screen.getByRole('button', { name: 'Correlation' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: '1D density' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Landscape' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText('Selected configuration')).toBeTruthy()
    expect(screen.getByText(/Correlation and 1D density require multiple Linear configurations/)).toBeTruthy()
  })

  it('re-enables both analyses when the selected Linear dataset has multiple parameter values', () => {
    render(<ConnectedResults results={dataset([[1, 250, -20], [2, 350, -21], [3, 450, -22]])} stage="linear" onResultsChanged={() => {}} />)
    expect((screen.getByRole('button', { name: 'Correlation' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: '1D density' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: '1D density' }))
    expect(screen.getByText('1D density heatmaps')).toBeTruthy()
  })

  it('returns to Landscape when the displayed dataset changes from swept to single-point', () => {
    const { rerender } = render(<ConnectedResults results={dataset([[1, 250, -20], [2, 350, -21], [3, 450, -22]])} stage="linear" onResultsChanged={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '1D density' }))
    rerender(<ConnectedResults results={dataset([[1, 250, -20]])} stage="linear" onResultsChanged={() => {}} />)
    expect((screen.getByRole('button', { name: '1D density' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Selected configuration')).toBeTruthy()
    expect(screen.queryByText('1D density heatmaps')).toBeNull()
  })
})
