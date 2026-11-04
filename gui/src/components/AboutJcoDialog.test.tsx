// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AboutJcoDialog, JCO_CITATION } from './AboutJcoDialog'
import type { JcoAdapter } from '../services/jcoAdapter'
import packageJson from '../../package.json'

afterEach(() => {
  cleanup()
  delete window.jco
})

describe('About JCO', () => {
  it('shows the author, institutional affiliation, app version and publication information', () => {
    render(<AboutJcoDialog open onClose={() => {}} />)

    expect(screen.getByRole('dialog', { name: 'About JCO' })).toBeTruthy()
    expect(screen.getByAltText('JCO — Josephson Circuits Optimizer')).toBeTruthy()
    expect(screen.getByText(`Version ${packageJson.version}`)).toBeTruthy()
    expect(screen.getByText('Developed by Emanuele Palumbo')).toBeTruthy()
    expect(screen.getByText('INRiM – Politecnico di Torino')).toBeTruthy()
    expect(screen.getByText('How to cite')).toBeTruthy()
    expect(screen.getByText(/IEEE Transactions on Applied Superconductivity/)).toBeTruthy()
    expect(screen.getByText(/Open-source software · MIT License/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'GitHub repository' }).getAttribute('href')).toBe('https://github.com/SQE-INRiM/JosephsonCircuitsOptimizer')
    expect(screen.getByRole('link', { name: 'Report an issue' }).getAttribute('href')).toContain('/issues')
    expect(screen.getByRole('link', { name: /DOI:/ }).getAttribute('href')).toBe('https://doi.org/10.1109/TASC.2026.3679488')
    expect(screen.getByRole('link', { name: 'View license' }).getAttribute('href')).toContain('/LICENSE.md')
  })

  it('copies the canonical paper citation to the clipboard', async () => {
    const writeText = vi.fn(async (_value: string) => {})
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })

    render(<AboutJcoDialog open onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy citation' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(JCO_CITATION))
    expect(screen.getByRole('status').textContent).toContain('Citation copied to clipboard.')
  })

  it('opens reference links using the desktop bridge', async () => {
    const openExternal = vi.fn(async (_url: string) => {})
    window.jco = { openExternal } as unknown as JcoAdapter

    render(<AboutJcoDialog open onClose={() => {}} />)
    fireEvent.click(screen.getByRole('link', { name: 'GitHub repository' }))
    await waitFor(() => expect(openExternal).toHaveBeenCalledWith('https://github.com/SQE-INRiM/JosephsonCircuitsOptimizer'))
  })
})
