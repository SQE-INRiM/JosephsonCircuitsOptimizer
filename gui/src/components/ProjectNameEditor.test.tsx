// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../store'
import { ProjectNameEditor } from './ProjectNameEditor'

const original = structuredClone(useAppStore.getState().project)

beforeEach(() => {
  useAppStore.getState().loadProject(structuredClone(original))
  useAppStore.setState({ dirty: false })
})

afterEach(() => {
  cleanup()
  useAppStore.getState().loadProject(structuredClone(original))
})

describe('Header project title', () => {
  it('shows only the clickable display name, not the underlying .jco filename', () => {
    render(<ProjectNameEditor />)
    expect(screen.getByRole('button', { name: `Rename project: ${original.name}` })).toBeTruthy()
    expect(screen.queryByText(original.filename)).toBeNull()
    expect(screen.queryByRole('textbox', { name: 'Project name' })).toBeNull()
  })

  it('renames a new project, keeps the .jco Save As filename in the model, and marks changes unsaved', () => {
    render(<ProjectNameEditor />)
    fireEvent.click(screen.getByRole('button', { name: `Rename project: ${original.name}` }))
    const input = screen.getByRole('textbox', { name: 'Project name' })
    fireEvent.change(input, { target: { value: 'New JTWPA design' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(useAppStore.getState().project.name).toBe('New JTWPA design')
    expect(useAppStore.getState().project.filename).toBe('New JTWPA design.jco')
    expect(useAppStore.getState().dirty).toBe(true)
    expect(screen.getByRole('button', { name: 'Rename project: New JTWPA design' })).toBeTruthy()
    expect(screen.queryByText('New JTWPA design.jco')).toBeNull()
  })

  it('cancels the rename with Escape and does not change a saved filename', () => {
    useAppStore.setState((state) => ({
      project: {
        ...state.project,
        name: 'Saved device',
        filename: 'device_2026.jco',
        workspaceInfo: { path: 'C:/projects', projectPath: 'C:/projects/device_2026.jco', auxiliaryFiles: [] },
      },
    }))
    render(<ProjectNameEditor />)
    fireEvent.click(screen.getByRole('button', { name: 'Rename project: Saved device' }))
    const input = screen.getByRole('textbox', { name: 'Project name' })
    fireEvent.change(input, { target: { value: 'Discard me' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(useAppStore.getState().project.name).toBe('Saved device')
    expect(useAppStore.getState().project.filename).toBe('device_2026.jco')
    expect(useAppStore.getState().dirty).toBe(false)
  })

  it('ignores an empty project name rather than saving a blank title', () => {
    render(<ProjectNameEditor />)
    fireEvent.click(screen.getByRole('button', { name: `Rename project: ${original.name}` }))
    const input = screen.getByRole('textbox', { name: 'Project name' })
    fireEvent.change(input, { target: { value: '  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(useAppStore.getState().project.name).toBe(original.name)
    expect(useAppStore.getState().dirty).toBe(false)
  })
})
