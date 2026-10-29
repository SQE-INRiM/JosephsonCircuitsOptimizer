import { describe, expect, it } from 'vitest'
import { createJcoTheme } from './theme'

describe('JCO display palettes', () => {
  it('keeps the original light palette available', () => {
    const theme = createJcoTheme('light')
    expect(theme.palette.mode).toBe('light')
    expect(theme.palette.background.paper).toBe('#ffffff')
  })
  it('uses dark backgrounds and readable text in dark mode', () => {
    const theme = createJcoTheme('dark')
    expect(theme.palette.mode).toBe('dark')
    expect(theme.palette.background.default).toBe('#131d2a')
    expect(theme.palette.text.primary).not.toBe(createJcoTheme('light').palette.text.primary)
  })
})
