// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
