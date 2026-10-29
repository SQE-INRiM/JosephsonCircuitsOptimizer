import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Box, Button, Chip, FormControl, InputLabel, MenuItem, Paper, Select,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material'
import { LineChart } from '@mui/x-charts/LineChart'
import { getJcoAdapter } from '../services/jcoAdapter'
import { useAppStore } from '../store'
import type {
  ResultTable, RunResults, SavedDataPointCatalog, SavedTraceData, SourceAmplitudeUnits,
} from '../types'
import { parameterLabel, sourceCoordinateLabel } from '../utils/resultUnits'

export type ResultSelectionMode = 'single' | 'compare'
type ResultStage = 'linear' | 'nonlinear'
type Component = 'values' | 'magnitude' | 'real' | 'imag' | 'phase'
type ArrayOption = { key: string; quantityName: string; quantityKey: string; arrayName: string }
type TracePair = { key: string; a: SavedTraceData; b: SavedTraceData }

export function updateComparisonSelection(current: number[], pointId: number): number[] {
  if (!Number.isFinite(pointId)) return current
  if (current.includes(pointId)) return current.filter((id) => id !== pointId)
  if (current.length < 2) return [...current, pointId]
  return [current[0], pointId]
}

/** Require matching physical X samples; never silently interpolate or align by index. */
export function sameTraceAxis(a: SavedTraceData, b: SavedTraceData): boolean {
  return a.xKind === b.xKind && a.x.length > 0 && a.x.length === b.x.length
    && a.x.every((value, index) => Number.isFinite(value) && value === b.x[index])
}

export function PointSelectionControls({
  mode, onModeChange, pointIds, onClear,
}: {
  mode: ResultSelectionMode
  onModeChange: (mode: ResultSelectionMode) => void
  pointIds: number[]
  onClear: () => void
}) {
  return <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', mt: 1 }}>
    <ToggleButtonGroup size="small" color="primary" exclusive aria-label="Point selection mode"
      value={mode} onChange={(_, next: ResultSelectionMode | null) => { if (next) onModeChange(next) }}>
      <ToggleButton value="single">Single</ToggleButton>
      <ToggleButton value="compare">Compare A/B</ToggleButton>
    </ToggleButtonGroup>
    {mode === 'compare' && <>
      {pointIds.map((id, index) => <Chip key={id} size="small" variant="outlined"
        label={(index === 0 ? 'A' : 'B') + ': Point ' + id}
        sx={{ borderColor: index === 0 ? '#2d6ca2' : '#cf8a2f', fontWeight: 700 }} />)}
      <Button size="small" onClick={onClear} disabled={!pointIds.length}>Clear</Button>
      <Typography variant="caption" color="text.secondary">
        Click a cell to add A/B; click again to remove. A third point replaces B.
      </Typography>
    </>}
  </Stack>
}

function pretty(value: unknown): string {
  if (value == null || value === '') return '—'
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return String(value)
  if (numeric === 0) return '0'
  return Math.abs(numeric) < 1e-3 || Math.abs(numeric) >= 1e4
    ? numeric.toExponential(4) : Number(numeric.toPrecision(6)).toString()
}

function pointCatalog(run: RunResults, stage: ResultStage, pointId: number): SavedDataPointCatalog | undefined {
  const catalog = stage === 'linear' ? run.savedLinear : run.savedNonlinear
  return catalog?.points.find((point) => point.pointId === pointId)
}

function optionsFor(point: SavedDataPointCatalog | undefined): ArrayOption[] {
  return point?.quantities.flatMap((quantity) => quantity.arrays.map((array) => ({
    key: quantity.name + '/' + array.name,
    quantityKey: quantity.name,
    quantityName: quantity.quantityName,
    arrayName: array.name,
  }))) ?? []
}

function valuesFor(trace: SavedTraceData, component: Component): number[] {
  if (component === 'magnitude') return trace.magnitude ?? []
  if (component === 'real') return trace.real ?? []
  if (component === 'imag') return trace.imag ?? []
  if (component === 'phase') return trace.phaseRad ?? []
  return trace.values ?? []
}

