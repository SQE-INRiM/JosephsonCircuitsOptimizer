// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../store'
import { SetupScreen } from './SetupScreen'

const originalProject = structuredClone(useAppStore.getState().project)

describe('Setup source type toggle', () => {
  beforeEach(() => {
    const acSource = structuredClone(originalProject.sources.find((source) => !source.isDc)!)
    useAppStore.setState({
      project: { ...structuredClone(originalProject), sources: [acSource] },
      setupStep: 0,
      setupPanel: 'sources',
      dirty: false,
    })
  })

  afterEach(() => cleanup())

  it.each([
    { mode: 'Fixed' as const, value: '7.5' },
    { mode: 'List' as const, values: '7, 8' },
    { mode: 'Range' as const, start: '6', stop: '9', step: '0.5' },
  ])('restores the previous AC frequency specification after toggling DC ($mode)', (acFrequency) => {
    useAppStore.setState((state) => ({
      project: {
        ...state.project,
        sources: state.project.sources.map((source) => ({ ...source, frequency: acFrequency })),
      },
    }))
    render(<SetupScreen />)
    expect(screen.getByRole('button', { name: 'AC' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'DC' }))
    expect(screen.getByRole('button', { name: 'DC' }).getAttribute('aria-pressed')).toBe('true')
    expect(useAppStore.getState().project.sources[0]).toMatchObject({
      isDc: true,
      frequency: { mode: 'Fixed', value: '0' },
      acFrequency,
    })

    fireEvent.click(screen.getByRole('button', { name: 'AC' }))
    expect(screen.getByRole('button', { name: 'AC' }).getAttribute('aria-pressed')).toBe('true')
    expect(useAppStore.getState().project.sources[0]).toMatchObject({
      isDc: false,
      frequency: acFrequency,
    })

    fireEvent.click(screen.getByRole('button', { name: 'DC' }))
    fireEvent.click(screen.getByRole('button', { name: 'AC' }))
    expect(useAppStore.getState().project.sources[0].frequency).toEqual(acFrequency)
  })

  it('displays the existing source type when opening a project with a DC source', () => {
    const dcSource = structuredClone(originalProject.sources.find((source) => source.isDc)!)
    useAppStore.setState((state) => ({
      project: { ...state.project, sources: [dcSource] },
    }))

    render(<SetupScreen />)
    expect(screen.getByRole('button', { name: 'DC' }).getAttribute('aria-pressed')).toBe('true')
  })
  it('uses the default 1 GHz only for a DC source with no previous AC configuration', () => {
    const dcSource = structuredClone(originalProject.sources.find((source) => source.isDc)!)
    useAppStore.setState((state) => ({
      project: { ...state.project, sources: [dcSource] },
    }))
    render(<SetupScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'AC' }))
    expect(useAppStore.getState().project.sources[0].frequency).toEqual({ mode: 'Fixed', value: '1' })
  })

  it('does not deselect the active source type', () => {
    render(<SetupScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'AC' }))
    expect(useAppStore.getState().project.sources[0].isDc).toBe(false)
    expect(screen.getByRole('button', { name: 'AC' }).getAttribute('aria-pressed')).toBe('true')
  })
})

