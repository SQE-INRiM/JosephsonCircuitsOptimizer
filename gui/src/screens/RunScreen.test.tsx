// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initialStages } from '../data/carthago'
import { useAppStore } from '../store'
import { formatStageCompletion, RunScreen } from './RunScreen'

const baseProject = structuredClone(useAppStore.getState().project)

describe('Run screen controls', () => {
  beforeEach(() => {
    useAppStore.setState({
      stages: structuredClone(initialStages),
      running: false,
      currentRunId: null,
      feedbackRun: null,
      pausedRun: null,
      project: structuredClone(baseProject),
    })
  })
afterEach(() => {
  cleanup()
})

it('runs the stage named by the selected-stage button', async () => {
  const onRunStage = vi.fn().mockResolvedValue(undefined)
  useAppStore.setState({ stages: structuredClone(initialStages).map((stage) => ({ ...stage, status: 'ready' as const })) })
  render(
    <RunScreen onRunRemaining={vi.fn()} onRunStep={vi.fn()} onResumeRun={vi.fn()}
      desktop
      cancelling={false}
      onRunAll={vi.fn()}
      onRunStage={onRunStage}
      onStop={vi.fn()}
    />,
  )

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Run Linear' }))
    await Promise.resolve()
  })

  expect(onRunStage).toHaveBeenCalledOnce()
  expect(onRunStage).toHaveBeenCalledWith('linear')
})

  it('offers Optimization after a valid Linear run', async () => {
    const stages = structuredClone(initialStages)
    stages[1] = { ...stages[1], status: 'stale' }
    useAppStore.setState({ stages })
    const onRunStage = vi.fn().mockResolvedValue(undefined)
    render(<RunScreen onRunRemaining={vi.fn()} onRunStep={vi.fn()} onResumeRun={vi.fn()} desktop cancelling={false} onRunAll={vi.fn()} onRunStage={onRunStage} onStop={vi.fn()} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Run Optimization' }))
      await Promise.resolve()
    })

    expect(onRunStage).toHaveBeenCalledWith('optimization')
  })

  it('runs all stages when the main Run control is clicked', async () => {
    const onRunAll = vi.fn().mockResolvedValue(undefined)
    render(<RunScreen onRunRemaining={vi.fn()} onRunStep={vi.fn()} onResumeRun={vi.fn()} desktop cancelling={false} onRunAll={onRunAll} onRunStage={vi.fn()} onStop={vi.fn()} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Run' }))
      await Promise.resolve()
    })

    expect(onRunAll).toHaveBeenCalledOnce()
  })

  it('runs only unfinished stages with Run remaining when feedback is off', async () => {
    const stages = structuredClone(initialStages)
    stages[0] = { ...stages[0], status: 'completed' }
    stages[1] = { ...stages[1], status: 'ready' }
    stages[2] = { ...stages[2], status: 'stale' }
    useAppStore.setState({ stages })
    const onRunRemaining = vi.fn().mockResolvedValue(undefined)
    render(<RunScreen onRunStep={vi.fn()} onResumeRun={vi.fn()} desktop cancelling={false} onRunAll={vi.fn()} onRunStage={vi.fn()} onRunRemaining={onRunRemaining} onStop={vi.fn()} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Run remaining' }))
      await Promise.resolve()
    })
    expect(onRunRemaining).toHaveBeenCalledWith(['optimization', 'hb'])
  })

  it('starts a stepped feedback run and resumes from a completed HB without re-launching Julia', async () => {
    const project = structuredClone(baseProject)
    project.parameters[0] = { ...project.parameters[0], mode: 'Range', start: '1', stop: '2', step: '1' }
    project.computation.nonlinearCorrectionCycles = 2
    useAppStore.setState({ project })
    const onRunStep = vi.fn().mockResolvedValue(undefined)
    const onResumeRun = vi.fn().mockResolvedValue(undefined)
    render(<RunScreen onRunRemaining={vi.fn()} desktop cancelling={false} onRunAll={vi.fn()} onRunStage={vi.fn()} onRunStep={onRunStep} onResumeRun={onResumeRun} onStop={vi.fn()} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Run next step' }))
      await Promise.resolve()
    })
    expect(onRunStep).toHaveBeenCalledOnce()
    act(() => useAppStore.setState({
      running: true, pausedRun: { cycle: 0, after: 'hb' },
      feedbackRun: { cycle: 0, completedCycles: 0, maximumCycles: 2, phase: 'baseline', status: 'running' },
    }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Run Linear' }))
      await Promise.resolve()
    })
    expect(onResumeRun).toHaveBeenCalledWith('next')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Run remaining' }))
      await Promise.resolve()
    })
    expect(onResumeRun).toHaveBeenCalledWith('remaining')
  })

  it('shows a stopping state and prevents duplicate cancellation clicks', () => {
    useAppStore.setState({ running: true })
    render(<RunScreen onRunRemaining={vi.fn()} onRunStep={vi.fn()} onResumeRun={vi.fn()} desktop cancelling onRunAll={vi.fn()} onRunStage={vi.fn()} onStop={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Stopping Julia…' }).hasAttribute('disabled')).toBe(true)
  })

  it('shows Starting before the backend reports the first real progress point', () => {
    const stages = structuredClone(initialStages)
    stages[0] = { ...stages[0], status: 'running', progress: 0, points: 1 }
    useAppStore.setState({ stages, running: true })
    render(<RunScreen onRunRemaining={vi.fn()} onRunStep={vi.fn()} onResumeRun={vi.fn()} desktop cancelling={false} onRunAll={vi.fn()} onRunStage={vi.fn()} onStop={vi.fn()} />)

    expect(screen.getAllByText(/Starting…/).length).toBeGreaterThan(0)
    expect(screen.queryByText('0 / 1')).toBeNull()
  })

  it('keeps feedback separate, noninteractive and hides cycles when disabled', () => {
    render(<RunScreen onRunRemaining={vi.fn()} onRunStep={vi.fn()} onResumeRun={vi.fn()} desktop cancelling={false} onRunAll={vi.fn()} onRunStage={vi.fn()} onStop={vi.fn()} />)
    expect(screen.getByLabelText('Nonlinear feedback status')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Nonlinear feedback details' })).toBeNull()
    expect(screen.getByText('Disabled in Setup')).toBeTruthy()
    expect(screen.queryByText(/Nonlinear feedback · Cycle/)).toBeNull()
  })

  it('shows cycle-aligned progress only while correction cycles are running', () => {
    const project = structuredClone(baseProject)
    project.parameters[0] = { ...project.parameters[0], mode: 'Range', start: '1', stop: '2', step: '1' }
    project.computation.nonlinearCorrectionCycles = 5
    useAppStore.setState({
      project, running: true, currentRunId: 'run-feedback',
      feedbackRun: { cycle: 2, maximumCycles: 5, completedCycles: 1, phase: 'optimization', status: 'running' },
    })
    render(<RunScreen onRunRemaining={vi.fn()} onRunStep={vi.fn()} onResumeRun={vi.fn()} desktop cancelling={false} onRunAll={vi.fn()} onRunStage={vi.fn()} onStop={vi.fn()} />)
    expect(screen.getByText('Nonlinear feedback · Cycle 2 / 5')).toBeTruthy()
    expect(screen.getByText('1 / 5 correction cycles completed · Cycle 2 running')).toBeTruthy()
    const bar = screen.getByRole('progressbar', { name: 'Completed feedback correction cycles' })
    expect(bar.getAttribute('aria-valuenow')).toBe('1')
    expect(bar.getAttribute('aria-valuemax')).toBe('5')
    expect(screen.queryByRole('button', { name: 'Nonlinear feedback details' })).toBeNull()
  })

  it('replaces the progress line with final completion or convergence details', () => {
    const project = structuredClone(baseProject)
    project.parameters[0] = { ...project.parameters[0], mode: 'Range', start: '1', stop: '2', step: '1' }
    project.computation.nonlinearCorrectionCycles = 5
    useAppStore.setState({
      project, running: false, currentRunId: 'run-feedback',
      feedbackRun: { cycle: 2, maximumCycles: 5, completedCycles: 2, phase: 'complete', status: 'converged' },
    })
    const props = { desktop: true, cancelling: false, onRunAll: vi.fn(), onRunStage: vi.fn(), onStop: vi.fn() }
    const { rerender } = render(<RunScreen onRunRemaining={vi.fn()} onRunStep={vi.fn()} onResumeRun={vi.fn()} {...props} />)
    expect(screen.getByText('Converged after 2 of 5 cycles')).toBeTruthy()
    expect(screen.getByText('2 / 5 correction cycles completed')).toBeTruthy()
    expect(screen.queryByRole('progressbar', { name: 'Completed feedback correction cycles' })).toBeNull()

    useAppStore.setState({
      project: { ...project, computation: { ...project.computation, nonlinearCorrectionCycles: 2 } },
      feedbackRun: { cycle: 2, maximumCycles: 2, completedCycles: 2, phase: 'complete', status: 'completed' },
    })
    rerender(<RunScreen onRunRemaining={vi.fn()} onRunStep={vi.fn()} onResumeRun={vi.fn()} {...props} />)
    expect(screen.getByText('2 correction cycles completed')).toBeTruthy()
    expect(screen.getByText('2 / 2 correction cycles completed')).toBeTruthy()
    expect(screen.queryByRole('progressbar', { name: 'Completed feedback correction cycles' })).toBeNull()
  })

  it('shows disabled feedback without a cycle banner for a single configuration', () => {
    const project = structuredClone(baseProject)
    project.computation.nonlinearCorrectionCycles = 5
    useAppStore.setState({ project })
    render(<RunScreen onRunRemaining={vi.fn()} onRunStep={vi.fn()} onResumeRun={vi.fn()} desktop cancelling={false} onRunAll={vi.fn()} onRunStage={vi.fn()} onStop={vi.fn()} />)
    expect(screen.getByText('Requires a device-parameter sweep')).toBeTruthy()
    expect(screen.queryByText(/Nonlinear feedback · Cycle/)).toBeNull()
  })

  it('uses one completion-time format for live and stored run timestamps', () => {
    expect(formatStageCompletion('01/09/2026, 11:49:33')).toBe('01/09/2026 · 11:49:33')
    expect(formatStageCompletion('2026-09-01 · 11-49-33')).toBe('01/09/2026 · 11:49:33')
  })
})
