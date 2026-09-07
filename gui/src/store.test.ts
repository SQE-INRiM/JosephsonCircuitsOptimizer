import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from './store'

const originalProject = structuredClone(useAppStore.getState().project)

describe('GUI device parameter workflow', () => {
  beforeEach(() => {
    useAppStore.setState({ project: structuredClone(originalProject), dirty: false })
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

  it('uses backend stage completion time instead of a demo duration', () => {
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
