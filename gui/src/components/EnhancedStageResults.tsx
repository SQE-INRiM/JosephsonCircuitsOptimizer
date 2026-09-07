import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, Chip, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Typography } from '@mui/material'
import { LineChart } from '@mui/x-charts/LineChart'
import type { ResultTable, ResultsBundle, RunResults, SavedDataCatalog, SavedTraceData, StageId } from '../types'
import { getJcoAdapter } from '../services/jcoAdapter'
import { useAppStore } from '../store'
import { parameterLabel } from '../utils/resultUnits'
import { HeatmapGrid } from './HeatmapGrid'

const ALL_PARAMETERS = '__all__'
type HbView = 'landscape' | 'response'
type ConvergenceFilter = 'all' | 'converged' | 'nonconverged'

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

function sourceCoordinateColumns(table: ResultTable): string[] {
  return table.columns.filter((column) => /^source_\d+_(frequency|amplitude)$/i.test(column))
}
function amplitudeColumns(table: ResultTable): string[] { return sourceCoordinateColumns(table).filter((column) => /_amplitude$/i.test(column)) }
function metricColumns(table: ResultTable): string[] {
  const coords = new Set(sourceCoordinateColumns(table))
  return table.columns.filter((column) => column !== 'point_id' && column !== 'converged' && !coords.has(column))
}
function varyingColumns(table: ResultTable, columns: string[]): string[] {
  const rows = rowsAsNumbers(table)
  return columns.filter((column) => {
    const index = table.columns.indexOf(column)
    return index >= 0 && unique(rows.map((row) => row[index])).length > 1
  })
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
  const xIndex = table.columns.indexOf(xName); const yIndex = table.columns.indexOf(yName); const metricIndex = table.columns.indexOf(metricName); const pointIndex = table.columns.indexOf('point_id')
  const rows = rowsAsNumbers(table).filter((row) => Number.isFinite(row[xIndex]) && Number.isFinite(row[yIndex]) && rowMatchesFixed(table, row, fixed) && convergenceMatches(table, row, convergence))
  const x = unique(rows.map((row) => row[xIndex])); const y = unique(rows.map((row) => row[yIndex])); const map = new Map(rows.map((row) => [`${row[xIndex]}|${row[yIndex]}`, row]))
  return {
    x,
    y,
    values: y.map((yv) => x.map((xv) => { const row = map.get(`${xv}|${yv}`); const value = row?.[metricIndex]; return value != null && Number.isFinite(value) ? value : null })),
    pointIds: y.map((yv) => x.map((xv) => { const row = map.get(`${xv}|${yv}`); const id = pointIndex >= 0 ? row?.[pointIndex] : null; return id != null && Number.isFinite(id) ? id : null })),
  }
}

function RunControls({ results, run, stage, activeRunId, onRunId, onResultsChanged }: { results: ResultsBundle; run: RunResults; stage: StageId; activeRunId?: string | null; onRunId: (id: string) => void; onResultsChanged: (results: ResultsBundle) => void }) {
  const [status, setStatus] = useState(''); const [deleting, setDeleting] = useState(false)
  const table = stage === 'hb' ? run.nonlinear : run.optimization
  const deleteRun = async () => {
    if (run.id === activeRunId) return setStatus('The active running simulation cannot be deleted.')
    if (!window.confirm(`Delete ${run.id} and all of its stored numerical results? This cannot be undone.`)) return
    const adapter = getJcoAdapter(); if (!adapter) return
    setDeleting(true)
    try { const next = await adapter.deleteRun(run.id); onResultsChanged(next); onRunId(next.runs[0]?.id ?? '') } catch (error) { setStatus(error instanceof Error ? error.message : String(error)) } finally { setDeleting(false) }
  }
  return <Stack spacing={1}><Paper variant="outlined" sx={{ p: 1.25 }}><Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}><FormControl size="small" sx={{ minWidth: 270 }}><InputLabel>Run</InputLabel><Select label="Run" value={run.id} onChange={(event) => onRunId(event.target.value)}>{results.runs.map((item) => <MenuItem value={item.id} key={item.id}>{item.id}{item.id === activeRunId ? ' · running' : ''}</MenuItem>)}</Select></FormControl><Chip size="small" color="success" variant="outlined" label="Stored JCO data" />{stage === 'hb' && run.savedNonlinear && <Chip size="small" variant="outlined" label={`${run.savedNonlinear.points.length} retained-data points`} />}<Button sx={{ ml: 'auto' }} size="small" color="error" variant="outlined" disabled={deleting || run.id === activeRunId} onClick={deleteRun}>{deleting ? 'Deleting…' : 'Delete run'}</Button><Button size="small" variant="outlined" disabled={!table} onClick={async () => { try { const target = await getJcoAdapter()?.exportData({ runId: run.id, stage, format: 'csv', metrics: [], filters: {} }); if (target) setStatus(`Exported to ${target}`) } catch (error) { setStatus(error instanceof Error ? error.message : String(error)) } }}>Export CSV…</Button></Stack></Paper>{status && <Alert severity={status.startsWith('Exported') ? 'success' : 'error'} onClose={() => setStatus('')}>{status}</Alert>}</Stack>
}

