import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, Chip, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Typography } from '@mui/material'
import { LineChart } from '@mui/x-charts/LineChart'
import type { ResultTable, ResultsBundle, RunResults, SavedDataCatalog, SavedTraceData } from '../types'
import { getJcoAdapter } from '../services/jcoAdapter'
import { HeatmapGrid } from './HeatmapGrid'

type HbView = 'landscape' | 'response'
type ConvergenceFilter = 'all' | 'converged' | 'nonconverged'
type TraceComponent = 'values' | 'magnitude' | 'real' | 'imag' | 'phase'
type LoadedTrace = { key: string; trace: SavedTraceData; component: TraceComponent }
type CatalogItem = { key: string; quantityKey: string; quantityName: string; arrayName: string; length: number }

type NumericRow = number[]

type HbGrid = {
  x: number[]
  y: number[]
  values: Array<Array<number | null>>
  pointIds: Array<Array<number | null>>
}

function rowsAsNumbers(table: ResultTable): NumericRow[] { return table.rows.map((row) => row.map(Number)) }
function unique(values: number[]): number[] { return [...new Set(values.filter(Number.isFinite))].sort((a, b) => a - b) }
function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return ''
  const numeric = Number(value)
  if (numeric === 0) return '0'
  const absolute = Math.abs(numeric)
  if (absolute < 1e-3 || absolute >= 1e4) return numeric.toExponential(4)
  return Number(numeric.toPrecision(6)).toString()
}
function sourceCoordinateColumns(table: ResultTable): string[] { return table.columns.filter((column) => /^source_\d+_(frequency|amplitude)$/i.test(column)) }
function amplitudeColumns(table: ResultTable): string[] { return sourceCoordinateColumns(table).filter((column) => /_amplitude$/i.test(column)) }
function metricColumns(table: ResultTable): string[] {
  const coords = new Set(sourceCoordinateColumns(table))
  return table.columns.filter((column) => column !== 'point_id' && column !== 'converged' && !coords.has(column))
}
function columnValues(table: ResultTable, column: string): number[] {
  const index = table.columns.indexOf(column)
  return index < 0 ? [] : unique(rowsAsNumbers(table).map((row) => row[index]))
}
function rowMatchesFixed(table: ResultTable, row: NumericRow, fixed: Record<string, number>): boolean {
  return Object.entries(fixed).every(([column, value]) => row[table.columns.indexOf(column)] === value)
}
function convergenceMatches(table: ResultTable, row: NumericRow, filter: ConvergenceFilter): boolean {
  if (filter === 'all') return true
  const index = table.columns.indexOf('converged')
  if (index < 0) return filter === 'converged'
  return filter === 'converged' ? row[index] === 1 : row[index] !== 1
}

export function buildHbGrid(table: ResultTable, xName: string, yName: string, metricName: string, fixed: Record<string, number>, convergence: ConvergenceFilter): HbGrid {
  const xIndex = table.columns.indexOf(xName)
  const yIndex = table.columns.indexOf(yName)
  const metricIndex = table.columns.indexOf(metricName)
  const pointIndex = table.columns.indexOf('point_id')
  const rows = rowsAsNumbers(table).filter((row) => Number.isFinite(row[xIndex]) && Number.isFinite(row[yIndex]) && rowMatchesFixed(table, row, fixed) && convergenceMatches(table, row, convergence))
  const x = unique(rows.map((row) => row[xIndex]))
  const y = unique(rows.map((row) => row[yIndex]))
  const map = new Map(rows.map((row) => [`${row[xIndex]}|${row[yIndex]}`, row]))
  return {
    x,
    y,
    values: y.map((yv) => x.map((xv) => { const row = map.get(`${xv}|${yv}`); const value = row?.[metricIndex]; return value != null && Number.isFinite(value) ? value : null })),
    pointIds: y.map((yv) => x.map((xv) => { const row = map.get(`${xv}|${yv}`); const id = pointIndex >= 0 ? row?.[pointIndex] : null; return id != null && Number.isFinite(id) ? id : null })),
  }
}

export function customAxisCompatible(xLength: number, yLength: number): boolean { return xLength > 0 && xLength === yLength }

function traceValues(item: LoadedTrace): number[] {
  if (item.component === 'magnitude') return item.trace.magnitude ?? []
  if (item.component === 'real') return item.trace.real ?? []
  if (item.component === 'imag') return item.trace.imag ?? []
  if (item.component === 'phase') return item.trace.phaseRad ?? []
  return item.trace.values ?? []
}
function axisValues(trace: SavedTraceData): number[] { return trace.values ?? trace.magnitude ?? trace.real ?? [] }
function traceLabel(trace: Pick<SavedTraceData, 'quantityName' | 'arrayName'>): string { return trace.quantityName === trace.arrayName ? trace.quantityName : `${trace.quantityName} · ${trace.arrayName}` }

