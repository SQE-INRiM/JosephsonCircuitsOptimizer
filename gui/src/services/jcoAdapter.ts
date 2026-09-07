import type { ProjectModel, ResultsBundle, SavedTraceData, SavedTraceRequest, StageId, StageStatus } from '../types'

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info'
  path: string
  message: string
}

export interface SaveResult {
  path: string
  revision: string
  project?: ProjectModel
}

export interface ExampleDescriptor {
  fileName: string
  name: string
}

export interface RunRequest {
  project: ProjectModel
  stages: StageId[]
  resumeFromRunId?: string
}

export interface CancelResult {
  accepted: boolean
  runId?: string
  alreadyRequested?: boolean
  message?: string
}

export interface ExportRequest {
  runId: string
  stage: StageId
  format: 'csv' | 'json' | 'hdf5'
  metrics: string[]
  filters: Record<string, string | number | boolean | Array<string | number>>
}

export interface CircuitPreviewComponent {
  name: string
  kind: 'P' | 'R' | 'C' | 'L' | 'Lj' | 'K' | 'I' | 'V' | 'Unknown'
  node1: string
  node2: string
  valueExpression: string
  resolvedValue: number | string | null
}

export interface CircuitPreviewData {
  schemaVersion: string
  parameterPolicy: 'first_value'
  parameters: Record<string, number | string | boolean>
  portCount: number
  nodes: string[]
  components: CircuitPreviewComponent[]
}

export type RunEvent =
  | { type: 'run-started'; runId: string; timestamp: string }
  | { type: 'stage-status'; runId: string; stage: StageId; status: StageStatus; timestamp: string; durationSeconds?: number }
  | { type: 'progress'; runId: string; stage: StageId; completed: number; total: number; etaSeconds?: number; timestamp: string }
  | { type: 'log'; runId: string; level: 'INFO' | 'WARN' | 'ERROR'; message: string; timestamp: string }
  | { type: 'result-available'; runId: string; stage: StageId; metricIds: string[]; timestamp: string }
  | { type: 'run-finished'; runId: string; outcome: 'completed' | 'failed' | 'cancelled'; timestamp: string }

/** Stable renderer/main-process boundary. */
export interface JcoAdapter {
  newProject(): Promise<ProjectModel>
  openProject(): Promise<ProjectModel | null>
  importWorkspace(): Promise<ProjectModel | null>
  listExamples(): Promise<ExampleDescriptor[]>
  openExample(fileName: string): Promise<ProjectModel>
  saveProject(project: ProjectModel, saveAs?: boolean): Promise<SaveResult | null>
  exportWorkspace(project: ProjectModel): Promise<string | null>
  validateProject(project: ProjectModel): Promise<ValidationIssue[]>
  previewCircuit(project: ProjectModel): Promise<CircuitPreviewData>
  startRun(request: RunRequest): Promise<{ runId: string }>
  cancelRun(runId: string): Promise<CancelResult>
  deleteRun(runId: string): Promise<ResultsBundle>
  exportData(request: ExportRequest): Promise<string | null>
  readResults(): Promise<ResultsBundle>
  readSavedTrace(request: SavedTraceRequest): Promise<SavedTraceData>
  getSettings(): Promise<{ juliaPath: string; threads: number }>
  setSettings(patch: Partial<{ juliaPath: string; threads: number }>): Promise<{ juliaPath: string; threads: number }>
  setupRuntime(): Promise<{ ok: boolean; message: string }>
  showWorkspace(): Promise<string | null>
  onRunEvent(listener: (event: RunEvent) => void): () => void
}

declare global {
  interface Window {
    jco?: JcoAdapter
  }
}

export function getJcoAdapter(): JcoAdapter | null {
  return window.jco ?? null
}

export function isDesktopBridgeAvailable(): boolean {
  return Boolean(window.jco)
}
