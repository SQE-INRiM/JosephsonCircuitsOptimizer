// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResultsBundle, StageId } from '../types'
import { useAppStore } from '../store'
import { ResultsScreen } from './ResultsScreen'

vi.mock('../components/ConnectedResults', () => ({
  ConnectedResults: ({ stage, selectedRunId }: { stage: StageId; selectedRunId?: string | null }) => <><div data-testid="visible-results-stage">{stage}</div><div data-testid="selected-results-run">{selectedRunId}</div></>,
}))
vi.mock('../components/ResultsRunManager', () => ({ ResultsRunManager: () => null }))
vi.mock('../components/RunSetupSnapshot', () => ({ RunSetupSnapshot: () => null }))

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

  it('places one Run selector above the three stage tabs and shares the same historical run', () => {
    render(<ResultsScreen />)
    const selector = screen.getByRole('combobox', { name: 'Run' })
    const linearTab = screen.getByRole('tab', { name: 'Linear' })
    expect(selector.compareDocumentPosition(linearTab) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getAllByRole('combobox', { name: 'Run' })).toHaveLength(1)
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