function OptimizationResults({ table }: { table: ResultTable }) {
  const projectParameters = useAppStore((state) => state.project.parameters)
  const metricIndex = table.columns.indexOf('metric'); const evaluationIndex = table.columns.indexOf('evaluation')
  if (metricIndex < 0) return <Alert severity="warning">The optimization table does not contain a metric column.</Alert>
  const rows = rowsAsNumbers(table).filter((row) => Number.isFinite(row[metricIndex])).sort((a, b) => (evaluationIndex >= 0 ? a[evaluationIndex] - b[evaluationIndex] : 0))
  const evaluations = rows.map((row, index) => evaluationIndex >= 0 ? row[evaluationIndex] : index + 1)
  const parameters = varyingColumns(table, table.columns.slice(Math.max(0, evaluationIndex + 1), metricIndex))
  const [mode, setMode] = useState<'best' | 'history'>('best'); const [parameter, setParameter] = useState(parameters[0] ?? ALL_PARAMETERS)
  useEffect(() => { if (parameter !== ALL_PARAMETERS && !parameters.includes(parameter)) setParameter(parameters[0] ?? ALL_PARAMETERS) }, [parameters, parameter])
  let best = Number.POSITIVE_INFINITY; const bestHistory = rows.map((row) => { best = Math.min(best, row[metricIndex]); return best })
  const parameterChart = (name: string, height = 300) => { const index = table.columns.indexOf(name); const data = rows.map((row) => row[index]); const displayName = parameterLabel(projectParameters, name); return <Paper key={name} variant="outlined" sx={{ p: 1.2 }}><Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{displayName}</Typography><LineChart height={height} margin={{ bottom: 50, left: 90 }} xAxis={[{ data: evaluations, scaleType: 'linear', label: 'Evaluation number', tickMinStep: 1, valueFormatter: (value: number | null) => `${Math.round(Number(value))}` }]} yAxis={[{ label: displayName, width: 80, valueFormatter: (value: number | null) => formatNumber(value) }]} series={[{ data, label: displayName, showMark: true, curve: 'linear', valueFormatter: (value: number | null) => formatNumber(value) }]} grid={{ horizontal: true }} /></Paper> }
  return <Stack spacing={1.3}><Paper variant="outlined" sx={{ p: 1.25 }}><Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}><Button size="small" variant={mode === 'best' ? 'contained' : 'outlined'} onClick={() => setMode('best')}>Best objective</Button><Button size="small" variant={mode === 'history' ? 'contained' : 'outlined'} onClick={() => setMode('history')}>Parameter history</Button><Chip sx={{ ml: { md: 'auto' } }} size="small" variant="outlined" label={`${rows.length} optimizer evaluations`} />{mode === 'history' && <FormControl size="small" sx={{ minWidth: 220 }}><InputLabel>Parameter</InputLabel><Select label="Parameter" value={parameter} onChange={(event) => setParameter(event.target.value)}><MenuItem value={ALL_PARAMETERS}>All parameters</MenuItem>{parameters.map((name) => <MenuItem value={name} key={name}>{parameterLabel(projectParameters, name)}</MenuItem>)}</Select></FormControl>}</Stack></Paper>{mode === 'best' && <Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="h6">Best sampled objective</Typography><Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Best objective found up to each optimizer evaluation.</Typography><LineChart height={380} margin={{ bottom: 55, left: 90 }} xAxis={[{ data: evaluations, scaleType: 'linear', label: 'Evaluation number', tickMinStep: 1, valueFormatter: (value: number | null) => `${Math.round(Number(value))}` }]} yAxis={[{ label: table.columns[metricIndex], width: 80, valueFormatter: (value: number | null) => formatNumber(value) }]} series={[{ data: bestHistory, label: table.columns[metricIndex], showMark: evaluations.length <= 40, curve: 'linear', valueFormatter: (value: number | null) => formatNumber(value) }]} grid={{ horizontal: true }} /></Paper>}{mode === 'history' && (parameter === ALL_PARAMETERS ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' }, gap: 1.2 }}>{parameters.map((name) => parameterChart(name, 270))}</Box> : parameterChart(parameter, 380))}</Stack>
}

function traceSeries(trace: SavedTraceData): { data: number[]; label: string } {
  if (trace.magnitude) return { data: trace.magnitude, label: `${trace.quantityName} · ${trace.arrayName} (magnitude)` }
  if (trace.values) return { data: trace.values, label: `${trace.quantityName} · ${trace.arrayName}` }
  if (trace.real) return { data: trace.real, label: `${trace.quantityName} · ${trace.arrayName} (real)` }
  return { data: [], label: `${trace.quantityName} · ${trace.arrayName}` }
}

function HbPointInspector({ run, table, pointId, catalog }: { run: RunResults; table: ResultTable; pointId: number | null; catalog?: SavedDataCatalog | null }) {
  const pointIndex = table.columns.indexOf('point_id'); const row = pointId == null ? undefined : table.rows.find((candidate) => Number(candidate[pointIndex]) === pointId)
  const savedPoint = pointId == null ? undefined : catalog?.points.find((point) => point.pointId === pointId)
  const [traces, setTraces] = useState<Record<string, SavedTraceData>>({}); const [error, setError] = useState('')
  useEffect(() => { setTraces({}); setError('') }, [run.id, pointId])
  if (!row || pointId == null) return <Alert severity="info">Select a Harmonic Balance point to inspect it.</Alert>
  const sourceCols = sourceCoordinateColumns(table); const metrics = metricColumns(table); const convergedIndex = table.columns.indexOf('converged')
  const loadTrace = async (quantityName: string, arrayName: string) => { const key = `${quantityName}/${arrayName}`; if (traces[key]) return setTraces((current) => { const next = { ...current }; delete next[key]; return next }); try { const trace = await getJcoAdapter()?.readSavedTrace({ runId: run.id, stage: 'nonlinear', pointId, quantityName, arrayName }); if (trace) setTraces((current) => ({ ...current, [key]: trace })) } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)) } }
  return <Paper variant="outlined" sx={{ p: 1.5 }}><Stack spacing={1.2}><Stack direction="row" spacing={0.8} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}><Typography variant="h6">Point data</Typography><Chip size="small" label={`Point ${pointId}`} />{convergedIndex >= 0 && <Chip size="small" color={Number(row[convergedIndex]) === 1 ? 'success' : 'warning'} label={Number(row[convergedIndex]) === 1 ? 'Converged' : 'Non-converged'} />}</Stack><Stack direction="row" spacing={0.7} useFlexGap sx={{ flexWrap: 'wrap' }}>{sourceCols.map((column) => <Chip size="small" variant="outlined" key={column} label={`${column} = ${formatNumber(Number(row[table.columns.indexOf(column)]))}`} />)}</Stack><Stack direction="row" spacing={0.7} useFlexGap sx={{ flexWrap: 'wrap' }}>{metrics.map((column) => <Chip size="small" variant="outlined" key={column} label={`${column} = ${formatNumber(Number(row[table.columns.indexOf(column)])) || 'unavailable'}`} />)}</Stack>{savedPoint && Object.keys(savedPoint.parameters).length > 0 && <Box><Typography variant="subtitle2" sx={{ mb: 0.5 }}>Device parameters</Typography><Stack direction="row" spacing={0.6} useFlexGap sx={{ flexWrap: 'wrap' }}>{Object.entries(savedPoint.parameters).map(([name, value]) => <Chip size="small" variant="outlined" key={name} label={`${name} = ${formatNumber(Number(value))}`} />)}</Stack></Box>}<Box><Typography variant="subtitle2" sx={{ mb: 0.5 }}>Retained arrays</Typography>{!savedPoint?.quantities.length ? <Typography variant="body2" color="text.secondary">No nonlinear arrays were retained for this point.</Typography> : <Stack direction="row" spacing={0.7} useFlexGap sx={{ flexWrap: 'wrap' }}>{savedPoint.quantities.flatMap((quantity) => quantity.arrays.map((array) => { const key = `${quantity.name}/${array.name}`; return <Button size="small" key={key} variant={traces[key] ? 'contained' : 'outlined'} onClick={() => loadTrace(quantity.name, array.name)}>{quantity.quantityName} · {array.name}</Button> }))}</Stack>}</Box>{error && <Alert severity="warning">{error}</Alert>}{Object.entries(traces).map(([key, trace]) => { const series = traceSeries(trace); const x = trace.xKind === 'frequency_hz' ? trace.x.map((value) => value / 1e9) : trace.x; return <Paper key={key} variant="outlined" sx={{ p: 1 }}><LineChart height={300} xAxis={[{ data: x, label: trace.xKind === 'frequency_hz' ? 'Frequency / GHz' : trace.xLabel }]} series={[{ data: series.data, label: series.label, showMark: series.data.length < 100 }]} grid={{ horizontal: true }} /></Paper> })}</Stack></Paper>
}

