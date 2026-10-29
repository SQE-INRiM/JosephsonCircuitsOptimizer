// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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

  it('warns when the shared intermodulation order is unlimited', () => {
    render(<SetupScreen />)
    expect(screen.getByText(/For first-order linear simulations, set both linear harmonic counts and Max intermodulation order to 1/)).toBeTruthy()
    expect(screen.getByText(/changing it also affects the nonlinear HB stage/)).toBeTruthy()
  })

  it('shows first-order guidance when all three truncations are 1', () => {
    useAppStore.getState().updateComputation({ maxIntermodOrder: '1' })
    render(<SetupScreen />)

    expect(screen.getByText(/Linear-stage harmonic and intermodulation limits are set to first order/)).toBeTruthy()
    expect(screen.queryByText(/For first-order linear simulations, set both linear harmonic counts/)).toBeNull()
  })

  it.each([
    { linearStrongToneHarmonics: 2 },
    { linearModulationHarmonics: 2 },
  ])('warns when a linear harmonic count is increased (%o)', (patch) => {
    useAppStore.getState().updateComputation({ maxIntermodOrder: '1', ...patch })
    render(<SetupScreen />)
    expect(screen.getByText(/For first-order linear simulations, set both linear harmonic counts/)).toBeTruthy()
  })

  it('updates the guidance when the shared intermodulation order changes', () => {
    render(<SetupScreen />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Max intermodulation order' }), { target: { value: '1' } })
    expect(screen.getByText(/Linear-stage harmonic and intermodulation limits are set to first order/)).toBeTruthy()
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
