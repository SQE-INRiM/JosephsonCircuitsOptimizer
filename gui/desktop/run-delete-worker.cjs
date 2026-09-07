const fs = require('fs')
const { parentPort, workerData } = require('worker_threads')
const { packProject } = require('./archive.cjs')

async function main() {
  await fs.promises.rm(workerData.target, { recursive: true, force: true })
  const manifest = workerData.projectPath
    ? packProject(workerData.workspace, workerData.projectPath, workerData.manifest)
    : null
  parentPort.postMessage({ ok: true, manifest })
}

main().catch((error) => {
  parentPort.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) })
})