function HarmonicBalanceResults({ run, table }: { run: RunResults; table: ResultTable }) {
  const sourceCols = sourceCoordinateColumns(table); const varyingSources = varyingColumns(table, sourceCols); const metrics = metricColumns(table); const amps = amplitudeColumns(table)
  const defaultX = varyingSources.find((name) => /_frequency$/i.test(name)) ?? varyingSources[0] ?? sourceCols[0] ?? ''
  const defaultY = varyingSources.find((name) => /_amplitude$/i.test(name) && name !== defaultX) ?? varyingSources.find((name) => name !== defaultX) ?? sourceCols.find((name) => name !== defaultX) ?? ''
  const [view, setView] = useState<HbView>('landscape'); const [metric, setMetric] = useState(metrics.includes('performance') ? 'performance' : metrics[0] ?? ''); const [x, setX] = useState(defaultX); const [y, setY] = useState(defaultY); const [convergence, setConvergence] = useState<ConvergenceFilter>('all'); const [fixed, setFixed] = useState<Record<string, number>>(() => Object.fromEntries(sourceCols.map((column) => [column, columnValues(table, column)[0]]))); const [selectedPointId, setSelectedPointId] = useState<number | null>(null); const [responseAmplitude, setResponseAmplitude] = useState(amps[0] ?? '')
  useEffect(() => { setFixed((current) => Object.fromEntries(sourceCols.map((column) => { const options = columnValues(table, column); return [column, options.includes(current[column]) ? current[column] : options[0]] }))) }, [table])
  const sliceColumns = sourceCols.filter((column) => column !== x && column !== y); const activeFixed = Object.fromEntries(sliceColumns.map((column) => [column, fixed[column]]).filter(([, value]) => Number.isFinite(value))) as Record<string, number>
  const grid = useMemo(() => x && y && x !== y && metric ? buildHbGrid(table, x, y, metric, activeFixed, convergence) : null, [table, x, y, metric, convergence, ...sliceColumns.map((column) => fixed[column])])
  const selectedCell = useMemo(() => { if (!grid || selectedPointId == null) return null; for (let r = 0; r < grid.pointIds.length; r += 1) { const c = grid.pointIds[r].findIndex((id) => id === selectedPointId); if (c >= 0) return { rowIndex: r, columnIndex: c } } return null }, [grid, selectedPointId])
  useEffect(() => { if (!grid) return; const ids = grid.pointIds.flat().filter((id): id is number => id != null); if (selectedPointId == null || !ids.includes(selectedPointId)) setSelectedPointId(ids[0] ?? null) }, [grid, selectedPointId])
  const responseFixedColumns = sourceCols.filter((column) => column !== responseAmplitude); const responseRows = useMemo(() => { const ampIndex = table.columns.indexOf(responseAmplitude); return rowsAsNumbers(table).filter((row) => responseAmplitude && rowMatchesFixed(table, row, Object.fromEntries(responseFixedColumns.map((column) => [column, fixed[column]]))) && convergenceMatches(table, row, convergence) && Number.isFinite(row[ampIndex])).sort((a, b) => a[ampIndex] - b[ampIndex]) }, [table, responseAmplitude, convergence, ...responseFixedColumns.map((column) => fixed[column])])
  const responseX = responseRows.map((row) => row[table.columns.indexOf(responseAmplitude)]); const performanceIndex = table.columns.indexOf('performance'); const deltaIndex = table.columns.indexOf('delta_quantity')
  if (!sourceCols.length) return <Alert severity="warning">The HB table does not contain source frequency/amplitude coordinates.</Alert>
  return <Stack spacing={1.3}><Paper variant="outlined" sx={{ p: 1.25 }}><Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}><Button size="small" variant={view === 'landscape' ? 'contained' : 'outlined'} onClick={() => setView('landscape')}>Landscape</Button><Button size="small" variant={view === 'response' ? 'contained' : 'outlined'} onClick={() => setView('response')}>Amplitude response</Button><Chip sx={{ ml: { md: 'auto' } }} size="small" variant="outlined" label={`${table.rows.length} HB points`} /><FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>Convergence</InputLabel><Select label="Convergence" value={convergence} onChange={(event) => setConvergence(event.target.value as ConvergenceFilter)}><MenuItem value="all">All points</MenuItem><MenuItem value="converged">Converged</MenuItem><MenuItem value="nonconverged">Non-converged</MenuItem></Select></FormControl></Stack></Paper>{view === 'landscape' && <><Paper variant="outlined" sx={{ p: 1.25 }}><Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}><FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>Metric</InputLabel><Select label="Metric" value={metric} onChange={(event) => setMetric(event.target.value)}>{metrics.map((name) => <MenuItem value={name} key={name}>{name}</MenuItem>)}</Select></FormControl><FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>X axis</InputLabel><Select label="X axis" value={x} onChange={(event) => { const next = event.target.value; setX(next); if (next === y) setY(sourceCols.find((column) => column !== next) ?? '') }}>{sourceCols.map((name) => <MenuItem value={name} key={name}>{name}</MenuItem>)}</Select></FormControl><FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>Y axis</InputLabel><Select label="Y axis" value={y} onChange={(event) => setY(event.target.value)}>{sourceCols.filter((name) => name !== x).map((name) => <MenuItem value={name} key={name}>{name}</MenuItem>)}</Select></FormControl>{sliceColumns.map((column) => <FormControl size="small" sx={{ minWidth: 210 }} key={column}><InputLabel>{`${column} fixed`}</InputLabel><Select label={`${column} fixed`} value={fixed[column] ?? ''} onChange={(event) => setFixed((current) => ({ ...current, [column]: Number(event.target.value) }))}>{columnValues(table, column).map((value) => <MenuItem key={value} value={value}>{formatNumber(value)}</MenuItem>)}</Select></FormControl>)}</Stack></Paper>{grid && grid.x.length > 0 && grid.y.length > 0 ? <Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="h6">{metric}</Typography><Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Harmonic Balance source-space slice. Fixed coordinates are selected explicitly; no averaging or interpolation is applied.</Typography><Box sx={{ minHeight: 390, display: 'flex', alignItems: 'center' }}><HeatmapGrid xLabels={grid.x.map(formatNumber)} yLabels={grid.y.map(formatNumber)} values={grid.values} valueLabel={metric} xAxisLabel={x} yAxisLabel={y} formatValue={formatNumber} selectedCell={selectedCell} onCellClick={(rowIndex, columnIndex) => { const id = grid.pointIds[rowIndex]?.[columnIndex]; if (id != null) setSelectedPointId(id) }} /></Box></Paper> : <Alert severity="info">No HB points match the selected slice and convergence filter.</Alert>}<HbPointInspector run={run} table={table} pointId={selectedPointId} catalog={run.savedNonlinear} /></>}{view === 'response' && <><Paper variant="outlined" sx={{ p: 1.25 }}><Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}><FormControl size="small" sx={{ minWidth: 220 }}><InputLabel>Source amplitude</InputLabel><Select label="Source amplitude" value={responseAmplitude} onChange={(event) => setResponseAmplitude(event.target.value)}>{amps.map((name) => <MenuItem value={name} key={name}>{name}</MenuItem>)}</Select></FormControl>{responseFixedColumns.map((column) => <FormControl size="small" sx={{ minWidth: 210 }} key={column}><InputLabel>{`${column} fixed`}</InputLabel><Select label={`${column} fixed`} value={fixed[column] ?? ''} onChange={(event) => setFixed((current) => ({ ...current, [column]: Number(event.target.value) }))}>{columnValues(table, column).map((value) => <MenuItem key={value} value={value}>{formatNumber(value)}</MenuItem>)}</Select></FormControl>)}</Stack></Paper>{!responseAmplitude || !responseRows.length ? <Alert severity="info">No HB points match the selected amplitude response slice.</Alert> : <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: deltaIndex >= 0 ? 'repeat(2, minmax(0, 1fr))' : '1fr' }, gap: 1.2 }}>{performanceIndex >= 0 && <Paper variant="outlined" sx={{ p: 1.2 }}><Typography variant="h6">Performance vs {responseAmplitude}</Typography><LineChart height={350} xAxis={[{ data: responseX, label: responseAmplitude, valueFormatter: (value: number | null) => formatNumber(value) }]} yAxis={[{ label: 'performance', width: 80, valueFormatter: (value: number | null) => formatNumber(value) }]} series={[{ data: responseRows.map((row) => row[performanceIndex]), label: 'performance', showMark: true, curve: 'linear', valueFormatter: (value: number | null) => formatNumber(value) }]} grid={{ horizontal: true }} /></Paper>}{deltaIndex >= 0 && <Paper variant="outlined" sx={{ p: 1.2 }}><Typography variant="h6">Delta quantity vs {responseAmplitude}</Typography><LineChart height={350} xAxis={[{ data: responseX, label: responseAmplitude, valueFormatter: (value: number | null) => formatNumber(value) }]} yAxis={[{ label: 'delta_quantity', width: 80, valueFormatter: (value: number | null) => formatNumber(value) }]} series={[{ data: responseRows.map((row) => row[deltaIndex]), label: 'delta_quantity', showMark: true, curve: 'linear', valueFormatter: (value: number | null) => formatNumber(value) }]} grid={{ horizontal: true }} /></Paper>}</Box>}</>}</Stack>
}

export function EnhancedStageResults({ results, stage, onResultsChanged, activeRunId }: { results: ResultsBundle; stage: 'optimization' | 'hb'; onResultsChanged: (results: ResultsBundle) => void; activeRunId?: string | null }) {
  const [runId, setRunId] = useState(results.runs[0]?.id ?? '')
  useEffect(() => { if (!results.runs.some((item) => item.id === runId)) setRunId(results.runs[0]?.id ?? '') }, [results, runId])
  const run = results.runs.find((item) => item.id === runId) ?? results.runs[0]
  if (!run) return <Alert severity="info">The project contains no indexed runs yet.</Alert>
  const table = stage === 'optimization' ? run.optimization : run.nonlinear
  return <Stack spacing={1.3}><RunControls results={results} run={run} stage={stage} activeRunId={activeRunId} onRunId={setRunId} onResultsChanged={onResultsChanged} />{!table ? <Alert severity="warning">{stage === 'optimization' ? 'This run does not contain persisted optimizer evaluations.' : 'This run does not contain a Harmonic Balance summary table.'}</Alert> : stage === 'optimization' ? <OptimizationResults table={table} /> : <HarmonicBalanceResults run={run} table={table} />}</Stack>
}
