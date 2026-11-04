const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const isWindows = process.platform === 'win32'
const electronVersion = '43.4.1'

// npm.cmd requires a shell on Windows. Run npm's JS CLI through Node instead
// to avoid DEP0190 (passing argument arrays to shell: true).
const npmCli = isWindows
  ? [process.env.npm_execpath, path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')]
    .find((candidate) => candidate && /npm-cli\\.js$/i.test(candidate) && fs.existsSync(candidate))
  : null

function fail(message) {
  console.error(`\n[JCO GUI] ${message}\n`)
  process.exit(1)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    ...options,
  })

  if (result.error) fail(result.error.message)
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function runNpm(args) {
  if (isWindows) {
    if (!npmCli) fail('Cannot locate npm-cli.js for the current Node.js installation.')
    run(process.execPath, [npmCli, ...args])
  } else {
    run('npm', args)
  }
}

const nodeMajor = Number(process.versions.node.split('.')[0])
if (!Number.isFinite(nodeMajor) || nodeMajor < 20) {
  fail(`Node.js 20 or newer is required. Current version: ${process.version}`)
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
