const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { resolveNpmCli } = require('./npm-command.cjs')

test('prefers npm_execpath for npm run jco, including portable Windows Node installs', () => {
  const npmCli = 'C:\\Tools\\node\\node_modules\\npm\\bin\\npm-cli.js'
  const result = resolveNpmCli('C:\\Tools\\node\\node.exe', npmCli, (candidate) => candidate === npmCli)
  assert.equal(result, npmCli)
})

test('finds npm installed beside Node when invoked without npm_execpath', () => {
  const nodePath = '/opt/node/bin/node'
  const expected = path.join('/opt/node/bin', 'node_modules', 'npm', 'bin', 'npm-cli.js')
  const result = resolveNpmCli(nodePath, undefined, (candidate) => candidate === expected)
  assert.equal(result, expected)
})

test('finds npm in the parent directory of a portable Node installation', () => {
  const nodePath = '/opt/node/bin/node'
  const expected = path.join('/opt/node', 'node_modules', 'npm', 'bin', 'npm-cli.js')
  const result = resolveNpmCli(nodePath, undefined, (candidate) => candidate === expected)
  assert.equal(result, expected)
})

test('rejects shell wrappers and arbitrary command entries', () => {
  const npmCli = '/some/path/npm.cmd'
  const result = resolveNpmCli('/opt/node/bin/node', npmCli, (candidate) => candidate === npmCli)
  assert.equal(result, undefined)
})
