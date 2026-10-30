'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const guiRoot = path.resolve(__dirname, '..')
const builderConfig = fs.readFileSync(path.join(guiRoot, 'electron-builder.yml'), 'utf8')

test('Windows NSIS updates the desktop shortcut instead of preserving the old icon', () => {
  const nsisBlock = builderConfig.split(/\r?\nnsis:\r?\n/)[1]?.split(/\r?\n(?=[a-zA-Z][\w-]*:)/)[0]
  assert.ok(nsisBlock, 'NSIS config section must exist')
  assert.match(nsisBlock, /^  createDesktopShortcut: always\s*$/m)
  assert.match(nsisBlock, /^  shortcutName: JCO GUI\s*$/m)
  assert.match(builderConfig, /^win:\r?\n  icon: build\/icon\.ico\s*$/m)
})

test('The configured Windows application icon is a non-empty valid ICO container', () => {
  const icon = fs.readFileSync(path.join(guiRoot, 'build', 'icon.ico'))
  assert.ok(icon.length > 22, 'App icon must not be empty')
  assert.equal(icon.readUInt16LE(0), 0, 'ICO reserved header')
  assert.equal(icon.readUInt16LE(2), 1, 'ICO image type')
  const count = icon.readUInt16LE(4)
  assert.ok(count > 0, 'ICO must contain at least one image')
  assert.ok(icon.length >= 6 + count * 16, 'ICO entry table must be present')
  for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 16
    const bytes = icon.readUInt32LE(offset + 8)
    const location = icon.readUInt32LE(offset + 12)
    assert.ok(bytes > 0 && location >= 6 + count * 16 && location + bytes <= icon.length,
      'ICO image payload must fit inside the file')
  }
})