function HbPointInspector({ run, table, pointId, catalog }: { run: RunResults; table: ResultTable; pointId: number | null; catalog?: SavedDataCatalog | null }) {
  const pointIndex = table.columns.indexOf('point_id')
  const row = pointId == null ? undefined : table.rows.find((candidate) => Number(candidate[pointIndex]) === pointId)
  const savedPoint = pointId == null ? undefined : catalog?.points.find((point) => point.pointId === pointId)
  const [traces, setTraces] = useState<LoadedTrace[]>([])
  const [xChoice, setXChoice] = useState('auto')
  const [xTrace, setXTrace] = useState<SavedTraceData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState('')
  const catalogItems: CatalogItem[] = savedPoint?.quantities.flatMap((quantity) => quantity.arrays.map((array) => ({ key: `${quantity.name}/${array.name}`, quantityKey: quantity.name, quantityName: quantity.quantityName, arrayName: array.name, length: array.length }))) ?? []

  useEffect(() => { setTraces([]); setXChoice('auto'); setXTrace(null); setError(''); setLoading('') }, [run.id, pointId])
  if (!row || pointId == null) return <Alert severity="info">Select a Harmonic Balance point to inspect it.</Alert>

  const sourceCols = sourceCoordinateColumns(table)
  const metrics = metricColumns(table)
  const convergedIndex = table.columns.indexOf('converged')
  const read = async (item: CatalogItem) => {
    const adapter = getJcoAdapter()
    if (!adapter) throw new Error('Desktop result bridge is unavailable.')
    return adapter.readSavedTrace({ runId: run.id, stage: 'nonlinear', pointId, quantityName: item.quantityKey, arrayName: item.arrayName })
  }
  const toggleTrace = async (item: CatalogItem) => {
    if (traces.some((trace) => trace.key === item.key)) return setTraces((current) => current.filter((trace) => trace.key !== item.key))
    setLoading(item.key); setError('')
    try {
      const trace = await read(item)
      setTraces((current) => [...current, { key: item.key, trace, component: trace.magnitude ? 'magnitude' : 'values' }])
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)) } finally { setLoading('') }
  }
  const chooseAxis = async (key: string) => {
    setXChoice(key); setError('')
    if (key === 'auto') return setXTrace(null)
    const item = catalogItems.find((candidate) => candidate.key === key)
    if (!item) return setXTrace(null)
    setLoading(`axis:${key}`)
    try { setXTrace(await read(item)) } catch (caught) { setXChoice('auto'); setXTrace(null); setError(caught instanceof Error ? caught.message : String(caught)) } finally { setLoading('') }
  }

  return <Paper variant="outlined" sx={{ p: 1.5 }}><Stack spacing={1.2}>
    <Stack direction="row" spacing={0.8} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
      <Typography variant="h6">Point data</Typography><Chip size="small" label={`Point ${pointId}`} />
      {convergedIndex >= 0 && <Chip size="small" color={Number(row[convergedIndex]) === 1 ? 'success' : 'warning'} label={Number(row[convergedIndex]) === 1 ? 'Converged' : 'Non-converged'} />}
    </Stack>
    <Stack direction="row" spacing={0.7} useFlexGap sx={{ flexWrap: 'wrap' }}>{sourceCols.map((column) => <Chip size="small" variant="outlined" key={column} label={`${column} = ${formatNumber(Number(row[table.columns.indexOf(column)]))}`} />)}</Stack>
    <Stack direction="row" spacing={0.7} useFlexGap sx={{ flexWrap: 'wrap' }}>{metrics.map((column) => <Chip size="small" variant="outlined" key={column} label={`${column} = ${formatNumber(Number(row[table.columns.indexOf(column)])) || 'unavailable'}`} />)}</Stack>
    {savedPoint && Object.keys(savedPoint.parameters).length > 0 && <Box><Typography variant="subtitle2" sx={{ mb: 0.5 }}>Device parameters</Typography><Stack direction="row" spacing={0.6} useFlexGap sx={{ flexWrap: 'wrap' }}>{Object.entries(savedPoint.parameters).map(([name, value]) => <Chip size="small" variant="outlined" key={name} label={`${name} = ${formatNumber(Number(value))}`} />)}</Stack></Box>}
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Retained arrays</Typography>
      {!catalogItems.length ? <Typography variant="body2" color="text.secondary">No nonlinear arrays were retained for this point.</Typography> : <Stack spacing={1}>
        <Stack direction="row" spacing={0.7} useFlexGap sx={{ flexWrap: 'wrap' }}>{catalogItems.map((item) => <Button size="small" key={item.key} variant={traces.some((trace) => trace.key === item.key) ? 'contained' : 'outlined'} disabled={loading === item.key} onClick={() => toggleTrace(item)}>{loading === item.key ? 'Loading…' : `${item.quantityName} · ${item.arrayName}`}</Button>)}</Stack>
        <FormControl size="small" sx={{ minWidth: 280, maxWidth: 520 }}>
          <InputLabel>X axis for saved data</InputLabel>
          <Select label="X axis for saved data" value={xChoice} onChange={(event) => void chooseAxis(event.target.value)}>
            <MenuItem value="auto">Automatic · stored frequency/index</MenuItem>
            {catalogItems.map((item) => <MenuItem key={item.key} value={item.key}>{item.quantityName} · {item.arrayName}</MenuItem>)}
          </Select>
        </FormControl>
        {xChoice !== 'auto' && <Typography variant="caption" color="text.secondary">The selected retained array is used as X only for traces with the same number of samples; incompatible traces keep their automatic axis.</Typography>}
      </Stack>}
    </Box>
    {error && <Alert severity="warning">{error}</Alert>}
    {traces.map((item) => {
      const values = traceValues(item)
      const customX = xTrace ? axisValues(xTrace) : []
      const useCustom = xTrace !== null && customAxisCompatible(customX.length, values.length)
      const frequency = !useCustom && item.trace.xKind === 'frequency_hz'
      const x = useCustom ? customX : frequency ? item.trace.x.map((value) => value / 1e9) : item.trace.x
      const xLabel = useCustom && xTrace ? traceLabel(xTrace) : frequency ? 'Frequency / GHz' : item.trace.xLabel
      return <Paper key={item.key} variant="outlined" sx={{ p: 1.1 }}>
        <Stack direction="row" spacing={0.8} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 0.7 }}>
          <Typography variant="subtitle2">{traceLabel(item.trace)}</Typography>
          {item.trace.magnitude && <FormControl size="small" sx={{ minWidth: 120 }}><InputLabel>View</InputLabel><Select label="View" value={item.component} onChange={(event) => setTraces((current) => current.map((trace) => trace.key === item.key ? { ...trace, component: event.target.value as TraceComponent } : trace))}><MenuItem value="magnitude">magnitude</MenuItem><MenuItem value="real">real</MenuItem><MenuItem value="imag">imag</MenuItem><MenuItem value="phase">phase</MenuItem></Select></FormControl>}
          {xTrace && !useCustom && <Chip size="small" color="warning" variant="outlined" label="Selected X axis has incompatible length" />}
        </Stack>
        <LineChart height={310} xAxis={[{ data: x, label: xLabel, valueFormatter: (value: number | null) => formatNumber(value) }]} yAxis={[{ valueFormatter: (value: number | null) => formatNumber(value) }]} series={[{ data: values, label: `${traceLabel(item.trace)}${item.component === 'values' ? '' : ` (${item.component})`}`, showMark: values.length < 100, valueFormatter: (value: number | null) => formatNumber(value) }]} grid={{ horizontal: true }} />
      </Paper>
    })}
  </Stack></Paper>
}

