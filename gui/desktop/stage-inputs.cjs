// Validate partial-run provenance against the current input files, not just a
// green renderer status. Run-only stages must never consume a stale latest run.
const fs = require('fs')
const path = require('path')

function parseJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}
function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, ordered(value[key])]))
  return value
}
function equal(a, b) {
  return JSON.stringify(ordered(a)) === JSON.stringify(ordered(b))
}
function linearDrives(drives) {
  return Object.fromEntries(Object.entries(drives).filter(([key]) => !/^source_\d+_non_linear_amplitude$/.test(key)))
}
const NONLINEAR_SIM_KEYS = new Set([
  'nonlinear_strong_tone_harmonics', 'nonlinear_modulation_harmonics',
  'threewavemixing', 'fourwavemixing', 'n_iterations_nonlinear_correction',
  'nonlinear_feedback_stop_mode', 'nonlinear_feedback_metric',
  'nonlinear_feedback_tolerance_type', 'nonlinear_feedback_tolerance',
])
function linearSimulation(config) {
  return Object.fromEntries(Object.entries(config).filter(([key]) => !NONLINEAR_SIM_KEYS.has(key)))
}
function auxiliaryFiles(dir) {
  return fs.readdirSync(dir).filter((name) => /\.(jl|txt)$/i.test(name)).sort()
}
function assertSameInput(source, snapshot, filename, transform = (x) => x) {
  const a = path.join(source, filename)
  const b = path.join(snapshot, filename)
  if (!fs.existsSync(a) || !fs.existsSync(b)) throw new Error('Missing ' + filename + ' in the current or saved run inputs. Run Linear first.')
  const first = /\.json$/i.test(filename) ? parseJson(a) : fs.readFileSync(a, 'utf8')
  const second = /\.json$/i.test(filename) ? parseJson(b) : fs.readFileSync(b, 'utf8')
  if (!equal(transform(first), transform(second))) {
    throw new Error('Saved run is incompatible with current ' + filename + '. Run Linear first.')
  }
}
function isSinglePointDeviceSpace(parameters) {
  return Object.values(parameters).every((spec) => {
    if (Array.isArray(spec)) return spec.length === 1
    if (spec && typeof spec === 'object') return Number(spec.start) === Number(spec.stop)
    return true
  })
}
function assertMatchingSnapshot(workspace, runPath, mode) {
  const input = path.join(workspace, 'user_inputs')
  const snapshot = path.join(runPath, 'inputs_snapshot')
  if (!fs.existsSync(snapshot)) throw new Error('Saved run has no inputs snapshot.')

  assertSameInput(input, snapshot, 'device_parameters_space.json')
  assertSameInput(input, snapshot, 'drive_physical_quantities.json', linearDrives)
  assertSameInput(input, snapshot, 'simulation_config.json', linearSimulation)
  const currentAux = auxiliaryFiles(input)
  const savedAux = auxiliaryFiles(snapshot)
  if (!equal(currentAux, savedAux)) throw new Error('Julia or calibration input files changed.')
  for (const name of currentAux) assertSameInput(input, snapshot, name)

  if (mode === 'nonlinear_only' && !isSinglePointDeviceSpace(parseJson(path.join(input, 'device_parameters_space.json')))) {
    assertSameInput(input, snapshot, 'optimizer_config.json')
  }
}

/** Return explicit paths for a compatible *completed stage artifact*. A cancelled
 * optimization can leave partial history in LATEST, so never rely on that pointer
 * alone or borrow an optimum from an incompatible run. */
function validatePartialRunInputs(workspace, mode) {
  if (!['optimization_only', 'nonlinear_only'].includes(mode)) return {}
  const outputRoot = path.resolve(workspace, 'outputs')
  const candidates = fs.existsSync(outputRoot)
    ? fs.readdirSync(outputRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^output_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/.test(entry.name))
        .map((entry) => path.join(outputRoot, entry.name))
        .sort().reverse()
    : []
  const errors = []
  for (const run of candidates) {
    const datasetPath = path.join(run, 'df_uniform_analysis.h5')
    const optimalParamsPath = path.join(run, 'optimal_device_parameters.json')
    if (!fs.existsSync(datasetPath)) continue
    if (mode === 'nonlinear_only' && !fs.existsSync(optimalParamsPath)) continue
    try {
      assertMatchingSnapshot(workspace, run, mode)
    } catch (error) {
      errors.push(error.message)
      continue
    }
    return { datasetPath, optimalParamsPath: mode === 'nonlinear_only' ? optimalParamsPath : undefined }
  }

  if (errors.length) {
    throw new Error('No compatible saved stage found for ' + mode +
      '. Run Linear' + (mode === 'nonlinear_only' ? ' and Optimization' : '') +
      ' first. Most recent mismatch: ' + errors[0])
  }
  throw new Error('No completed saved stage found for ' + mode +
    '. Run Linear' + (mode === 'nonlinear_only' ? ' and Optimization' : '') + ' first.')
}

module.exports = { validatePartialRunInputs }
