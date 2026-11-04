// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { useAppStore } from './store'
import type { JcoAdapter } from './services/jcoAdapter'
import type { ProjectModel } from './types'

const originalProject = structuredClone(useAppStore.getState().project)
const saved = vi.fn(async (_project: ProjectModel, _saveAs = false): Promise<null> => null)

beforeEach(() => {
  useAppStore.getState().loadProject(structuredClone(originalProject))
  useAppStore.setState({ dirty: false })
  saved.mockClear()
  window.jco = {
    onRunEvent: () => () => {},
    setupRuntime: async () => ({ ok: true, message: 'ready' }),
    newProject: async () => structuredClone(originalProject),
    listExamples: async () => [{ fileName: 'demo-jtwpa.jco', name: 'Demo JTWPA' }],
    openExample: async () => structuredClone(originalProject),
    saveProject: saved,
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

  it('keeps Save As operational in the primary project-action group', async () => {
    render(<App themePreference="dark" />)
    fireEvent.click(screen.getByRole('button', { name: 'Project menu' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Save As…' }))

    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1))
    expect(saved.mock.calls[0]?.[1]).toBe(true)
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
