// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { useAppStore } from './store'
import type { JcoAdapter } from './services/jcoAdapter'
import type { ProjectModel } from './types'

const baseline = structuredClone(useAppStore.getState().project)
function projectFromArchive(): ProjectModel {
  return {
    ...structuredClone(baseline),
    name: 'Dropped JTWPA',
    filename: 'dropped.jco',
    circuitCode: 'function create_user_circuit(device_params_set)\nCg = device_params_set[:Cg]\nend',
    parameters: [{
      id: 'Cg', name: 'Cg', mode: 'Range',
      start: '100', stop: '350', step: '25', unit: 'fF',
      role: 'Design', circuitStatus: 'configured',
    }],
  }
}

afterEach(() => {
  cleanup()
  delete window.jco
  vi.unstubAllGlobals()
  useAppStore.setState({ project: structuredClone(baseline), dirty: false, setupPanel: 'parameters' })
})

describe('Desktop .jco file-drop and parameter editing integration', () => {
  it('keeps the dropped project when startup completes late', async () => {
    let resolveNewProject!: (project: ProjectModel) => void
    const pendingStartup = new Promise<ProjectModel>((resolve) => { resolveNewProject = resolve })
    const model = projectFromArchive()
    const openDroppedProject = vi.fn(async () => model)
    window.jco = {
      onRunEvent: () => () => {},
      setupRuntime: async () => ({ ok: true, message: 'ready' }),
      newProject: () => pendingStartup,
      listExamples: async () => [],
      openDroppedProject,
      readResults: async () => ({ schemaVersion: 'jco.results/4', workspace: '', runs: [] }),
    } as unknown as JcoAdapter

    render(<App />)
    const file = new File(['example'], 'dropped.jco')
    const transfer = { types: ['Files'], files: [file], dropEffect: 'copy' }
    fireEvent.dragEnter(window, { dataTransfer: transfer })
    fireEvent.drop(window, { dataTransfer: transfer })
    expect(openDroppedProject).not.toHaveBeenCalled()
    resolveNewProject(structuredClone(baseline))
    await waitFor(() => expect(useAppStore.getState().project.name).toBe('Dropped JTWPA'))
    expect(openDroppedProject).toHaveBeenCalledTimes(1)
    useAppStore.getState().updateParameter('Cg', { mode: 'Fixed' })
    useAppStore.getState().updateParameter('Cg', { value: '250' })
    expect(useAppStore.getState().project.parameters[0]).toMatchObject({ mode: 'Fixed', value: '250' })
  })

  it('clears the drag overlay even if the drop event omits file types', async () => {
    window.jco = {
      onRunEvent: () => () => {},
      setupRuntime: async () => ({ ok: true, message: 'ready' }),
      newProject: async () => structuredClone(baseline),
      listExamples: async () => [],
    } as unknown as JcoAdapter
    render(<App />)
    fireEvent.dragEnter(window, { dataTransfer: { types: ['Files'], files: [] } })
    expect(screen.getByRole('status', { name: 'Drop .jco project' })).toBeTruthy()
    fireEvent.drop(window, { dataTransfer: { types: [], files: [] } })
    expect(screen.queryByRole('status', { name: 'Drop .jco project' })).toBeNull()
  })

  it('can edit Range, Fixed and List after dropping a project', async () => {
    const model = projectFromArchive()
    const openDroppedProject = vi.fn(async (_file: File) => model)
    window.jco = {
      onRunEvent: () => () => {},
      setupRuntime: async () => ({ ok: true, message: 'ready' }),
      newProject: async () => structuredClone(baseline),
      listExamples: async () => [],
      openDroppedProject,
      readResults: async () => ({ schemaVersion: 'jco.results/4', workspace: '', runs: [] }),
    } as unknown as JcoAdapter
    vi.stubGlobal('confirm', vi.fn(() => true))

    render(<App />)
    await waitFor(() => expect(useAppStore.getState().project.filename).toBe(baseline.filename))

    const file = new File(['example'], 'dropped.jco', { type: 'application/octet-stream' })
    const transfer = { types: ['Files'], files: [file], dropEffect: 'copy' }
    fireEvent.dragEnter(window, { dataTransfer: transfer })
    expect(screen.getByRole('status', { name: 'Drop .jco project' })).toBeTruthy()
    fireEvent.drop(window, { dataTransfer: transfer })
    await waitFor(() => expect(openDroppedProject).toHaveBeenCalledWith(file))
    await waitFor(() => expect(useAppStore.getState().project.name).toBe('Dropped JTWPA'))
    expect(screen.queryByRole('status', { name: 'Drop .jco project' })).toBeNull()

    useAppStore.getState().setSetupPanel('parameters')
    const row = (await screen.findByDisplayValue('Cg')).closest('tr') as HTMLElement
    const select = (mode: 'Fixed' | 'Range' | 'List') => {
      fireEvent.mouseDown(within(row).getByRole('combobox'))
      fireEvent.click(screen.getByRole('option', { name: mode }))
    }
    select('Fixed')
    expect((within(row).getByRole('textbox', { name: 'Stop' }) as HTMLInputElement).value).toBe('')
    expect((within(row).getByRole('textbox', { name: 'Step' }) as HTMLInputElement).value).toBe('')
    fireEvent.change(within(row).getByRole('textbox', { name: 'Value' }), { target: { value: '250' } })
    expect(useAppStore.getState().project.parameters[0]).toMatchObject({ mode: 'Fixed', value: '250', stop: '', step: '' })
    select('List')
    fireEvent.change(within(row).getByRole('textbox', { name: 'Values' }), { target: { value: '100, 200, 250' } })
    expect(useAppStore.getState().project.parameters[0]).toMatchObject({ mode: 'List', values: '100, 200, 250', stop: '', step: '' })
    select('Range')
    for (const [name, value] of [['Start', '120'], ['Stop', '300'], ['Step', '20']] as const) {
      fireEvent.change(within(row).getByRole('textbox', { name }), { target: { value } })
    }
    expect(useAppStore.getState().project.parameters[0]).toMatchObject({ mode: 'Range', start: '120', stop: '300', step: '20' })
  })
})
