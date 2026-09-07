const fs = require('fs')
const path = require('path')
const { validateWorkspace } = require('./archive.cjs')

const GUI_METADATA_FILE = 'jco_gui_metadata.json'
const DEFAULT_SOURCE_IMPEDANCE_OHM = 50

function readJson(file, fallback = {}, { required = false, preserveMalformed = false } = {}) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    if (required || (preserveMalformed && error?.code !== 'ENOENT')) {
      const kind = required ? 'required JSON' : 'JSON'
      throw new Error(`Unable to read ${kind} ${path.basename(file)}: ${error.message}`)
    }
    return fallback
  }
}

function readText(file, fallback = '', { required = false } = {}) {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch (error) {
    if (required) throw new Error(`Unable to read required input ${path.basename(file)}: ${error.message}`)
    return fallback
  }
}

function writeOptionalText(file, content) {
  const text = String(content ?? '')
  if (text.trim()) fs.writeFileSync(file, text)
  else fs.rmSync(file, { force: true })
}

function readAuxiliaryTextFiles(input) {
  const result = {}
  for (const name of fs.readdirSync(input)) {
    const filePath = path.join(input, name)
    if (!/\.txt$/i.test(name) || !fs.statSync(filePath).isFile()) continue
    result[name] = readText(filePath)
  }
  return result
}