describe('Linear-stage harmonic and intermodulation guidance', () => {
  beforeEach(() => {
    useAppStore.setState({
      project: structuredClone(originalProject),
      setupStep: 1,
      dirty: false,
    })
  })

  afterEach(() => cleanup())

  it('shows informational guidance when the shared intermodulation order is unlimited', () => {
    render(<SetupScreen />)
    const guidance = screen.getByText(/For a standard Linear sweep, set Strong-tone harmonics and Modulation harmonics to 1/)
    expect(guidance.closest('.MuiAlert-root')?.getAttribute('role')).toBe('status')
    expect(screen.queryByText(/changing it also affects the nonlinear HB stage/)).toBeNull()
    expect(screen.queryByText(/DC inclusion is determined automatically/)).toBeNull()
    expect(screen.queryByText(/Shared by linear and nonlinear stages/)).toBeNull()

    const batchesHint = screen.getByText(/Set Frequency batches to 0 to use all Julia threads configured in/)
    expect(batchesHint.classList.contains('MuiTypography-caption')).toBe(true)
    expect(batchesHint.closest('.MuiAlert-root')).toBeNull()
    expect(batchesHint.textContent).toContain('Julia settings')
  })

  it('shows first-order guidance when all three truncations are 1', () => {
    useAppStore.getState().updateComputation({ maxIntermodOrder: '1' })
    render(<SetupScreen />)

    expect(screen.getByText(/Linear-stage harmonic and intermodulation limits are set to first order/)).toBeTruthy()
    expect(screen.queryByText(/For a standard Linear sweep, set Strong-tone harmonics and Modulation harmonics/)).toBeNull()
  })

  it.each([
    { linearStrongToneHarmonics: 2 },
    { linearModulationHarmonics: 2 },
  ])('shows info when a linear harmonic count is increased (%o)', (patch) => {
    useAppStore.getState().updateComputation({ maxIntermodOrder: '1', ...patch })
    render(<SetupScreen />)
    const guidance = screen.getByText(/For a standard Linear sweep, set Strong-tone harmonics and Modulation harmonics/)
    expect(guidance.closest('.MuiAlert-root')?.getAttribute('role')).toBe('status')
  })

  it('updates the guidance when the shared intermodulation order changes', () => {
    render(<SetupScreen />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Max intermodulation order' }), { target: { value: '1' } })
    expect(screen.getByText(/Linear-stage harmonic and intermodulation limits are set to first order/)).toBeTruthy()
  })
})

describe('Single-point optimization panel', () => {
  beforeEach(() => {
    useAppStore.setState({
      project: {
        ...structuredClone(originalProject),
        parameters: originalProject.parameters.map((parameter) => ({
          ...parameter, mode: 'Fixed' as const, value: '250',
        })),
      },
      setupStep: 1,
      dirty: false,
    })
  })

  afterEach(() => cleanup())

  it('shows a muted panel and disables all optimization controls for one configuration', () => {
    render(<SetupScreen />)

    const panel = screen.getByText('Optimization').closest('.MuiCard-root')
    expect(panel?.getAttribute('aria-disabled')).toBe('true')
    expect(panel?.querySelectorAll('.Mui-disabled').length).toBeGreaterThan(0)
    expect(screen.getByText(/Optimization skipped — only one device configuration in Linear/)).toBeTruthy()
    for (const label of ['Iterations', 'Samples / iteration', 'Random seed']) {
      expect((screen.getByRole('spinbutton', { name: label }) as HTMLInputElement).disabled).toBe(true)
    }
    for (const label of ['Surrogate', 'Strategy', 'Sampler']) {
      expect(screen.getByRole('combobox', { name: label }).getAttribute('aria-disabled')).toBe('true')
    }
  })

  it('keeps a single-value List disabled and automatically re-enables optimization for multiple points', () => {
    render(<SetupScreen />)
    const startingIterations = useAppStore.getState().project.computation.optimizerIterations

    act(() => {
      useAppStore.setState((state) => ({
        project: {
          ...state.project,
          parameters: state.project.parameters.map((parameter, index) =>
            index === 0 ? { ...parameter, mode: 'List' as const, values: '250' } : parameter),
        },
      }))
    })
    expect((screen.getByRole('spinbutton', { name: 'Iterations' }) as HTMLInputElement).disabled).toBe(true)

    act(() => {
      useAppStore.setState((state) => ({
        project: {
          ...state.project,
          parameters: state.project.parameters.map((parameter, index) =>
            index === 0 ? { ...parameter, mode: 'List' as const, values: '250, 350' } : parameter),
        },
      }))
    })
    expect(screen.getByText(/Optimization enabled/)).toBeTruthy()
    expect(screen.getByText('Optimization').closest('.MuiCard-root')?.getAttribute('aria-disabled')).toBe('false')
    expect((screen.getByRole('spinbutton', { name: 'Iterations' }) as HTMLInputElement).disabled).toBe(false)
    expect(screen.getByRole('combobox', { name: 'Surrogate' }).getAttribute('aria-disabled')).not.toBe('true')
    expect(useAppStore.getState().project.computation.optimizerIterations).toBe(startingIterations)
  })
})

describe('Device parameter mode editor regression', () => {
  beforeEach(() => {
    useAppStore.setState({
      project: {
        ...structuredClone(originalProject),
        circuitCode: 'function create_user_circuit(device_params_set)\nCg = device_params_set[:Cg]\nend',
        parameters: [{
          id: 'circuit-Cg', name: 'Cg', mode: 'Fixed',
          value: '250', unit: 'fF', role: 'Fixed model', circuitStatus: 'configured',
        }],
      },
      setupStep: 0,
      setupPanel: 'parameters',
      dirty: false,
    })
  })

  afterEach(() => cleanup())

  function selectMode(row: HTMLElement, mode: 'Fixed' | 'Range' | 'List') {
    fireEvent.mouseDown(within(row).getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: mode }))
  }

  it('allows typing a List immediately after changing Fixed to List', () => {
    const { container } = render(<SetupScreen />)
    const row = container.querySelector('tbody tr') as HTMLElement
    selectMode(row, 'List')
    const values = within(row).getByRole('textbox', { name: 'Values' }) as HTMLInputElement
    expect(values.disabled).toBe(false)
    fireEvent.change(values, { target: { value: '100, 150, 250' } })
    expect(useAppStore.getState().project.parameters[0]).toMatchObject({
      mode: 'List', values: '100, 150, 250',
    })
    expect((within(row).getByRole('textbox', { name: 'Values' }) as HTMLInputElement).value)
      .toBe('100, 150, 250')
  })

  it('allows editing Start, Stop, Step after changing to Range', () => {
    const { container } = render(<SetupScreen />)
    const row = container.querySelector('tbody tr') as HTMLElement
    selectMode(row, 'Range')
    for (const [name, value] of [['Start', '100'], ['Stop', '350'], ['Step', '25']] as const) {
      const input = within(row).getByRole('textbox', { name }) as HTMLInputElement
      expect(input.disabled).toBe(false)
      fireEvent.change(input, { target: { value } })
    }
    expect(useAppStore.getState().project.parameters[0]).toMatchObject({
      mode: 'Range', start: '100', stop: '350', step: '25',
    })
  })

  it('keeps Fixed editable after switching List then Fixed', () => {
    const { container } = render(<SetupScreen />)
    const row = container.querySelector('tbody tr') as HTMLElement
    selectMode(row, 'List')
    selectMode(row, 'Fixed')
    const value = within(row).getByRole('textbox', { name: 'Value' }) as HTMLInputElement
    expect(value.disabled).toBe(false)
    fireEvent.change(value, { target: { value: '300' } })
    expect(useAppStore.getState().project.parameters[0]).toMatchObject({ mode: 'Fixed', value: '300' })
  })
})

