const { contextBridge, ipcRenderer, webUtils } = require('electron')

const api = {
  newProject: () => ipcRenderer.invoke('jco:new'),
  openProject: () => ipcRenderer.invoke('jco:open'),
  openDroppedProject: (file) => {
    const filePath = webUtils.getPathForFile(file)
    if (!filePath || !filePath.toLowerCase().endsWith('.jco')) throw new Error('Drop a valid .jco project file.')
    return ipcRenderer.invoke('jco:open-path', filePath)
  },
  importWorkspace: () => ipcRenderer.invoke('jco:import-workspace'),
  listExamples: () => ipcRenderer.invoke('jco:list-examples'),
  openExample: (fileName) => ipcRenderer.invoke('jco:open-example', fileName),
  saveProject: (project, saveAs = false) => ipcRenderer.invoke('jco:save', project, saveAs),
  exportWorkspace: (project) => ipcRenderer.invoke('jco:export-workspace', project),
  validateProject: (project) => ipcRenderer.invoke('jco:validate', project),
  previewCircuit: (project) => ipcRenderer.invoke('jco:preview-circuit', project),
  startRun: (request) => ipcRenderer.invoke('jco:start-run', request),
  cancelRun: (runId) => ipcRenderer.invoke('jco:cancel-run', runId),
  deleteRun: (runId) => ipcRenderer.invoke('jco:delete-run', runId),
  readResults: () => ipcRenderer.invoke('jco:read-results'),
  readSavedTrace: (request) => ipcRenderer.invoke('jco:read-saved-trace', request),
  exportData: (request) => ipcRenderer.invoke('jco:export-data', request),
  getSettings: () => ipcRenderer.invoke('jco:get-settings'),
  setSettings: (patch) => ipcRenderer.invoke('jco:set-settings', patch),
  setupRuntime: () => ipcRenderer.invoke('jco:setup-runtime'),
  showWorkspace: () => ipcRenderer.invoke('jco:show-workspace'),
  getZoom: () => ipcRenderer.invoke('jco:get-zoom'),
  setZoom: (percent) => ipcRenderer.invoke('jco:set-zoom', percent),
  onZoomChanged: (listener) => {
    const wrapped = (_event, percent) => listener(percent)
    ipcRenderer.on('jco:zoom-changed', wrapped)
    return () => ipcRenderer.removeListener('jco:zoom-changed', wrapped)
  },
  onRunEvent: (listener) => {
    const wrapped = (_event, payload) => listener(payload)
    ipcRenderer.on('jco:event', wrapped)
    return () => ipcRenderer.removeListener('jco:event', wrapped)
  },
}

contextBridge.exposeInMainWorld('jco', api)

// Capture Ctrl + wheel to override browser zoom and keep the persisted app
// zoom level synchronized with the keyboard and toolbar controls.
window.addEventListener('wheel', (event) => {
  if (!event.ctrlKey || event.deltaY === 0) return
  event.preventDefault()
  ipcRenderer.send('jco:zoom-step', event.deltaY < 0 ? 1 : -1)
}, { passive: false, capture: true })