function commonComponents(a: SavedTraceData, b: SavedTraceData): Component[] {
  const options: Array<[Component, keyof SavedTraceData]> = [
    ['values', 'values'], ['magnitude', 'magnitude'], ['real', 'real'],
    ['imag', 'imag'], ['phase', 'phaseRad'],
  ]
  return options.filter(([, field]) =>
    Array.isArray(a[field]) && Array.isArray(b[field])
  ).map(([component]) => component)
}

export function PointComparisonPanel({
  run, table, stage, pointIds, amplitudeUnit = 'A', maskedIds,
}: {
  run: RunResults
  table: ResultTable
  stage: ResultStage
  pointIds: number[]
  amplitudeUnit?: SourceAmplitudeUnits
  maskedIds?: Set<number>
}) {
  const projectParameters = useAppStore((state) => state.project.parameters)
  const ids = pointIds.slice(0, 2)
  const pointIndex = table.columns.indexOf('point_id')
  const rows = ids.map((id) => table.rows.find((row) => Number(row[pointIndex]) === id))
  const catalogs = ids.map((id) => pointCatalog(run, stage, id))
  const ac = optionsFor(catalogs[0])
  const bc = optionsFor(catalogs[1])
  const availableB = new Set(bc.map((option) => option.key))
  const commonOptions = ac.filter((option) => availableB.has(option.key))
  const [selectedArrays, setSelectedArrays] = useState<string[]>([])
  const [components, setComponents] = useState<Record<string, Component>>({})
  const [loaded, setLoaded] = useState<TracePair[]>([])
  const [loading, setLoading] = useState(false)
  const [readErrors, setReadErrors] = useState<string[]>([])

  // A comparison is local to one run and stage; changing either resets its array choices.
  useEffect(() => {
    setSelectedArrays([])
    setComponents({})
    setLoaded([])
    setReadErrors([])
  }, [run.id, stage])

  const firstId = ids[0]
  const secondId = ids[1]
  const chosenKey = selectedArrays.join('|')
  useEffect(() => {
    if (firstId == null || secondId == null || !selectedArrays.length) {
      setLoaded([])
      setReadErrors([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setLoaded([])
    setReadErrors([])
    const adapter = getJcoAdapter()
    if (!adapter) {
      setReadErrors(['Desktop result bridge is unavailable.'])
      setLoading(false)
      return
    }
    void Promise.all(selectedArrays.map(async (key) => {
      const option = optionsFor(pointCatalog(run, stage, firstId)).find((item) => item.key === key)
      const other = optionsFor(pointCatalog(run, stage, secondId)).find((item) => item.key === key)
      if (!option || !other) throw new Error(key + ' is not retained for both points.')
      const [a, b] = await Promise.all([firstId, secondId].map((pointId) =>
        adapter.readSavedTrace({
          runId: run.id, stage, pointId,
          quantityName: option.quantityKey, arrayName: option.arrayName,
        }),
      ))
      return { key, a, b }
    }).map(async (request) => {
      try { return { pair: await request, error: '' } }
      catch (error) { return { pair: null, error: error instanceof Error ? error.message : String(error) } }
    })).then((results) => {
      if (cancelled) return
      setLoaded(results.flatMap((item) => item.pair ? [item.pair] : []))
      setReadErrors(results.map((item) => item.error).filter(Boolean))
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [run.id, stage, firstId, secondId, chosenKey])

  const parameterEnd = table.columns.indexOf('metric')
  const firstParameter = table.columns.indexOf('point_id') + 1
  const parameterColumns = stage === 'linear'
    ? table.columns.slice(firstParameter, parameterEnd >= 0 ? parameterEnd : undefined)
    : table.columns.filter((col) => /^source_\d+_(frequency|amplitude)$/i.test(col))
  const metricColumns = stage === 'linear'
    ? table.columns.slice(parameterEnd >= 0 ? parameterEnd : table.columns.length - 1)
    : table.columns.filter((col) => col !== 'point_id' && col !== 'converged' && !parameterColumns.includes(col))
  const resolved = ids.map((id, index) =>
    stage === 'linear'
      ? table.resolvedParameters?.['point_' + String(id).padStart(6, '0')] ?? catalogs[index]?.parameters ?? {}
      : catalogs[index]?.parameters ?? {}
  )
  const rawValue = (index: number, column: string) => {
    if (index >= ids.length) return undefined
    if (stage === 'linear' && parameterColumns.includes(column) && Object.hasOwn(resolved[index], column))
      return resolved[index][column]
    return rows[index]?.[table.columns.indexOf(column)]
  }
  const entry = (name: string, label: string, valueA: unknown, valueB: unknown) => {
    const va = Number(valueA), vb = Number(valueB)
    const delta = valueA != null && valueB != null && Number.isFinite(va) && Number.isFinite(vb)
      ? pretty(vb - va) : '—'
    return { name, label, a: pretty(valueA), b: pretty(valueB), delta }
  }
  const parameters = parameterColumns.map((column) =>
    entry(column, stage === 'linear' ? parameterLabel(projectParameters, column) : sourceCoordinateLabel(column, amplitudeUnit),
      rawValue(0, column), rawValue(1, column)))
  const metrics = metricColumns.map((column) =>
    entry(column, column, rawValue(0, column), rawValue(1, column)))
  const deviceParameterNames = stage === 'nonlinear'
    ? [...new Set(resolved.flatMap((item) => Object.keys(item)))] : []
  const deviceParameters = deviceParameterNames.map((name) =>
    entry(name, parameterLabel(projectParameters, name), resolved[0]?.[name], resolved[1]?.[name]))
  const convergenceIndex = stage === 'nonlinear' ? table.columns.indexOf('converged') : -1
  const convergence = ids.map((_, index) => {
    const value = rows[index]?.[convergenceIndex]
    return value == null ? '—' : Number(value) === 1 ? 'Converged' : 'Non-converged'
  })
  const compareRows = [
    { heading: stage === 'linear' ? 'Device parameters' : 'Source coordinates', entries: parameters },
    ...(deviceParameters.length ? [{ heading: 'Device parameters', entries: deviceParameters }] : []),
    { heading: 'Scalar metrics', entries: metrics },
    ...(convergenceIndex >= 0 ? [{
      heading: 'Solver status',
      entries: [{ name: 'converged', label: 'Convergence', a: convergence[0], b: convergence[1] ?? '—', delta: '—' }],
    }] : []),
  ]
  const selected = useMemo(() => new Set(selectedArrays), [chosenKey])

  return <Paper variant="outlined" sx={{ p: 1.7 }}>
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="h6">Compare configurations</Typography>
        {ids.map((id, index) => <Chip key={id} size="small" label={(index === 0 ? 'A' : 'B') + ' · Point ' + id}
          sx={(theme) => ({
            backgroundColor: theme.palette.mode === 'dark'
              ? index === 0 ? '#28435a' : '#493921'
              : index === 0 ? '#e6eff7' : '#fff1df',
            color: theme.palette.mode === 'dark'
              ? index === 0 ? '#abd6f5' : '#f3c280'
              : index === 0 ? '#2d6ca2' : '#a76716',
          })} />)}
        {ids.map((id) => maskedIds?.has(id) ? <Chip size="small" key={'masked-' + id} color="warning" label={'Point ' + id + ' masked'} /> : null)}
      </Stack>
      {!ids.length && <Alert severity="info">Select Point A on the heatmap to begin comparing.</Alert>}
      {ids.length === 1 && <Alert severity="info">Select Point B on the heatmap to overlay the same retained arrays for two configurations.</Alert>}
      {ids.length > 0 && <TableContainer sx={{ maxHeight: 420 }}>
        <Table size="small" stickyHeader aria-label="Point A/B comparison">
          <TableHead><TableRow>
            <TableCell>Quantity</TableCell>
            <TableCell align="right">A · Point {ids[0]}</TableCell>
            <TableCell align="right">B {ids[1] == null ? '· not selected' : '· Point ' + ids[1]}</TableCell>
            <TableCell align="right">Δ (B − A)</TableCell>
          </TableRow></TableHead>
          <TableBody>{compareRows.flatMap((section) => [
            <TableRow key={'head-' + section.heading}><TableCell colSpan={4}
              sx={{ fontWeight: 750, color: 'text.secondary', backgroundColor: 'background.default' }}>{section.heading}</TableCell></TableRow>,
            ...section.entries.map((item) => <TableRow key={section.heading + item.name}>
              <TableCell>{item.label}</TableCell><TableCell align="right">{item.a}</TableCell>
              <TableCell align="right">{item.b}</TableCell><TableCell align="right">{item.delta}</TableCell>
            </TableRow>),
          ])}</TableBody>
        </Table>
      </TableContainer>}
      {ids.length === 2 && <>
        <Box>
          <Typography variant="subtitle2">Retained arrays · overlay A / B</Typography>
          <Typography variant="caption" color="text.secondary">
            Select an array once to load it for both points. Only arrays stored for both configurations are listed.
          </Typography>
          {!commonOptions.length && <Alert severity="info" sx={{ mt: 1 }}>
            No common retained arrays were found for these two points.
          </Alert>}
          <Stack direction="row" spacing={0.8} useFlexGap sx={{ flexWrap: 'wrap', mt: 1 }}>
            {commonOptions.map((option) => <Button key={option.key} size="small"
              variant={selected.has(option.key) ? 'contained' : 'outlined'}
              onClick={() => setSelectedArrays((current) =>
                current.includes(option.key) ? current.filter((key) => key !== option.key) : [...current, option.key])}>
              {option.quantityName === option.arrayName ? option.quantityName : option.quantityName + ' · ' + option.arrayName}
            </Button>)}
          </Stack>
        </Box>
        {loading && <Typography variant="caption" color="text.secondary">Loading retained arrays for A and B…</Typography>}
        {readErrors.map((error, index) => <Alert key={index} severity="warning">{error}</Alert>)}
        {loaded.map((pair) => {
          const options = commonComponents(pair.a, pair.b)
          const component = options.includes(components[pair.key]) ? components[pair.key] :
            options.includes('magnitude') ? 'magnitude' : options[0]
          const a = component ? valuesFor(pair.a, component) : []
          const b = component ? valuesFor(pair.b, component) : []
          const compatible = sameTraceAxis(pair.a, pair.b)
            && a.length === pair.a.x.length && b.length === pair.b.x.length
          const x = pair.a.xKind === 'frequency_hz' ? pair.a.x.map((value) => value / 1e9) : pair.a.x
          const catalog = commonOptions.find((item) => item.key === pair.key)
          const label = catalog ? catalog.quantityName + ' · ' + catalog.arrayName : pair.key
          return <Paper key={pair.key} variant="outlined" sx={{ p: 1.5 }}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="subtitle2">{label}</Typography>
                {options.length > 1 && <FormControl size="small" sx={{ minWidth: 135, ml: 'auto' }}>
                  <InputLabel>View</InputLabel>
                  <Select label="View" value={component ?? ''} onChange={(event) =>
                    setComponents((current) => ({ ...current, [pair.key]: event.target.value as Component }))}>
                    {options.map((item) => <MenuItem value={item} key={item}>{item}</MenuItem>)}
                  </Select>
                </FormControl>}
              </Stack>
              {compatible
                ? <LineChart height={310}
                    xAxis={[{ data: x, label: pair.a.xKind === 'frequency_hz' ? 'Frequency / GHz' : 'Index' }]}
                    series={[
                      { data: a, label: 'A · Point ' + ids[0], color: '#2d6ca2', showMark: a.length < 90 },
                      { data: b, label: 'B · Point ' + ids[1], color: '#cf8a2f', showMark: b.length < 90 },
                    ]} grid={{ horizontal: true }} />
                : <Alert severity="warning">
                    The arrays for A and B use different X samples or incompatible components. No interpolation or misleading overlay was applied.
                  </Alert>}
            </Stack>
          </Paper>
        })}
      </>}
    </Stack>
  </Paper>
}
