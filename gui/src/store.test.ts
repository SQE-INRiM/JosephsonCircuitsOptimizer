import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from './store'
import { nextRunStage } from './utils/runStages'

const originalProject = structuredClone(useAppStore.getState().project)

describe('GUI device parameter workflow', () => {
  beforeEach(() => {
    useAppStore.setState({ project: structuredClone(originalProject), dirty: false })
  })

  it('clears obsolete Range fields when changing mode, including after loading a .jco-shaped project', () => {
    const circuitCode = 'function create_user_circuit(device_params_set)\\nCg = device_params_set[:Cg]\\nend'
    useAppStore.getState().loadProject({
      ...structuredClone(originalProject),
      filename: 'dropped.jco',
      name: 'Dropped from disk',
      circuitCode,
      parameters: [
        { id: 'Cg', name: 'Cg', mode: 'Range', start: '100', stop: '350', step: '25', unit: 'fF', role: 'Design', circuitStatus: 'configured' },
      ],
    })
    expect(useAppStore.getState().project.parameters[0].id).toBe('Cg')
    const { updateParameter } = useAppStore.getState()
    updateParameter('Cg', { mode: 'Fixed' })
    expect(useAppStore.getState().project.parameters[0]).toMatchObject({
      mode: 'Fixed', start: '', stop: '', step: '', values: '', value: '',
    })
    updateParameter('Cg', { value: '250' })
    expect(useAppStore.getState().project.parameters[0].value).toBe('250')
    updateParameter('Cg', { mode: 'List' })
    expect(useAppStore.getState().project.parameters[0]).toMatchObject({
      mode: 'List', start: '', stop: '', step: '', values: '', value: '',
    })
    updateParameter('Cg', { values: '100, 250' })
    expect(useAppStore.getState().project.parameters[0].values).toBe('100, 250')
  })

  it('creates a parameter from the circuit editor and accepts its value', () => {
    useAppStore.getState().updateCircuitCode(`
      function create_user_circuit(device_parameters_set::Dict)
        Cg = device_parameters_set[:Cg_from_gui]
      end
    `)

    const discovered = useAppStore.getState().project.parameters.find((parameter) => parameter.name === 'Cg_from_gui')
    expect(discovered?.circuitStatus).toBe('missing')

    useAppStore.getState().updateParameter(discovered!.id, { value: '100e-15' })
    const configured = useAppStore.getState().project.parameters.find((parameter) => parameter.name === 'Cg_from_gui')
    expect(configured?.circuitStatus).toBe('configured')
    expect(configured?.value).toBe('100e-15')
  })

  it('adds and removes a manual parameter', () => {
    useAppStore.getState().addParameter()
    const added = useAppStore.getState().project.parameters.find((parameter) => parameter.id.startsWith('manual-'))
    expect(added?.circuitStatus).toBe('unused')

    useAppStore.getState().removeParameter(added!.id)
    expect(useAppStore.getState().project.parameters.some((parameter) => parameter.id === added!.id)).toBe(false)
  })

  it('removes old template parameters when a new circuit is written', () => {
    useAppStore.getState().updateCircuitCode('function create_user_circuit(device_params_set)\nCg = device_params_set[:OnlyCg]\nend')
    expect(useAppStore.getState().project.parameters.map((parameter) => parameter.name)).toEqual(['OnlyCg'])
  })

  it('updates the project name independently and proposes a matching unsaved filename', () => {
    useAppStore.getState().updateProjectName('My JTWPA')
    expect(useAppStore.getState().project.name).toBe('My JTWPA')
    expect(useAppStore.getState().project.filename).toBe('My JTWPA.jco')
  })

  it('adds and removes sources while keeping sequential JCO source ids', () => {
    const initialCount = useAppStore.getState().project.sources.length
    useAppStore.getState().addSource()
    const added = useAppStore.getState().project.sources.at(-1)!
    expect(added.id).toBe(`source_${initialCount + 1}`)
    expect(added.frequency).toEqual({ mode: 'Fixed', value: '1' })

    useAppStore.getState().removeSource('source_1')
    expect(useAppStore.getState().project.sources.map((source) => source.id)).toEqual(
      Array.from({ length: initialCount }, (_, index) => `source_${index + 1}`),
    )
  })

  it('updates the metric list from named Julia returns', () => {
    useAppStore.getState().updateMetricsCode(`
      function user_cost(S, p, correction)
        return (metric = total, reflection = s11)
      end
      function user_performance(sol, p, amps, freqs)
        return (performance = gain, ripple = ripple)
      end
    `)
    expect(useAppStore.getState().project.metrics.map((metric) => metric.name)).toEqual(['metric', 'reflection', 'performance', 'ripple'])
  })

  it('keeps completed Linear when editing only optimizer or nonlinear settings', () => {
    const project = structuredClone(originalProject)
    project.parameters[0] = { ...project.parameters[0], mode: 'Range', start: '1', stop: '2', step: '1' }
    useAppStore.getState().loadProject(project)
    useAppStore.setState((state) => ({
      stages: state.stages.map((stage) => ({ ...stage, status: 'completed' as const })),
    }))
    const iterations = useAppStore.getState().project.computation.optimizerIterations
    useAppStore.getState().updateComputation({ optimizerIterations: iterations + 1 })
    expect(useAppStore.getState().stages.map((stage) => stage.status))
      .toEqual(['completed', 'stale', 'stale'])

    useAppStore.setState((state) => ({
      stages: state.stages.map((stage) => ({ ...stage, status: 'completed' as const })),
    }))
    const source = useAppStore.getState().project.sources[0]
    useAppStore.getState().updateSource(source.id, { nonlinearAmplitude: { mode: 'Fixed', value: '2e-6' } })
    expect(useAppStore.getState().stages.map((stage) => stage.status))
      .toEqual(['completed', 'completed', 'stale'])
  })

  it('does not resurrect stale stages from old result tables', () => {
    useAppStore.setState((state) => ({
      stages: state.stages.map((stage) => ({ ...stage, status: 'stale' as const })),
    }))
    useAppStore.getState().setResults({
      schemaVersion: 'jco.results/4', workspace: 'test',
      runs: [{ id: 'output_old', linear: { columns: ['metric'], rows: [[1]], file: 'old.h5' }, traces: [] }],
    })
    expect(useAppStore.getState().stages[0].status).toBe('stale')
  })

  it('does not unlock Nonlinear when Optimization is cancelled midway', () => {
    const store = useAppStore.getState()
    const project = structuredClone(originalProject)
    project.parameters[0] = { ...project.parameters[0], mode: 'Range', start: '1', stop: '2', step: '1' }
    store.loadProject(project)
    const runId = 'output_2026-11-03_16-00-00-000Z'
    const timestamp = '2026-11-03T16:00:00.000Z'
    const stages = ['linear', 'optimization', 'hb'] as const
    store.applyRunEvent({ type: 'run-started', runId, stages: [...stages], timestamp })
    store.applyRunEvent({ type: 'stage-status', runId, stage: 'linear', status: 'running', timestamp })
    store.applyRunEvent({ type: 'stage-status', runId, stage: 'linear', status: 'completed', timestamp })
    store.applyRunEvent({ type: 'stage-status', runId, stage: 'optimization', status: 'running', timestamp })
    store.applyRunEvent({ type: 'progress', runId, stage: 'optimization', completed: 3, total: 10, timestamp })
    store.applyRunEvent({ type: 'run-finished', runId, outcome: 'cancelled', timestamp })
    expect(useAppStore.getState().stages.map((stage) => stage.status))
      .toEqual(['completed', 'cancelled', 'stale'])
    expect(nextRunStage(useAppStore.getState().stages)).toBe('optimization')
    // A canceled run with no data may be pruned, exposing an older fully
    // completed run as latest. Reading it must not resurrect the canceled BO.
    store.setResults({
      schemaVersion: 'jco.results/4', workspace: 'test',
      runs: [{
        id: 'output_older', status: { status: 'completed' },
        linear: { columns: ['metric'], rows: [[1]], file: 'linear.h5' },
        optimalParameters: { data: { Cg: 250 } },
        nonlinear: { columns: ['performance'], rows: [[20]], file: 'hb.h5' },
        traces: [],
      }],
    })
    expect(useAppStore.getState().stages.map((stage) => stage.status))
      .toEqual(['completed', 'cancelled', 'stale'])
    expect(nextRunStage(useAppStore.getState().stages)).toBe('optimization')
  })

  it('cancels a repeated Optimization even when no stage event arrived', () => {
    const project = structuredClone(originalProject)
    project.parameters[0] = { ...project.parameters[0], mode: 'Range', start: '1', stop: '2', step: '1' }
    useAppStore.getState().loadProject(project)
    useAppStore.setState((state) => ({
      stages: state.stages.map((stage) => ({ ...stage, status: 'completed' as const })),
    }))
    const runId = 'output_2026-11-03_16-20-00-000Z'
    const timestamp = '2026-11-03T16:20:00.000Z'
    useAppStore.getState().applyRunEvent({ type: 'run-started', runId, stages: ['optimization'], timestamp })
    expect(useAppStore.getState().stages.map((stage) => stage.status))
      .toEqual(['completed', 'ready', 'stale'])
    useAppStore.getState().applyRunEvent({ type: 'run-finished', runId, outcome: 'cancelled', timestamp })
    expect(useAppStore.getState().stages.map((stage) => stage.status))
      .toEqual(['completed', 'cancelled', 'stale'])
  })

  it('uses backend stage completion time instead of a demo duration', () => {
    useAppStore.getState().applyRunEvent({
      type: 'run-started',
      runId: 'output_2026-08-27_15-00-00-000Z',
      stages: ['linear'],
      timestamp: '2026-08-27T13:00:00.000Z',
    })
    useAppStore.getState().applyRunEvent({
      type: 'stage-status',
      runId: 'output_2026-08-27_15-00-00-000Z',
      stage: 'linear',
      status: 'completed',
      timestamp: '2026-08-27T13:01:07.000Z',
      durationSeconds: 67,
    })

    const linear = useAppStore.getState().stages.find((stage) => stage.id === 'linear')
    expect(linear?.duration).toBe('1 min 07 s')
    expect(linear?.progress).toBe(100)
  })
})

