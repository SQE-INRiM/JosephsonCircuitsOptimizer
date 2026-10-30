/** Four spaces are stored in the Julia source (not a visual tab stop). */
const INDENT = '    '

export type IndentEdit = {
  text: string
  selectionStart: number
  selectionEnd: number
}

/**
 * Indent/outdent the selected lines, or insert spaces at a single caret.
 * Range edits retain a line-wise selection so a second Tab/Shift+Tab can
 * operate on the same block without the user selecting it again.
 */
export function editJuliaIndent(
  source: string,
  selectionStart: number,
  selectionEnd: number,
  outdent = false,
): IndentEdit {
  const start = Math.min(selectionStart, selectionEnd)
  const end = Math.max(selectionStart, selectionEnd)

  if (!outdent && start === end) {
    return {
      text: source.slice(0, start) + INDENT + source.slice(end),
      selectionStart: start + INDENT.length,
      selectionEnd: start + INDENT.length,
    }
  }

  const blockStart = source.lastIndexOf('\n', start - 1) + 1
  // A range ending immediately after a newline does not include the next line.
  const lastSelected = end > start && source[end - 1] === '\n' ? end - 1 : end
  const followingNewline = source.indexOf('\n', lastSelected)
  const blockEnd = followingNewline < 0 ? source.length : followingNewline
  const block = source.slice(blockStart, blockEnd)
  const lines = block.split('\n')
  const changed = lines.map((line) => {
    if (!outdent) return line.length === 0 ? line : INDENT + line
    // Remove at most one indentation level, including legacy hard tabs.
    return line.replace(/^(?: {1,4}|\t)/, '')
  })
  const newBlock = changed.join('\n')
  const result = source.slice(0, blockStart) + newBlock + source.slice(blockEnd)

  if (start === end) {
    // Shift+Tab on a single line preserves the caret relative to its text.
    const removed = block.length - newBlock.length
    const position = Math.max(blockStart, start - removed)
    return { text: result, selectionStart: position, selectionEnd: position }
  }
  return {
    text: result,
    selectionStart: blockStart,
    selectionEnd: blockStart + newBlock.length,
  }
}
