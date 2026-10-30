export type JuliaTokenKind = 'plain' | 'keyword' | 'literal' | 'comment' | 'string' | 'number' | 'macro' | 'function'
export type JuliaToken = { kind: JuliaTokenKind; text: string }

const KEYWORDS = new Set([
  'abstract', 'baremodule', 'begin', 'break', 'catch', 'const', 'continue',
  'do', 'else', 'elseif', 'end', 'export', 'finally', 'for', 'function',
  'global', 'if', 'import', 'in', 'isa', 'let', 'local', 'macro', 'module',
  'mutable', 'primitive', 'quote', 'return', 'struct', 'try', 'type',
  'using', 'where', 'while',
])
const LITERALS = new Set(['true', 'false', 'nothing', 'missing', 'Inf', 'NaN', 'undef'])

const IDENTIFIER = /[\p{L}_][\p{L}\p{N}_!?]*/uy
const MACRO = /@[\p{L}_][\p{L}\p{N}_!?]*/uy
const NUMBER = /(?:0x[0-9a-fA-F_]+|0b[01_]+|0o[0-7_]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eEfF][+-]?\d+)?)/y
const FUNCTION_CALL = /[ \t]*\(/y

function quotedEnd(source: string, start: number, delimiter: string): number {
  let pos = start + delimiter.length
  while (pos < source.length) {
    if (source[pos] === '\\') {
      pos += 2
    } else if (source.startsWith(delimiter, pos)) {
      return pos + delimiter.length
    } else {
      pos++
    }
  }
  return source.length
}

function isFunctionCall(source: string, position: number): boolean {
  FUNCTION_CALL.lastIndex = position
  return FUNCTION_CALL.test(source)
}

/**
 * A visual-only Julia lexer. The original string is never modified and remains
 * the source of truth in the editable textarea and .jco project.
 * This intentionally does not attempt to validate or parse Julia expressions.
 */
export function highlightJulia(source: string): JuliaToken[] {
  const tokens: JuliaToken[] = []
  const push = (kind: JuliaTokenKind, text: string) => {
    if (!text) return
    const last = tokens[tokens.length - 1]
    if (last?.kind === kind) last.text += text
    else tokens.push({ kind, text })
  }

  let pos = 0
  while (pos < source.length) {
    const start = pos
    if (source.startsWith('#=', pos)) {
      // Julia permits nested block comments.
      let depth = 1
      pos += 2
      while (pos < source.length && depth > 0) {
        if (source.startsWith('#=', pos)) { depth++; pos += 2 }
        else if (source.startsWith('=#', pos)) { depth--; pos += 2 }
        else pos++
      }
      push('comment', source.slice(start, pos))
      continue
    }
    if (source[pos] === '#') {
      const end = source.indexOf('\n', pos)
      pos = end < 0 ? source.length : end
      push('comment', source.slice(start, pos))
      continue
    }
    if (source.startsWith('"""', pos) || source[pos] === '"' || source[pos] === '\x60') {
      const delimiter = source.startsWith('"""', pos) ? '"""' : source[pos]
      pos = quotedEnd(source, pos, delimiter)
      push('string', source.slice(start, pos))
      continue
    }

    MACRO.lastIndex = pos
    const macro = MACRO.exec(source)
    if (macro) {
      pos = MACRO.lastIndex
      push('macro', macro[0])
      continue
    }

    IDENTIFIER.lastIndex = pos
    const identifier = IDENTIFIER.exec(source)
    if (identifier) {
      pos = IDENTIFIER.lastIndex
      const name = identifier[0]
      const kind: JuliaTokenKind = KEYWORDS.has(name) ? 'keyword'
        : LITERALS.has(name) ? 'literal'
        : isFunctionCall(source, pos) ? 'function'
        : 'plain'
      push(kind, name)
      continue
    }

    NUMBER.lastIndex = pos
    const number = NUMBER.exec(source)
    if (number) {
      pos = NUMBER.lastIndex
      push('number', number[0])
      continue
    }
    pos++
    push('plain', source.slice(start, pos))
  }
  return tokens
}