function extractDeviceParameterNames(code) {
  const executableCode = code.replace(/#=[\s\S]*?=#/g, '').replace(/#.*$/gm, '')
  const names = []
  const seen = new Set()
  const parameterSets = ['device_params_set', 'device_parameters_set']
  const signature = executableCode.match(/(?:function\s+)?create_user_circuit\s*\(\s*([A-Za-z_]\w*)/)
  if (signature?.[1] && !parameterSets.includes(signature[1])) parameterSets.unshift(signature[1])
  const pattern = new RegExp(`\\b(?:${parameterSets.join('|')})\\s*\\[\\s*:([A-Za-z_]\\w*)\\s*\\]`, 'g')
  for (const match of executableCode.matchAll(pattern)) {
    const name = match[1]
    if (!seen.has(name)) {
      seen.add(name)
      names.push(name)
    }
  }
  return names
}

function parameterFromEntry([name, raw], circuitStatus = 'configured', unit = '—') {
  const displayUnit = typeof unit === 'string' && unit.trim() ? unit : '—'
  if (Array.isArray(raw)) {
    if (raw.length <= 1) return { id: name, name, mode: 'Fixed', value: String(raw[0] ?? ''), unit: displayUnit, role: 'Fixed model', circuitStatus }
    return { id: name, name, mode: 'List', values: raw.join(', '), unit: displayUnit, role: 'Design', circuitStatus }
  }
  if (raw && typeof raw === 'object' && 'start' in raw) {
    return { id: name, name, mode: 'Range', start: String(raw.start), stop: String(raw.stop), step: String(raw.step), unit: displayUnit, role: 'Design', circuitStatus }
  }
  return { id: name, name, mode: 'Fixed', value: String(raw ?? ''), unit: displayUnit, role: 'Fixed model', circuitStatus }
}

function parametersFromCircuitAndJson(circuitCode, raw, metadata = {}) {
  const referenced = extractDeviceParameterNames(circuitCode)
  const parameterUnits = metadata.parameterUnits || {}
  const result = []
  for (const name of referenced) {
    const unit = parameterUnits[name] ?? '—'
    if (Object.prototype.hasOwnProperty.call(raw, name)) result.push(parameterFromEntry([name, raw[name]], 'configured', unit))
    else result.push({ id: name, name, mode: 'Fixed', value: '', unit, role: 'Fixed model', circuitStatus: 'missing' })
  }
  for (const [name, value] of Object.entries(raw)) {
    if (!referenced.includes(name)) result.push(parameterFromEntry([name, value], 'unused', parameterUnits[name] ?? '—'))
  }
  return result
}

function scaledDisplay(value, scale = 1) {
  if (typeof value === 'number') return String(value / scale)
  return String(value ?? '')
}

function valueSpecFromRaw(raw, scale = 1) {
  if (Array.isArray(raw)) {
    if (raw.length <= 1) return { mode: 'Fixed', value: scaledDisplay(raw[0], scale) }
    return { mode: 'List', values: raw.map((value) => scaledDisplay(value, scale)).join(', ') }
  }
  if (raw && typeof raw === 'object' && 'start' in raw) {
    return {
      mode: 'Range',
      start: scaledDisplay(raw.start, scale),
      stop: scaledDisplay(raw.stop, scale),
      step: scaledDisplay(raw.step, scale),
    }
  }
  return { mode: 'Fixed', value: scaledDisplay(raw, scale) }
}

function isDcFrequency(raw) {
  if (Array.isArray(raw)) return raw.length > 0 && raw.every((value) => Number(value) === 0)
  if (raw && typeof raw === 'object' && 'start' in raw) return Number(raw.start) === 0 && Number(raw.stop) === 0
  return Number(raw) === 0
}

function sourcesFromJson(raw, metadata = {}) {
  const sourceDisplay = metadata.sourceDisplay || {}
  const ids = [...new Set(Object.keys(raw).map((key) => key.match(/^source_(\d+)_/)?.[1]).filter(Boolean))].sort((a, b) => Number(a) - Number(b))
  return ids.map((id) => {
    const frequency = raw[`source_${id}_frequency`]
    const linearAmplitude = raw[`source_${id}_linear_amplitude`]
    const hbAmplitude = raw[`source_${id}_non_linear_amplitude`]
    const coreKeys = new Set(['on_port', 'frequency', 'linear_amplitude', 'non_linear_amplitude'])
    const extras = Object.fromEntries(Object.entries(raw)
      .filter(([key]) => key.startsWith(`source_${id}_`))
      .map(([key, value]) => [key.slice(`source_${id}_`.length), value])
      .filter(([suffix]) => !coreKeys.has(suffix)))
    const isDc = isDcFrequency(frequency)
    const display = sourceDisplay[`source_${id}`] || {}
    return {
      id: `source_${id}`,
      name: `Source ${id}`,
      port: Number(raw[`source_${id}_on_port`] ?? Number(id)),
      isDc,
      frequency: isDc ? { mode: 'Fixed', value: '0' } : valueSpecFromRaw(frequency, 1e9),
      linearAmplitude: display.linearAmplitude || valueSpecFromRaw(linearAmplitude),
      nonlinearAmplitude: display.nonlinearAmplitude || valueSpecFromRaw(hbAmplitude),
      linearAmplitudeUnit: display.linearAmplitudeUnit === 'dBm' ? 'dBm' : 'A',
      nonlinearAmplitudeUnit: display.nonlinearAmplitudeUnit === 'dBm' ? 'dBm' : 'A',
      impedanceOhm: Number(display.impedanceOhm) > 0 ? Number(display.impedanceOhm) : DEFAULT_SOURCE_IMPEDANCE_OHM,
      extras,
    }
  })
}

function normalizeComputation(drives, sim, opt) {
  const range = drives.frequency_range || { start: 0, stop: 10e9, step: 1e6 }
  const samplerName = String(opt.sampling_strategy ?? 'RandomSample').toLowerCase()
  const sampler = samplerName === 'sobol' || samplerName === 'sobolsample'
    ? 'SobolSample'
    : samplerName === 'lhs' || samplerName === 'latinhypercubesample'
      ? 'LatinHypercubeSample'
      : 'RandomSample'
  return {
    frequencyStartGHz: Number(range.start) / 1e9,
    frequencyStopGHz: Number(range.stop) / 1e9,
    frequencyStepMHz: Number(range.step) / 1e6,
    linearStrongToneHarmonics: Number(sim.linear_strong_tone_harmonics ?? 1),
    linearModulationHarmonics: Number(sim.linear_modulation_harmonics ?? 1),
    nonlinearStrongToneHarmonics: Number(sim.nonlinear_strong_tone_harmonics ?? 1),
    nonlinearModulationHarmonics: Number(sim.nonlinear_modulation_harmonics ?? 1),
    maxSimulatorIterations: Number(sim.max_simulator_iterations ?? 200),
    solverFtol: Number(sim.ftol ?? 1e-8),
    switchOffLineSearchTolerance: Number(sim.switchofflinesearchtol ?? 1e-5),
    alphaMin: Number(sim.alphamin ?? 1e-4),
    maxIntermodOrder: String(sim.maxintermodorder ?? 'Inf'),
    solverBatches: Number(sim.nbatches ?? 0),
    nodeSorting: ['number', 'name', 'none'].includes(sim.sorting) ? sim.sorting : 'number',
    optimizerIterations: Number(opt.max_optimizer_iterations ?? 5),
    samplesPerIteration: Number(opt.new_samples_per_optimizer_iteration ?? 5),
    surrogate: String(opt.surrogate_model ?? 'Kriging'),
    strategy: String(opt.optimizer_strategy ?? 'SRBF'),
    sampler,
    randomSeed: Number(opt.random_seed ?? 1234),
    threeWaveMixing: Boolean(sim.threewavemixing),
    fourWaveMixing: Boolean(sim.fourwavemixing),
    nonlinearCorrectionCycles: Number(sim.n_iterations_nonlinear_correction ?? 0),
  }
}

function functionSection(code, name) {
  const start = new RegExp(`\\bfunction\\s+${name}\\s*\\(`).exec(code)
  if (!start) return null
  const rest = code.slice(start.index + start[0].length)
  const nextFunction = /\n\s*function\s+[A-Za-z_]\w*\s*\(/.exec(rest)
  return rest.slice(0, nextFunction?.index ?? rest.length)
}

function namedTupleFields(section) {
  const returns = [...section.matchAll(/\breturn\b/g)]
  for (const match of returns.reverse()) {
    let cursor = match.index + match[0].length
    while (/\s/.test(section[cursor] || '')) cursor += 1
    if (section[cursor] !== '(') continue

    let depth = 0
    let quote = ''
    let escaped = false
    let end = -1
    for (let index = cursor; index < section.length; index += 1) {
      const char = section[index]
      if (quote) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === quote) quote = ''
        continue
      }
      if (char === '"' || char === "'") { quote = char; continue }
      if (char === '(') depth += 1
      else if (char === ')' && --depth === 0) { end = index; break }
    }
    if (end < 0) continue

    const content = section.slice(cursor + 1, end)
    const fields = []
    let itemStart = 0
    depth = 0
    quote = ''
    escaped = false
    for (let index = 0; index <= content.length; index += 1) {
      const char = content[index] || ','
      if (quote) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === quote) quote = ''
        continue
      }
      if (char === '"' || char === "'") { quote = char; continue }
      if ('([{'.includes(char)) depth += 1
      else if (')]}'.includes(char)) depth -= 1
      else if (char === ',' && depth === 0) {
        const field = content.slice(itemStart, index).trim().replace(/^;/, '').trim().match(/^([A-Za-z_]\w*)\s*=/)?.[1]
        if (field) fields.push(field)
        itemStart = index + 1
      }
    }
    if (fields.length) return fields
  }
  return []
}

