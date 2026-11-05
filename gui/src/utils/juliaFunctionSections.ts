/**
 * Lossless editor projection for a named Julia function embedded in the shared
 * user_cost_and_performance.jl file.
 *
 * This is deliberately not a general Julia parser. Only a uniquely identified
 * long-form function with balanced blocks can be isolated. Unsupported syntax
 * must fall back to the full-file editor rather than risk changing user code.
 */
export type MetricFunctionName = 'user_cost' | 'user_performance' | 'user_nonlinear_correction'

export type FunctionSlice =
  | { kind: 'found'; start: number; end: number; text: string }
  | { kind: 'missing' }
  | { kind: 'unsupported' }

const BLOCK_OPENERS = new Set([
  'function', 'if', 'for', 'while', 'begin', 'let', 'try', 'struct',
  'module', 'baremodule', 'macro', 'quote', 'do',
])

// Blank comments, Julia strings, characters and command literals in place,
// preserving all offsets and line breaks so code spans remain exact.
function maskJuliaTrivia(source: string): string {
  // Use UTF-16 code units, matching String.slice and RegExp indices even with emoji.
  const chars = source.split('')
  const blank = (index: number) => {
    if (chars[index] !== '\n' && chars[index] !== '\r') chars[index] = ' '
  }
  let i = 0
  while (i < source.length) {
    if (source.startsWith('#=', i)) {
      let depth = 1
      blank(i++)
      blank(i++)
      while (i < source.length && depth > 0) {
        if (source.startsWith('#=', i)) { depth++; blank(i++); blank(i++); continue }
        if (source.startsWith('=#', i)) { depth--; blank(i++); blank(i++); continue }
        blank(i++)
      }
      continue
    }
    if (source[i] === '#') {
      while (i < source.length && source[i] !== '\n') blank(i++)
      continue
    }
    if (source[i] === '"' || source[i] === '`' || source[i] === "'") {
      const delimiter = source.startsWith('"""', i) ? '"""' : source[i]
      // A bare apostrophe is normally the Julia transpose operator, not a char.
      if (delimiter === "'" && !/^'(?:\\\\.|[^'\\\\\\n])'/.test(source.slice(i))) {
        i++ // Transpose / adjoint operator, not a character literal.
        continue
      }
      for (let j = 0; j < delimiter.length; j++) blank(i++)
      while (i < source.length) {
        if (source[i] === '\\') { blank(i++); if (i < source.length) blank(i++); continue }
        if (source.startsWith(delimiter, i)) {
          for (let j = 0; j < delimiter.length; j++) blank(i++)
          break
        }
        blank(i++)
      }
      continue
    }
    i++
  }
  return chars.join('')
}

export function isolateMetricFunction(source: string, name: MetricFunctionName): FunctionSlice {
  const masked = maskJuliaTrivia(source)
  const declaration = new RegExp('^[ \\t]*function[ \\t]+' + name + '[ \\t]*\\(', 'gm')
  const matches = [...masked.matchAll(declaration)]
  if (matches.length === 0) {
    // A short-form definition, macro-wrapped function, or callsite that cannot
    // be reliably isolated must never be treated as a missing definition.
    return new RegExp('\\b' + name + '[ \\t]*\\(').test(masked)
      ? { kind: 'unsupported' } : { kind: 'missing' }
  }
  if (matches.length !== 1) return { kind: 'unsupported' }
  const start = matches[0].index
  const tokenPattern = /[A-Za-z_]\w*|[()[\]{}]/g
  tokenPattern.lastIndex = start
  let blocks = 0
  let brackets = 0
  let token: RegExpExecArray | null
  while ((token = tokenPattern.exec(masked))) {
    const word = token[0]
    if (word === '(' || word === '[' || word === '{') { brackets++; continue }
    if (word === ')' || word === ']' || word === '}') {
      if (brackets <= 0) return { kind: 'unsupported' }
      brackets--
      continue
    }
    if (brackets > 0) continue
    const before = masked.slice(0, token.index).trimEnd()
    // Indexing/symbol/property `end` is not a block terminator.
    if (before.endsWith('.') || before.endsWith(':')) continue
    if (BLOCK_OPENERS.has(word)) blocks++
    else if (word === 'end') {
      blocks--
      if (blocks === 0) {
        const end = token.index + word.length
        return { kind: 'found', start, end, text: source.slice(start, end) }
      }
      if (blocks < 0) return { kind: 'unsupported' }
    }
  }
  return { kind: 'unsupported' }
}

export function replaceMetricFunction(
  source: string, name: MetricFunctionName, editedText: string,
): { code: string } | { error: string } {
  const draft = isolateMetricFunction(editedText, name)
  if (draft.kind !== 'found' || draft.start !== 0 || draft.end !== editedText.trimEnd().length) {
    return { error: 'Keep one complete function, from its definition through the matching end.' }
  }
  const current = isolateMetricFunction(source, name)
  if (current.kind === 'unsupported') {
    return { error: 'This Julia definition cannot be isolated safely. Edit the complete file instead.' }
  }
  if (current.kind === 'missing') {
    const separator = source === '' ? '' : source.endsWith('\n\n') ? '' : source.endsWith('\n') ? '\n' : '\n\n'
    return { code: source + separator + editedText }
  }
  return { code: source.slice(0, current.start) + editedText + source.slice(current.end) }
}

export function defaultMetricFunction(name: MetricFunctionName): string {
  switch (name) {
    case 'user_cost':
      return 'function user_cost(sol, device_params_set, nonlinear_correction)\n    return (metric = 0.0,)\nend'
    case 'user_performance':
      return 'function user_performance(sol, device_params_set, source_amps, source_freqs)\n    return (performance = 0.0,)\nend'
    case 'user_nonlinear_correction':
      return 'function user_nonlinear_correction(sol_linear, sol_nonlinear, device_params_set)\n    return 0.0\nend'
  }
}
