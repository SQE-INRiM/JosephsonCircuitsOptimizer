import { describe, expect, it } from 'vitest'
import { notificationForRunOutcome } from './runNotifications'

describe('simulation completion notifications', () => {
  it('reports successful completion without implying all project stages are current', () => {
    expect(notificationForRunOutcome('completed')).toEqual({
      severity: 'success',
      message: 'Simulation completed. Results are ready to explore.',
    })
  })

  it('distinguishes a failure from a completed simulation', () => {
    expect(notificationForRunOutcome('failed')).toEqual({
      severity: 'error',
      message: 'Simulation failed. Check the Run logs for details.',
    })
  })

  it('distinguishes user cancellation from failure', () => {
    expect(notificationForRunOutcome('cancelled')).toEqual({
      severity: 'warning',
      message: 'Simulation cancelled.',
    })
  })
})
