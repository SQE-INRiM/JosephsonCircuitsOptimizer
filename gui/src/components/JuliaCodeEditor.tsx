import { useLayoutEffect, useMemo, useRef } from 'react'
import { highlightJulia } from '../utils/juliaHighlight'
import { editJuliaIndent } from '../utils/juliaIndent'

type JuliaCodeEditorProps = {
  value: string
  onChange: (value: string) => void
  label: string
  /** Move the cursor to the selected function on editor opening. */
  focusFunction?: string
}

/**
 * Syntax-colored mirror behind a native, controlled textarea.
 * Selection, keyboard input, IME composition, undo and clipboard remain native;
 * only the mirror has colored tokens, and it never edits the source.
 */
export function JuliaCodeEditor({ value, onChange, label, focusFunction }: JuliaCodeEditorProps) {
  const highlightRef = useRef<HTMLPreElement>(null)
  const gutterRef = useRef<HTMLPreElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const pendingSelection = useRef<{ start: number; end: number } | null>(null)
  const tokens = useMemo(() => highlightJulia(value), [value])
  const lineNumbers = useMemo(
    () => Array.from({ length: value.split('\n').length }, (_, index) => String(index + 1)).join('\n'),
    [value],
  )

  // This editor always edits the entire shared Julia file. Navigate only on
  // opening/target change: editing text must never reset the user's selection.
  useLayoutEffect(() => {
    if (!focusFunction || !/^[A-Za-z_]\\w*$/.test(focusFunction) || !inputRef.current) return
    const match = new RegExp('^[ \\t]*function[ \\t]+' + focusFunction + '[ \\t]*\\(', 'm').exec(value)
    if (!match) return
    const editor = inputRef.current
    const lineStart = match.index
    const lineNumber = value.slice(0, lineStart).split('\\n').length - 1
    editor.focus()
    editor.setSelectionRange(lineStart, lineStart)
    editor.scrollTop = Math.max(0, lineNumber - 2) * 20
    syncScroll(editor)
  // Only re-run for a different function target, not on keystrokes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusFunction])

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
