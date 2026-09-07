import { create } from 'zustand'
import { carthagoParameters, carthagoSources, initialStages } from './data/carthago'
import { nextManualParameter, reconcileDeviceParameters } from './utils/deviceParameters'
import { metricsFromCode } from './utils/metrics'
import type {
  ComputationConfig,
  LogEntry,
  NavigationSection,
  ParameterSpec,
  ProjectModel,
  ResultsBundle,
  SetupStep,
  SourceSpec,
  StageId,
  StageState,
} from './types'

const computation: ComputationConfig = {
  frequencyStartGHz: 0.001,
  frequencyStopGHz: 10,
  frequencyStepMHz: 1,
  linearStrongToneHarmonics: 1,
  linearModulationHarmonics: 1,
  nonlinearStrongToneHarmonics: 8,
  nonlinearModulationHarmonics: 4,
  maxSimulatorIterations: 200,
  solverFtol: 1e-8,
  switchOffLineSearchTolerance: 1e-5,
  alphaMin: 1e-4,
  maxIntermodOrder: 'Inf',
  solverBatches: 0,
  nodeSorting: 'number',
  optimizerIterations: 5,
  samplesPerIteration: 5,
  surrogate: 'Kriging',
  strategy: 'SRBF',
  sampler: 'Random',
  randomSeed: 1234,
  threeWaveMixing: false,
  fourWaveMixing: true,
  nonlinearCorrectionCycles: 0,
}

const placeholderCode = `function create_user_circuit(device_params_set)
    # Browser preview placeholder. Open a .jco project or bundled runtime
    # example for a complete circuit definition.
    N = Int(round(device_params_set[:N]))
    @variables Rleft Rright Cg Lj_large Lj_small
    # 700-cell Kerr-reversal JTWPA + alternating bias-line coupling
    # ...
    return circuit, circuitdefs
end`

const placeholderMetrics = `function user_cost(S, device_params_set, nonlinear_correction)
    metric = 0.0
    reflection = 0.0
    phase_mismatch = 0.0
    return (metric = metric, reflection = reflection, phase_mismatch = phase_mismatch)
end

function user_performance(sol, device_params_set, source_amps, source_freqs)
    performance = 0.0
    gain_ripple = 0.0
    return (performance = performance, gain_ripple = gain_ripple)
end`

const initialProject: ProjectModel = {
  name: 'JTWPA Carthago — loss & fabrication spread',
  filename: 'carthago_loss_spread.jco',
  schemaVersion: 'jco.project/1',
  circuitCode: placeholderCode,
  metricsCode: placeholderMetrics,
  helpersCode: '# Advanced metric helpers are preserved with the project.',
  parameters: reconcileDeviceParameters(placeholderCode, carthagoParameters, false),
  sources: carthagoSources,
  metrics: metricsFromCode(placeholderMetrics),
  computation,
}

const initialLogs: LogEntry[] = [
  { id: 1, time: '--:--:--', level: 'INFO', message: 'Preview project loaded. Open or import a workspace before starting a desktop simulation.' },
]

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return minutes ? `${minutes} min ${String(remainder).padStart(2, '0')} s` : `${remainder} s`
}

interface AppStore {
  section: NavigationSection
  setupStep: SetupStep
  setupPanel: 'circuit' | 'parameters' | 'sources'
  resultsStage: StageId
  project: ProjectModel
  dirty: boolean
  stages: StageState[]
  logs: LogEntry[]
  running: boolean
  currentRunId: string | null
  selectedPumpAmplitude: number
  results: ResultsBundle | null
  setSection: (section: NavigationSection) => void
  setSetupStep: (step: SetupStep) => void
  setSetupPanel: (panel: 'circuit' | 'parameters' | 'sources') => void
  setResultsStage: (stage: StageId) => void
  setSelectedPumpAmplitude: (amplitude: number) => void
  updateProjectName: (name: string) => void
  updateParameter: (id: string, patch: Partial<ParameterSpec>) => void
  addParameter: () => void
  removeParameter: (id: string) => void
  updateSource: (id: string, patch: Partial<SourceSpec>) => void
  addSource: () => void
  removeSource: (id: string) => void
  updateCircuitCode: (code: string) => void
  updateMetricsCode: (code: string) => void
  updateParametricSourcesCode: (code: string) => void
  updateComputation: (patch: Partial<ComputationConfig>) => void
  markSaved: () => void
  resetProject: () => void
  startDemoRun: () => void
  stopDemoRun: () => void
  setStage: (id: StageId, patch: Partial<StageState>) => void
  addLog: (entry: Omit<LogEntry, 'id' | 'time'>) => void
  loadProject: (project: ProjectModel) => void
  setResults: (results: ResultsBundle | null) => void
  applyRunEvent: (event: import('./services/jcoAdapter').RunEvent) => void
}

let timer: ReturnType<typeof setInterval> | null = null

function staleStages(stages: StageState[]): StageState[] {
  return stages.map((stage) => {
    if (stage.id === 'optimization' && stage.status === 'skipped') return stage
    return { ...stage, status: stage.status === 'running' ? stage.status : 'stale', progress: 0 }
  })
}

