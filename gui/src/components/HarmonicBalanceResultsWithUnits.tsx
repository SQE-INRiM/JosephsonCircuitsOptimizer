import { useMemo, useState } from 'react'
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material'
import type { ResultTable, ResultsBundle, SourceAmplitudeUnit } from '../types'
import { useAppStore } from '../store'
import { currentToDbm, DEFAULT_SOURCE_IMPEDANCE_OHM } from '../utils/sourceUnits'
import { HarmonicBalanceResultsNormalized } from './HarmonicBalanceResultsNormalized'

function sourceNumberFromAmplitudeColumn(column: string): number | null {
  const match = column.match(/^source_(\d+)_amplitude$/i)
  return match ? Number(match[1]) : null
}

export function convertHbAmplitudeTableForDisplay(
  table: ResultTable,
  unit: SourceAmplitudeUnit,
  impedancesOhm: Record<number, number>,
): ResultTable {
  if (unit === 'A') return table
  const amplitudeColumns = table.columns
    .map((column, index) => ({ column, index, sourceNumber: sourceNumberFromAmplitudeColumn(column) }))
    .filter((item): item is { column: string; index: number; sourceNumber: number } => item.sourceNumber !== null)

  if (!amplitudeColumns.length) return table

  const rows = table.rows.map((row) => {
    const converted = [...row]
    amplitudeColumns.forEach(({ index, sourceNumber }) => {
      const currentA = Number(row[index])
      if (!Number.isFinite(currentA)) return
      const impedance = impedancesOhm[sourceNumber] ?? DEFAULT_SOURCE_IMPEDANCE_OHM
      converted[index] = currentToDbm(currentA, impedance)
    })
    return converted
  })

  const filteredRows = table.filteredRows?.map((row) => {
    const converted = [...row]
    amplitudeColumns.forEach(({ index, sourceNumber }) => {
      const currentA = Number(row[index])
      if (!Number.isFinite(currentA)) return
      const impedance = impedancesOhm[sourceNumber] ?? DEFAULT_SOURCE_IMPEDANCE_OHM
      converted[index] = currentToDbm(currentA, impedance)
    })
    return converted
  })

  return { ...table, rows, filteredRows }
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

export function HarmonicBalanceResultsWithUnits({ results, activeRunId }: { results: ResultsBundle; activeRunId?: string | null }) {
  const sources = useAppStore((state) => state.project.sources)
  const preferredUnit = sources.some((source) => source.nonlinearAmplitudeUnit === 'dBm') ? 'dBm' : 'A'
  const [unit, setUnit] = useState<SourceAmplitudeUnit>(preferredUnit)

  const impedancesOhm = useMemo(() => Object.fromEntries(sources.map((source, index) => [index + 1, source.impedanceOhm ?? DEFAULT_SOURCE_IMPEDANCE_OHM])), [sources])
  const displayResults = useMemo<ResultsBundle>(() => ({
    ...results,
    runs: results.runs.map((run) => run.nonlinear
      ? {
          ...run,
          nonlinear: convertHbFrequencyTableForDisplay(
            convertHbAmplitudeTableForDisplay(run.nonlinear, unit, impedancesOhm),
          ),
        }
      : run),
  }), [results, unit, impedancesOhm])

  const unitControl = <FormControl size="small" sx={{ minWidth: 92 }}>
    <InputLabel>Unit</InputLabel>
    <Select label="Unit" value={unit} onChange={(event) => setUnit(event.target.value as SourceAmplitudeUnit)}>
      <MenuItem value="A">A</MenuItem>
      <MenuItem value="dBm">dBm</MenuItem>
    </Select>
  </FormControl>

  return <HarmonicBalanceResultsNormalized results={displayResults} activeRunId={activeRunId} unitControl={unitControl} amplitudeUnit={unit} />
}
