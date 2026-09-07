// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initialStages } from '../data/carthago'
import { useAppStore } from '../store'
import { formatStageCompletion, RunScreen } from './RunScreen'

describe('Run screen controls', () => {
  beforeEach(() => {
    useAppStore.setState({
      stages: structuredClone(initialStages),
      running: false,
      currentRunId: null,
    })
  })

  it('runs the stage named by the selected-stage button', () => {
    const onRunStage = vi.fn().mockResolvedValue(undefined)
    render(<RunScreen desktop cancelling={false} onRunRemaining={vi.fn()} onRunStage={onRunStage} onStop={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Run Linear' }))

    expect(onRunStage).toHaveBeenCalledOnce()
    expect(onRunStage).toHaveBeenCalledWith('linear')
  })

  it('shows a stopping state and prevents duplicate cancellation clicks', () => {
    useAppStore.setState({ running: true })
    render(<RunScreen desktop cancelling onRunRemaining={vi.fn()} onRunStage={vi.fn()} onStop={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Stopping Julia…' }).hasAttribute('disabled')).toBe(true)
  })

  it('shows Starting before the backend reports the first real progress point', () => {
    const stages = structuredClone(initialStages)
    stages[0] = { ...stages[0], status: 'running', progress: 0, points: 1 }
    useAppStore.setState({ stages, running: true })
    render(<RunScreen desktop cancelling={false} onRunRemaining={vi.fn()} onRunStage={vi.fn()} onStop={vi.fn()} />)

    expect(screen.getAllByText(/Starting…/).length).toBeGreaterThan(0)
    expect(screen.queryByText('0 / 1')).toBeNull()
  })

  it('uses one completion-time format for live and stored run timestamps', () => {
    expect(formatStageCompletion('01/09/2026, 11:49:33')).toBe('01/09/2026 · 11:49:33')
    expect(formatStageCompletion('2026-09-01 · 11-49-33')).toBe('01/09/2026 · 11:49:33')
  })
})
