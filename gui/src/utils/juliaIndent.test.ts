import { describe, expect, it } from 'vitest'
import { editJuliaIndent } from './juliaIndent'

describe('Julia code indentation', () => {
  it('inserts exactly four spaces at the caret without replacing surrounding code', () => {
    expect(editJuliaIndent('ab\ncd', 1, 1)).toEqual({
      text: 'a    b\ncd',
      selectionStart: 5,
      selectionEnd: 5,
    })
  })

  it('indents a multiline selection and outdents it again', () => {
    const original = 'alpha\nbeta\ngamma'
    const indented = editJuliaIndent(original, 0, 10)
    expect(indented).toEqual({
      text: '    alpha\n    beta\ngamma',
      selectionStart: 0,
      selectionEnd: 18,
    })
    const restored = editJuliaIndent(indented.text, indented.selectionStart, indented.selectionEnd, true)
    expect(restored.text).toBe(original)
  })

  it('does not indent a next line when selection ends immediately after a newline', () => {
    const changed = editJuliaIndent('one\ntwo', 0, 4)
    expect(changed.text).toBe('    one\ntwo')
  })

  it('outdents at the caret, respecting up to four spaces and legacy tabs', () => {
    expect(editJuliaIndent('    foo\nbar', 6, 6, true)).toEqual({
      text: 'foo\nbar',
      selectionStart: 2,
      selectionEnd: 2,
    })
    expect(editJuliaIndent('\tfoo', 3, 3, true).text).toBe('foo')
    expect(editJuliaIndent('  foo', 4, 4, true).text).toBe('foo')
    expect(editJuliaIndent('foo', 1, 1, true).text).toBe('foo')
  })

  it('preserves blank lines, symbols and nested Julia expressions', () => {
    const original = 'function f(φ)\n\n  return φ\nend'
    const changed = editJuliaIndent(original, 0, original.length)
    expect(changed.text).toBe('    function f(φ)\n\n    return φ\n    end')
    expect(editJuliaIndent(changed.text, 0, changed.text.length, true).text).toBe(original)
  })
})