function HarmonicBalanceRun({ run }: { run: RunResults }) {
  const table = run.nonlinear
  if (!table) return <Alert severity="info">This run does not contain a Harmonic Balance dataset.</Alert>
  const coordinates = sourceCoordinateColumns(table)
  const metrics = metricColumns(table)
  if (!coordinates.length || !metrics.length) return <Alert severity="warning">The Harmonic Balance table does not contain source coordinates and scalar metrics.</Alert>

  const defaultX = coordinates.find((name) => /frequency$/i.test(name)) ?? coordinates[0]
  const defaultY = coordinates.find((name) => /amplitude$/i.test(name) && name !== defaultX) ?? coordinates.find((name) => name !== defaultX) ?? coordinates[0]
  const [view, setView] = useState<HbView>('landscape')
  const [x, setX] = useState(defaultX)
  const [y, setY] = useState(defaultY)
  const [metric, setMetric] = useState(metrics.includes('performance') ? 'performance' : metrics[0])
  const [convergence, setConvergence] = useState<ConvergenceFilter>('all')
  const [fixed, setFixed] = useState<Record<string, number>>({})
  const [selectedPointId, setSelectedPointId] = useState<number | null>(null)
  const amplitudes = amplitudeColumns(table)
  const [responseAmplitude, setResponseAmplitude] = useState(amplitudes[0] ?? '')
  const [responseFixed, setResponseFixed] = useState<Record<string, number>>({})

  useEffect(() => {
    const next: Record<string, number> = {}
    coordinates.filter((column) => column !== x && column !== y).forEach((column) => { next[column] = fixed[column] ?? columnValues(table, column)[0] })
    setFixed(next)
  }, [table, x, y])
  useEffect(() => {
    if (!responseAmplitude && amplitudes.length) setResponseAmplitude(amplitudes[0])
    const next: Record<string, number> = {}
    coordinates.filter((column) => column !== responseAmplitude).forEach((column) => { next[column] = responseFixed[column] ?? columnValues(table, column)[0] })
    setResponseFixed(next)
  }, [table, responseAmplitude])

  const grid = useMemo(() => x !== y ? buildHbGrid(table, x, y, metric, fixed, convergence) : null, [table, x, y, metric, fixed, convergence])
  useEffect(() => {
    const first = grid?.pointIds.flat().find((id): id is number => id != null) ?? null
    if (first != null && !grid?.pointIds.flat().includes(selectedPointId)) setSelectedPointId(first)
  }, [grid, selectedPointId])

  const responseRows = useMemo(() => {
    if (!responseAmplitude) return [] as NumericRow[]
    const ampIndex = table.columns.indexOf(responseAmplitude)
    return rowsAsNumbers(table).filter((row) => rowMatchesFixed(table, row, responseFixed) && convergenceMatches(table, row, convergence) && Number.isFinite(row[ampIndex])).sort((a, b) => a[ampIndex] - b[ampIndex])
  }, [table, responseAmplitude, responseFixed, convergence])
  const ampIndex = table.columns.indexOf(responseAmplitude)
  const performanceIndex = table.columns.indexOf('performance')
  const deltaIndex = table.columns.indexOf('delta_quantity')

  return <Stack spacing={1.3}>
    <Paper variant="outlined" sx={{ p: 1.2 }}><Stack direction="row" spacing={0.8} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
      <Button size="small" variant={view === 'landscape' ? 'contained' : 'outlined'} onClick={() => setView('landscape')}>Landscape</Button>
      <Button size="small" variant={view === 'response' ? 'contained' : 'outlined'} onClick={() => setView('response')}>Amplitude response</Button>
      <FormControl size="small" sx={{ minWidth: 175, ml: { md: 'auto' } }}><InputLabel>Convergence</InputLabel><Select label="Convergence" value={convergence} onChange={(event) => setConvergence(event.target.value as ConvergenceFilter)}><MenuItem value="all">All points</MenuItem><MenuItem value="converged">Converged</MenuItem><MenuItem value="nonconverged">Non-converged</MenuItem></Select></FormControl>
    </Stack></Paper>

    {view === 'landscape' && <>
      <Paper variant="outlined" sx={{ p: 1.2 }}><Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>X axis</InputLabel><Select label="X axis" value={x} onChange={(event) => setX(event.target.value)}>{coordinates.map((column) => <MenuItem key={column} value={column} disabled={column === y}>{column}</MenuItem>)}</Select></FormControl>
        <FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>Y axis</InputLabel><Select label="Y axis" value={y} onChange={(event) => setY(event.target.value)}>{coordinates.map((column) => <MenuItem key={column} value={column} disabled={column === x}>{column}</MenuItem>)}</Select></FormControl>
        <FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>Metric / color</InputLabel><Select label="Metric / color" value={metric} onChange={(event) => setMetric(event.target.value)}>{metrics.map((column) => <MenuItem key={column} value={column}>{column}</MenuItem>)}</Select></FormControl>
        {coordinates.filter((column) => column !== x && column !== y).map((column) => <FormControl key={column} size="small" sx={{ minWidth: 210 }}><InputLabel>{column} fixed</InputLabel><Select label={`${column} fixed`} value={fixed[column] ?? ''} onChange={(event) => setFixed((current) => ({ ...current, [column]: Number(event.target.value) }))}>{columnValues(table, column).map((value) => <MenuItem key={value} value={value}>{formatNumber(value)}</MenuItem>)}</Select></FormControl>)}
      </Stack></Paper>
      {grid && grid.x.length && grid.y.length ? <Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="h6">{metric}</Typography><Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{x} × {y} · exact HB slice</Typography><Box sx={{ minHeight: 390, display: 'flex', alignItems: 'center' }}><HeatmapGrid xLabels={grid.x.map(formatNumber)} yLabels={grid.y.map(formatNumber)} values={grid.values} valueLabel={metric} xAxisLabel={x} yAxisLabel={y} formatValue={formatNumber} onCellClick={(r, c) => { const id = grid.pointIds[r]?.[c]; if (id != null) setSelectedPointId(id) }} /></Box></Paper> : <Alert severity="info">No points match the selected HB slice and convergence filter.</Alert>}
      <HbPointInspector run={run} table={table} pointId={selectedPointId} catalog={run.savedNonlinear} />
    </>}

    {view === 'response' && <Stack spacing={1.2}>
      <Paper variant="outlined" sx={{ p: 1.2 }}><Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 220 }}><InputLabel>Source amplitude</InputLabel><Select label="Source amplitude" value={responseAmplitude} onChange={(event) => setResponseAmplitude(event.target.value)}>{amplitudes.map((column) => <MenuItem key={column} value={column}>{column}</MenuItem>)}</Select></FormControl>
        {coordinates.filter((column) => column !== responseAmplitude).map((column) => <FormControl key={column} size="small" sx={{ minWidth: 210 }}><InputLabel>{column} fixed</InputLabel><Select label={`${column} fixed`} value={responseFixed[column] ?? ''} onChange={(event) => setResponseFixed((current) => ({ ...current, [column]: Number(event.target.value) }))}>{columnValues(table, column).map((value) => <MenuItem key={value} value={value}>{formatNumber(value)}</MenuItem>)}</Select></FormControl>)}
      </Stack></Paper>
      {!responseRows.length ? <Alert severity="info">No points match the selected amplitude-response slice.</Alert> : <>
        {performanceIndex >= 0 && <Paper variant="outlined" sx={{ p: 1.2 }}><Typography variant="h6">Performance vs {responseAmplitude}</Typography><LineChart height={340} xAxis={[{ data: responseRows.map((row) => row[ampIndex]), label: responseAmplitude, valueFormatter: (value: number | null) => formatNumber(value) }]} yAxis={[{ label: 'performance', valueFormatter: (value: number | null) => formatNumber(value) }]} series={[{ data: responseRows.map((row) => row[performanceIndex]), label: 'performance', showMark: true, valueFormatter: (value: number | null) => formatNumber(value) }]} grid={{ horizontal: true }} /></Paper>}
        {deltaIndex >= 0 && <Paper variant="outlined" sx={{ p: 1.2 }}><Typography variant="h6">delta_quantity vs {responseAmplitude}</Typography><LineChart height={340} xAxis={[{ data: responseRows.map((row) => row[ampIndex]), label: responseAmplitude, valueFormatter: (value: number | null) => formatNumber(value) }]} yAxis={[{ label: 'delta_quantity', valueFormatter: (value: number | null) => formatNumber(value) }]} series={[{ data: responseRows.map((row) => row[deltaIndex]), label: 'delta_quantity', showMark: true, valueFormatter: (value: number | null) => formatNumber(value) }]} grid={{ horizontal: true }} /></Paper>}
      </>}
    </Stack>}
  </Stack>
}

