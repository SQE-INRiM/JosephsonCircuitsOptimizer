const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const AdmZip = require('adm-zip')
const { spawn } = require('child_process')
const { Worker } = require('worker_threads')
const readline = require('readline')
const { copyWorkspace, findWorkspaceRoot, packProject, packWorkspaceZip, unpackProject, validateWorkspace } = require('./archive.cjs')
const { loadProjectModel, saveProjectModel } = require('./project-model.cjs')
const { modeForStages } = require('./run-mode.cjs')
const { createRunId, outcomeForClose, requireDurableProject, terminateProcessTree } = require('./run-process.cjs')
const { assertProcessIdle, captureRunSession } = require('./run-session.cjs')

let mainWindow
let session = null
let juliaProcess = null
let stopTimer = null
let activeRun = null

const CANCELLATION_GRACE_MS = 3000

function resourcesRoot() {
  return app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', 'runtime')
}

function examplesRoot() {
  return path.join(resourcesRoot(), 'examples')
}

function examplePath(fileName) {
  const normalized = String(fileName || '')
  if (!normalized.toLowerCase().endsWith('.jco') || path.basename(normalized) !== normalized) {
    throw new Error('Invalid example filename.')
  }
  const root = path.resolve(examplesRoot())
  const target = path.resolve(root, normalized)
  if (path.dirname(target) !== root) throw new Error('Invalid example path.')
  return target
}

function readExampleManifest(filePath) {
  const zip = new AdmZip(filePath)
  const manifestEntry = zip.getEntry('manifest.json')
  if (!manifestEntry) throw new Error('manifest.json is missing')
  const manifest = JSON.parse(manifestEntry.getData().toString('utf8'))
  if (manifest.format !== 'jco.project/1') throw new Error(`unsupported format ${manifest.format}`)
  return manifest
}

function listExamples() {
  const root = examplesRoot()
  if (!fs.existsSync(root)) return []
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.jco'))
    .map((entry) => {
      const fileName = entry.name
      try {
        const manifest = readExampleManifest(path.join(root, fileName))
        return { fileName, name: String(manifest.name || path.basename(fileName, path.extname(fileName))) }
      } catch (error) {
        console.warn(`[JCO GUI] Ignoring invalid example ${fileName}: ${error.message}`)
        return null
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name))
}

function jcoRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'jco')
    : path.resolve(__dirname, '..', '..')
}

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json')
}

function getSettings() {
  try { return { juliaPath: 'julia', threads: 1, ...JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) } }
  catch { return { juliaPath: 'julia', threads: 1 } }
}

function setSettings(patch) {
  const settings = { ...getSettings(), ...patch }
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true })
  fs.writeFileSync(settingsPath(), `${JSON.stringify(settings, null, 2)}\n`)
  return settings
}

function createSessionWorkspace() {
  const root = path.join(app.getPath('userData'), 'active-project', crypto.randomUUID())
  fs.mkdirSync(root, { recursive: true })
  return root
}

function emit(event) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('jco:event', event)
}

function currentModel() {
  if (!session) return null
  return loadProjectModel(session.workspace, session.projectPath, session.manifest)
}

function openWorkspace(source, projectPath = null, manifest = {}) {
  assertProcessIdle(juliaProcess, 'Changing projects')
  const workspace = createSessionWorkspace()
  copyWorkspace(source, workspace)
  session = { workspace, projectPath, manifest: { ...manifest, name: manifest.name || path.basename(source) } }
  return currentModel()
}

async function chooseAndOpenProject() {
  assertProcessIdle(juliaProcess, 'Opening a project')
  const selected = await dialog.showOpenDialog(mainWindow, { title: 'Open JCO project', properties: ['openFile'], filters: [{ name: 'JCO project', extensions: ['jco'] }] })
  if (selected.canceled) return null
  assertProcessIdle(juliaProcess, 'Opening a project')
  const projectPath = selected.filePaths[0]
  const workspace = createSessionWorkspace()
  const manifest = unpackProject(projectPath, workspace)
  session = { workspace, projectPath, manifest }
  return currentModel()
}

