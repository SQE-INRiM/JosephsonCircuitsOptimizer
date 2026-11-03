// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResultsBundle, StageId } from '../types'
import { useAppStore } from '../store'
import { ResultsScreen } from './ResultsScreen'

vi.mock('../components/ConnectedResults', () => ({
  ConnectedResults: ({ stage }: { stage: StageId }) => <div data-testid="visible-results-stage">{stage}</div>,
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

  it('keeps historical optimization data accessible despite a single-point current setup', () => {
    useAppStore.setState({ results: bundle(true) })
    render(<ResultsScreen />)
    expect((screen.getByRole('tab', { name: 'Optimization' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByTestId('visible-results-stage').textContent).toBe('optimization')
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
