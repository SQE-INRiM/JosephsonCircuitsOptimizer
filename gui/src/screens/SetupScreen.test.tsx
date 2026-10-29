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

  it('switches between AC and DC while keeping the source frequency semantics', () => {
    render(<SetupScreen />)
    expect(screen.getByRole('button', { name: 'AC' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'DC' }))
    expect(screen.getByRole('button', { name: 'DC' }).getAttribute('aria-pressed')).toBe('true')

    expect(useAppStore.getState().project.sources[0].isDc).toBe(true)
    expect(useAppStore.getState().project.sources[0].frequency).toEqual({ mode: 'Fixed', value: '0' })

    fireEvent.click(screen.getByRole('button', { name: 'AC' }))
    expect(screen.getByRole('button', { name: 'AC' }).getAttribute('aria-pressed')).toBe('true')

    expect(useAppStore.getState().project.sources[0].isDc).toBe(false)
    expect(useAppStore.getState().project.sources[0].frequency).toEqual({ mode: 'Fixed', value: '1' })
  })

  it('displays the existing source type when opening a project with a DC source', () => {
    const dcSource = structuredClone(originalProject.sources.find((source) => source.isDc)!)
    useAppStore.setState((state) => ({
      project: { ...state.project, sources: [dcSource] },
    }))

    render(<SetupScreen />)
    expect(screen.getByRole('button', { name: 'DC' }).getAttribute('aria-pressed')).toBe('true')
  })
  it('does not deselect the active source type', () => {
    render(<SetupScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'AC' }))
    expect(useAppStore.getState().project.sources[0].isDc).toBe(false)
    expect(screen.getByRole('button', { name: 'AC' }).getAttribute('aria-pressed')).toBe('true')
  })
})
