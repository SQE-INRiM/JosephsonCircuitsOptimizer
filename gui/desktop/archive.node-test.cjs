const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const AdmZip = require('adm-zip')
const { copyWorkspace, findWorkspaceRoot, packProject, packWorkspaceZip, unpackProject, validateWorkspace } = require('./archive.cjs')
const { extractDeviceParameterNames, loadProjectModel, metricsFromCode, saveProjectModel } = require('./project-model.cjs')
const { modeForStages } = require('./run-mode.cjs')
const { createRunId, outcomeForClose, requireDurableProject, terminateProcessTree } = require('./run-process.cjs')

const requiredContent = {
  'device_parameters_space.json': JSON.stringify({ I0: [2e-6], Cg: { start: 1e-13, step: 1e-13, stop: 3e-13 } }),
  'drive_physical_quantities.json': JSON.stringify({ frequency_range: { start: 1e6, step: 1e6, stop: 10e9 }, source_1_on_port: 1, source_1_frequency: 7e9, source_1_linear_amplitude: 0, source_1_non_linear_amplitude: [1e-7, 2e-7], source_1_non_linear_amplitude_for_delta_correction: 1.2e-6, source_2_on_port: 3, source_2_frequency: 0, source_2_linear_amplitude: 125e-6, source_2_non_linear_amplitude: 125e-6 }),
  'simulation_config.json': JSON.stringify({ linear_strong_tone_harmonics: 1, nonlinear_strong_tone_harmonics: 8, max_simulator_iterations: 200, ftol: 1e-8, switchofflinesearchtol: 0.0, alphamin: 1e-7, maxintermodorder: 7, nbatches: 2, sorting: 'name', fourwavemixing: true, skip_higher_pump_on_nonconvergence: true }),
  'optimizer_config.json': JSON.stringify({ max_optimizer_iterations: 5, new_samples_per_optimizer_iteration: 5, surrogate_model: 'Kriging', optimizer_strategy: 'SRBF', sampling_strategy: 'random' }),
  'user_circuit.jl': 'function create_user_circuit(p)\nend\n',
  'user_cost_and_performance.jl': 'function user_cost(S,p,c)\n return (metric = 1.0, reflection = -20.0)\nend\nfunction user_performance(sol,p,amps,freqs)\n return (performance = 10.0, ripple = 0.5)\nend\n',
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jco-archive-test-'))
  const workspace = path.join(root, 'workspace')
  const input = path.join(workspace, 'user_inputs')
  fs.mkdirSync(input, { recursive: true })
  for (const [name, value] of Object.entries(requiredContent)) fs.writeFileSync(path.join(input, name), value)
  fs.mkdirSync(path.join(workspace, 'outputs'), { recursive: true })
  fs.writeFileSync(path.join(workspace, 'outputs', 'LATEST.txt'), '')
  return { root, workspace }
}

test('discovers parameters from the create_user_circuit argument used in the GUI', () => {
  const code = 'function create_user_circuit(device_parameters_set::Dict)\\nCg = device_parameters_set[:Cg]\\nLj = device_parameters_set[ :Lj ]\\nend'
  assert.deepEqual(extractDeviceParameterNames(code), ['Cg', 'Lj'])
})

test('ignores circuit parameters that are present only in Julia comments', () => {
  const code = 'function create_user_circuit(device_params_set)\n# device_params_set[:Old]\nCg = device_params_set[:Cg]\nend'
  assert.deepEqual(extractDeviceParameterNames(code), ['Cg'])
})

test('discovers ordered objective and analysis metrics from Julia named returns', () => {
  const metrics = metricsFromCode(requiredContent['user_cost_and_performance.jl'])
  assert.deepEqual(metrics.map(({ source, name, purpose, direction }) => ({ source, name, purpose, direction })), [
    { source: 'user_cost', name: 'metric', purpose: 'Objective', direction: 'Minimize' },
    { source: 'user_cost', name: 'reflection', purpose: 'Analysis', direction: '—' },
    { source: 'user_performance', name: 'performance', purpose: 'Objective', direction: 'Maximize' },
    { source: 'user_performance', name: 'ripple', purpose: 'Analysis', direction: '—' },
  ])
})