describe('Shared Results run selection', () => {
  const resultsFor = (ids: string[]) => ({
    schemaVersion: 'jco.results/1',
    workspace: '/tmp/jco-test',
    runs: ids.map((id) => ({ id, traces: [] })),
  })

  beforeEach(() => {
    useAppStore.setState({ results: null, selectedResultsRunId: null })
  })

  it('selects the latest initially, preserves an older run on refresh, and falls back only if removed', () => {
    useAppStore.getState().setResults(resultsFor(['latest', 'older']))
    expect(useAppStore.getState().selectedResultsRunId).toBe('latest')
    useAppStore.getState().setSelectedResultsRunId('older')
    useAppStore.getState().setResults(resultsFor(['newer', 'latest', 'older']))
    expect(useAppStore.getState().selectedResultsRunId).toBe('older')
    useAppStore.getState().setResults(resultsFor(['newer', 'latest']))
    expect(useAppStore.getState().selectedResultsRunId).toBe('newer')
    useAppStore.getState().setResults(resultsFor([]))
    expect(useAppStore.getState().selectedResultsRunId).toBeNull()
  })

  it('clears the selected run when switching projects', () => {
    useAppStore.getState().setResults(resultsFor(['latest', 'older']))
    useAppStore.getState().setSelectedResultsRunId('older')
    useAppStore.getState().loadProject(structuredClone(originalProject))
    expect(useAppStore.getState().selectedResultsRunId).toBeNull()
    expect(useAppStore.getState().results).toBeNull()
  })
})
