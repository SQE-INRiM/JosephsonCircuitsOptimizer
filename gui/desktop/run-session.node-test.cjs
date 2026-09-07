'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { assertProcessIdle, captureRunSession } = require('./run-session.cjs')

test('assertProcessIdle permits project operations only without an active process', () => {
  assert.doesNotThrow(() => assertProcessIdle(null, 'Saving the project'))
  assert.throws(
    () => assertProcessIdle({ pid: 42 }, 'Saving the project'),
    /Saving the project is unavailable while a simulation or runtime setup is running./,
  )
})

test('captureRunSession preserves the project targeted by a running process', () => {
  const session = {
    workspace: 'C:/temporary/project-a',
    projectPath: 'C:/projects/project-a.jco',
    manifest: { name: 'Project A', modifiedAt: 'before-run' },
  }

  const captured = captureRunSession(session, 'output_2026-09-02_12-00-00')
  session.workspace = 'C:/temporary/project-b'
  session.projectPath = 'C:/projects/project-b.jco'
  session.manifest.modifiedAt = 'after-project-switch'

  assert.deepEqual(captured, {
    runId: 'output_2026-09-02_12-00-00',
    workspace: 'C:/temporary/project-a',
    projectPath: 'C:/projects/project-a.jco',
    manifest: { name: 'Project A', modifiedAt: 'before-run' },
  })
  assert.equal(Object.isFrozen(captured), true)
  assert.equal(Object.isFrozen(captured.manifest), true)
})