test('packs and unpacks a complete workspace without losing auxiliary files', () => {
  const { root, workspace } = fixture()
  fs.writeFileSync(path.join(workspace, 'user_inputs', 'flux_curve.txt'), '0 0\n1 1\n')
  const target = path.join(root, 'device.jco')
  const manifest = packProject(workspace, target, { name: 'Device' })
  assert.equal(manifest.format, 'jco.project/1')
  const extracted = path.join(root, 'extracted')
  unpackProject(target, extracted)
  assert.equal(validateWorkspace(extracted).valid, true)
  assert.equal(fs.readFileSync(path.join(extracted, 'user_inputs', 'flux_curve.txt'), 'utf8'), '0 0\n1 1\n')
})

test('exports an editable workspace ZIP with the original JCO input layout', () => {
  const { root, workspace } = fixture()
  const target = path.join(root, 'editable-workspace.zip')
  packWorkspaceZip(workspace, target)
  const entries = new AdmZip(target).getEntries().map((entry) => entry.entryName)
  assert.ok(entries.includes('user_inputs/device_parameters_space.json'))
  assert.ok(entries.includes('user_inputs/drive_physical_quantities.json'))
  assert.ok(entries.includes('user_inputs/user_circuit.jl'))
  assert.equal(entries.includes('manifest.json'), false)
})

test('rejects archives that do not contain a complete JCO workspace', () => {
  const { root } = fixture()
  const target = path.join(root, 'unsafe.jco')
  const zip = new AdmZip()
  zip.addFile('manifest.json', Buffer.from(JSON.stringify({ format: 'jco.project/1' })))
  zip.addFile('workspace/readme.txt', Buffer.from('incomplete'))
  zip.writeZip(target)
  assert.throws(() => unpackProject(target, path.join(root, 'out')), /missing required inputs/i)
})

test('loads GUI fields and writes edited parameter/config values back', () => {
  const { workspace } = fixture()
  const model = loadProjectModel(workspace, null, { name: 'Fixture' })
  assert.equal(model.parameters.find((item) => item.name === 'Cg').mode, 'Range')
  assert.equal(model.sources[0].frequency.value, '7')
  assert.equal(model.sources[0].nonlinearAmplitude.mode, 'List')
  assert.equal(model.sources[1].isDc, true)
  assert.equal(model.computation.switchOffLineSearchTolerance, 0)
  assert.equal(model.computation.alphaMin, 1e-7)
  assert.equal(model.computation.maxIntermodOrder, '7')
  assert.equal(model.computation.solverBatches, 2)
  assert.equal(model.computation.nodeSorting, 'name')
  assert.equal(model.computation.sampler, 'RandomSample')
  assert.deepEqual(model.metrics.map((metric) => metric.name), ['metric', 'reflection', 'performance', 'ripple'])
  model.parameters.find((item) => item.name === 'I0').value = '3e-6'
  model.sources[0].frequency = { mode: 'Range', start: '7', step: '0.5', stop: '8' }
  model.sources[0].linearAmplitude = { mode: 'Range', start: '1e-9', step: '1e-9', stop: '3e-9' }
  model.sources[0].nonlinearAmplitude = { mode: 'List', values: '[1e-7, 2e-7]' }
  model.computation.nonlinearStrongToneHarmonics = 10
  model.computation.solverFtol = 2e-9
  model.computation.maxIntermodOrder = 'Inf'
  model.computation.solverBatches = 0
  model.computation.nodeSorting = 'none'
  model.computation.surrogate = 'SecondOrderPolynomial'
  model.computation.strategy = 'LCBS'
  model.computation.sampler = 'SobolSample'
  saveProjectModel(workspace, model)
  const parameters = JSON.parse(fs.readFileSync(path.join(workspace, 'user_inputs', 'device_parameters_space.json')))
  const drives = JSON.parse(fs.readFileSync(path.join(workspace, 'user_inputs', 'drive_physical_quantities.json')))
  const simulation = JSON.parse(fs.readFileSync(path.join(workspace, 'user_inputs', 'simulation_config.json')))
  const optimizer = JSON.parse(fs.readFileSync(path.join(workspace, 'user_inputs', 'optimizer_config.json')))
  assert.deepEqual(parameters.I0, [3e-6])
  assert.deepEqual(drives.source_1_frequency, { start: 7e9, step: 0.5e9, stop: 8e9 })
  assert.deepEqual(drives.source_1_linear_amplitude, { start: 1e-9, step: 1e-9, stop: 3e-9 })
  assert.deepEqual(drives.source_1_non_linear_amplitude, [1e-7, 2e-7])
  assert.equal(drives.source_1_non_linear_amplitude_for_delta_correction, 1.2e-6)
  assert.equal(drives.source_2_frequency, 0)
  assert.equal(simulation.nonlinear_strong_tone_harmonics, 10)
  assert.equal(simulation.ftol, 2e-9)
  assert.equal(simulation.maxintermodorder, 'Inf')
  assert.equal(simulation.nbatches, 0)
  assert.equal(simulation.sorting, 'none')
  assert.equal('skip_higher_pump_on_nonconvergence' in simulation, false)
  assert.equal(optimizer.surrogate_model, 'SecondOrderPolynomial')
  assert.equal(optimizer.optimizer_strategy, 'LCBS')
  assert.equal(optimizer.sampling_strategy, 'SobolSample')
})