describe('Setup navigation across Model & inputs substeps', () => {
  beforeEach(() => {
    useAppStore.setState({
      project: structuredClone(originalProject),
      setupStep: 0,
      setupPanel: 'circuit',
      dirty: false,
    })
  })
  afterEach(() => cleanup())

  it('walks through Circuit, Device parameters and Sources before Computation', () => {
    render(<SetupScreen />)
    const next = screen.getByRole('button', { name: 'Next' })
    const back = screen.getByRole('button', { name: 'Back' })

    const titleRow = screen.getByText('Project setup').parentElement?.parentElement
    expect(titleRow?.contains(next)).toBe(true)
    expect(titleRow?.contains(back)).toBe(true)
    expect(next.closest('.MuiPaper-root')).toBeNull()
    expect(back.classList.contains('MuiButton-outlined')).toBe(true)
    expect(next.classList.contains('MuiButton-contained')).toBe(true)
    expect(screen.queryByRole('button', { name: 'Run remaining' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Stop run' })).toBeNull()

    expect(back.hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('tab', { name: 'Circuit' }).getAttribute('aria-selected')).toBe('true')

    fireEvent.click(next)
    expect(useAppStore.getState()).toMatchObject({ setupStep: 0, setupPanel: 'parameters' })
    expect(screen.getByRole('tab', { name: /Device parameters/ }).getAttribute('aria-selected')).toBe('true')

    fireEvent.click(next)
    expect(useAppStore.getState()).toMatchObject({ setupStep: 0, setupPanel: 'sources' })
    expect(screen.getByRole('tab', { name: /Sources/ }).getAttribute('aria-selected')).toBe('true')

    fireEvent.click(next)
    expect(useAppStore.getState()).toMatchObject({ setupStep: 1, setupPanel: 'sources' })
    expect(screen.getByText('Harmonic and solver settings')).toBeTruthy()

    fireEvent.click(next)
    expect(useAppStore.getState().setupStep).toBe(2)
    expect(next.hasAttribute('disabled')).toBe(true)
  })

  it('traverses the same substeps backwards from Metrics to Circuit', () => {
    useAppStore.setState({ setupStep: 2, setupPanel: 'circuit' })
    render(<SetupScreen />)
    const back = screen.getByRole('button', { name: 'Back' })

    fireEvent.click(back)
    expect(useAppStore.getState().setupStep).toBe(1)

    fireEvent.click(back)
    expect(useAppStore.getState()).toMatchObject({ setupStep: 0, setupPanel: 'sources' })

    fireEvent.click(back)
    expect(useAppStore.getState()).toMatchObject({ setupStep: 0, setupPanel: 'parameters' })

    fireEvent.click(back)
    expect(useAppStore.getState()).toMatchObject({ setupStep: 0, setupPanel: 'circuit' })
    expect(back.hasAttribute('disabled')).toBe(true)
  })

  it('respects manually selected sub-tabs when using Next and Back', () => {
    render(<SetupScreen />)
    fireEvent.click(screen.getByRole('tab', { name: /Sources/ }))
    expect(useAppStore.getState()).toMatchObject({ setupStep: 0, setupPanel: 'sources' })

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(useAppStore.getState().setupStep).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(useAppStore.getState()).toMatchObject({ setupStep: 0, setupPanel: 'sources' })
  })
})

describe('Nonlinear feedback setup', () => {
  beforeEach(() => {
    useAppStore.setState({
      project: structuredClone(originalProject),
      setupStep: 1,
      dirty: false,
    })
  })

  afterEach(() => cleanup())

  it('is disabled by default and preserves per-source reference currents when toggled', () => {
    render(<SetupScreen />)
    const enable = screen.getByRole('checkbox', { name: /Enable nonlinear feedback/ })
    expect((enable as HTMLInputElement).checked).toBe(false)
    expect(screen.queryByRole('spinbutton', { name: 'Correction cycles' })).toBeNull()

    fireEvent.click(enable)
    expect(useAppStore.getState().project.computation.nonlinearCorrectionCycles).toBe(1)
    expect(screen.getByText(/Every source needs a finite reference amplitude/)).toBeTruthy()

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Correction cycles' }), { target: { value: '3' } })
    expect(useAppStore.getState().project.computation.nonlinearCorrectionCycles).toBe(3)

    fireEvent.change(screen.getByRole('textbox', { name: 'Source 1 reference amplitude (A)' }), { target: { value: '1e-6' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Source 2 reference amplitude (A)' }), { target: { value: '-0.0001' } })
    expect(useAppStore.getState().project.sources.map((source) => source.extras?.non_linear_amplitude_for_delta_correction))
      .toEqual(['1e-6', '-0.0001'])
    expect(screen.queryByText(/Every source needs a finite reference amplitude/)).toBeNull()

    fireEvent.click(enable)
    expect(useAppStore.getState().project.computation.nonlinearCorrectionCycles).toBe(0)
    fireEvent.click(enable)
    expect(useAppStore.getState().project.computation.nonlinearCorrectionCycles).toBe(1)
    expect((screen.getByRole('textbox', { name: 'Source 1 reference amplitude (A)' }) as HTMLInputElement).value).toBe('1e-6')
  })

  it('documents full linear and nonlinear hbsolve inputs to the correction hook', () => {
    useAppStore.setState({ setupStep: 2 })
    render(<SetupScreen />)
    expect(screen.getByRole('button', { name: 'Edit correction' })).toBeTruthy()
    expect(screen.getByText(/user_nonlinear_correction\(sol_linear, sol_nonlinear, device_params_set\)/)).toBeTruthy()
    expect(screen.getByText(/Both inputs are complete hbsolve solutions/)).toBeTruthy()
  })

  it.each([
    { action: 'Edit cost', functionName: 'user_cost' },
    { action: 'Edit performance', functionName: 'user_performance' },
    { action: 'Edit correction', functionName: 'user_nonlinear_correction' },
  ])('opens the shared Julia file at $functionName', ({ action, functionName }) => {
    useAppStore.setState({ setupStep: 2 })
    render(<SetupScreen />)
    fireEvent.click(screen.getByRole('button', { name: action }))
    const editor = screen.getByRole('textbox', { name: 'user_cost_and_performance.jl' }) as HTMLTextAreaElement
    const original = useAppStore.getState().project.metricsCode
    expect(editor.value).toBe(original)
    expect(editor.selectionStart).toBe(original.indexOf('function ' + functionName + '('))
    expect(editor.selectionEnd).toBe(editor.selectionStart)
  })

  it('preserves every user function when editing the correction', () => {
    useAppStore.setState({ setupStep: 2 })
    render(<SetupScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit correction' }))
    const editor = screen.getByRole('textbox', { name: 'user_cost_and_performance.jl' })
    const original = useAppStore.getState().project.metricsCode
    const modified = original.replace(
      'function user_nonlinear_correction(sol_linear, sol_nonlinear, device_params_set)',
      'function user_nonlinear_correction(sol_linear, sol_nonlinear, device_params_set)\n    # custom feedback',
    )
    fireEvent.change(editor, { target: { value: modified } })
    expect(useAppStore.getState().project.metricsCode).toBe(modified)
    expect(useAppStore.getState().project.metricsCode).toContain('function user_cost(')
    expect(useAppStore.getState().project.metricsCode).toContain('function user_performance(')
    expect(useAppStore.getState().dirty).toBe(true)
  })
})


