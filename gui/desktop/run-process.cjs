const { spawn } = require('child_process')

function createRunId(date = new Date()) {
  return `output_${date.toISOString().replace(/\.(\d{3})Z$/, '-$1Z').replace('T', '_').replaceAll(':', '-')}`
}

function outcomeForClose(code, cancelRequested) {
  if (cancelRequested) return 'cancelled'
  return code === 0 ? 'completed' : code === 130 ? 'cancelled' : 'failed'
}

function requireDurableProject(session) {
  if (!session?.projectPath) {
    throw new Error('Save As a .jco project before running. This ensures every generated dataset is stored in a durable project file.')
  }
  return session.projectPath
}

function terminateProcessTree(child, { platform = process.platform, spawnProcess = spawn } = {}) {
  if (!child || !child.pid) return false
  if (platform === 'win32') {
    const killer = spawnProcess('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    })
    killer.once?.('error', () => {
      try { child.kill() } catch {}
    })
  } else {
    try { child.kill('SIGTERM') } catch { return false }
  }
  return true
}

module.exports = { createRunId, outcomeForClose, requireDurableProject, terminateProcessTree }