export const useAppStore = create<AppStore>((set, get) => ({
  section: 'setup',
  setupStep: 0,
  setupPanel: 'parameters',
  resultsStage: 'linear',
  project: initialProject,
  dirty: false,
  stages: initialStages,
  logs: initialLogs,
  running: false,
  currentRunId: null,
  selectedPumpAmplitude: 1.122,
  results: null,
  setSection: (section) => set({ section }),
  setSetupStep: (setupStep) => set({ setupStep }),
  setSetupPanel: (setupPanel) => set({ setupPanel }),
  setResultsStage: (resultsStage) => set({ resultsStage }),
  setSelectedPumpAmplitude: (selectedPumpAmplitude) => set({ selectedPumpAmplitude }),
  updateProjectName: (name) =>
    set((state) => {
      const safeFileStem = name.trim().replace(/[<>:"/\\|?*]/g, '_') || 'Untitled project'
      const filename = state.project.workspaceInfo?.projectPath ? state.project.filename : `${safeFileStem}.jco`
      return { dirty: true, project: { ...state.project, name, filename } }
    }),
  updateParameter: (id, patch) =>
    set((state) => {
      const parameters = state.project.parameters.map((parameter) => {
        if (parameter.id !== id) return parameter
        const updated = { ...parameter, ...patch }
        return { ...updated, role: updated.mode === 'Fixed' ? 'Fixed model' as const : 'Design' as const }
      })
      return {
        dirty: true,
        project: { ...state.project, parameters: reconcileDeviceParameters(state.project.circuitCode, parameters) },
        stages: staleStages(state.stages),
      }
    }),
  addParameter: () =>
    set((state) => ({
      dirty: true,
      project: { ...state.project, parameters: [...state.project.parameters, nextManualParameter(state.project.parameters)] },
      stages: staleStages(state.stages),
    })),
  removeParameter: (id) =>
    set((state) => {
      const parameter = state.project.parameters.find((item) => item.id === id)
      if (!parameter || parameter.circuitStatus !== 'unused') return state
      return {
        dirty: true,
        project: { ...state.project, parameters: state.project.parameters.filter((item) => item.id !== id) },
        stages: staleStages(state.stages),
      }
    }),
  updateSource: (id, patch) =>
    set((state) => ({
      dirty: true,
      project: { ...state.project, sources: state.project.sources.map((source) => source.id === id ? { ...source, ...patch } : source) },
      stages: state.stages.map((stage) => stage.status === 'running' ? stage : { ...stage, status: stage.id === 'optimization' && stage.status === 'skipped' ? 'skipped' : 'stale', progress: 0 }),
    })),
  addSource: () =>
    set((state) => {
      const number = state.project.sources.length + 1
      const source: SourceSpec = {
        id: `source_${number}`,
        name: `Source ${number}`,
        port: number,
        isDc: false,
        frequency: { mode: 'Fixed', value: '1' },
        linearAmplitude: { mode: 'Fixed', value: '0' },
        nonlinearAmplitude: { mode: 'Fixed', value: '0' },
        extras: {},
      }
      return {
        dirty: true,
        project: { ...state.project, sources: [...state.project.sources, source] },
        stages: staleStages(state.stages),
      }
    }),
  removeSource: (id) =>
    set((state) => ({
      dirty: true,
      project: {
        ...state.project,
        sources: state.project.sources.filter((source) => source.id !== id).map((source, index) => ({
          ...source,
          id: `source_${index + 1}`,
          name: `Source ${index + 1}`,
        })),
      },
      stages: staleStages(state.stages),
    })),
  updateCircuitCode: (circuitCode) =>
    set((state) => ({
      dirty: true,
      project: { ...state.project, circuitCode, parameters: reconcileDeviceParameters(circuitCode, state.project.parameters, false) },
      stages: staleStages(state.stages),
    })),
  updateMetricsCode: (metricsCode) =>
    set((state) => ({
      dirty: true,
      project: { ...state.project, metricsCode, metrics: metricsFromCode(metricsCode) },
      stages: state.stages.map((stage) => stage.status === 'running' ? stage : { ...stage, status: stage.id === 'optimization' && stage.status === 'skipped' ? 'skipped' : 'stale', progress: 0 }),
    })),
  updateParametricSourcesCode: (parametricSourcesCode) =>
    set((state) => ({
      dirty: true,
      project: { ...state.project, parametricSourcesCode },
      stages: state.stages.map((stage) => stage.status === 'running' ? stage : { ...stage, status: stage.id === 'optimization' && stage.status === 'skipped' ? 'skipped' : 'stale', progress: 0 }),
    })),
  updateComputation: (patch) =>
    set((state) => ({
      dirty: true,
      project: { ...state.project, computation: { ...state.project.computation, ...patch } },
      stages: state.stages.map((stage) => stage.id === 'hb' ? { ...stage, status: 'stale', progress: 0 } : stage),
    })),
  markSaved: () => set({ dirty: false }),
  resetProject: () => set({ project: initialProject, dirty: false, stages: initialStages, logs: initialLogs, currentRunId: null }),
  setStage: (id, patch) => set((state) => ({ stages: state.stages.map((stage) => (stage.id === id ? { ...stage, ...patch } : stage)) })),
  addLog: (entry) =>
    set((state) => ({
      logs: [...state.logs, { ...entry, id: state.logs.length ? state.logs[state.logs.length - 1].id + 1 : 1, time: new Date().toLocaleTimeString('en-GB', { hour12: false }) }],
    })),
  loadProject: (project) => {
    const reconciled = { ...project, parameters: reconcileDeviceParameters(project.circuitCode, project.parameters) }
    const singlePoint = reconciled.parameters.every((parameter) => parameter.mode === 'Fixed')
    set({
      project: reconciled,
      dirty: false,
      section: 'setup',
      setupStep: 0,
      stages: initialStages.map((stage) => ({
        ...stage,
        status: stage.id === 'optimization' && singlePoint ? 'skipped' : 'ready',
        progress: 0,
        detail: stage.id === 'optimization' && singlePoint ? 'Skipped for a single device configuration' : stage.detail,
      })),
      logs: [{ id: 1, time: new Date().toLocaleTimeString('en-GB', { hour12: false }), level: 'INFO', message: `Loaded ${project.filename}` }],
      results: null,
      currentRunId: null,
    })
  },
  setResults: (results) => set((state) => {
    const latest = results?.runs[0]
    if (!latest) return { results }
    const failedStage = latest.status?.status === 'error' ? String(latest.status?.stage ?? '').toLowerCase() : ''
    return {
      results,
      stages: state.stages.map((stage) => {
        if ((stage.id === 'linear' && failedStage === 'lin') || (stage.id === 'optimization' && failedStage === 'bo') || (stage.id === 'hb' && failedStage === 'hb')) return { ...stage, status: 'failed' }
        if (stage.id === 'linear' && latest.linear) return { ...stage, status: 'completed', progress: 100, completedAt: latest.id.replace('output_', '').replace('_', ' · ') }
        if (stage.id === 'hb' && latest.nonlinear) return { ...stage, status: 'completed', progress: 100, completedAt: latest.id.replace('output_', '').replace('_', ' · ') }
        return stage
      }),
    }
  }),
  applyRunEvent: (event) => {
    if (event.type === 'run-started') { set({ running: true, section: 'run', currentRunId: event.runId }); return }
    if (event.type === 'stage-status') {
      const patch: Partial<StageState> = { status: event.status, progress: event.status === 'running' ? 0 : event.status === 'completed' ? 100 : undefined }
      if (event.status === 'completed') {
        patch.completedAt = new Date(event.timestamp).toLocaleString('en-GB', { hour12: false })
        if (event.durationSeconds !== undefined) patch.duration = formatDuration(event.durationSeconds)
      }
      get().setStage(event.stage, patch); return
    }
    if (event.type === 'progress') {
      const progress = event.total ? Math.min(100, Math.round((event.completed / event.total) * 100)) : 0
      get().setStage(event.stage, { status: 'running', progress, points: event.total }); return
    }
    if (event.type === 'log') { get().addLog({ level: event.level, message: event.message }); return }
    if (event.type === 'run-finished') {
      set((state) => ({
        running: false,
        stages: state.stages.map((stage) => stage.status === 'running' ? { ...stage, status: event.outcome === 'completed' ? 'completed' : event.outcome, progress: event.outcome === 'completed' ? 100 : stage.progress, completedAt: stage.completedAt } : stage),
      }))
    }
  },
  startDemoRun: () => {
    if (get().running) return
    const target = get().stages.find((stage) => ['ready', 'stale', 'failed', 'cancelled'].includes(stage.status))
    if (!target) return
    set({ running: true, section: 'run' })
    get().setStage(target.id, { status: 'running', progress: 0 })
    get().addLog({ level: 'INFO', message: `Starting ${target.label} through the mock backend adapter` })
    let progress = 0
    timer = setInterval(() => {
      progress += 4
      get().setStage(target.id, { progress })
      if (progress % 20 === 0) get().addLog({ level: 'PROGRESS', message: `${target.shortLabel} ${Math.round((target.points * progress) / 100)} / ${target.points}` })
      if (progress >= 100) {
        if (timer) clearInterval(timer)
        timer = null
        get().setStage(target.id, { status: 'completed', progress: 100, completedAt: 'just now', duration: 'preview run · 6 s' })
        get().addLog({ level: 'INFO', message: `${target.label} completed. Replace mock adapter with window.jco.startRun().` })
        set({ running: false })
      }
    }, 220)
  },
  stopDemoRun: () => {
    if (timer) clearInterval(timer)
    timer = null
    set((state) => ({
      running: false,
      stages: state.stages.map((stage) => stage.status === 'running' ? { ...stage, status: 'cancelled', detail: 'Cancelled by user in preview' } : stage),
    }))
    get().addLog({ level: 'WARN', message: 'Run cancelled by user' })
  },
}))