function metricsFromCode(code) {
  const executableCode = code.replace(/#=[\s\S]*?=#/g, '').replace(/#.*$/gm, '')
  const definitions = [
    { source: 'user_cost', stage: 'Linear', defaultName: 'metric', direction: 'Minimize' },
    { source: 'user_performance', stage: 'Nonlinear', defaultName: 'performance', direction: 'Maximize' },
  ]
  return definitions.flatMap((definition) => {
    const section = functionSection(executableCode, definition.source)
    if (section === null) return []
    const names = namedTupleFields(section)
    const returnedNames = names.length ? names : [definition.defaultName]
    return returnedNames.map((name, index) => ({
      id: `${definition.source}:${name}:${index}`,
      name,
      source: definition.source,
      stage: definition.stage,
      position: index + 1,
      purpose: index === 0 ? 'Objective' : 'Analysis',
      direction: index === 0 ? definition.direction : '—',
    }))
  })
}

function loadProjectModel(workspace, projectPath, manifest = {}) {
  const validation = validateWorkspace(workspace)
  if (!validation.valid) throw new Error(`Missing required inputs: ${validation.missing.join(', ')}`)
  const input = validation.inputDir
  const parametersRaw = readJson(path.join(input, 'device_parameters_space.json'), {}, { required: true })
  const drives = readJson(path.join(input, 'drive_physical_quantities.json'), {}, { required: true })
  const sim = readJson(path.join(input, 'simulation_config.json'), {}, { required: true })
  const opt = readJson(path.join(input, 'optimizer_config.json'), {}, { required: true })
  const guiMetadata = readJson(path.join(workspace, GUI_METADATA_FILE))
  const costCode = readText(path.join(input, 'user_cost_and_performance.jl'), '', { required: true })
  const circuitCode = readText(path.join(input, 'user_circuit.jl'), '', { required: true })
  return {
    name: manifest.name || path.basename(projectPath || workspace, path.extname(projectPath || workspace)),
    filename: projectPath ? path.basename(projectPath) : manifest.fileName || `${manifest.name || path.basename(workspace)}.jco`,
    schemaVersion: manifest.format || 'jco.project/1',
    circuitCode,
    metricsCode: costCode,
    helpersCode: readText(path.join(input, 'user_metric_utils.jl')),
    parametricSourcesCode: readText(path.join(input, 'user_parametric_sources.jl')),
    auxiliaryTextFiles: readAuxiliaryTextFiles(input),
    parameters: parametersFromCircuitAndJson(circuitCode, parametersRaw, guiMetadata),
    sources: sourcesFromJson(drives, guiMetadata),
    metrics: metricsFromCode(costCode),
    computation: normalizeComputation(drives, sim, opt),
    workspaceInfo: {
      path: workspace,
      projectPath: projectPath || null,
      auxiliaryFiles: fs.readdirSync(input).filter((name) => !name.endsWith('.json') && !name.endsWith('.jl')),
    },
  }
}

function numeric(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  const number = Number(text)
  return Number.isFinite(number) ? number : value
}

function structured(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  try { return JSON.parse(text) } catch { return numeric(text) }
}

function parameterToJson(parameter) {
  if (parameter.mode === 'Range') return { start: numeric(parameter.start), step: numeric(parameter.step), stop: numeric(parameter.stop) }
  if (parameter.mode === 'List') return String(parameter.values || '').split(',').map((value) => numeric(value.trim())).filter((value) => value !== '')
  const value = numeric(parameter.value)
  return value === '' ? [] : [value]
}

function listValues(text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return []
  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed)
    if (!Array.isArray(parsed)) throw new Error('List values must be a JSON array or comma-separated values.')
    return parsed
  }
  return trimmed.split(',').map((value) => structured(value.trim())).filter((value) => value !== '')
}