async function chooseAndImportWorkspace() {
  assertProcessIdle(juliaProcess, 'Importing a workspace')
  const selected = await dialog.showOpenDialog(mainWindow, { title: 'Import legacy JCO workspace', properties: ['openDirectory'] })
  if (selected.canceled) return null
  const source = findWorkspaceRoot(selected.filePaths[0])
  return openWorkspace(source, null, { name: path.basename(source), importedFrom: source })
}

async function saveCurrent(project, saveAs = false) {
  assertProcessIdle(juliaProcess, 'Saving the project')
  if (!session) throw new Error('No project is open.')
  saveProjectModel(session.workspace, project)
  let target = !saveAs ? session.projectPath : null
  if (!target) {
    const selected = await dialog.showSaveDialog(mainWindow, {
      title: 'Save JCO project',
      defaultPath: project.filename || `${project.name || 'project'}.jco`,
      filters: [{ name: 'JCO project', extensions: ['jco'] }],
    })
    if (selected.canceled || !selected.filePath) return null
    target = selected.filePath.toLowerCase().endsWith('.jco') ? selected.filePath : `${selected.filePath}.jco`
  }
  assertProcessIdle(juliaProcess, 'Saving the project')
  const manifest = packProject(session.workspace, target, { ...session.manifest, name: project.name })
  session.projectPath = target
  session.manifest = manifest
  return { path: target, revision: manifest.modifiedAt, project: currentModel() }
}

async function exportEditableWorkspace(project) {
  assertProcessIdle(juliaProcess, 'Exporting the editable workspace')
  if (!session) throw new Error('No project is open.')
  saveProjectModel(session.workspace, project)
  const fileStem = path.basename(project.filename || `${project.name || 'project'}.jco`, '.jco')
  const selected = await dialog.showSaveDialog(mainWindow, {
    title: 'Export editable JCO workspace',
    defaultPath: `${fileStem}.zip`,
    filters: [{ name: 'ZIP archive', extensions: ['zip'] }],
  })
  if (selected.canceled || !selected.filePath) return null
  assertProcessIdle(juliaProcess, 'Exporting the editable workspace')
  const target = selected.filePath.toLowerCase().endsWith('.zip') ? selected.filePath : `${selected.filePath}.zip`
  return packWorkspaceZip(session.workspace, target)
}

function parseOutputLine(line, runId) {
  const trimmed = line.trim()
  if (!trimmed) return
  let match = trimmed.match(/^STAGE name=(\S+)/)
  if (match) {
    const stage = match[1] === 'LIN' ? 'linear' : match[1] === 'BO' ? 'optimization' : match[1] === 'HB' ? 'hb' : match[1].toLowerCase()
    const now = new Date()
    if (activeRun?.runId === runId) activeRun.stageStartedAt[stage] = now.getTime()
    emit({ type: 'stage-status', runId, stage, status: 'running', timestamp: now.toISOString() })
    return
  }
  match = trimmed.match(/^PROGRESS_DONE stage=(\S+)/)
  if (match) {
    const stage = match[1] === 'LIN' ? 'linear' : match[1] === 'BO' ? 'optimization' : match[1] === 'HB' ? 'hb' : match[1].toLowerCase()
    const now = new Date()
    const startedAt = activeRun?.runId === runId ? activeRun.stageStartedAt?.[stage] : undefined
    emit({ type: 'stage-status', runId, stage, status: 'completed', timestamp: now.toISOString(), durationSeconds: startedAt ? (now.getTime() - startedAt) / 1000 : undefined })
    return
  }
  match = trimmed.match(/^PROGRESS i=(\d+) N=(\d+)(?: ETA=([\d.]+)s)? stage=(\S+)/)
  if (match) {
    const stage = match[4] === 'LIN' ? 'linear' : match[4] === 'BO' ? 'optimization' : 'hb'
    emit({ type: 'progress', runId, stage, completed: Number(match[1]), total: Number(match[2]), etaSeconds: match[3] ? Number(match[3]) : undefined, timestamp: new Date().toISOString() })
    return
  }
  const levelMatch = trimmed.match(/^\[\d\d:\d\d:\d\d\] \[(INFO|WARN|ERROR|DEBUG)\] (.*)$/)
  emit({ type: 'log', runId, level: levelMatch?.[1] === 'DEBUG' ? 'INFO' : levelMatch?.[1] || 'INFO', message: levelMatch?.[2] || trimmed, timestamp: new Date().toISOString() })
}

