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
function validatePartialRunInputs(workspace, mode) {
  if (!['optimization_only', 'nonlinear_only'].includes(mode)) return
  const outputRoot = path.resolve(workspace, 'outputs')
  const latestPointer = path.join(outputRoot, 'LATEST.txt')
  if (!fs.existsSync(latestPointer)) throw new Error('No saved Linear dataset. Run Linear first.')
  const latest = path.resolve(fs.readFileSync(latestPointer, 'utf8').trim())
  // LATEST is an archive-controlled pointer: never read outside this workspace's outputs.
  if (!latest.startsWith(outputRoot + path.sep)) throw new Error('Invalid latest-run path. Run Linear first.')
  const required = mode === 'optimization_only' ? 'df_uniform_analysis.h5' : 'optimal_device_parameters.json'
  if (!fs.existsSync(path.join(latest, 'df_uniform_analysis.h5')) || !fs.existsSync(path.join(latest, required))) {
    throw new Error('Latest run is missing prerequisites for ' + mode + '. Run Linear' +
      (mode === 'nonlinear_only' ? ' and Optimization (unless skipped)' : '') + ' first.')
  }
  const input = path.join(workspace, 'user_inputs')
  const snapshot = path.join(latest, 'inputs_snapshot')
  if (!fs.existsSync(snapshot)) throw new Error('Saved run has no inputs snapshot. Run Linear first.')

  assertSameInput(input, snapshot, 'device_parameters_space.json')
  assertSameInput(input, snapshot, 'drive_physical_quantities.json', linearDrives)
  assertSameInput(input, snapshot, 'simulation_config.json', linearSimulation)
  const currentAux = auxiliaryFiles(input)
  const savedAux = auxiliaryFiles(snapshot)
  if (!equal(currentAux, savedAux)) throw new Error('Julia or calibration input files changed. Run Linear first.')
  for (const name of currentAux) assertSameInput(input, snapshot, name)

  // Only HB depends on the selected optimizer output. Changes to BO settings
  // may reuse the Linear sweep, but not an old optimum.
  if (mode === 'nonlinear_only' && !isSinglePointDeviceSpace(parseJson(path.join(input, 'device_parameters_space.json')))) {
    assertSameInput(input, snapshot, 'optimizer_config.json')
  }
}

module.exports = { validatePartialRunInputs }
