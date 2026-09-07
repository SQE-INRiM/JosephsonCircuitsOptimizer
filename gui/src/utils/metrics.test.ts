import { describe, expect, it } from 'vitest'
import { metricsFromCode } from './metrics'

describe('Julia metric return discovery', () => {
  it('maps named cost and performance returns in their declared order', () => {
    const metrics = metricsFromCode(`
      function user_cost(S, p, correction)
        # return (fake_metric = 0, fake_analysis = 0)
        if bad(S)
          return 1e8
        end
        return (
          metric = total(a, b),
          reflection = mean(S[(1,1)]),
          phase_mismatch = delta_k,
        )
      end

      function user_performance(sol, p, amps, freqs)
        return (performance = gain, ripple = std(trace))
      end
    `)

    expect(metrics.map(({ source, name, purpose, direction }) => ({ source, name, purpose, direction }))).toEqual([
      { source: 'user_cost', name: 'metric', purpose: 'Objective', direction: 'Minimize' },
      { source: 'user_cost', name: 'reflection', purpose: 'Analysis', direction: '—' },
      { source: 'user_cost', name: 'phase_mismatch', purpose: 'Analysis', direction: '—' },
      { source: 'user_performance', name: 'performance', purpose: 'Objective', direction: 'Maximize' },
      { source: 'user_performance', name: 'ripple', purpose: 'Analysis', direction: '—' },
    ])
  })

  it('keeps scalar-return legacy functions compatible', () => {
    const metrics = metricsFromCode('function user_cost(S, p, c)\n return metric\nend')
    expect(metrics.map((metric) => metric.name)).toEqual(['metric'])
  })
})
