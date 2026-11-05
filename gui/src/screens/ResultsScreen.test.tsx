// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResultsBundle, StageId } from '../types'
import { useAppStore } from '../store'
import { ResultsScreen } from './ResultsScreen'

vi.mock('../components/ConnectedResults', () => ({
  ConnectedResults: ({ stage, selectedRunId, results }: { stage: StageId; selectedRunId?: string | null; results: ResultsBundle }) => <><div data-testid="visible-results-stage">{stage}</div><div data-testid="selected-results-run">{selectedRunId}</div><div data-testid="selected-feedback-cycle">{results.runs[0]?.cycle ?? 0}</div><div data-testid="selected-linear-file">{results.runs[0]?.linear?.file ?? 'missing'}</div></>,
}))
vi.mock('../components/NonlinearFeedbackResults', () => ({
  NonlinearFeedbackResults: ({ onOpenCycle }: { onOpenCycle: (cycle: number) => void }) =>
    <button type="button" onClick={() => onOpenCycle(1)}>Show Cycle 1 in HB</button>,
}))
vi.mock('../components/ResultsRunManager', () => ({ ResultsRunManager: () => <button type="button">Manage runs</button> }))
vi.mock('../components/RunSetupSnapshot', () => ({ RunSetupSnapshot: () => <button type="button">Simulation info</button> }))

const originalProject = structuredClone(useAppStore.getState().project)
const onePoint = { columns: ['point_id', 'Cg', 'metric'], rows: [[1, 250, -20]], file: 'linear.h5' }
const optimization = { columns: ['evaluation', 'Cg', 'metric'], rows: [[1, 250, -20]], file: 'optimization.h5' }

function bundle(withOptimization = false): ResultsBundle {
  return {
    schemaVersion: 'jco.results/1',
    workspace: '/tmp/jco-test',
    runs: [{ id: 'run-1', linear: onePoint, optimization: withOptimization ? optimization : null, traces: [] }],
  }
}

