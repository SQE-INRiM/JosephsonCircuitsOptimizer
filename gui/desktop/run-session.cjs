'use strict'

function assertProcessIdle(activeProcess, operation) {
  if (!activeProcess) return
  throw new Error(`${operation} is unavailable while a simulation or runtime setup is running.`)
}

function captureRunSession(session, runId) {
  if (!session) throw new Error('Open or import a project first.')
  return Object.freeze({
    runId,
    workspace: session.workspace,
    projectPath: session.projectPath,
    manifest: Object.freeze({ ...(session.manifest || {}) }),
  })
}

module.exports = { assertProcessIdle, captureRunSession }