export function HarmonicBalanceResults({ results, activeRunId }: { results: ResultsBundle; activeRunId?: string | null }) {
  const [runId, setRunId] = useState(results.runs[0]?.id ?? '')
  useEffect(() => { if (!results.runs.some((run) => run.id === runId)) setRunId(results.runs[0]?.id ?? '') }, [results, runId])
  const run = results.runs.find((item) => item.id === runId) ?? results.runs[0]
  if (!run) return <Alert severity="info">The project contains no indexed runs yet.</Alert>
  return <Stack spacing={1.3}>
    <Paper variant="outlined" sx={{ p: 1.2 }}><Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}><FormControl size="small" sx={{ minWidth: 290 }}><InputLabel>Run</InputLabel><Select label="Run" value={run.id} onChange={(event) => setRunId(event.target.value)}>{results.runs.map((item) => <MenuItem key={item.id} value={item.id}>{item.id}{item.id === activeRunId ? ' · running' : ''}</MenuItem>)}</Select></FormControl><Chip size="small" color="success" variant="outlined" label="Stored JCO data" />{run.savedNonlinear && <Chip size="small" variant="outlined" label={`${run.savedNonlinear.points.length} retained-data points`} />}</Stack></Paper>
    <HarmonicBalanceRun run={run} />
  </Stack>
}