function scaledValue(value, scale) {
  return typeof value === 'number' ? value * scale : value
}

function valueSpecToJson(spec, scale = 1) {
  if (spec.mode === 'Range') return {
    start: scaledValue(structured(spec.start), scale),
    step: scaledValue(structured(spec.step), scale),
    stop: scaledValue(structured(spec.stop), scale),
  }
  if (spec.mode === 'List') return listValues(spec.values).map((value) => scaledValue(value, scale))
  return scaledValue(structured(spec.value), scale)
}

function dbmNumber(value) {
  const text = String(value ?? '').trim()
  if (/^-inf(?:inity)?$/i.test(text)) return Number.NEGATIVE_INFINITY
  const number = Number(text)
  if (!Number.isFinite(number)) throw new Error(`dBm amplitudes must be numeric or -Inf; received ${text || 'empty value'}.`)
  return number
}

function dBmToCurrent(powerDbm, impedanceOhm = DEFAULT_SOURCE_IMPEDANCE_OHM) {
  if (!(impedanceOhm > 0)) throw new Error('Source impedance must be positive.')
  if (powerDbm === Number.NEGATIVE_INFINITY) return 0
  const powerW = 1e-3 * 10 ** (powerDbm / 10)
  return Math.sqrt(powerW / (2 * impedanceOhm))
}

