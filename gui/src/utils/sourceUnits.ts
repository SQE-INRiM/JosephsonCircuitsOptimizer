import type { SourceAmplitudeUnit, SourceValueSpec } from '../types'

export const DEFAULT_SOURCE_IMPEDANCE_OHM = 50

export function dBmToCurrent(powerDbm: number, impedanceOhm = DEFAULT_SOURCE_IMPEDANCE_OHM) {
  if (!(impedanceOhm > 0)) throw new Error('Source impedance must be positive.')
  if (powerDbm === Number.NEGATIVE_INFINITY) return 0
  const powerW = 1e-3 * 10 ** (powerDbm / 10)
  return Math.sqrt(powerW / (2 * impedanceOhm))
}

export function currentToDbm(currentA: number, impedanceOhm = DEFAULT_SOURCE_IMPEDANCE_OHM) {
  if (!(impedanceOhm > 0)) throw new Error('Source impedance must be positive.')
  if (currentA === 0) return Number.NEGATIVE_INFINITY
  const powerW = 2 * Math.abs(currentA) ** 2 * impedanceOhm
  return 10 * Math.log10(powerW / 1e-3)
}

function parseDisplayNumber(value: string | undefined) {
  const text = String(value ?? '').trim()
  if (/^-inf(?:inity)?$/i.test(text)) return Number.NEGATIVE_INFINITY
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

function formatDisplayNumber(value: number) {
  if (value === Number.NEGATIVE_INFINITY) return '-Inf'
  if (value === 0) return '0'
  return Number(value.toPrecision(10)).toString()
}

function rangeValues(spec: SourceValueSpec) {
  const start = parseDisplayNumber(spec.start)
  const stop = parseDisplayNumber(spec.stop)
  const step = parseDisplayNumber(spec.step)
  if (start === null || stop === null || step === null || !Number.isFinite(start) || !Number.isFinite(stop) || !Number.isFinite(step) || step === 0) return null
  if ((stop - start) * step < 0) return null
  const count = Math.floor((stop - start) / step + 1e-10) + 1
  if (count < 1 || count > 100000) return null
  return Array.from({ length: count }, (_, index) => start + index * step)
}

function listValues(text: string | undefined) {
  const trimmed = String(text ?? '').trim()
  if (!trimmed) return []
  const parts = trimmed.startsWith('[') && trimmed.endsWith(']')
    ? trimmed.slice(1, -1).split(',')
    : trimmed.split(',')
  const values = parts.map((part) => parseDisplayNumber(part.trim()))
  return values.every((value) => value !== null) ? values as number[] : null
}

export function convertSourceValueSpec(
  spec: SourceValueSpec,
  fromUnit: SourceAmplitudeUnit,
  toUnit: SourceAmplitudeUnit,
  impedanceOhm = DEFAULT_SOURCE_IMPEDANCE_OHM,
): SourceValueSpec {
  if (fromUnit === toUnit) return spec
  const convert = fromUnit === 'A'
    ? (value: number) => currentToDbm(value, impedanceOhm)
    : (value: number) => dBmToCurrent(value, impedanceOhm)

  if (spec.mode === 'Fixed') {
    const value = parseDisplayNumber(spec.value)
    return value === null ? spec : { ...spec, value: formatDisplayNumber(convert(value)) }
  }

  if (spec.mode === 'List') {
    const values = listValues(spec.values)
    return values === null ? spec : { ...spec, values: values.map((value) => formatDisplayNumber(convert(value))).join(', ') }
  }

  const values = rangeValues(spec)
  if (values === null) return spec
  return {
    mode: 'List',
    values: values.map((value) => formatDisplayNumber(convert(value))).join(', '),
  }
}
