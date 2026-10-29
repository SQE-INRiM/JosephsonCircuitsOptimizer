'use strict'
const fs = require('fs')
const path = require('path')

// Deliberately conservative: never remove a run with any possible numeric,
// user-saved, diagnostic data or an unreadable/unknown file. We only discard
// runs that consist solely of known setup/bookkeeping files and logs.
const RUN_ID = /^output_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(?:-\d{3}Z)?$/
const NO_RESULT_FILES = new Set([
  'simulation_info/status.json',
  'simulation_info/run_config.json',
  'simulation_info/versions.txt',
  'STOP',
])

function hasNumericHistory(metadata) {
  const results = metadata?.results
  const history = results?.metric_history
  if (Array.isArray(history?.metrics) && history.metrics.length) return true
  if (Array.isArray(metadata?.cost_history?.metrics) && metadata.cost_history.metrics.length) return true
  if (results && typeof results === 'object') {
    // run_config.json always writes these three keys, even on empty runs.
    // Check their values rather than their mere presence.
    if (results.best_metric !== null && results.best_metric !== undefined && results.best_metric !== '') return true
    const best = results.best_device_parameters
    if (best != null && (typeof best !== 'object' || Object.keys(best).length > 0)) return true
    for (const [key, value] of Object.entries(results)) {
      if (['best_metric', 'best_device_parameters', 'metric_history'].includes(key)) continue
      if (value !== null && value !== undefined) return true
    }
  }
  return false
}

function onlyBookkeeping(runPath) {
  const stack = [{ absolute: runPath, relative: '' }]
  while (stack.length) {
    const { absolute, relative } = stack.pop()
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) return false
      const rel = relative ? relative + '/' + entry.name : entry.name
      const full = path.join(absolute, entry.name)
      if (entry.isDirectory()) {
        // Not sure what an unknown directory contains: keep the run.
        if (!['inputs_snapshot', 'simulation_info', 'saved_data', 'data_saved_by_user', 'plots', 'figures'].includes(rel)) return false
        stack.push({ absolute: full, relative: rel })
      } else if (entry.isFile()) {
        if (rel.startsWith('inputs_snapshot/')) continue
        if (NO_RESULT_FILES.has(rel)) continue
        if (rel.startsWith('simulation_info/') && /\.(?:log|txt)$/i.test(rel)) continue
        // Any other file can be numerical output; preserve the whole run.
        return false
      } else return false
    }
  }
  return true
}

/** Returns true only when absence of numerical results can be established. */
function isProvablyEmptyRun(workspace, runId) {
  if (!RUN_ID.test(runId)) return false
  const outputs = path.resolve(workspace, 'outputs')
  const target = path.resolve(outputs, runId)
  if (path.dirname(target) !== outputs || !fs.existsSync(target)) return false
  try {
    if (!fs.lstatSync(target).isDirectory()) return false
    const metadataPath = path.join(target, 'simulation_info', 'run_config.json')
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
      if (hasNumericHistory(metadata)) return false
    }
    const parameters = path.join(target, 'optimal_device_parameters.json')
    if (fs.existsSync(parameters)) return false
    return onlyBookkeeping(target)
  } catch {
    // Broken/unreadable metadata is NOT evidence that no results exist.
    return false
  }
}

function updateLatestPointer(workspace, deletedPath) {
  const outputs = path.join(workspace, 'outputs')
  const pointer = path.join(outputs, 'LATEST.txt')
  if (!fs.existsSync(pointer)) return
  const old = fs.readFileSync(pointer, 'utf8').trim()
  if (path.resolve(old) !== path.resolve(deletedPath)) return
  const remaining = fs.readdirSync(outputs, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && RUN_ID.test(entry.name))
    .map((entry) => path.join(outputs, entry.name))
    .sort().reverse()
  if (remaining.length) fs.writeFileSync(pointer, remaining[0] + '\n', 'utf8')
  else fs.rmSync(pointer, { force: true })
}

module.exports = { isProvablyEmptyRun, updateLatestPointer }
