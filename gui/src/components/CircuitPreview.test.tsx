// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CircuitPreview } from './CircuitPreview'
import type { CircuitPreviewData } from '../services/jcoAdapter'

const preview: CircuitPreviewData = {
  schemaVersion: 'jco.circuit-preview/1',
  parameterPolicy: 'first_value',
  parameters: { Lj: 1e-9, Cc: 1e-13 },
  portCount: 1,
  nodes: ['0', '1', '2'],
  components: [
    { name: 'P1', kind: 'P', node1: '1', node2: '0', valueExpression: '1', resolvedValue: 1 },
    { name: 'R1', kind: 'R', node1: '1', node2: '0', valueExpression: 'R', resolvedValue: 50 },
    { name: 'C1', kind: 'C', node1: '1', node2: '2', valueExpression: 'Cc', resolvedValue: 1e-13 },
    { name: 'Lj1', kind: 'Lj', node1: '2', node2: '0', valueExpression: 'Lj', resolvedValue: 1e-9 },
  ],
}

const longChain: CircuitPreviewData = {
  schemaVersion: 'jco.circuit-preview/1',
  parameterPolicy: 'first_value',
  parameters: {},
  portCount: 2,
  nodes: ['0', ...Array.from({ length: 21 }, (_, index) => String(index + 1))],
  components: [
    { name: 'P1', kind: 'P', node1: '1', node2: '0', valueExpression: '1', resolvedValue: 1 },
    ...Array.from({ length: 20 }, (_, index) => ({
      name: `L${index + 1}`,
      kind: 'L' as const,
      node1: String(index + 1),
      node2: String(index + 2),
      valueExpression: 'L',
      resolvedValue: 1e-9,
    })),
    { name: 'P2', kind: 'P', node1: '21', node2: '0', valueExpression: '2', resolvedValue: 2 },
  ],
}

const twoLongLines: CircuitPreviewData = {
  schemaVersion: 'jco.circuit-preview/1',
  parameterPolicy: 'first_value',
  parameters: {},
  portCount: 4,
  nodes: [
    '0',
    ...Array.from({ length: 21 }, (_, index) => `A${index + 1}`),
    ...Array.from({ length: 21 }, (_, index) => `B${index + 1}`),
  ],
  components: [
    { name: 'P1', kind: 'P', node1: 'A1', node2: '0', valueExpression: '1', resolvedValue: 1 },
    ...Array.from({ length: 20 }, (_, index) => ({
      name: `LA${index + 1}`,
      kind: 'L' as const,
      node1: `A${index + 1}`,
      node2: `A${index + 2}`,
      valueExpression: 'L',
      resolvedValue: 1e-9,
    })),
    { name: 'P2', kind: 'P', node1: 'A21', node2: '0', valueExpression: '2', resolvedValue: 2 },
    { name: 'P3', kind: 'P', node1: 'B1', node2: '0', valueExpression: '3', resolvedValue: 3 },
    ...Array.from({ length: 20 }, (_, index) => ({
      name: `LB${index + 1}`,
      kind: 'L' as const,
      node1: `B${index + 1}`,
      node2: `B${index + 2}`,
      valueExpression: 'L',
      resolvedValue: 1e-9,
    })),
    { name: 'P4', kind: 'P', node1: 'B21', node2: '0', valueExpression: '4', resolvedValue: 4 },
    { name: 'K1', kind: 'K', node1: 'LA1', node2: 'LB1', valueExpression: 'k', resolvedValue: 0.99 },
  ],
}

afterEach(cleanup)

describe('CircuitPreview', () => {
  it('renders a resolved circuit and exposes component details', () => {
    render(<CircuitPreview data={preview} loading={false} error={null} stale={false} onGenerate={vi.fn()} />)

    expect(screen.getByText('Resolved circuit')).toBeTruthy()
    expect(screen.getByText('2 nodes')).toBeTruthy()
    expect(screen.getByText('4 components')).toBeTruthy()
    expect(screen.getByText('1 ports')).toBeTruthy()

    const junctionLabel = screen.getByText('Lj1')
    fireEvent.click(junctionLabel.closest('g')!)
    expect(screen.getByText('1 nH')).toBeTruthy()
  })

  it('condenses long chains after the first 15 cells and keeps the final cell and port', () => {
    render(<CircuitPreview data={longChain} loading={false} error={null} stale={false} onGenerate={vi.fn()} />)

    expect(screen.getByText('L15')).toBeTruthy()
    expect(screen.queryByText('L16')).toBeNull()
    expect(screen.getByText('L20')).toBeTruthy()
    expect(screen.getByText('P2')).toBeTruthy()
    expect(screen.getByText('…')).toBeTruthy()
  })

  it('keeps disconnected long lines separate and preserves all of their ports', () => {
    render(<CircuitPreview data={twoLongLines} loading={false} error={null} stale={false} onGenerate={vi.fn()} />)

    expect(screen.getByText('P1')).toBeTruthy()
    expect(screen.getByText('P2')).toBeTruthy()
    expect(screen.getByText('P3')).toBeTruthy()
    expect(screen.getByText('P4')).toBeTruthy()
    expect(screen.getAllByText('…')).toHaveLength(2)
    expect(screen.getByText('K1')).toBeTruthy()
  })

  it('does not execute anything until the user requests a preview', () => {
    const onGenerate = vi.fn()
    render(<CircuitPreview data={null} loading={false} error={null} stale={false} onGenerate={onGenerate} />)
    fireEvent.click(screen.getByRole('button', { name: 'Generate preview' }))
    expect(onGenerate).toHaveBeenCalledTimes(1)
  })
})
