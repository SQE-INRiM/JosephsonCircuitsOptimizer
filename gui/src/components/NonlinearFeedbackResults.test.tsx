// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RunResults } from '../types'
import { NonlinearFeedbackResults } from './NonlinearFeedbackResults'

vi.mock('@mui/x-charts/LineChart', () => ({
  LineChart: ({ series, xAxis, height, onMarkClick }: {
    series: Array<{ label: string; data: Array<number | null> }>
    xAxis: Array<{ data: number[] }>
    height: number
  }) => <div data-testid="feedback-chart" data-height={height}
    data-x={xAxis[0].data.join(',')}
    data-label={series[0].label}
    data-y={series[0].data.join(',')} />,
}))

const withFeedback: RunResults = {
  id: 'run-1', traces: [],
  feedback: {
    schemaVersion: 'jco.feedback/1', requestedCycles: 3,
    cycles: [
      { cycle: 0, status: 'completed', metric: -19, performance: 15, correction: 0, parameters: { I0: 1.5e-6, Cg: 250e-15 } },
      { cycle: 1, status: 'completed', metric: -20, performance: 21, correction: 2, parameters: { I0: 1.7e-6, Cg: 300e-15 } },
      { cycle: 2, status: 'completed', metric: -22, performance: 23, correction: 1, parameters: { I0: 1.6e-6, Cg: 320e-15 } },
    ],
  },
  cycles: [{ cycle: 1, status: 'completed', traces: [] }, { cycle: 2, status: 'completed', traces: [] }],
}

describe('Nonlinear feedback convergence', () => {
  afterEach(() => cleanup())

  it('plots baseline plus completed feedback cycles and one small chart per parameter', () => {
    render(<NonlinearFeedbackResults run={withFeedback} />)
    const charts = screen.getAllByTestId('feedback-chart')
    expect(charts).toHaveLength(3)
    expect(charts.map((chart) => chart.getAttribute('data-height'))).toEqual(['290', '205', '205'])
    expect(charts[0].getAttribute('data-x')).toBe('0,1,2')
    expect(charts[0].getAttribute('data-y')).toBe('15,21,23')
    expect(charts[1].getAttribute('data-y')).toBe('0.0000015,0.0000017,0.0000016')
    expect(screen.getByText(/Cycle 0 is the uncorrected baseline/)).toBeTruthy()
  })

  it('keeps cycle navigation out of the convergence charts', () => {
    render(<NonlinearFeedbackResults run={withFeedback} />)
    expect(screen.queryByRole('button', { name: 'Cycle 2' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Choose second cycle point/ })).toBeNull()
  })

  it('does not invent convergence values for incomplete cycles', () => {
    render(<NonlinearFeedbackResults run={{
      ...withFeedback,
      cycles: [...(withFeedback.cycles ?? []), { cycle: 3, status: 'incomplete', traces: [] }],
    }} />)
    expect(screen.getAllByTestId('feedback-chart')[0].getAttribute('data-x')).toBe('0,1,2')
    expect(screen.queryByRole('button', { name: /Cycle 3/ })).toBeNull()
  })

  it('distinguishes an early convergence stop from reaching the configured cycle limit', () => {
    const stopping = {
      stopping_mode: 'convergence' as const,
      monitored_metric: 'performance' as const,
      tolerance_type: 'relative' as const,
      tolerance: 2,
      monitored_values: [21, 23],
      cycles_completed: 2,
      maximum_cycles: 8,
      stop_reason: 'converged' as const,
    }
    const converged: RunResults = {
      ...withFeedback,
      feedback: { ...withFeedback.feedback!, stopping },
    }
    const rendered = render(<NonlinearFeedbackResults run={converged} />)
    expect(screen.getByText('Converged')).toBeTruthy()
    expect(screen.queryByText('Cycle limit reached')).toBeNull()
    rendered.rerender(<NonlinearFeedbackResults run={{
      ...converged,
      feedback: { ...converged.feedback!, stopping: { ...stopping, stop_reason: 'cycle_limit' } },
    }} />)
    expect(screen.getByText('Cycle limit reached')).toBeTruthy()
  })

  it('does not render empty charts for legacy runs', () => {
    render(<NonlinearFeedbackResults run={{ id: 'legacy', traces: [] }} />)
    expect(screen.queryAllByTestId('feedback-chart')).toHaveLength(0)
    expect(screen.getByText(/does not contain nonlinear feedback cycles/)).toBeTruthy()
  })
})
