const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { loadProjectModel, saveProjectModel } = require('./project-model.cjs')

function makeWorkspace() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'jco-parametric-'))
  const input = path.join(workspace, 'user_inputs')
  fs.mkdirSync(input, { recursive: true })
  fs.writeFileSync(path.join(input, 'device_parameters_space.json'), '{"alphaSNAIL":[0.16]}\n')
  fs.writeFileSync(path.join(input, 'drive_physical_quantities.json'), JSON.stringify({
    frequency_range: { start: 1e6, step: 1e6, stop: 10e9 },
    source_1_on_port: 1,
    source_1_frequency: 0,
    source_1_linear_amplitude: 'calculate_source_1_amplitude',
    source_1_non_linear_amplitude: 'calculate_source_1_amplitude',
  }))
  fs.writeFileSync(path.join(input, 'optimizer_config.json'), '{}\n')
  fs.writeFileSync(path.join(input, 'simulation_config.json'), '{}\n')
  fs.writeFileSync(path.join(input, 'user_circuit.jl'), 'function create_user_circuit(device_params_set)\n x = device_params_set[:alphaSNAIL]\nend\n')
  fs.writeFileSync(path.join(input, 'user_cost_and_performance.jl'), 'function user_cost(sol, device_params_set, nonlinear_correction)\n return (metric = 0.0,)\nend\nfunction user_performance(sol, device_params_set, source_amps, source_freqs)\n return (performance = 0.0,)\nend\n')
  fs.writeFileSync(path.join(input, 'user_metric_utils.jl'), 'metric_helper() = 1\n')
  fs.writeFileSync(path.join(input, 'user_parametric_sources.jl'), 'function calculate_source_1_amplitude(device_params_set::Dict)\n return device_params_set[:alphaSNAIL]\nend\n')
  fs.writeFileSync(path.join(input, 'flux_curve.txt'), '0.10,0.35\n0.20,0.37\n')
  return workspace
}

test('loads and persists calibration text files while preserving function-name source amplitudes', () => {
  const workspace = makeWorkspace()
  try {
    const project = loadProjectModel(workspace, null, { name: 'Parametric source test' })
    assert.equal(project.auxiliaryTextFiles['flux_curve.txt'], '0.10,0.35\n0.20,0.37\n')
    assert.equal(project.sources[0].linearAmplitude.value, 'calculate_source_1_amplitude')

    project.auxiliaryTextFiles['replacement_curve.txt'] = '1,2\n3,4\n'
    delete project.auxiliaryTextFiles['flux_curve.txt']
    saveProjectModel(workspace, project)

    assert.equal(fs.existsSync(path.join(workspace, 'user_inputs', 'flux_curve.txt')), false)
    assert.equal(fs.readFileSync(path.join(workspace, 'user_inputs', 'replacement_curve.txt'), 'utf8'), '1,2\n3,4\n')
    const drives = JSON.parse(fs.readFileSync(path.join(workspace, 'user_inputs', 'drive_physical_quantities.json'), 'utf8'))
    assert.equal(drives.source_1_linear_amplitude, 'calculate_source_1_amplitude')
    assert.equal(drives.source_1_non_linear_amplitude, 'calculate_source_1_amplitude')
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true })
  }
})

test('persists device parameter display units through save and reload', () => {
  const workspace = makeWorkspace()
  try {
    const project = loadProjectModel(workspace, null, { name: 'Parameter unit test' })
    project.parameters[0].unit = 'µm²'

    saveProjectModel(workspace, project)

    const metadata = JSON.parse(fs.readFileSync(path.join(workspace, 'jco_gui_metadata.json'), 'utf8'))
    assert.equal(metadata.parameterUnits.alphaSNAIL, 'µm²')

    const reloaded = loadProjectModel(workspace, null, { name: 'Parameter unit test' })
    assert.equal(reloaded.parameters[0].unit, 'µm²')
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true })
  }
})

test('rejects malformed required JSON instead of loading defaults', () => {
  const workspace = makeWorkspace()
  try {
    const file = path.join(workspace, 'user_inputs', 'device_parameters_space.json')
    fs.writeFileSync(file, '{"alphaSNAIL": [0.16]\n')

    assert.throws(
      () => loadProjectModel(workspace, null, { name: 'Corrupt project' }),
      /Unable to read required JSON device_parameters_space\.json/,
    )
    assert.equal(fs.readFileSync(file, 'utf8'), '{"alphaSNAIL": [0.16]\n')
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true })
  }
})

test('refuses to overwrite malformed existing configuration during save', () => {
  const workspace = makeWorkspace()
  try {
    const project = loadProjectModel(workspace, null, { name: 'Corrupt save test' })
    const file = path.join(workspace, 'user_inputs', 'drive_physical_quantities.json')
    const corrupt = '{"frequency_range":'
    fs.writeFileSync(file, corrupt)

    assert.throws(
      () => saveProjectModel(workspace, project),
      /Unable to read JSON drive_physical_quantities\.json/,
    )
    assert.equal(fs.readFileSync(file, 'utf8'), corrupt)
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true })
  }
})

test('deletes optional Julia hook files when their editor contents are cleared', () => {
  const workspace = makeWorkspace()
  try {
    const project = loadProjectModel(workspace, null, { name: 'Optional hooks test' })
    project.helpersCode = '   \n'
    project.parametricSourcesCode = ''

    saveProjectModel(workspace, project)

    assert.equal(fs.existsSync(path.join(workspace, 'user_inputs', 'user_metric_utils.jl')), false)
    assert.equal(fs.existsSync(path.join(workspace, 'user_inputs', 'user_parametric_sources.jl')), false)
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true })
  }
})
