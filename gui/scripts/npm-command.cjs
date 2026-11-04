const fs = require('fs')
const path = require('path')

// npm sets npm_execpath for scripts launched through "npm run jco".
// Running its JavaScript CLI with the active Node executable avoids Windows
// .cmd wrappers and the shell:true + argument-vector deprecation (DEP0190).
function resolveNpmCli(nodePath = process.execPath, npmExecPath = process.env.npm_execpath, existsSync = fs.existsSync) {
  const nodeDir = path.dirname(nodePath)
  const candidates = [
    npmExecPath,
    path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.resolve(nodeDir, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ]
  return candidates.find((candidate) =>
    typeof candidate === 'string'
    && /(^|[/\\])npm-cli\.js$/i.test(candidate)
    && existsSync(candidate)
  )
}

module.exports = { resolveNpmCli }
