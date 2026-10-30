import { describe, expect, it } from 'vitest'
import { highlightJulia } from './juliaHighlight'

describe('Julia code highlighting', () => {
  it('distinguishes keywords, macros, function calls, numbers, comments and strings', () => {
    const code = [
      'function create_user_circuit(device_params_set)',
      '  φ = 1.2e-6 # device parameter',
      '  @show φ',
      '  println("the # inside this string is not a comment")',
      '  return nothing',
      'end',
    ].join('\n')
    const tokens = highlightJulia(code)
    expect(tokens.map((token) => token.text).join('')).toBe(code)
    expect(tokens.some((token) => token.kind === 'keyword' && token.text === 'function')).toBe(true)
    expect(tokens.some((token) => token.kind === 'macro' && token.text === '@show')).toBe(true)
    expect(tokens.some((token) => token.kind === 'number' && token.text === '1.2e-6')).toBe(true)
    expect(tokens.some((token) => token.kind === 'comment' && token.text === '# device parameter')).toBe(true)
    expect(tokens.some((token) => token.kind === 'string' && token.text.includes('# inside this string'))).toBe(true)
    expect(tokens.some((token) => token.kind === 'function' && token.text === 'println')).toBe(true)
    expect(tokens.some((token) => token.kind === 'literal' && token.text === 'nothing')).toBe(true)
  })

  it('preserves nested multi-line comments and escaped text exactly', () => {
    const code = 'x = #= outer \n #= inner =# still outer =# 0xAF\ns = "escaped \\"quote\\""'
    const tokens = highlightJulia(code)
    expect(tokens.map((token) => token.text).join('')).toBe(code)
    expect(tokens.filter((token) => token.kind === 'comment')).toHaveLength(1)
    expect(tokens.find((token) => token.kind === 'comment')?.text).toContain('still outer =#')
    expect(tokens.some((token) => token.kind === 'number' && token.text === '0xAF')).toBe(true)
  })

  it('preserves blank lines, whitespace, Julia Unicode and unfinished literals', () => {
    const code = '\n  λ² = """unfinished\n\n'
    const tokens = highlightJulia(code)
    expect(tokens.map((token) => token.text).join('')).toBe(code)
    expect(tokens.some((token) => token.kind === 'string' && token.text === '"""unfinished\n\n')).toBe(true)
    expect(highlightJulia('')).toEqual([])
  })
})
