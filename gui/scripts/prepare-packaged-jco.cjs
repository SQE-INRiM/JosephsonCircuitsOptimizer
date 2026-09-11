'use strict'

const fs = require('fs')
const path = require('path')

const guiRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(guiRoot, '..')
const targetRoot = path.join(guiRoot, 'runtime', 'jco')

function requirePath(target) {
  if (!fs.existsSync(target)) {
    throw new Error(`Required packaging input is missing: ${target}`)
  }
}

function readProjectVersion(projectToml) {
  const match = projectToml.match(/^version\s*=\s*"([^"]+)"/m)
  if (!match) throw new Error('Could not read version from root Project.toml')
  return match[1]
}

for (const relative of ['Project.toml', 'Manifest.toml', 'src']) {
  requirePath(path.join(repoRoot, relative))
}

const packageJson = JSON.parse(fs.readFileSync(path.join(guiRoot, 'package.json'), 'utf8'))
const projectToml = fs.readFileSync(path.join(repoRoot, 'Project.toml'), 'utf8')
const juliaVersion = readProjectVersion(projectToml)

if (String(packageJson.version) !== juliaVersion) {
  throw new Error(
    `GUI version ${packageJson.version} does not match JCO Project.toml version ${juliaVersion}. ` +
    'Keep release versions synchronized before packaging.'
  )
}

fs.rmSync(targetRoot, { recursive: true, force: true })
fs.mkdirSync(targetRoot, { recursive: true })

for (const fileName of ['Project.toml', 'Manifest.toml', 'LICENSE.md']) {
  const source = path.join(repoRoot, fileName)
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, path.join(targetRoot, fileName))
  }
}

fs.cpSync(path.join(repoRoot, 'src'), path.join(targetRoot, 'src'), {
  recursive: true,
  errorOnExist: false,
})

for (const relative of ['Project.toml', 'Manifest.toml', 'src']) {
  requirePath(path.join(targetRoot, relative))
}

console.log(`[JCO GUI] Prepared packaged JCO ${juliaVersion} at ${targetRoot}`)