function dbmRangeValues(spec) {
  const start = dbmNumber(spec.start)
  const stop = dbmNumber(spec.stop)
  const step = dbmNumber(spec.step)
  if (![start, stop, step].every(Number.isFinite) || step === 0) throw new Error('A dBm range requires finite start, stop, and non-zero step values.')
  if ((stop - start) * step < 0) throw new Error('The dBm range step must point from start toward stop.')
  const count = Math.floor((stop - start) / step + 1e-10) + 1
  if (count < 1 || count > 100000) throw new Error(`Invalid dBm range point count: ${count}.`)
  return Array.from({ length: count }, (_, index) => start + index * step)
}

function amplitudeSpecToJson(spec, unit = 'A', impedanceOhm = DEFAULT_SOURCE_IMPEDANCE_OHM) {
  if (unit !== 'dBm') return valueSpecToJson(spec)
  if (spec.mode === 'Range') return dbmRangeValues(spec).map((value) => dBmToCurrent(value, impedanceOhm))
  if (spec.mode === 'List') return listValues(spec.values).map((value) => dBmToCurrent(dbmNumber(value), impedanceOhm))
  return dBmToCurrent(dbmNumber(spec.value), impedanceOhm)
}

function saveProjectModel(workspace, project) {
  const input = path.join(workspace, 'user_inputs')
  fs.mkdirSync(input, { recursive: true })
  const existingDrives = readJson(path.join(input, 'drive_physical_quantities.json'), {}, { preserveMalformed: true })
  const existingSim = readJson(path.join(input, 'simulation_config.json'), {}, { preserveMalformed: true })
  const existingOpt = readJson(path.join(input, 'optimizer_config.json'), {}, { preserveMalformed: true })
  const existingGuiMetadata = readJson(path.join(workspace, GUI_METADATA_FILE))
  const parameters = Object.fromEntries(project.parameters.map((parameter) => [parameter.name, parameterToJson(parameter)]))
  const parameterUnits = Object.fromEntries(project.parameters.map((parameter) => [parameter.name, String(parameter.unit ?? '—')]))
  const c = project.computation
  existingDrives.frequency_range = { start: c.frequencyStartGHz * 1e9, step: c.frequencyStepMHz * 1e6, stop: c.frequencyStopGHz * 1e9 }
  for (const key of Object.keys(existingDrives)) {
    if (/^source_\d+_/.test(key)) delete existingDrives[key]
  }
  const sourceDisplay = {}
  for (const [index, source] of project.sources.entries()) {
    const id = String(index + 1)
    const impedanceOhm = Number(source.impedanceOhm) > 0 ? Number(source.impedanceOhm) : DEFAULT_SOURCE_IMPEDANCE_OHM
    const linearAmplitudeUnit = source.linearAmplitudeUnit === 'dBm' ? 'dBm' : 'A'
    const nonlinearAmplitudeUnit = source.nonlinearAmplitudeUnit === 'dBm' ? 'dBm' : 'A'
    existingDrives[`source_${id}_on_port`] = Number(source.port)
    existingDrives[`source_${id}_frequency`] = source.isDc ? 0 : valueSpecToJson(source.frequency, 1e9)
    existingDrives[`source_${id}_linear_amplitude`] = amplitudeSpecToJson(source.linearAmplitude, linearAmplitudeUnit, impedanceOhm)
    existingDrives[`source_${id}_non_linear_amplitude`] = amplitudeSpecToJson(source.nonlinearAmplitude, nonlinearAmplitudeUnit, impedanceOhm)
    sourceDisplay[`source_${id}`] = {
      linearAmplitudeUnit,
      nonlinearAmplitudeUnit,
      impedanceOhm,
      linearAmplitude: source.linearAmplitude,
      nonlinearAmplitude: source.nonlinearAmplitude,
    }
    for (const [suffix, value] of Object.entries(source.extras || {})) existingDrives[`source_${id}_${suffix}`] = value
  }
  Object.assign(existingSim, {
    linear_strong_tone_harmonics: c.linearStrongToneHarmonics,
    linear_modulation_harmonics: c.linearModulationHarmonics,
    nonlinear_strong_tone_harmonics: c.nonlinearStrongToneHarmonics,
    nonlinear_modulation_harmonics: c.nonlinearModulationHarmonics,
    max_simulator_iterations: c.maxSimulatorIterations,
    ftol: c.solverFtol,
    switchofflinesearchtol: c.switchOffLineSearchTolerance,
    alphamin: c.alphaMin,
    maxintermodorder: /^inf(?:inity)?$/i.test(String(c.maxIntermodOrder).trim()) ? 'Inf' : numeric(c.maxIntermodOrder),
    nbatches: c.solverBatches,
    sorting: c.nodeSorting,
    n_iterations_nonlinear_correction: c.nonlinearCorrectionCycles,
    threewavemixing: c.threeWaveMixing,
    fourwavemixing: c.fourWaveMixing,
  })
  delete existingSim.skip_higher_pump_on_nonconvergence
  Object.assign(existingOpt, {
    max_optimizer_iterations: c.optimizerIterations,
    new_samples_per_optimizer_iteration: c.samplesPerIteration,
    surrogate_model: c.surrogate,
    optimizer_strategy: c.optimizerStrategy,
    sampling_strategy: c.sampler,
    random_seed: c.randomSeed,
  })
  existingOpt.optimizer_strategy = c.strategy
  fs.writeFileSync(path.join(input, 'device_parameters_space.json'), `${JSON.stringify(parameters, null, 2)}\n`)
  fs.writeFileSync(path.join(input, 'drive_physical_quantities.json'), `${JSON.stringify(existingDrives, null, 2)}\n`)
  fs.writeFileSync(path.join(input, 'simulation_config.json'), `${JSON.stringify(existingSim, null, 2)}\n`)
  fs.writeFileSync(path.join(input, 'optimizer_config.json'), `${JSON.stringify(existingOpt, null, 2)}\n`)
  fs.writeFileSync(path.join(workspace, GUI_METADATA_FILE), `${JSON.stringify({ ...existingGuiMetadata, schemaVersion: 'jco.gui-metadata/1', sourceDisplay, parameterUnits }, null, 2)}\n`)
  fs.writeFileSync(path.join(input, 'user_circuit.jl'), project.circuitCode)
  fs.writeFileSync(path.join(input, 'user_cost_and_performance.jl'), project.metricsCode)
  writeOptionalText(path.join(input, 'user_metric_utils.jl'), project.helpersCode)
  writeOptionalText(path.join(input, 'user_parametric_sources.jl'), project.parametricSourcesCode)

  const auxiliaryTextFiles = project.auxiliaryTextFiles || {}
  for (const name of fs.readdirSync(input)) {
    if (/\.txt$/i.test(name) && !Object.prototype.hasOwnProperty.call(auxiliaryTextFiles, name)) fs.rmSync(path.join(input, name), { force: true })
  }
  for (const [name, content] of Object.entries(auxiliaryTextFiles)) {
    if (path.basename(name) !== name || !/\.txt$/i.test(name)) throw new Error(`Auxiliary calibration file must be a .txt basename; received ${name}.`)
    fs.writeFileSync(path.join(input, name), String(content), 'utf8')
  }
}

module.exports = {
  DEFAULT_SOURCE_IMPEDANCE_OHM,
  amplitudeSpecToJson,
  dBmToCurrent,
  extractDeviceParameterNames,
  loadProjectModel,
  metricsFromCode,
  parametersFromCircuitAndJson,
  saveProjectModel,
}
