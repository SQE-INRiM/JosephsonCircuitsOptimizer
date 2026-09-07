export type NavigationSection = 'setup' | 'run' | 'results'
export type SetupStep = 0 | 1 | 2
export type ParameterMode = 'Fixed' | 'Range' | 'List'
export type SourceAmplitudeUnit = 'A' | 'dBm'
export type StageId = 'linear' | 'optimization' | 'hb'
export type StageStatus =
  | 'not_ready'
  | 'ready'
  | 'running'
  | 'completed'
  | 'stale'
  | 'failed'
  | 'cancelled'
  | 'skipped'

export interface ParameterSpec {
  id: string
  name: string
  mode: ParameterMode
  value?: string
  start?: string
  stop?: string
  step?: string
  values?: string
  unit: string
  role: 'Design' | 'Fixed model'
  circuitStatus?: 'configured' | 'missing' | 'unused'
}

export interface SourceValueSpec {
  mode: ParameterMode
  value?: string
  start?: string
  stop?: string
  step?: string
  values?: string
}

export interface SourceSpec {
  id: string
  name: string
  port: number
  isDc: boolean
  frequency: SourceValueSpec
  linearAmplitude: SourceValueSpec
  nonlinearAmplitude: SourceValueSpec
  linearAmplitudeUnit?: SourceAmplitudeUnit
  nonlinearAmplitudeUnit?: SourceAmplitudeUnit
  impedanceOhm?: number
  extras?: Record<string, unknown>
}

export interface MetricSpec {
  id: string
  name: string
  source: 'user_cost' | 'user_performance'
  stage: 'Linear' | 'Nonlinear'
  position: number
  purpose: 'Objective' | 'Analysis'
  direction: 'Minimize' | 'Maximize' | '—'
}

export interface ComputationConfig {
  frequencyStartGHz: number
  frequencyStopGHz: number
  frequencyStepMHz: number
  linearStrongToneHarmonics: number
  linearModulationHarmonics: number
  nonlinearStrongToneHarmonics: number
  nonlinearModulationHarmonics: number
  maxSimulatorIterations: number
  solverFtol: number
  switchOffLineSearchTolerance: number
  alphaMin: number
  maxIntermodOrder: string
  solverBatches: number
  nodeSorting: 'number' | 'name' | 'none'
  optimizerIterations: number
  samplesPerIteration: number
  surrogate: string
  strategy: string
  sampler: string
  randomSeed: number
  threeWaveMixing: boolean
  fourWaveMixing: boolean
  nonlinearCorrectionCycles: number
}

export interface ProjectModel {
  name: string
  filename: string
  schemaVersion: string
  circuitCode: string
  metricsCode: string
  helpersCode: string
  parametricSourcesCode?: string
  auxiliaryTextFiles?: Record<string, string>
  parameters: ParameterSpec[]
  sources: SourceSpec[]
  metrics: MetricSpec[]
  computation: ComputationConfig
  workspaceInfo?: {
    path: string
    projectPath: string | null
    auxiliaryFiles: string[]
  }
}

export interface ResultTable {
  columns: string[]
  rows: Array<Array<number | string>>
  filteredRows?: Array<Array<number | string>> | null
  resolvedParameters?: Record<string, Record<string, number | string>>
  file: string
}

export interface ResultTrace {
  name: string
  relativePath: string
  datasets: Record<string, number[]>
}

export interface SavedDataArrayCatalog {
  name: string
  storage: string
  length: number
}

export interface SavedDataQuantityCatalog {
  name: string
  quantityName: string
  prefix: string
  arrays: SavedDataArrayCatalog[]
}

export interface SavedDataPointCatalog {
  pointId: number | null
  parameters: Record<string, number | string>
  quantities: SavedDataQuantityCatalog[]
}

export interface SavedDataCatalog {
  schemaVersion: string
  stage: string
  frequencyPointCount?: number | null
  points: SavedDataPointCatalog[]
}

export interface SavedTraceRequest {
  runId: string
  stage: 'linear' | 'nonlinear' | 'custom'
  pointId: number
  quantityName: string
  arrayName: string
}

export interface SavedTraceData {
  runId: string
  stage: string
  pointId: number
  quantityName: string
  arrayName: string
  storage: string
  x: number[]
  xKind: 'frequency_hz' | 'index'
  xLabel: string
  values?: number[]
  real?: number[]
  imag?: number[]
  magnitude?: number[]
  phaseRad?: number[]
}

export interface RunSetupSnapshot {
  parameters?: Record<string, unknown> | null
  sources?: Record<string, unknown> | null
  simulation?: Record<string, unknown> | null
  optimizer?: Record<string, unknown> | null
  juliaFiles?: Record<string, string> | null
}

export interface RunResults {
  id: string
  status?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  optimalParameters?: Record<string, unknown> | null
  setupSnapshot?: RunSetupSnapshot | null
  linear?: ResultTable | null
  optimization?: ResultTable | null
  nonlinear?: ResultTable | null
  savedLinear?: SavedDataCatalog | null
  savedNonlinear?: SavedDataCatalog | null
  traces: ResultTrace[]
}

export interface ResultsBundle {
  schemaVersion: string
  workspace: string
  runs: RunResults[]
}

export interface StageState {
  id: StageId
  label: string
  shortLabel: string
  status: StageStatus
  completedAt?: string
  duration?: string
  startedAt?: string
  estimatedRemainingSeconds?: number
  detail: string
  points: number
  progress: number
}

export interface LogEntry {
  id: number
  time: string
  level: 'INFO' | 'WARN' | 'ERROR' | 'PROGRESS'
  message: string
}
