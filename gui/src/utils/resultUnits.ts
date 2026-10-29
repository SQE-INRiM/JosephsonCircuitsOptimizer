import type { ParameterSpec, SourceAmplitudeUnits } from '../types'

export function parameterUnit(parameters: ParameterSpec[], name: string): string {
  const unit = parameters.find((parameter) => parameter.name === name)?.unit?.trim()
  return unit && unit !== '—' ? unit : ''
}

export function parameterLabel(parameters: ParameterSpec[], name: string): string {
  const unit = parameterUnit(parameters, name)
  return unit ? `${name} / ${unit}` : name
}

export function sourceCoordinateUnit(column: string, amplitudeUnit: SourceAmplitudeUnits): string {
  // Source frequencies are converted from stored Hz to displayed GHz in Results.
  // Heatmap tick labels use two decimal places (for example, 7.00 GHz).
  if (/^source_\d+_frequency$/i.test(column)) return 'GHz'
  const source = column.match(/^source_(\d+)_amplitude$/i)
  if (source) return typeof amplitudeUnit === 'string' ? amplitudeUnit : amplitudeUnit[Number(source[1])] ?? 'dBm'
  return ''
}

export function sourceCoordinateLabel(column: string, amplitudeUnit: SourceAmplitudeUnits): string {
  const unit = sourceCoordinateUnit(column, amplitudeUnit)
  return unit ? `${column} / ${unit}` : column
}
