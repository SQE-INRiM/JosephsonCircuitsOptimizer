// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HeatmapGrid } from './HeatmapGrid'

describe('HeatmapGrid A/B selection', () => {
  afterEach(() => cleanup())

  it('marks both selected cells and preserves the original numerical row indices on click', () => {
    const onCellClick = vi.fn()
    const { container } = render(<HeatmapGrid
      xLabels={[1, 2]} yLabels={[10, 20]}
      values={[[1, 2], [3, 4]]} valueLabel="metric"
      selectedCells={[{ rowIndex: 0, columnIndex: 0 }, { rowIndex: 1, columnIndex: 1 }]}
      onCellClick={onCellClick}
    />)
    expect(screen.getByText('A')).toBeTruthy()
    expect(screen.getByText('B')).toBeTruthy()

    // The Y axis is reversed for display, but events still use the data-row index.
    const cells = container.querySelectorAll('.heatmap-cell')
    fireEvent.click(cells[0])
    expect(onCellClick).toHaveBeenCalledWith(1, 0, 3)
    fireEvent.click(cells[3])
    expect(onCellClick).toHaveBeenCalledWith(0, 1, 2)
  })

  it('keeps masked cells unselectable', () => {
    const onCellClick = vi.fn()
    const { container } = render(<HeatmapGrid
      xLabels={[1, 2]} yLabels={[10, 20]}
      values={[[null, 2], [3, 4]]} valueLabel="metric" onCellClick={onCellClick}
    />)
    const cells = container.querySelectorAll('.heatmap-cell')
    fireEvent.click(cells[2])
    expect(onCellClick).not.toHaveBeenCalled()
  })
})
