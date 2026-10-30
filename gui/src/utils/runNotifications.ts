import type { RunEvent } from '../services/jcoAdapter'

type RunOutcome = Extract<RunEvent, { type: 'run-finished' }>['outcome']

export function notificationForRunOutcome(outcome: RunOutcome): {
  severity: 'success' | 'error' | 'warning'
  message: string
} {
  switch (outcome) {
    case 'completed':
      return { severity: 'success', message: 'Simulation completed. Results are ready to explore.' }
    case 'failed':
      return { severity: 'error', message: 'Simulation failed. Check the Run logs for details.' }
    case 'cancelled':
      return { severity: 'warning', message: 'Simulation cancelled.' }
  }
}
