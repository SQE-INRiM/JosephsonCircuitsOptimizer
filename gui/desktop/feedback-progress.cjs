'use strict'

// Machine-readable markers emitted only by Julia's full-run feedback loop.
// Normal STAGE / PROGRESS / PROGRESS_DONE continue to describe each numerical stage.
function parseFeedbackProgressLine(line, runId, timestamp = new Date().toISOString()) {
  let match = line.match(/^RUN_PAUSED cycle=(\\d+) after=(linear|optimization|hb)$/)
  if (match) {
    const cycle = Number(match[1])
    if (!Number.isSafeInteger(cycle) || cycle < 0) return null
    return { type: 'run-paused', runId, cycle, after: match[2], timestamp }
  }
  match = line.match(/^FEEDBACK_CYCLE cycle=(\d+) max=(\d+) phase=(correction|linear|optimization|hb|complete) status=(running|completed)$/)
  if (match) {
    const cycle = Number(match[1])
    const maximumCycles = Number(match[2])
    if (!Number.isSafeInteger(cycle) || !Number.isSafeInteger(maximumCycles) ||
        maximumCycles < 1 || cycle < 1 || cycle > maximumCycles) return null
    return { type: 'feedback-cycle', runId, cycle, maximumCycles,
      phase: match[3], status: match[4], timestamp }
  }
  match = line.match(/^FEEDBACK_DONE cycles=(\d+) max=(\d+) reason=(converged|cycle_limit)$/)
  if (match) {
    const completedCycles = Number(match[1])
    const maximumCycles = Number(match[2])
    if (!Number.isSafeInteger(completedCycles) || !Number.isSafeInteger(maximumCycles) ||
        maximumCycles < 1 || completedCycles < 1 || completedCycles > maximumCycles) return null
    return { type: 'feedback-done', runId, completedCycles, maximumCycles,
      reason: match[3], timestamp }
  }
  return null
}

module.exports = { parseFeedbackProgressLine }
