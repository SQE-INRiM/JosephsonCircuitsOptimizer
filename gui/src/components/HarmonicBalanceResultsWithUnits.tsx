import { useMemo } from 'react'
import type { ResultTable, ResultsBundle, RunResults, SourceAmplitudeUnit, SourceAmplitudeUnits } from '../types'
import { currentToDbm, DEFAULT_SOURCE_IMPEDANCE_OHM } from '../utils/sourceUnits'
import { HarmonicBalanceResultsNormalized } from './HarmonicBalanceResultsNormalized'

function sourceNumberFromAmplitudeColumn(column: string): number | null {
  const match = column.match(/^source_(\d+)_amplitude$/i)
  return match ? Number(match[1]) : null
}

export function runAmplitudeDisplay(run: RunResults): {
  units: Record<number, SourceAmplitudeUnit>
  impedancesOhm: Record<number, number>
} {
  // Prefer immutable display preferences captured with the run. Historic runs
  // have no such snapshot: keep their legacy Results display in dBm (50 ohm).
  const saved = run.setupSnapshot?.sourceDisplay ?? {}
  const units: Record<number, SourceAmplitudeUnit> = {}
  const impedancesOhm: Record<number, number> = {}
  for (const [key, record] of Object.entries(saved)) {
    const match = key.match(/^source_(\d+)$/i)
    if (!match || !record || typeof record !== 'object') continue
    const number = Number(match[1])
    units[number] = record.nonlinearAmplitudeUnit === 'A' ? 'A' : 'dBm'
    const impedance = Number(record.impedanceOhm)
    impedancesOhm[number] = Number.isFinite(impedance) && impedance > 0
      ? impedance : DEFAULT_SOURCE_IMPEDANCE_OHM
  }
  return { units, impedancesOhm }
}

export function convertHbAmplitudeTableForDisplay(
  table: ResultTable,
  unit: SourceAmplitudeUnits,
  impedancesOhm: Record<number, number>,
): ResultTable {
  if (unit === 'A') return table
  const amplitudeColumns = table.columns
    .map((column, index) => ({ index, sourceNumber: sourceNumberFromAmplitudeColumn(column) }))
    .filter((item): item is { index: number; sourceNumber: number } => item.sourceNumber !== null)
    .filter(({ sourceNumber }) => (typeof unit === 'string' ? unit : unit[sourceNumber] ?? 'dBm') === 'dBm')

  if (!amplitudeColumns.length) return table

  const convertRow = (row: Array<number | string>) => {
    const converted = [...row]
    amplitudeColumns.forEach(({ index, sourceNumber }) => {
      const currentA = Number(row[index])
      if (!Number.isFinite(currentA)) return
      const impedance = impedancesOhm[sourceNumber] ?? DEFAULT_SOURCE_IMPEDANCE_OHM
      converted[index] = currentToDbm(currentA, impedance)
    })
    return converted
  }
  return {
    ...table,
    rows: table.rows.map(convertRow),
    filteredRows: table.filteredRows?.map(convertRow),
  }
}

export function convertHbFrequencyTableForDisplay(table: ResultTable): ResultTable {
  const frequencyIndices = table.columns
    .map((column, index) => /^source_\d+_frequency$/i.test(column) ? index : -1)
    .filter((index) => index >= 0)
  if (!frequencyIndices.length) return table
  const convertRow = (row: Array<number | string>) => {
    const converted = [...row]
    frequencyIndices.forEach((index) => {
      const frequencyHz = Number(row[index])
      if (Number.isFinite(frequencyHz)) converted[index] = frequencyHz / 1e9
    })
    return converted
  }
  return {
    ...table,
    rows: table.rows.map(convertRow),
    filteredRows: table.filteredRows?.map(convertRow),
  }
}

export function HarmonicBalanceResultsWithUnits({ results, activeRunId }: {
  results: ResultsBundle
  activeRunId?: string | null
}) {
  const unitByRun = useMemo(() => Object.fromEntries(
    results.runs.map((run) => [run.id, runAmplitudeDisplay(run).units]),
  ), [results])
  const displayResults = useMemo<ResultsBundle>(() => ({
    ...results,
    runs: results.runs.map((run) => {
      if (!run.nonlinear) return run
      const display = runAmplitudeDisplay(run)
      return {
        ...run,
        nonlinear: convertHbFrequencyTableForDisplay(
          convertHbAmplitudeTableForDisplay(run.nonlinear, display.units, display.impedancesOhm),
        ),
      }
    }),
  }), [results])

  return <HarmonicBalanceResultsNormalized
    results={displayResults} activeRunId={activeRunId} unitByRun={unitByRun}
  />
}
