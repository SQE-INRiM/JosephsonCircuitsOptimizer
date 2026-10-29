const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { isProvablyEmptyRun, updateLatestPointer } = require('./empty-run-cleanup.cjs')
const RUN_A = 'output_2026-10-29_10-00-00-000Z'
const RUN_B = 'output_2026-10-29_11-00-00-000Z'

function fixture() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'jco-empty-run-test-'))
  const outputs = path.join(workspace, 'outputs')
  fs.mkdirSync(outputs)
  const run = path.join(outputs, RUN_A)
  fs.mkdirSync(path.join(run, 'simulation_info'), { recursive: true })
  fs.mkdirSync(path.join(run, 'inputs_snapshot'))
  fs.writeFileSync(path.join(run, 'simulation_info', 'run_config.json'), JSON.stringify({ results: { best_metric: null, best_device_parameters: null, metric_history: { metrics: [], params_vecs: [] } } }))
  fs.writeFileSync(path.join(run, 'simulation_info', 'status.json'), JSON.stringify({ status: 'failed' }))
  fs.writeFileSync(path.join(run, 'inputs_snapshot', 'device_parameters_space.json'), '{"N":100}')
  fs.writeFileSync(path.join(run, 'inputs_snapshot', 'jco_gui_metadata.json'), '{"sourceDisplay":{"source_1":{"nonlinearAmplitudeUnit":"dBm"}}}')
  return { workspace, outputs, run }
}

test('only a finished metadata-only run is eligible for automatic removal', (t) => {
  const f = fixture()
  t.after(() => fs.rmSync(f.workspace, { recursive: true, force: true }))
  assert.equal(isProvablyEmptyRun(f.workspace, RUN_A), true)
  assert.equal(isProvablyEmptyRun(f.workspace, '../../other'), false)
  assert.equal(isProvablyEmptyRun(f.workspace, RUN_B), false)
})

test('never discard partial Linear, HB, saved data, logs outside bookkeeping or unknown output files', (t) => {
  const f = fixture()
  t.after(() => fs.rmSync(f.workspace, { recursive: true, force: true }))
  for (const file of ['df_uniform_analysis.h5', 'df_nonlinear_analysis.h5', 'df_optimization_analysis.h5',
    'optimal_device_parameters.json', 'nonlinear_traces.h5']) {
    const p = path.join(f.run, file)
    fs.writeFileSync(p, 'numeric result')
    assert.equal(isProvablyEmptyRun(f.workspace, RUN_A), false, file)
    fs.rmSync(p)
  }
  fs.mkdirSync(path.join(f.run, 'saved_data'))
  fs.writeFileSync(path.join(f.run, 'saved_data', 'linear.h5'), 'saved data')
  assert.equal(isProvablyEmptyRun(f.workspace, RUN_A), false)
  fs.rmSync(path.join(f.run, 'saved_data'), { recursive: true })
  fs.writeFileSync(path.join(f.run, 'unknown.dat'), 'value')
  assert.equal(isProvablyEmptyRun(f.workspace, RUN_A), false)
})

test('preserve run when optimizer bookkeeping contains recorded metric history', (t) => {
  const f = fixture()
  t.after(() => fs.rmSync(f.workspace, { recursive: true, force: true }))
  fs.writeFileSync(path.join(f.run, 'simulation_info', 'run_config.json'),
    JSON.stringify({ results: { metric_history: { metrics: [-11] } } }))
  assert.equal(isProvablyEmptyRun(f.workspace, RUN_A), false)
})

test('preserve numerical best metrics even without HDF5 arrays', (t) => {
  const f = fixture()
  t.after(() => fs.rmSync(f.workspace, { recursive: true, force: true }))
  fs.writeFileSync(path.join(f.run, 'simulation_info', 'run_config.json'),
    JSON.stringify({ results: { best_metric: -12.5, best_device_parameters: null,
      metric_history: { metrics: [] } } }))
  assert.equal(isProvablyEmptyRun(f.workspace, RUN_A), false)
})

test('invalid metadata is not treated as evidence of emptiness', (t) => {
  const f = fixture()
  t.after(() => fs.rmSync(f.workspace, { recursive: true, force: true }))
  fs.writeFileSync(path.join(f.run, 'simulation_info', 'run_config.json'), '{not-json')
  assert.equal(isProvablyEmptyRun(f.workspace, RUN_A), false)
})

test('after deletion LATEST pointer selects the newest remaining run', (t) => {
  const f = fixture()
  t.after(() => fs.rmSync(f.workspace, { recursive: true, force: true }))
  const second = path.join(f.outputs, RUN_B)
  fs.mkdirSync(second)
  fs.writeFileSync(path.join(f.outputs, 'LATEST.txt'), f.run + '\n')
  fs.rmSync(f.run, { recursive: true })
  updateLatestPointer(f.workspace, f.run)
  assert.equal(fs.readFileSync(path.join(f.outputs, 'LATEST.txt'), 'utf8').trim(), second)
  fs.rmSync(second, { recursive: true })
  updateLatestPointer(f.workspace, second)
  assert.equal(fs.existsSync(path.join(f.outputs, 'LATEST.txt')), false)
})