async function startRun(request) {
  if (juliaProcess) throw new Error('A simulation is already running.')
  if (!session) throw new Error('Open or import a project first.')
  requireDurableProject(session)
  saveProjectModel(session.workspace, request.project)
  const validation = validateWorkspace(session.workspace)
  if (!validation.valid) throw new Error(`Missing inputs: ${validation.missing.join(', ')}`)
  const settings = getSettings()
  const runId = createRunId()
  const runSession = captureRunSession(session, runId)
  const bootstrap = path.join(resourcesRoot(), 'bridge', 'run.jl')
  const mode = modeForStages(request.stages)
  const args = ['--startup-file=no', '--color=no', `--project=${jcoRoot()}`, bootstrap]
  juliaProcess = spawn(settings.juliaPath || 'julia', args, {
    cwd: jcoRoot(),
    env: { ...process.env, JCO_PROJECT: jcoRoot(), JCO_WORKSPACE: runSession.workspace, JCO_MODE: mode, JCO_RUN_ID: runId, JULIA_NUM_THREADS: String(Math.max(1, settings.threads || 1)) },
    windowsHide: true,
  })
  activeRun = { ...runSession, cancelRequested: false, stageStartedAt: {} }
  emit({ type: 'run-started', runId, timestamp: new Date().toISOString() })
  readline.createInterface({ input: juliaProcess.stdout }).on('line', (line) => parseOutputLine(line, runId))
  readline.createInterface({ input: juliaProcess.stderr }).on('line', (line) => parseOutputLine(line, runId))
  juliaProcess.on('error', (error) => emit({ type: 'log', runId, level: 'ERROR', message: error.message, timestamp: new Date().toISOString() }))
  juliaProcess.on('close', async (code) => {
    if (stopTimer) clearTimeout(stopTimer)
    stopTimer = null
    const cancelRequested = activeRun?.runId === runId && activeRun.cancelRequested
    juliaProcess = null
    activeRun = null
    const outcome = outcomeForClose(code, cancelRequested)
    try { fs.rmSync(path.join(runSession.workspace, 'STOP'), { force: true }) } catch {}
    if (runSession.projectPath) {
      try { packProject(runSession.workspace, runSession.projectPath, runSession.manifest) } catch (error) { parseOutputLine(`Auto-save failed: ${error.message}`, runId) }
    }
    emit({ type: 'run-finished', runId, outcome, timestamp: new Date().toISOString() })
  })
  return { runId }
}

async function cancelRun(_event, requestedRunId) {
  if (!juliaProcess || !activeRun) return { accepted: false, message: 'No simulation is running.' }
  if (requestedRunId && requestedRunId !== 'current' && requestedRunId !== activeRun.runId) {
    return { accepted: false, message: `Run ${requestedRunId} is not active.` }
  }
  if (activeRun.cancelRequested) return { accepted: true, runId: activeRun.runId, alreadyRequested: true }
  activeRun.cancelRequested = true
  emit({ type: 'log', runId: activeRun.runId, level: 'WARN', message: `Cancellation requested. Julia has ${CANCELLATION_GRACE_MS / 1000} seconds to stop cleanly before its process tree is terminated.`, timestamp: new Date().toISOString() })
  try {
    fs.writeFileSync(path.join(activeRun.workspace, 'STOP'), 'Stop requested by JCO GUI\n')
  } catch (error) {
    emit({ type: 'log', runId: activeRun.runId, level: 'WARN', message: `The graceful stop request could not be written (${error.message}); forced termination will still run.`, timestamp: new Date().toISOString() })
  }
  stopTimer = setTimeout(() => {
    if (!juliaProcess || !activeRun?.cancelRequested) return
    emit({ type: 'log', runId: activeRun.runId, level: 'WARN', message: 'Julia did not stop during the grace period; terminating the simulation process tree.', timestamp: new Date().toISOString() })
    terminateProcessTree(juliaProcess)
  }, CANCELLATION_GRACE_MS)
  return { accepted: true, runId: activeRun.runId }
}

