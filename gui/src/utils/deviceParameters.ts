import type { ParameterSpec } from '../types'

const conventionalParameterSets = ['device_params_set', 'device_parameters_set']

function circuitParameterSetNames(code: string): string[] {
  const names = [...conventionalParameterSets]
  const signature = code.match(/(?:function\s+)?create_user_circuit\s*\(\s*([A-Za-z_]\w*)/)
  if (signature?.[1] && !names.includes(signature[1])) names.unshift(signature[1])
  return names
}

export function extractDeviceParameterNames(code: string): string[] {
  const executableCode = code.replace(/#=[\s\S]*?=#/g, '').replace(/#.*$/gm, '')
  const names: string[] = []
  const seen = new Set<string>()
  const parameterSets = circuitParameterSetNames(executableCode).join('|')
  const pattern = new RegExp(`\\b(?:${parameterSets})\\s*\\[\\s*:([A-Za-z_]\\w*)\\s*\\]`, 'g')
  for (const match of executableCode.matchAll(pattern)) {
    const name = match[1]
    if (!seen.has(name)) {
      seen.add(name)
      names.push(name)
    }
  }
  return names
}

function emptyParameter(name: string): ParameterSpec {
  return {
    id: `circuit-${name}`,
    name,
    mode: 'Fixed',
    value: '',
    unit: '—',
    role: 'Fixed model',
    circuitStatus: 'missing',
  }
}

export function nextManualParameter(parameters: ParameterSpec[]): ParameterSpec {
  const existing = new Set(parameters.map((parameter) => parameter.name))
  let suffix = 1
  while (existing.has(`parameter_${suffix}`)) suffix += 1
  const name = `parameter_${suffix}`
  return {
    id: `manual-${name}-${Date.now()}`,
    name,
    mode: 'Fixed',
    value: '',
    unit: '—',
    role: 'Fixed model',
    circuitStatus: 'unused',
  }
}

export function reconcileDeviceParameters(code: string, parameters: ParameterSpec[], keepUnreferenced = true): ParameterSpec[] {
  const referenced = extractDeviceParameterNames(code)
  const byName = new Map(parameters.map((parameter) => [parameter.name, parameter]))
  const reconciled: ParameterSpec[] = referenced.map((name) => {
    const existing = byName.get(name)
    if (!existing) return emptyParameter(name)
    const hasValue = existing.mode === 'Fixed'
      ? Boolean(existing.value?.trim())
      : existing.mode === 'List'
        ? Boolean(existing.values?.trim())
        : Boolean(existing.start?.trim() && existing.stop?.trim() && existing.step?.trim())
    return {
      ...existing,
      id: existing.id || `circuit-${name}`,
      role: existing.mode === 'Fixed' ? 'Fixed model' : 'Design',
      circuitStatus: hasValue ? 'configured' : 'missing',
    }
  })

  for (const parameter of parameters) {
    if (referenced.includes(parameter.name)) continue
    if (!keepUnreferenced && !parameter.id.startsWith('manual-')) continue
    reconciled.push({
      ...parameter,
      role: parameter.mode === 'Fixed' ? 'Fixed model' : 'Design',
      circuitStatus: 'unused',
    })
  }
  return reconciled
}
