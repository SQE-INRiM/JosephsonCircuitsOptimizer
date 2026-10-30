import { useLayoutEffect, useMemo, useRef } from 'react'
import { highlightJulia } from '../utils/juliaHighlight'
import { editJuliaIndent } from '../utils/juliaIndent'

type JuliaCodeEditorProps = {
  value: string
  onChange: (value: string) => void
  label: string
}

/**
 * Syntax-colored mirror behind a native, controlled textarea.
 * Selection, keyboard input, IME composition, undo and clipboard remain native;
 * only the mirror has colored tokens, and it never edits the source.
 */
export function JuliaCodeEditor({ value, onChange, label }: JuliaCodeEditorProps) {
  const highlightRef = useRef<HTMLPreElement>(null)
  const gutterRef = useRef<HTMLPreElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const pendingSelection = useRef<{ start: number; end: number } | null>(null)
  const tokens = useMemo(() => highlightJulia(value), [value])
  const lineNumbers = useMemo(
    () => Array.from({ length: value.split('\n').length }, (_, index) => String(index + 1)).join('\n'),
    [value],
  )

  useLayoutEffect(() => {
    if (!pendingSelection.current || !inputRef.current) return
    const { start, end } = pendingSelection.current
    inputRef.current.setSelectionRange(start, end)
    pendingSelection.current = null
  }, [value])

  const syncScroll = (textarea: HTMLTextAreaElement) => {
    if (highlightRef.current) {
      highlightRef.current.scrollTop = textarea.scrollTop
      highlightRef.current.scrollLeft = textarea.scrollLeft
    }
    if (gutterRef.current) gutterRef.current.scrollTop = textarea.scrollTop
  }

  return (
    <div className="jco-julia-editor">
      <pre ref={highlightRef} className="jco-julia-highlight" aria-hidden="true">
        {tokens.map((token, index) => (
          <span key={index} className={'jco-julia-' + token.kind}>{token.text}</span>
        ))}
      </pre>
      <pre ref={gutterRef} className="jco-julia-gutter" aria-hidden="true">{lineNumbers}</pre>
      <textarea
        ref={inputRef}
        aria-label={label}
        className="jco-julia-input"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return
          event.preventDefault()
          const input = event.currentTarget
          const edit = editJuliaIndent(value, input.selectionStart, input.selectionEnd, event.shiftKey)
          if (edit.text === value) return
          pendingSelection.current = { start: edit.selectionStart, end: edit.selectionEnd }
          onChange(edit.text)
        }}
        onScroll={(event) => syncScroll(event.currentTarget)}
        wrap="off"
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
      />
    </div>
  )
}
