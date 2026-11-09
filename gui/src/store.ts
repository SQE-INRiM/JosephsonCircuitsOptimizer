import { create } from 'zustand'
import { carthagoParameters, carthagoSources, initialStages } from './data/carthago'
import { nextManualParameter, reconcileDeviceParameters } from './utils/deviceParameters'
import { metricsFromCode } from './utils/metrics'
import { hasVaryingDeviceParameters } from './utils/runSummary'
import { affectedComputationStage, affectedSourceStage, finishRunStages, invalidateFrom, prepareStagesForRun } from './utils/runStages'
import type {
  ComputationConfig,
  FeedbackRunState,
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
  sampler: 'RandomSample',
  randomSeed: 1234,
  threeWaveMixing: false,
  fourWaveMixing: true,
  nonlinearCorrectionCycles: 0,
  nonlinearFeedbackStopMode: 'cycles',
  nonlinearFeedbackMetric: 'correction',
  nonlinearFeedbackToleranceType: 'absolute',
  nonlinearFeedbackTolerance: 0.01,
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

const placeholderMetrics = `function user_cost(sol, device_params_set, nonlinear_correction)
    metric = 0.0 + nonlinear_correction
    reflection = 0.0
    phase_mismatch = 0.0
    return (metric = metric, reflection = reflection, phase_mismatch = phase_mismatch)
end

function user_performance(sol, device_params_set, source_amps, source_freqs)
    performance = 0.0
    gain_ripple = 0.0
    return (performance = performance, gain_ripple = gain_ripple)
end

function user_nonlinear_correction(sol_linear, sol_nonlinear, device_params_set)
    # Both inputs are complete hbsolve solutions. Return a scalar correction.
    return 0.0
end`

const initialProject: ProjectModel = {
  name: 'New project',
  filename: 'New project.jco',
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
  selectedResultsRunId: string | null
  project: ProjectModel
  dirty: boolean
  stages: StageState[]
  logs: LogEntry[]
  running: boolean
  feedbackRun: FeedbackRunState | null
  currentRunId: string | null
  activeRunStages: StageId[]
  selectedPumpAmplitude: number
  results: ResultsBundle | null
  setSection: (section: NavigationSection) => void
  setSetupStep: (step: SetupStep) => void
  setSetupPanel: (panel: 'circuit' | 'parameters' | 'sources') => void
  setResultsStage: (stage: StageId) => void
  setSelectedResultsRunId: (runId: string) => void
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

export const useAppStore = create<AppStore>((set, get) => ({
  section: 'setup',
  setupStep: 0,
  setupPanel: 'circuit',
  resultsStage: 'linear',
  selectedResultsRunId: null,
  project: initialProject,
  dirty: false,
  stages: initialStages,
  logs: initialLogs,
  running: false,
  feedbackRun: null,
  currentRunId: null,
  activeRunStages: [],
  selectedPumpAmplitude: 1.122,
  results: null,
  setSection: (section) => set({ section }),
  setSetupStep: (setupStep) => set({ setupStep }),
  setSetupPanel: (setupPanel) => set({ setupPanel }),
  setResultsStage: (resultsStage) => set({ resultsStage }),
  setSelectedResultsRunId: (selectedResultsRunId) => set({ selectedResultsRunId }),
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
        // A mode change invalidates all values from the previous shape.
        // Clearing in the store (rather than only hiding inputs) also prevents
        // stale Range stop/step fields being saved or restored after .jco import.
        const modeChanged = patch.mode !== undefined && patch.mode !== parameter.mode
        const updated = modeChanged
          ? { ...parameter, value: '', start: '', stop: '', step: '', values: '', ...patch }
          : { ...parameter, ...patch }
        return { ...updated, role: updated.mode === 'Fixed' ? 'Fixed model' as const : 'Design' as const }
      })
      return {
        dirty: true,
        project: { ...state.project, parameters: reconcileDeviceParameters(state.project.circuitCode, parameters) },
        stages: invalidateFrom(state.stages, { ...state.project, parameters: reconcileDeviceParameters(state.project.circuitCode, parameters) }, 'linear'),
      }
    }),
  addParameter: () =>
    set((state) => {
      const project = { ...state.project, parameters: [...state.project.parameters, nextManualParameter(state.project.parameters)] }
      return { dirty: true, project, stages: invalidateFrom(state.stages, project, 'linear') }
    }),
  removeParameter: (id) =>
    set((state) => {
      const parameter = state.project.parameters.find((item) => item.id === id)
      if (!parameter || parameter.circuitStatus !== 'unused') return state
      return {
        dirty: true,
        project: { ...state.project, parameters: state.project.parameters.filter((item) => item.id !== id) },
        stages: invalidateFrom(state.stages, { ...state.project, parameters: state.project.parameters.filter((item) => item.id !== id) }, 'linear'),
      }
    }),
  updateSource: (id, patch) =>
    set((state) => {
      const current = state.project.sources.find((source) => source.id === id)
      if (!current) return state
      const affected = affectedSourceStage(current, { ...current, ...patch })
      const project = { ...state.project, sources: state.project.sources.map((source) => source.id === id ? { ...source, ...patch } : source) }
      return {
        dirty: true,
        project,
        stages: affected ? invalidateFrom(state.stages, project, affected) : state.stages,
      }
    }),
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
        stages: invalidateFrom(state.stages, state.project, 'linear'),
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
      stages: invalidateFrom(state.stages, state.project, 'linear'),
    })),
  updateCircuitCode: (circuitCode) =>
    set((state) => ({
      dirty: true,
      project: { ...state.project, circuitCode, parameters: reconcileDeviceParameters(circuitCode, state.project.parameters, false) },
      stages: invalidateFrom(state.stages, { ...state.project, circuitCode, parameters: reconcileDeviceParameters(circuitCode, state.project.parameters, false) }, 'linear'),
    })),
  updateMetricsCode: (metricsCode) =>
    set((state) => ({
      dirty: true,
      project: { ...state.project, metricsCode, metrics: metricsFromCode(metricsCode) },
      stages: invalidateFrom(state.stages, state.project, 'linear'),
    })),
  updateParametricSourcesCode: (parametricSourcesCode) =>
    set((state) => ({
      dirty: true,
      project: { ...state.project, parametricSourcesCode },
      stages: invalidateFrom(state.stages, state.project, 'linear'),
    })),
  updateComputation: (patch) =>
    set((state) => {
      const affected = affectedComputationStage(state.project.computation, patch)
      if (!affected) return state
      const project = { ...state.project, computation: { ...state.project.computation, ...patch } }
      return { dirty: true, project, stages: invalidateFrom(state.stages, project, affected) }
    }),
  markSaved: () => set({ dirty: false }),
  resetProject: () => set({ project: initialProject, setupStep: 0, setupPanel: 'circuit', dirty: false, stages: initialStages, logs: initialLogs, currentRunId: null, feedbackRun: null, activeRunStages: [], results: null, selectedResultsRunId: null }),
  setStage: (id, patch) => set((state) => ({ stages: state.stages.map((stage) => (stage.id === id ? { ...stage, ...patch } : stage)) })),
  addLog: (entry) =>
    set((state) => ({
      logs: [...state.logs, { ...entry, id: state.logs.length ? state.logs[state.logs.length - 1].id + 1 : 1, time: new Date().toLocaleTimeString('en-GB', { hour12: false }) }],
    })),
  loadProject: (project) => {
    const reconciled = { ...project, parameters: reconcileDeviceParameters(project.circuitCode, project.parameters) }
    const singlePoint = !hasVaryingDeviceParameters(reconciled)
    set({
      project: reconciled,
      dirty: false,
      section: 'setup',
      setupStep: 0,
      setupPanel: 'circuit',
      stages: initialStages.map((stage) => ({
        ...stage,
        status: stage.id === 'optimization' && singlePoint ? 'skipped' : 'ready',
        progress: 0,
        detail: stage.id === 'optimization' && singlePoint ? 'Skipped for a single device configuration' : stage.detail,
      })),
      logs: [{ id: 1, time: new Date().toLocaleTimeString('en-GB', { hour12: false }), level: 'INFO', message: `Loaded ${project.filename}` }],
      results: null,
      selectedResultsRunId: null,
      currentRunId: null,
      feedbackRun: null,
      activeRunStages: [],
    })
  },
  // Historical Results are for browsing only: a saved optimum or an old Linear
  // table is not evidence that the current (possibly cancelled) stage completed.
  setResults: (results) => set((state) => ({
    results,
    // Keep the user's chosen run when refreshing/indexing; only fall back if it disappears.
    selectedResultsRunId: results?.runs.some((run) => run.id === state.selectedResultsRunId)
      ? state.selectedResultsRunId
      : results?.runs[0]?.id ?? null,
  })),
  applyRunEvent: (event) => {
    if (event.type === 'run-started') {
      set((state) => ({
        running: true, section: 'run', currentRunId: event.runId,
        // Feedback only runs in the complete Julia pipeline, never in stage-only runs.
        feedbackRun: event.stages?.includes('linear') && event.stages?.includes('hb') &&
          state.project.computation.nonlinearCorrectionCycles > 0 &&
          hasVaryingDeviceParameters(state.project)
          ? { cycle: 0, maximumCycles: state.project.computation.nonlinearCorrectionCycles,
              completedCycles: 0, phase: 'baseline', status: 'running' }
          : null,
        activeRunStages: event.stages ?? [],
        stages: event.stages?.length ? prepareStagesForRun(state.stages, state.project, event.stages) : state.stages,
      }))
      return
    }
    if (event.type === 'feedback-cycle') {
      set((state) => {
        if (event.runId !== state.currentRunId || !state.feedbackRun) return state
        // A fresh correction cycle replaces the baseline/previous cycle in the
        // three existing stage cards. Keep the standard Julia stage/progress events.
        const fresh = event.phase === 'correction' && event.status === 'running' &&
          event.cycle > state.feedbackRun.cycle
        const stages = fresh ? state.stages.map((stage) => ({
          ...stage,
          status: stage.status === 'skipped' ? 'skipped' as const : 'ready' as const,
          progress: 0, points: 0, startedAt: undefined,
          completedAt: undefined, duration: undefined,
        })) : state.stages
        return {
          stages,
          feedbackRun: {
            ...state.feedbackRun,
            cycle: event.cycle,
            maximumCycles: event.maximumCycles,
            phase: event.phase,
            completedCycles: event.status === 'completed'
              ? Math.max(state.feedbackRun.completedCycles, event.cycle)
              : state.feedbackRun.completedCycles,
          },
        }
      })
      return
    }
    if (event.type === 'feedback-done') {
      set((state) => event.runId !== state.currentRunId || !state.feedbackRun ? state : ({
        feedbackRun: {
          ...state.feedbackRun,
          cycle: event.completedCycles,
          completedCycles: event.completedCycles,
          maximumCycles: event.maximumCycles,
          phase: 'complete',
          status: event.reason === 'converged' ? 'converged' : 'completed',
        },
      }))
      return
    }
    if (event.type === 'stage-status') {
      if (event.runId !== get().currentRunId) return
      const patch: Partial<StageState> = { status: event.status, progress: event.status === 'running' ? 0 : event.status === 'completed' ? 100 : undefined }
      if (event.status === 'completed') {
        patch.completedAt = new Date(event.timestamp).toLocaleString('en-GB', { hour12: false })
        if (event.durationSeconds !== undefined) patch.duration = formatDuration(event.durationSeconds)
      }
      get().setStage(event.stage, patch); return
    }
    if (event.type === 'progress') {
      if (event.runId !== get().currentRunId) return
      const progress = event.total ? Math.min(100, Math.round((event.completed / event.total) * 100)) : 0
      get().setStage(event.stage, { status: 'running', progress, points: event.total }); return
    }
    if (event.type === 'log') { get().addLog({ level: event.level, message: event.message }); return }
    if (event.type === 'run-finished') {
      set((state) => {
        if (event.runId !== state.currentRunId) return state
        const stages = state.activeRunStages.length
          ? finishRunStages(state.stages, state.activeRunStages, event.outcome)
          : state.stages.map((stage) => stage.status === 'running'
            ? { ...stage, status: event.outcome === 'completed' ? 'failed' as const : event.outcome }
            : stage)
        return {
          running: false, activeRunStages: [], stages,
          feedbackRun: state.feedbackRun ? {
            ...state.feedbackRun,
            status: event.outcome === 'cancelled' ? 'cancelled'
              : event.outcome === 'failed' ? 'failed'
              : state.feedbackRun.status === 'converged' ? 'converged' : 'completed',
          } : null,
        }
      })
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
