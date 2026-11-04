const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const { resolveNpmCli } = require('./npm-command.cjs')

const root = path.resolve(__dirname, '..')
const electronVersion = '43.4.1'

function fail(message) {
  console.error(`\n[JCO GUI] ${message}\n`)
  process.exit(1)
}

const nodeMajor = Number(process.versions.node.split('.')[0])
if (!Number.isFinite(nodeMajor) || nodeMajor < 20) {
  fail(`Node.js 20 or newer is required. Current version: ${process.version}`)
}

const npmCli = resolveNpmCli()
if (!npmCli) {
  fail('npm CLI could not be located. Start the application using "npm run jco" from the gui directory.')
}

function runNpm(args) {
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: false,
  })

  if (result.error) fail(result.error.message)
  if (result.status !== 0) process.exit(result.status ?? 1)
}

if (!fs.existsSync(path.join(root, 'node_modules'))) {
  console.log('[JCO GUI] Installing Node dependencies...')
  runNpm(['install'])
}

console.log('[JCO GUI] Building renderer...')
runNpm(['run', 'build'])

if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) {
  fail('The renderer build completed without creating dist/index.html.')
}

console.log('[JCO GUI] Starting desktop application...')
console.log('[JCO GUI] Julia is configured inside the application under Julia settings.')

// Keep Electron out of the application lockfile for now while still making the
// launcher reproducible. npm caches the package/binary after the first launch.
const execArgs = ['exec', '--yes', `--package=electron@${electronVersion}`, '--', 'electron', '.']
runNpm(execArgs)
