const { contextBridge, ipcRenderer } = require('electron')

const api = {
  newProject: () => ipcRenderer.invoke('jco:new'),
  openProject: () => ipcRenderer.invoke('jco:open'),
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
  onRunEvent: (listener) => {
    const wrapped = (_event, payload) => listener(payload)
    ipcRenderer.on('jco:event', wrapped)
    return () => ipcRenderer.removeListener('jco:event', wrapped)
  },
}

contextBridge.exposeInMainWorld('jco', api)