describe('Results stage availability for a fixed-parameter project', () => {
  beforeEach(() => {
    useAppStore.setState({
      project: {
        ...structuredClone(originalProject),
        parameters: originalProject.parameters.map((parameter) => ({ ...parameter, mode: 'Fixed' as const, value: '250' })),
      },
      results: bundle(),
      selectedResultsRunId: 'run-1',
      resultsStage: 'optimization',
      running: false,
    })
  })
  afterEach(() => cleanup())

  it('greys out skipped Optimization and returns to Linear while keeping stored Linear data visible', () => {
    render(<ResultsScreen />)
    expect((screen.getByRole('tab', { name: 'Optimization' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('visible-results-stage').textContent).toBe('linear')
    expect(useAppStore.getState().resultsStage).toBe('linear')
    expect((screen.getByRole('tab', { name: 'Harmonic balance' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('disables Optimization even when older runs contain persisted optimizer data', () => {
    useAppStore.setState({ results: bundle(true) })
    render(<ResultsScreen />)
    expect((screen.getByRole('tab', { name: 'Optimization' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('visible-results-stage').textContent).toBe('linear')
    expect(useAppStore.getState().resultsStage).toBe('linear')
  })

  it('re-enables Optimization when the current project defines a multi-point device sweep', () => {
    useAppStore.setState((state) => ({
      project: {
        ...state.project,
        parameters: state.project.parameters.map((parameter, index) =>
          index === 0 ? { ...parameter, mode: 'List' as const, values: '250, 350' } : parameter),
      },
    }))
    render(<ResultsScreen />)
    expect((screen.getByRole('tab', { name: 'Optimization' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByTestId('visible-results-stage').textContent).toBe('optimization')
  })
})

describe('Shared Results run navigation', () => {
  const multiRun: ResultsBundle = {
    schemaVersion: 'jco.results/1',
    workspace: '/tmp/jco-test',
    runs: [
      { id: 'newest', linear: onePoint, optimization, traces: [] },
      { id: 'older', linear: onePoint, optimization, traces: [] },
    ],
  }

  beforeEach(() => {
    useAppStore.setState({
      project: {
        ...structuredClone(originalProject),
        parameters: originalProject.parameters.map((parameter, index) =>
          index === 0 ? { ...parameter, mode: 'List' as const, values: '250, 350' } : parameter),
      },
      results: multiRun,
      selectedResultsRunId: 'newest',
      resultsStage: 'linear',
      running: false,
    })
  })
  afterEach(() => cleanup())

  it('places Manage runs before Refresh and orders actions immediately after the Run selector', () => {
    render(<ResultsScreen />)
    const manage = screen.getByRole('button', { name: 'Manage runs' })
    const refresh = screen.getByRole('button', { name: 'Refresh results' })
    const selector = screen.getByRole('combobox', { name: 'Run' })
    const csv = screen.getByRole('button', { name: 'Export CSV…' })
    const info = screen.getByRole('button', { name: 'Simulation info' })
    const deleteRun = screen.getByRole('button', { name: 'Delete run' })
    const linearTab = screen.getByRole('tab', { name: 'Linear' })

    expect(manage.parentElement).toBe(refresh.parentElement)
    for (const [first, second] of [[manage, refresh], [refresh, selector], [selector, csv], [csv, info], [info, deleteRun], [deleteRun, linearTab]]) {
      expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it('places one Run selector above the three stage tabs and shares the same historical run', () => {
    render(<ResultsScreen />)
    const selector = screen.getByRole('combobox', { name: 'Run' })
    const linearTab = screen.getByRole('tab', { name: 'Linear' })
    expect(selector.compareDocumentPosition(linearTab) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getAllByRole('combobox', { name: 'Run' })).toHaveLength(1)
    expect(screen.queryByText('Stored JCO data')).toBeNull()
    expect(screen.queryByText(/retained-data points/)).toBeNull()
    fireEvent.mouseDown(selector)
    fireEvent.click(screen.getByRole('option', { name: 'older' }))
    expect(useAppStore.getState().selectedResultsRunId).toBe('older')
    expect(screen.getByTestId('selected-results-run').textContent).toBe('older')

    fireEvent.click(screen.getByRole('tab', { name: 'Optimization' }))
    expect(screen.getByTestId('visible-results-stage').textContent).toBe('optimization')
    expect(screen.getByTestId('selected-results-run').textContent).toBe('older')

    fireEvent.click(screen.getByRole('tab', { name: 'Harmonic balance' }))
    expect(screen.getByTestId('visible-results-stage').textContent).toBe('hb')
    expect(screen.getByTestId('selected-results-run').textContent).toBe('older')
  })

  it('keeps the selected run on refresh and page re-entry, falling back only if deleted', () => {
    const { unmount } = render(<ResultsScreen />)
    act(() => {
      useAppStore.getState().setSelectedResultsRunId('older')
      useAppStore.getState().setResults({ ...multiRun, runs: [{ id: 'newer', linear: onePoint, traces: [] }, ...multiRun.runs] })
    })
    expect(screen.getByTestId('selected-results-run').textContent).toBe('older')
    unmount()
    render(<ResultsScreen />)
    expect(screen.getByTestId('selected-results-run').textContent).toBe('older')
    act(() => useAppStore.getState().setResults({ ...multiRun, runs: [multiRun.runs[0]] }))
    expect(screen.getByTestId('selected-results-run').textContent).toBe('newest')
  })
})

describe('Feedback cycle navigation within Results', () => {
  const feedbackBundle: ResultsBundle = {
    schemaVersion: 'jco.results/4',
    workspace: '/tmp/jco-feedback',
    runs: [{
      id: 'feedback-run', traces: [],
      linear: { ...onePoint, file: 'baseline.h5' },
      feedback: {
        schemaVersion: 'jco.feedback/1', requestedCycles: 2,
        cycles: [
          { cycle: 0, status: 'completed', metric: -20, performance: 15, correction: 0, parameters: { Cg: 250 } },
          { cycle: 1, status: 'completed', metric: -21, performance: 20, correction: 2, parameters: { Cg: 300 } },
        ],
      },
      cycles: [{
        cycle: 1, status: 'completed',
        linear: { ...onePoint, file: 'cycle_001/df_uniform_analysis.h5' },
        optimization: null, nonlinear: null, traces: [],
      }],
    }],
  }

  beforeEach(() => {
    useAppStore.setState({
      project: structuredClone(originalProject),
      results: feedbackBundle,
      selectedResultsRunId: 'feedback-run',
      resultsStage: 'linear',
      running: false,
    })
  })
  afterEach(() => cleanup())

  it('places Cycle under Run in the same stage bar without adding another divider', () => {
    render(<ResultsScreen />)
    const run = screen.getByRole('combobox', { name: 'Run' })
    const tabs = screen.getByRole('tab', { name: 'Linear' })
    const cycle = screen.getByRole('combobox', { name: 'Cycle' })
    expect(run.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(tabs.parentElement?.parentElement?.contains(cycle)).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Nonlinear feedback' })).toBeTruthy()
    expect(screen.getByTestId('selected-feedback-cycle').textContent).toBe('0')
    expect(screen.getByTestId('selected-linear-file').textContent).toBe('baseline.h5')
    fireEvent.mouseDown(cycle)
    fireEvent.click(screen.getByRole('option', { name: 'Cycle 1' }))
    expect(screen.getByTestId('selected-feedback-cycle').textContent).toBe('1')
    expect(screen.getByTestId('selected-linear-file').textContent).toBe('cycle_001/df_uniform_analysis.h5')
  })

  it('opens selected cycle from feedback convergence into the normal HB stage', () => {
    render(<ResultsScreen />)
    fireEvent.click(screen.getByRole('tab', { name: 'Nonlinear feedback' }))
    expect(screen.queryByRole('combobox', { name: 'Cycle' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show Cycle 1 in HB' }))
    expect(screen.getByTestId('visible-results-stage').textContent).toBe('hb')
    expect(screen.getByTestId('selected-feedback-cycle').textContent).toBe('1')
    expect(screen.getByRole('combobox', { name: 'Cycle' })).toBeTruthy()
  })

  it('does not introduce feedback controls for historical runs without cycles', () => {
    useAppStore.setState({ results: bundle() })
    render(<ResultsScreen />)
    expect(screen.queryByRole('tab', { name: 'Nonlinear feedback' })).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Cycle' })).toBeNull()
  })
})
