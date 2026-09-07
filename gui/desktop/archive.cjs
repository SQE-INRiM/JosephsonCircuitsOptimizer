const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const AdmZip = require('adm-zip')

const FORMAT = 'jco.project/1'
const REQUIRED_INPUTS = [
  'device_parameters_space.json',
  'drive_physical_quantities.json',
  'optimizer_config.json',
  'simulation_config.json',
  'user_circuit.jl',
  'user_cost_and_performance.jl',
]
const IGNORED_PARTS = new Set(['.git', '__pycache__', '.ipynb_checkpoints', 'node_modules'])

function isIgnored(relativePath) {
  return relativePath.split(/[\\/]/).some((part) => IGNORED_PARTS.has(part))
}

function findWorkspaceRoot(selectedPath) {
  const direct = path.join(selectedPath, 'user_inputs')
  if (fs.existsSync(direct)) return selectedPath
  const children = fs.readdirSync(selectedPath, { withFileTypes: true }).filter((entry) => entry.isDirectory())
  const candidates = children.map((entry) => path.join(selectedPath, entry.name)).filter((candidate) => fs.existsSync(path.join(candidate, 'user_inputs')))
  if (candidates.length === 1) return candidates[0]
  throw new Error('The selected folder must contain user_inputs/, directly or in one single child folder.')
}

function validateWorkspace(workspace) {
  const inputDir = path.join(workspace, 'user_inputs')
  const missing = REQUIRED_INPUTS.filter((name) => !fs.existsSync(path.join(inputDir, name)))
  return {
    valid: missing.length === 0,
    missing,
    inputDir,
  }
}

function copyWorkspace(source, destination) {
  fs.rmSync(destination, { recursive: true, force: true })
  fs.mkdirSync(destination, { recursive: true })
  fs.cpSync(source, destination, {
    recursive: true,
    filter: (sourcePath) => {
      const relative = path.relative(source, sourcePath)
      return !isIgnored(relative)
    },
  })
}

function addTree(zip, root, current = root, prefix = 'workspace') {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name)
    const relative = path.relative(root, absolute).replaceAll(path.sep, '/')
    if (isIgnored(relative)) continue
    if (entry.isDirectory()) addTree(zip, root, absolute, prefix)
    else if (entry.isFile()) {
      const relativeDirectory = path.posix.dirname(relative) === '.' ? '' : path.posix.dirname(relative)
      const destination = [prefix, relativeDirectory].filter(Boolean).join('/')
      zip.addLocalFile(absolute, destination)
    }
  }
}

function packProject(workspace, targetPath, extra = {}) {
  const validation = validateWorkspace(workspace)
  if (!validation.valid) throw new Error(`Cannot save project: missing ${validation.missing.join(', ')}`)
  const manifest = {
    format: FORMAT,
    archive: 'zip',
    createdAt: extra.createdAt || new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    projectId: extra.projectId || crypto.randomUUID(),
    name: extra.name || path.basename(targetPath, path.extname(targetPath)),
    workspaceRoot: 'workspace/',
    jcoCompatibility: '>=1.0.0',
  }
  const zip = new AdmZip()
  zip.addFile('manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'))
  addTree(zip, workspace)
  const temp = `${targetPath}.tmp-${process.pid}`
  zip.writeZip(temp)
  fs.rmSync(targetPath, { force: true })
  fs.renameSync(temp, targetPath)
  return manifest
}

function packWorkspaceZip(workspace, targetPath) {
  const validation = validateWorkspace(workspace)
  if (!validation.valid) throw new Error(`Cannot export workspace: missing ${validation.missing.join(', ')}`)
  const zip = new AdmZip()
  addTree(zip, workspace, workspace, '')
  const temp = `${targetPath}.tmp-${process.pid}`
  zip.writeZip(temp)
  fs.rmSync(targetPath, { force: true })
  fs.renameSync(temp, targetPath)
  return targetPath
}

function assertSafeEntries(zip) {
  for (const entry of zip.getEntries()) {
    const normalized = path.posix.normalize(entry.entryName.replaceAll('\\', '/'))
    if (normalized.startsWith('../') || normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
      throw new Error(`Unsafe archive entry: ${entry.entryName}`)
    }
  }
}

function unpackProject(projectPath, destination) {
  const zip = new AdmZip(projectPath)
  assertSafeEntries(zip)
  const manifestEntry = zip.getEntry('manifest.json')
  if (!manifestEntry) throw new Error('Not a JCO project: manifest.json is missing.')
  const manifest = JSON.parse(manifestEntry.getData().toString('utf8'))
  if (manifest.format !== FORMAT) throw new Error(`Unsupported JCO project format: ${manifest.format}`)
  fs.rmSync(destination, { recursive: true, force: true })
  fs.mkdirSync(destination, { recursive: true })
  for (const entry of zip.getEntries()) {
    if (!entry.entryName.startsWith('workspace/')) continue
    const relative = entry.entryName.slice('workspace/'.length)
    if (!relative) continue
    const target = path.join(destination, ...relative.split('/'))
    if (entry.isDirectory) fs.mkdirSync(target, { recursive: true })
    else {
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, entry.getData())
    }
  }
  const validation = validateWorkspace(destination)
  if (!validation.valid) throw new Error(`Project is missing required inputs: ${validation.missing.join(', ')}`)
  return manifest
}

module.exports = {
  FORMAT,
  REQUIRED_INPUTS,
  copyWorkspace,
  findWorkspaceRoot,
  packProject,
  packWorkspaceZip,
  unpackProject,
  validateWorkspace,
}
