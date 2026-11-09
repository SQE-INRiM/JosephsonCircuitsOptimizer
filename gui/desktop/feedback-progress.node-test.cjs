const test = require('node:test')
const assert = require('node:assert/strict')
const { parseFeedbackProgressLine } = require('./feedback-progress.cjs')

const id = 'output_test'
const at = '2026-11-06T12:00:00.000Z'

test('parses start, phase and completion events', () => {
  assert.deepEqual(parseFeedbackProgressLine('FEEDBACK_CYCLE cycle=2 max=5 phase=optimization status=running', id, at), {
    type: 'feedback-cycle', runId: id, cycle: 2, maximumCycles: 5,
    phase: 'optimization', status: 'running', timestamp: at,
  })
  assert.deepEqual(parseFeedbackProgressLine('FEEDBACK_CYCLE cycle=5 max=5 phase=complete status=completed', id, at), {
    type: 'feedback-cycle', runId: id, cycle: 5, maximumCycles: 5,
    phase: 'complete', status: 'completed', timestamp: at,
  })
  assert.deepEqual(parseFeedbackProgressLine('FEEDBACK_DONE cycles=3 max=8 reason=converged', id, at), {
    type: 'feedback-done', runId: id, completedCycles: 3, maximumCycles: 8,
    reason: 'converged', timestamp: at,
  })
})

test('parses a paused feedback stage, including the baseline', () => {
  assert.deepEqual(parseFeedbackProgressLine('RUN_PAUSED cycle=0 after=hb', id, at), {
    type: 'run-paused', runId: id, cycle: 0, after: 'hb', timestamp: at,
  })
  assert.deepEqual(parseFeedbackProgressLine('RUN_PAUSED cycle=2 after=linear', id, at), {
    type: 'run-paused', runId: id, cycle: 2, after: 'linear', timestamp: at,
  })
  assert.equal(parseFeedbackProgressLine('RUN_PAUSED cycle=-1 after=hb', id, at), null)
  assert.equal(parseFeedbackProgressLine('RUN_PAUSED cycle=1 after=unknown', id, at), null)
})

test('rejects invalid cycle counts and ignores numerical progress', () => {
  for (const line of [
    'FEEDBACK_CYCLE cycle=0 max=5 phase=linear status=running',
    'FEEDBACK_CYCLE cycle=6 max=5 phase=linear status=running',
    'FEEDBACK_DONE cycles=9 max=8 reason=cycle_limit',
    'FEEDBACK_DONE cycles=0 max=8 reason=converged',
    'FEEDBACK_CYCLE cycle=1 max=5 phase=unknown status=running',
    'PROGRESS i=3 N=5 stage=LIN',
    'STAGE name=HB',
  ]) assert.equal(parseFeedbackProgressLine(line, id, at), null, line)
})
