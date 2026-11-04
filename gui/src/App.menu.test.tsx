// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { useAppStore } from './store'
import type { JcoAdapter } from './services/jcoAdapter'
import type { ProjectModel } from './types'

const originalProject = structuredClone(useAppStore.getState().project)
const saved = vi.fn(async (_project: ProjectModel, _saveAs = false): Promise<null> => null)
const exported = vi.fn(async (_project: ProjectModel): Promise<string | null> => 'C:/exports/JTWPA.zip')

beforeEach(() => {
  useAppStore.getState().loadProject(structuredClone(originalProject))
  useAppStore.setState({ dirty: false })
  saved.mockClear()
  exported.mockClear()
  window.jco = {
    onRunEvent: () => () => {},
    setupRuntime: async () => ({ ok: true, message: 'ready' }),
    newProject: async () => structuredClone(originalProject),
    listExamples: async () => [{ fileName: 'demo-jtwpa.jco', name: 'Demo JTWPA' }],
    openExample: async () => structuredClone(originalProject),
    saveProject: saved,
    exportWorkspace: exported,
  } as unknown as JcoAdapter
})

afterEach(() => {
  cleanup()
  delete window.jco
  useAppStore.getState().loadProject(structuredClone(originalProject))
})

describe('JCO project menu', () => {
  it('groups project actions, examples, app information, and only Dark/Light in that order', async () => {
    render(<App themePreference="dark" />)
    fireEvent.click(screen.getByRole('button', { name: 'Project menu' }))

    await screen.findByRole('menuitem', { name: 'Demo JTWPA' })
    const menu = screen.getByRole('menu')
    const labels = within(menu).getAllByRole('menuitem').map((item) => item.textContent?.trim())

    expect(labels).toEqual([
      'New project',
      'Open project…',
      'Save',
      'Save As…',
      'Examples',
      'Demo JTWPA',
      'Julia settings…',
      'About JCO…',
      'Appearance',
      'Dark ✓',
      'Light',
    ])
    expect(screen.queryByRole('menuitem', { name: /Import legacy folder|Export editable workspace|Export Data|System/ })).toBeNull()
  })

  it('offers editable ZIP as the primary Save As action without changing the current .jco project', async () => {
    render(<App themePreference="dark" />)
    fireEvent.click(screen.getByRole('button', { name: 'Project menu' }))
    // The desktop startup loads a fresh project asynchronously. Mark edits
    // only after initialization, as a user would do in the running GUI.
    await screen.findByRole('menuitem', { name: 'Demo JTWPA' })
    useAppStore.setState({ dirty: true })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Save As…' }))

    const dialog = screen.getByRole('dialog', { name: 'Save As…' })
    expect(within(dialog).getByRole('button', { name: 'Editable workspace (.zip)' }).classList.contains('MuiButton-contained')).toBe(true)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Editable workspace (.zip)' }))

    await waitFor(() => expect(exported).toHaveBeenCalledTimes(1))
    expect(exported.mock.calls[0]?.[0].name).toBe(originalProject.name)
    expect(saved).not.toHaveBeenCalled()
    expect(useAppStore.getState().dirty).toBe(true)
    expect(useAppStore.getState().project.filename).toBe(originalProject.filename)
  })

  it('still allows making a second .jco copy via Save As', async () => {
    render(<App themePreference="dark" />)
    fireEvent.click(screen.getByRole('button', { name: 'Project menu' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Save As…' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Save As…' })).getByRole('button', { name: 'JCO project (.jco)' }))

    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1))
    expect(saved.mock.calls[0]?.[1]).toBe(true)
    expect(exported).not.toHaveBeenCalled()
  })

  it('keeps the regular Save action directed at the current .jco project', async () => {
    render(<App themePreference="dark" />)
    fireEvent.click(screen.getByRole('button', { name: 'Project menu' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /^Save$/ }))

    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1))
    expect(saved.mock.calls[0]?.[1]).toBe(false)
    expect(exported).not.toHaveBeenCalled()
  })

  it('exposes Dark and Light choices and notifies the theme controller', async () => {
    const changeTheme = vi.fn()
    render(<App themePreference="dark" onThemePreferenceChange={changeTheme} />)
    fireEvent.click(screen.getByRole('button', { name: 'Project menu' }))
    const dark = screen.getByRole('menuitem', { name: 'Dark ✓' })
    expect(dark.classList.contains('Mui-selected')).toBe(true)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Light' }))
    expect(changeTheme).toHaveBeenCalledWith('light')
  })
})
