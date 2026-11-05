import { describe, expect, it } from 'vitest'
import { preferredResultAxes } from './ResultAxesContext'

describe('shared Results axes', () => {
  const available = ['I0', 'Cg', 'Ladd']
  const defaults = { x: 'I0', y: 'Cg' }

  it('inherits a valid pair selected in Linear without swapping order', () => {
    expect(preferredResultAxes(available, defaults, { x: 'Cg', y: 'I0' }))
      .toEqual({ x: 'Cg', y: 'I0' })
  })

  it('falls back to available coordinates for an incompatible dataset', () => {
    expect(preferredResultAxes(['I0', 'Cg'], defaults, { x: 'unknown', y: 'I0' }))
      .toEqual({ x: 'I0', y: 'Cg' })
  })

  it('never uses the same axis twice', () => {
    expect(preferredResultAxes(available, defaults, { x: 'Cg', y: 'Cg' }))
      .toEqual({ x: 'Cg', y: 'I0' })
  })
})