function runJuliaJson(scriptName, extraArgs = []) {
  return new Promise((resolve, reject) => {
    if (!session) return reject(new Error('No project is open.'))
    const settings = getSettings()
    const script = path.join(resourcesRoot(), 'bridge', scriptName)
    const child = spawn(settings.juliaPath || 'julia', ['--startup-file=no', '--color=no', `--project=${jcoRoot()}`, script, session.workspace, ...extraArgs], { cwd: jcoRoot(), windowsHide: true })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(stderr.trim() || `Julia bridge exited with code ${code}`))
      else {
        try { resolve(JSON.parse(stdout)) } catch { reject(new Error(`Invalid result data from Julia. ${stderr}`)) }
      }
    })
  })
}

async function previewCircuit(project) {
  if (juliaProcess) throw new Error('Circuit preview is unavailable while a simulation or runtime setup is running.')
  if (!session) throw new Error('Open or import a project first.')
  saveProjectModel(session.workspace, project)
  const validation = validateWorkspace(session.workspace)
  if (!validation.valid) throw new Error(`Missing inputs: ${validation.missing.join(', ')}`)
  return runJuliaJson('circuit_preview.jl')
}

function setupRuntime() {
  return new Promise((resolve, reject) => {
    try { assertProcessIdle(juliaProcess, 'Julia runtime setup') } catch (error) { return reject(error) }
    const settings = getSettings()
    const runId = 'runtime-setup'
    const code = 'using Pkg; Pkg.instantiate(); Pkg.precompile(); println("JCO_RUNTIME_READY")'
    const child = spawn(settings.juliaPath || 'julia', ['--startup-file=no', '--color=no', `--project=${jcoRoot()}`, '-e', code], {
      cwd: jcoRoot(),
      env: { ...process.env, JULIA_NUM_THREADS: String(Math.max(1, settings.threads || 1)) },
      windowsHide: true,
    })
    juliaProcess = child
    let ready = false
    readline.createInterface({ input: child.stdout }).on('line', (line) => {
      if (line.includes('JCO_RUNTIME_READY')) ready = true
      else parseOutputLine(line, runId)
    })
    readline.createInterface({ input: child.stderr }).on('line', (line) => parseOutputLine(line, runId))
    child.on('error', reject)
    child.on('close', (code) => {
      juliaProcess = null
      if (code === 0 && ready) resolve({ ok: true, message: 'Julia and the JCO environment are ready.' })
      else reject(new Error(`Julia environment setup failed (exit code ${code ?? 'unknown'}). Check the runtime log and Julia path.`))
    })
  })
}

function csvCell(value) {
  const text = value == null ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

async function exportData(request) {
  const results = await runJuliaJson('results.jl')
  const run = results.runs?.find((item) => item.id === request.runId)
  if (!run) throw new Error(`Run ${request.runId} is no longer available.`)
  const table = request.stage === 'hb' ? run.nonlinear : run.linear
  if (!table) throw new Error(`No ${request.stage} table is available for this run.`)
  const selectedColumns = request.metrics?.length
    ? table.columns.filter((column) => request.metrics.includes(column))
    : table.columns
  const indices = selectedColumns.map((column) => table.columns.indexOf(column))
  const rows = [selectedColumns, ...table.rows.map((row) => indices.map((index) => row[index]))]
  const output = `${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`
  const selected = await dialog.showSaveDialog(mainWindow, {
    title: 'Export JCO data',
    defaultPath: `${request.runId}_${request.stage}.csv`,
    filters: [{ name: 'CSV data', extensions: ['csv'] }],
  })
  if (selected.canceled || !selected.filePath) return null
  const target = selected.filePath.toLowerCase().endsWith('.csv') ? selected.filePath : `${selected.filePath}.csv`
  fs.writeFileSync(target, output, 'utf8')
  return target
}

async function readSavedTrace(request) {
  if (!request || !request.runId || !request.stage || !Number.isInteger(request.pointId) || !request.quantityName || !request.arrayName) {
    throw new Error('Invalid saved trace request.')
  }
  return runJuliaJson('saved_trace.jl', [
    String(request.runId),
    String(request.stage),
    String(request.pointId),
    String(request.quantityName),
    String(request.arrayName),
  ])
}

function runDeletionWorker(workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'run-delete-worker.cjs'), { workerData })
    let settled = false
    worker.once('message', (result) => {
      settled = true
      if (result?.ok) resolve(result)
      else reject(new Error(result?.error || 'Stored-run deletion failed.'))
    })
    worker.once('error', (error) => { if (!settled) { settled = true; reject(error) } })
    worker.once('exit', (code) => { if (!settled) { settled = true; code === 0 ? reject(new Error('Stored-run deletion worker exited without a result.')) : reject(new Error(`Stored-run deletion worker exited with code ${code}.`)) } })
  })
}