test('finds a workspace in a single wrapper directory', () => {
  const { root, workspace } = fixture()
  const wrapper = path.join(root, 'wrapper')
  fs.mkdirSync(wrapper)
  const nested = path.join(wrapper, 'experiment')
  copyWorkspace(workspace, nested)
  assert.equal(findWorkspaceRoot(wrapper), nested)
})

test('maps a linear-only request to the real JCO sweep entry point', () => {
  assert.equal(modeForStages(['linear']), 'sweep_only')
  assert.equal(modeForStages(['linear', 'linear']), 'sweep_only')
  assert.equal(modeForStages(['optimization', 'hb']), 'from_latest')
})

test('uses one path-safe run id for the GUI and Julia output folder', () => {
  assert.equal(createRunId(new Date('2026-08-27T14:30:15.123Z')), 'output_2026-08-27_14-30-15-123Z')
})

test('linear-only Julia runner reuses the GUI run id and does not create plots', () => {
  const source = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'JosephsonCircuitsOptimizer.jl'),
  'utf8',
)
  const start = source.indexOf('function run_sweep_only')
  const finish = source.indexOf('function run_from_latest_dataset_only', start)
  const linearRunner = source.slice(start, finish)
  assert.match(source, /function create_output_path[\s\S]*get\(ENV, "JCO_RUN_ID"/)
  assert.match(linearRunner, /create_output_path\(base_output_path\)/)
  assert.doesNotMatch(linearRunner, /create_corr_figure/)
})

test('preserves cancellation intent when a forced process exit has a nonzero code', () => {
  assert.equal(outcomeForClose(1, true), 'cancelled')
  assert.equal(outcomeForClose(null, true), 'cancelled')
  assert.equal(outcomeForClose(1, false), 'failed')
})

test('requires a durable user project but allows bundled examples to run temporarily', () => {
  assert.throws(() => requireDurableProject({ projectPath: null, manifest: { name: 'New project' } }), /Save As a \.jco project before running/)
  assert.equal(requireDurableProject({ projectPath: 'C:\\projects\\device.jco' }), 'C:\\projects\\device.jco')
  assert.equal(requireDurableProject({ projectPath: null, manifest: { fileName: 'SNAIL JTWPA 3WM.jco' } }), null)
})

test('terminates the complete Julia process tree on Windows', () => {
  const calls = []
  const fakeChild = { pid: 4242, kill: () => { throw new Error('fallback should not be used') } }
  const fakeKiller = { once: () => {} }
  const accepted = terminateProcessTree(fakeChild, {
    platform: 'win32',
    spawnProcess: (...args) => { calls.push(args); return fakeKiller },
  })
  assert.equal(accepted, true)
  assert.deepEqual(calls[0][0], 'taskkill')
  assert.deepEqual(calls[0][1], ['/pid', '4242', '/T', '/F'])
})
