import type { MetricSpec } from '../types'

function functionSection(code: string, name: string) {
  const start = new RegExp(`\\bfunction\\s+${name}\\s*\\(`).exec(code)
  if (!start) return null
  const rest = code.slice(start.index + start[0].length)
  const nextFunction = /\n\s*function\s+[A-Za-z_]\w*\s*\(/.exec(rest)
  return rest.slice(0, nextFunction?.index ?? rest.length)
}

function namedTupleFields(section: string) {
  const returns = [...section.matchAll(/\breturn\b/g)]
  for (const match of returns.reverse()) {
    let cursor = (match.index ?? 0) + match[0].length
    while (/\s/.test(section[cursor] ?? '')) cursor += 1
    if (section[cursor] !== '(') continue

    let depth = 0
    let quote = ''
    let escaped = false
    let end = -1
    for (let index = cursor; index < section.length; index += 1) {
      const char = section[index]
      if (quote) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === quote) quote = ''
        continue
      }
      if (char === '"' || char === "'") { quote = char; continue }
      if (char === '(') depth += 1
      else if (char === ')' && --depth === 0) { end = index; break }
    }
    if (end < 0) continue

    const content = section.slice(cursor + 1, end)
    const fields: string[] = []
    let itemStart = 0
    depth = 0
    quote = ''
    escaped = false
    for (let index = 0; index <= content.length; index += 1) {
      const char = content[index] ?? ','
      if (quote) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === quote) quote = ''
        continue
      }
      if (char === '"' || char === "'") { quote = char; continue }
      if ('([{'.includes(char)) depth += 1
      else if (')]}'.includes(char)) depth -= 1
      else if (char === ',' && depth === 0) {
        const field = content.slice(itemStart, index).trim().replace(/^;/, '').trim().match(/^([A-Za-z_]\w*)\s*=/)?.[1]
        if (field) fields.push(field)
        itemStart = index + 1
      }
    }
    if (fields.length) return fields
  }
  return []
}

export function metricsFromCode(code: string): MetricSpec[] {
  const executableCode = code.replace(/#=[\s\S]*?=#/g, '').replace(/#.*$/gm, '')
  const definitions = [
    { source: 'user_cost' as const, stage: 'Linear' as const, defaultName: 'metric', direction: 'Minimize' as const },
    { source: 'user_performance' as const, stage: 'Nonlinear' as const, defaultName: 'performance', direction: 'Maximize' as const },
  ]

  return definitions.flatMap((definition) => {
    const section = functionSection(executableCode, definition.source)
    if (section === null) return []
    const names = namedTupleFields(section)
    const returnedNames = names.length ? names : [definition.defaultName]
    return returnedNames.map((name, index) => ({
      id: `${definition.source}:${name}:${index}`,
      name,
      source: definition.source,
      stage: definition.stage,
      position: index + 1,
      purpose: index === 0 ? 'Objective' as const : 'Analysis' as const,
      direction: index === 0 ? definition.direction : '—' as const,
    }))
  })
}
