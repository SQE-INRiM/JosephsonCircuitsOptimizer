const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const isWindows = process.platform === 'win32'
const npm = isWindows ? 'npm.cmd' : 'npm'
const electronVersion = '43.4.1'

function fail(message) {
  console.error(`\n[JCO GUI] ${message}\n`)
  process.exit(1)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: isWindows,
    ...options,
  })

  if (result.error) fail(result.error.message)
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const nodeMajor = Number(process.versions.node.split('.')[0])
if (!Number.isFinite(nodeMajor) || nodeMajor < 20) {
  fail(`Node.js 20 or newer is required. Current version: ${process.version}`)
}

if (!fs.existsSync(path.join(root, 'node_modules'))) {
  console.log('[JCO GUI] Installing Node dependencies...')
  run(npm, ['install'])
}

console.log('[JCO GUI] Building renderer...')
run(npm, ['run', 'build'])

if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) {
  fail('The renderer build completed without creating dist/index.html.')
}

console.log('[JCO GUI] Starting desktop application...')
console.log('[JCO GUI] Julia is configured inside the application under Julia settings.')

// Keep Electron out of the application lockfile for now while still making the
// launcher reproducible. npm caches the package/binary after the first launch.
const execArgs = ['exec', '--yes', `--package=electron@${electronVersion}`, '--', 'electron', '.']
run(npm, execArgs)
