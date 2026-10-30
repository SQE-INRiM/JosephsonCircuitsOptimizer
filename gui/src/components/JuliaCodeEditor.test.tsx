// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
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


function ControlledEditor({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial)
  return <JuliaCodeEditor value={value} onChange={setValue} label="Editable Julia" />
}

describe('JuliaCodeEditor indentation keys', () => {
  it('inserts four real spaces on Tab and restores the caret after React rerenders', () => {
    render(<ControlledEditor initial="foo" />)
    const editor = screen.getByRole('textbox', { name: 'Editable Julia' }) as HTMLTextAreaElement
    editor.focus()
    editor.setSelectionRange(2, 2)
    fireEvent.keyDown(editor, { key: 'Tab', code: 'Tab' })
    expect(editor.value).toBe('fo    o')
    expect(editor.selectionStart).toBe(6)
    expect(editor.selectionEnd).toBe(6)
    expect(document.activeElement).toBe(editor)
  })

  it('indents selected Julia lines and reverses the indentation with Shift+Tab', () => {
    const { container } = render(<ControlledEditor initial={'one\ntwo'} />)
    const editor = screen.getByRole('textbox', { name: 'Editable Julia' }) as HTMLTextAreaElement
    editor.setSelectionRange(0, editor.value.length)
    fireEvent.keyDown(editor, { key: 'Tab', code: 'Tab' })
    expect(editor.value).toBe('    one\n    two')
    expect(editor.selectionStart).toBe(0)
    expect(editor.selectionEnd).toBe(editor.value.length)
    expect(container.querySelector('.jco-julia-highlight')?.textContent).toBe(editor.value)

    fireEvent.keyDown(editor, { key: 'Tab', code: 'Tab', shiftKey: true })
    expect(editor.value).toBe('one\ntwo')
    expect(editor.selectionStart).toBe(0)
    expect(editor.selectionEnd).toBe(editor.value.length)
  })
})
