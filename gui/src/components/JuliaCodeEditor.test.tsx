// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { JuliaCodeEditor } from './JuliaCodeEditor'

afterEach(() => cleanup())

describe('JuliaCodeEditor', () => {
  it('preserves the exact source and sends edits through the existing change callback', () => {
    const source = 'function f(x)\n\t# comment\n\treturn x * 2\nend'
    const onChange = vi.fn()
    const { container } = render(<JuliaCodeEditor value={source} onChange={onChange} label="user_circuit.jl" />)
    const editor = screen.getByRole('textbox', { name: 'user_circuit.jl' }) as HTMLTextAreaElement
    expect(editor.value).toBe(source)
    expect(editor.spellcheck).not.toBe(true)
    expect(container.querySelector('.jco-julia-highlight')?.textContent).toBe(source)
    expect(container.querySelector('.jco-julia-gutter')?.textContent).toBe('1\n2\n3\n4')
    expect(container.querySelector('.jco-julia-keyword')?.textContent).toBe('function')

    const updated = source + '\n# added by the user'
    fireEvent.change(editor, { target: { value: updated } })
    expect(onChange).toHaveBeenCalledWith(updated)
  })

  it('keeps the code and line-number mirrors aligned with textarea scrolling', () => {
    const { container } = render(
      <JuliaCodeEditor value={'function f()\n' + '  return 1\n'.repeat(100) + 'end'} onChange={() => {}} label="Julia source" />,
    )
    const editor = screen.getByRole('textbox', { name: 'Julia source' }) as HTMLTextAreaElement
    editor.scrollTop = 74
    editor.scrollLeft = 19
    fireEvent.scroll(editor)
    expect((container.querySelector('.jco-julia-highlight') as HTMLPreElement).scrollTop).toBe(74)
    expect((container.querySelector('.jco-julia-highlight') as HTMLPreElement).scrollLeft).toBe(19)
    expect((container.querySelector('.jco-julia-gutter') as HTMLPreElement).scrollTop).toBe(74)
  })

  it('renders user code as text, never as HTML', () => {
    const source = '# <img src=x onerror=alert(1)>\nprintln("hello")'
    const { container } = render(<JuliaCodeEditor value={source} onChange={() => {}} label="Julia source" />)
    expect(container.querySelector('.jco-julia-highlight')?.textContent).toBe(source)
    expect(container.querySelector('.jco-julia-highlight img')).toBeNull()
  })
})