async function deleteRun(requestedRunId) {
  if (!session) throw new Error('No project is open.')
  const runId = String(requestedRunId || '')
  if (!/^output_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(?:-\d{3}Z)?$/.test(runId)) throw new Error('Invalid run ID.')
  if (activeRun?.runId === runId) throw new Error('The active running simulation cannot be deleted.')

  const snapshot = { workspace: session.workspace, projectPath: session.projectPath, manifest: session.manifest }
  const outputsRoot = path.resolve(snapshot.workspace, 'outputs')
  const target = path.resolve(outputsRoot, runId)
  if (path.dirname(target) !== outputsRoot) throw new Error('Invalid run path.')
  if (!fs.existsSync(target)) throw new Error(`Run ${runId} is no longer available.`)

  const result = await runDeletionWorker({ target, workspace: snapshot.workspace, projectPath: !juliaProcess ? snapshot.projectPath : null, manifest: snapshot.manifest })
  if (!session || session.workspace !== snapshot.workspace) throw new Error('The project changed while the stored run was being deleted.')
  if (result.manifest && session.projectPath === snapshot.projectPath) session.manifest = result.manifest
  return runJuliaJson('results.jl')
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: '#f4f7f9',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  })
  mainWindow.removeMenu()
  const devUrl = process.env.JCO_DEV_SERVER_URL
  if (devUrl) mainWindow.loadURL(devUrl)
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

app.whenReady().then(() => {
  ipcMain.handle('jco:new', async () => {
    const template = path.join(resourcesRoot(), 'templates', 'default')
    return openWorkspace(template, null, { name: 'Untitled project' })
  })
  ipcMain.handle('jco:open', chooseAndOpenProject)
  ipcMain.handle('jco:import-workspace', chooseAndImportWorkspace)
  ipcMain.handle('jco:list-examples', () => listExamples())
  ipcMain.handle('jco:open-example', (_event, fileName) => {
    assertProcessIdle(juliaProcess, 'Opening an example')
    const source = examplePath(fileName)
    if (!fs.existsSync(source)) throw new Error(`Example ${fileName} is no longer available.`)
    const workspace = createSessionWorkspace()
    const manifest = unpackProject(source, workspace)
    session = { workspace, projectPath: null, manifest: { ...manifest, fileName } }
    return currentModel()
  })
  ipcMain.handle('jco:save', (_event, project, saveAs) => saveCurrent(project, saveAs))
  ipcMain.handle('jco:export-workspace', (_event, project) => exportEditableWorkspace(project))
  ipcMain.handle('jco:validate', (_event, project) => {
    assertProcessIdle(juliaProcess, 'Validating project changes')
    if (!session) return [{ severity: 'error', path: '', message: 'No project is open.' }]
    saveProjectModel(session.workspace, project)
    const validation = validateWorkspace(session.workspace)
    return validation.missing.map((name) => ({ severity: 'error', path: `user_inputs/${name}`, message: 'Required input is missing.' }))
  })
  ipcMain.handle('jco:preview-circuit', (_event, project) => previewCircuit(project))
  ipcMain.handle('jco:start-run', (_event, request) => startRun(request))
  ipcMain.handle('jco:cancel-run', cancelRun)
  ipcMain.handle('jco:delete-run', (_event, runId) => deleteRun(runId))
  ipcMain.handle('jco:read-results', () => runJuliaJson('results.jl'))
  ipcMain.handle('jco:read-saved-trace', (_event, request) => readSavedTrace(request))
  ipcMain.handle('jco:export-data', (_event, request) => exportData(request))
  ipcMain.handle('jco:get-settings', getSettings)
  ipcMain.handle('jco:set-settings', (_event, patch) => setSettings(patch))
  ipcMain.handle('jco:setup-runtime', setupRuntime)
  ipcMain.handle('jco:show-workspace', () => session ? shell.openPath(session.workspace) : null)
  createWindow()
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
