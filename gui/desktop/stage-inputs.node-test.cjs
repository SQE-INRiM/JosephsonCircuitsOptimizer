const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { validatePartialRunInputs } = require('./stage-inputs.cjs')

function fixture() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'jco-stage-inputs-'))
  const input = path.join(workspace, 'user_inputs')
  const run = path.join(workspace, 'outputs', 'output_2026-11-03_16-00-00-000Z')
  const snapshot = path.join(run, 'inputs_snapshot')
  fs.mkdirSync(input, { recursive: true })
  fs.mkdirSync(snapshot, { recursive: true })
  fs.writeFileSync(path.join(workspace, 'outputs', 'LATEST.txt'), run + '\n')
  const files = {
    'device_parameters_space.json': { Cg: [1] },
    'drive_physical_quantities.json': { frequency_range: [1, 2], source_1_on_port: 1, source_1_linear_amplitude: [0], source_1_non_linear_amplitude: [1] },
    'simulation_config.json': { ftol: 1e-10, nonlinear_strong_tone_harmonics: 3 },
    'optimizer_config.json': { max_optimizer_iterations: 20 },
    'user_circuit.jl': 'function create_user_circuit(device_params_set) end',
    'user_cost_and_performance.jl': 'function user_cost(sol, p, c) end',
  }
  for (const [name, value] of Object.entries(files)) {
    const content = typeof value === 'string' ? value : JSON.stringify(value)
    fs.writeFileSync(path.join(input, name), content)
    fs.writeFileSync(path.join(snapshot, name), content)
  }
  fs.writeFileSync(path.join(run, 'df_uniform_analysis.h5'), 'fixture')
  fs.writeFileSync(path.join(run, 'optimal_device_parameters.json'), '{}')
  return { workspace, input, run, cleanup: () => fs.rmSync(workspace, { recursive: true, force: true }) }
}
function writeJson(root, file, update) {
  const full = path.join(root, file)
  const value = JSON.parse(fs.readFileSync(full, 'utf8'))
  fs.writeFileSync(full, JSON.stringify({ ...value, ...update }))
}
test('allows valid partial runs and nonlinear-only changes without repeating Linear', () => {
  const f = fixture()
  try {
    validatePartialRunInputs(f.workspace, 'optimization_only')
    validatePartialRunInputs(f.workspace, 'nonlinear_only')
    writeJson(f.input, 'drive_physical_quantities.json', { source_1_non_linear_amplitude: [2] })
    writeJson(f.input, 'simulation_config.json', { nonlinear_strong_tone_harmonics: 7 })
    validatePartialRunInputs(f.workspace, 'optimization_only')
    validatePartialRunInputs(f.workspace, 'nonlinear_only')
  } finally { f.cleanup() }
})
test('optimizer changes keep Linear reusable but invalidate an HB-only optimum', () => {
  const f = fixture()
  try {
    writeJson(f.input, 'device_parameters_space.json', { Cg: { start: 1, step: 1, stop: 2 } })
    writeJson(path.join(f.run, 'inputs_snapshot'), 'device_parameters_space.json', { Cg: { start: 1, step: 1, stop: 2 } })
    writeJson(f.input, 'optimizer_config.json', { max_optimizer_iterations: 40 })
    validatePartialRunInputs(f.workspace, 'optimization_only')
    assert.throws(() => validatePartialRunInputs(f.workspace, 'nonlinear_only'), /optimizer_config/)
  } finally { f.cleanup() }
})
test('HB can use a fixed-device Linear point after changing irrelevant optimizer settings', () => {
  const f = fixture()
  try {
    writeJson(f.input, 'optimizer_config.json', { max_optimizer_iterations: 99 })
    validatePartialRunInputs(f.workspace, 'nonlinear_only')
  } finally { f.cleanup() }
})
test('retry Optimization after cancellation reuses the earlier valid Linear dataset', () => {
  const f = fixture()
  try {
    const abandoned = path.join(f.workspace, 'outputs', 'output_2026-11-03_16-30-00-000Z')
    fs.mkdirSync(path.join(abandoned, 'inputs_snapshot'), { recursive: true })
    fs.writeFileSync(path.join(abandoned, 'simulation_info.txt'), 'cancelled optimizer, partial history')
    fs.writeFileSync(path.join(f.workspace, 'outputs', 'LATEST.txt'), abandoned + '\\n')
    const resolved = validatePartialRunInputs(f.workspace, 'optimization_only')
    assert.equal(resolved.datasetPath, path.join(f.run, 'df_uniform_analysis.h5'))
    assert.equal(resolved.optimalParamsPath, undefined)
  } finally { f.cleanup() }
})
test('retry Nonlinear after cancellation finds the last compatible optimum', () => {
  const f = fixture()
  try {
    const abandoned = path.join(f.workspace, 'outputs', 'output_2026-11-03_16-30-00-000Z')
    fs.mkdirSync(abandoned)
    fs.writeFileSync(path.join(abandoned, 'df_uniform_analysis.h5'), 'partial copied dataset')
    fs.writeFileSync(path.join(f.workspace, 'outputs', 'LATEST.txt'), abandoned + '\\n')
    const resolved = validatePartialRunInputs(f.workspace, 'nonlinear_only')
    assert.equal(resolved.datasetPath, path.join(f.run, 'df_uniform_analysis.h5'))
    assert.equal(resolved.optimalParamsPath, path.join(f.run, 'optimal_device_parameters.json'))
  } finally { f.cleanup() }
})
test('rejects a changed Linear input and missing prerequisites', () => {
  const f = fixture()
  try {
    writeJson(f.input, 'drive_physical_quantities.json', { source_1_linear_amplitude: [3] })
    assert.throws(() => validatePartialRunInputs(f.workspace, 'optimization_only'), /Run Linear/)
    fs.rmSync(path.join(f.run, 'df_uniform_analysis.h5'))
    assert.throws(() => validatePartialRunInputs(f.workspace, 'optimization_only'), /No completed saved stage/)
  } finally { f.cleanup() }
})
