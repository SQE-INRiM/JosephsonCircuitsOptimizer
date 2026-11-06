import { useContext, useEffect, useId, useMemo, useState } from 'react'
import { Alert, Box, Button, Chip, Divider, FormControl, InputLabel, MenuItem, Paper, Select, Slider, Stack, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { LineChart } from '@mui/x-charts/LineChart'
import type { ParameterSpec, ResultTable, RunResults } from '../types'
import { useAppStore } from '../store'
import { parameterLabel } from '../utils/resultUnits'
import {
  bestSample, linearObjectiveSlice, nearestStoredValue, optimizerParameterNames,
  objectiveHistoryForPlot, optimizerSamples, sampleOnSlice, storedValues,
} from '../utils/optimizationLandscape'
import type { LinearSlice, OptimizerSample } from '../utils/optimizationLandscape'
import { sequentialColor } from './HeatmapGrid'
import { initialLinearResultAxes, preferredResultAxes, ResultsAxesContext } from './ResultAxesContext'

type LandscapeMode = 'projection' | 'slice'

function displayNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value === 0) return '0'
  const absolute = Math.abs(value)
  return absolute < 1e-3 || absolute >= 1e4 ? value.toExponential(3) : Number(value.toPrecision(5)).toString()
}

function range(values: number[]): [number, number] {
  const finite = values.filter(Number.isFinite)
  if (!finite.length) return [0, 1]
  let lower = Math.min(...finite)
  let upper = Math.max(...finite)
  const padding = lower === upper ? (lower === 0 ? 1 : Math.abs(lower) * 0.06) : (upper - lower) * 0.04
  lower -= padding
  upper += padding
  return [lower, upper]
}

function cellEdges(centers: number[], fallback: number): Array<[number, number]> {
  return centers.map((value, index) => [
    index ? (centers[index - 1] + value) / 2 : value - (centers[1] == null ? fallback : centers[1] - value) / 2,
    index === centers.length - 1 ? value + (index ? value - centers[index - 1] : fallback) / 2 : (value + centers[index + 1]) / 2,
  ])
}

function OptimizerScatter({
  samples, allSamples, selectedIndex, onSelect, xName, yName, mode, slice, fixed, parameters, showPath,
}: {
  samples: OptimizerSample[]
  allSamples: OptimizerSample[]
  selectedIndex: number | null
  onSelect: (index: number) => void
  xName: string
  yName: string
  mode: LandscapeMode
  slice: LinearSlice | null
  fixed: Record<string, number>
  parameters: ParameterSpec[]
  showPath: boolean
}) {
  const theme = useTheme()
  const clipId = useId().replace(/:/g, '')
  const width = 960
  const height = 505
  const left = 105
  const right = 28
  const top = 25
  const bottom = 93
  const chartWidth = width - left - right
  const chartHeight = height - top - bottom

  const visible = samples.map((sample, index) => ({ sample, index }))
    .filter(({ sample }) => Number.isFinite(sample.values[xName]) && Number.isFinite(sample.values[yName]))
  const allCoordinates = allSamples.filter((sample) => Number.isFinite(sample.values[xName]) && Number.isFinite(sample.values[yName]))

  const xCellEdges = mode === 'slice' && slice && slice.x.length
    ? cellEdges(slice.x, 1e-15) : []
  const yCellEdges = mode === 'slice' && slice && slice.y.length
    ? cellEdges(slice.y, 1e-15) : []
  const xDomain = range([
    ...allCoordinates.map((sample) => sample.values[xName]),
    ...xCellEdges.flat(),
  ])
  const yDomain = range([
    ...allCoordinates.map((sample) => sample.values[yName]),
    ...yCellEdges.flat(),
  ])
  const xPosition = (value: number) => left + (value - xDomain[0]) / (xDomain[1] - xDomain[0]) * chartWidth
  const yPosition = (value: number) => top + chartHeight - (value - yDomain[0]) / (yDomain[1] - yDomain[0]) * chartHeight

  const metricValues = allSamples.map((sample) => sample.metric).filter(Number.isFinite)
  const linearValues = slice?.values.flat().filter((value): value is number => value != null && Number.isFinite(value)) ?? []
  const colorValues = mode === 'slice' && linearValues.length ? linearValues : metricValues
  const min = colorValues.length ? Math.min(...colorValues) : 0
  const max = colorValues.length ? Math.max(...colorValues) : 1
  const best = bestSample(samples)
  const linearMinimum = mode === 'slice' && slice && slice.x.length * slice.y.length > 1
    ? slice.values.flatMap((row, yi) => row.map((value, xi) =>
      value !== null && Number.isFinite(value)
        ? { x: slice.x[xi], y: slice.y[yi], metric: value }
        : null,
    )).reduce<{ x: number; y: number; metric: number } | null>((minimum, value) =>
      value && (!minimum || value.metric < minimum.metric) ? value : minimum, null)
    : null

  const dark = theme.palette.mode === 'dark'
  const ticks = Array.from({ length: 5 }, (_, index) => index / 4)
  const plotColor = theme.palette.text.secondary
  const points = visible.map(({ sample }) => ({
    x: xPosition(sample.values[xName]),
    y: yPosition(sample.values[yName]),
  }))
  const pathLine = points.map(({ x, y }) => x + ',' + y).join(' ')
  // Cap direction markers so exploration remains readable for long histories.
  const arrowEvery = Math.max(1, Math.ceil((points.length - 1) / 12))
  const pathColor = dark ? '#e5eaf0' : '#273d51'

  return <Stack spacing={1}>
    <Box sx={{ width: '100%', maxWidth: 1100, mx: 'auto' }}>
      <svg viewBox={'0 0 ' + width + ' ' + height} width="100%" role="img" aria-label="Optimizer evaluations in two-dimensional parameter space" style={{ display: 'block' }}>
        <defs><clipPath id={clipId}><rect x={left} y={top} width={chartWidth} height={chartHeight} /></clipPath></defs>
        <rect x={left} y={top} width={chartWidth} height={chartHeight} fill={dark ? '#172638' : '#f9fafb'} />
        <g clipPath={'url(#' + clipId + ')'}>
          {ticks.map((fraction) => <g key={'grid-' + fraction}>
            <line x1={left + fraction * chartWidth} x2={left + fraction * chartWidth} y1={top} y2={top + chartHeight} stroke={theme.palette.divider} strokeWidth={0.9} />
            <line x1={left} x2={left + chartWidth} y1={top + fraction * chartHeight} y2={top + fraction * chartHeight} stroke={theme.palette.divider} strokeWidth={0.9} />
          </g>)}
          {mode === 'slice' && slice && slice.values.flatMap((row, yi) => row.map((value, xi) => {
            const xEdges = xCellEdges[xi]
            const yEdges = yCellEdges[yi]
            const x0 = xPosition(xEdges[0])
            const x1 = xPosition(xEdges[1])
            const y0 = yPosition(yEdges[1])
            const y1 = yPosition(yEdges[0])
            // Draw singleton dimensions as a discrete marker, never as an
            // extrapolated region outside the sampled Linear coordinates.
            const singletonX = slice.x.length === 1
            const singletonY = slice.y.length === 1
            const cellX = singletonX ? xPosition(slice.x[xi]) - 8 : x0
            const cellY = singletonY ? yPosition(slice.y[yi]) - 8 : y0
            const cellWidth = singletonX ? 16 : Math.max(0, x1 - x0)
            const cellHeight = singletonY ? 16 : Math.max(0, y1 - y0)
            return <rect key={'cell-' + yi + '-' + xi} data-testid="optimizer-linear-slice-cell"
              x={cellX} y={cellY} width={cellWidth} height={cellHeight}
              fill={value == null ? (dark ? '#314052' : '#ffffff') : sequentialColor(value, min, max)}
              stroke={dark ? '#304258' : '#e8edf2'} strokeWidth={0.9}>
              <title>{xName + '=' + displayNumber(slice.x[xi]) + ', ' + yName + '=' + displayNumber(slice.y[yi]) + ': ' + (value == null ? 'masked / unavailable' : displayNumber(value))}</title>
            </rect>
          }))}
          {showPath && points.length > 1 && <>
            <polyline data-testid="optimizer-trajectory" points={pathLine} fill="none" stroke={dark ? '#122236' : '#ffffff'} strokeWidth={4} strokeLinejoin="round" opacity={0.88} pointerEvents="none" />
            <polyline points={pathLine} fill="none" stroke={pathColor} strokeWidth={1.7} strokeLinejoin="round" opacity={0.88} pointerEvents="none" />
            {points.slice(1).map((point, index) => {
              if (index % arrowEvery !== 0) return null
              const previous = points[index]
              const dx = point.x - previous.x
              const dy = point.y - previous.y
              const length = Math.hypot(dx, dy)
              if (length < 22) return null
              const ux = dx / length
              const uy = dy / length
              const centerX = previous.x + dx * 0.63
              const centerY = previous.y + dy * 0.63
              const tip = [centerX + ux * 7, centerY + uy * 7]
              const left = [centerX - ux * 5 - uy * 4.5, centerY - uy * 5 + ux * 4.5]
              const right = [centerX - ux * 5 + uy * 4.5, centerY - uy * 5 - ux * 4.5]
              return <polygon key={'direction-' + index} points={[tip, left, right].map((p) => p.join(',')).join(' ')} fill={pathColor} pointerEvents="none" />
            })}
          </>}
          {visible.map(({ sample, index }) => {
            const onSlice = mode !== 'slice' || sampleOnSlice(sample, fixed)
            const isSelected = selectedIndex === index
            const centerX = xPosition(sample.values[xName])
            const centerY = yPosition(sample.values[yName])
            return <circle key={'sample-' + index} cx={centerX} cy={centerY} r={isSelected ? 7 : 5.5}
              fill={mode === 'slice' ? (onSlice ? '#ffffff' : '#aeb8c3') : sequentialColor(sample.metric, min, max)}
              stroke={isSelected ? '#f59e0b' : mode === 'slice' ? '#182e45' : (dark ? '#f3f6fa' : '#12283c')}
              strokeWidth={isSelected ? 3 : 1.5}
              opacity={mode === 'slice' && !onSlice ? 0.34 : 0.9}
              role="button" tabIndex={0}
              aria-label={'Evaluation ' + displayNumber(sample.evaluation) + ', objective ' + displayNumber(sample.metric)}
              onClick={() => onSelect(index)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(index) } }}
              style={{ cursor: 'pointer' }}>
              <title>{'Evaluation ' + sample.evaluation + ' | metric ' + displayNumber(sample.metric) + ' | ' + xName + '=' + displayNumber(sample.values[xName]) + ', ' + yName + '=' + displayNumber(sample.values[yName]) + (mode === 'slice' ? (onSlice ? ' | on slice' : ' | projected from off-slice') : '')}</title>
            </circle>
          })}
          {linearMinimum && <polygon data-testid="linear-slice-minimum"
            points={[
              [xPosition(linearMinimum.x), yPosition(linearMinimum.y) - 6.5],
              [xPosition(linearMinimum.x) + 6.5, yPosition(linearMinimum.y)],
              [xPosition(linearMinimum.x), yPosition(linearMinimum.y) + 6.5],
              [xPosition(linearMinimum.x) - 6.5, yPosition(linearMinimum.y)],
            ].map((point) => point.join(',')).join(' ')}
            fill={dark ? '#10283f' : '#193851'} stroke="#ffffff" strokeWidth={1.9}
            pointerEvents="none">
            <title>{'Lowest Linear value in displayed slice: ' + displayNumber(linearMinimum.metric)}</title>
          </polygon>}
          {best && Number.isFinite(best.values[xName]) && Number.isFinite(best.values[yName]) && <circle
            cx={xPosition(best.values[xName])} cy={yPosition(best.values[yName])} r={11} fill="none" stroke="#d18a23" strokeWidth={3.6} pointerEvents="none" />}

        </g>
        <rect x={left} y={top} width={chartWidth} height={chartHeight} fill="none" stroke={theme.palette.divider} />
        {ticks.map((fraction) => {
          const xValue = xDomain[0] + fraction * (xDomain[1] - xDomain[0])
          const yValue = yDomain[0] + fraction * (yDomain[1] - yDomain[0])
          return <g key={'tick-' + fraction} fill={plotColor} fontSize={14}>
            <text x={left + fraction * chartWidth} y={top + chartHeight + 24} textAnchor="middle">{displayNumber(xValue)}</text>
            <text x={left - 12} y={yPosition(yValue) + 5} textAnchor="end">{displayNumber(yValue)}</text>
          </g>
        })}
        <text x={left + chartWidth / 2} y={height - 14} fill={plotColor} textAnchor="middle" fontSize={17} fontWeight={600}>{parameterLabel(parameters, xName)}</text>
        <text transform={'translate(22 ' + (top + chartHeight / 2) + ') rotate(-90)'} fill={plotColor} textAnchor="middle" fontSize={17} fontWeight={600}>{parameterLabel(parameters, yName)}</text>
      </svg>
    </Box>
    <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
      <Typography variant="caption" sx={{ color: '#b67b21', fontWeight: 700 }}>◯ Best sampled</Typography>
      {showPath && samples.length > 1 && <Typography variant="caption" color="text.secondary">→ Evaluation order</Typography>}
      {mode === 'slice' && <>
        {linearMinimum && <Typography variant="caption" color="text.secondary">◆ Linear slice min</Typography>}
        <Typography variant="caption" color="text.secondary">● Pale: off-slice</Typography>
      </>}
      <Box sx={{ flexGrow: 1 }} />
      <Typography variant="caption" color="text.secondary">{displayNumber(min)}</Typography>
      <Box sx={{ width: 150, height: 8, borderRadius: 8, background: 'linear-gradient(90deg,#edf4fa,#4489ab,#eaad38)' }} />
      <Typography variant="caption" color="text.secondary">{displayNumber(max)}</Typography>
      <Typography variant="caption" color="text.secondary">{mode === 'slice' ? 'Linear metric' : 'Sampled metric'}</Typography>
    </Stack>
    {best && <Typography variant="caption" color="text.secondary">
      Best sampled: {displayNumber(best.metric)} · eval {displayNumber(best.evaluation)}
    </Typography>}
  </Stack>
}

export function OptimizationResultsView({ run, table }: { run: RunResults; table: ResultTable }) {
  const parameters = useAppStore((state) => state.project.parameters)
  const samples = useMemo(() => optimizerSamples(table), [table])
  const names = useMemo(() => optimizerParameterNames(table), [table])
  const varying = names.filter((name) => new Set(samples.map((sample) => sample.values[name]).filter(Number.isFinite)).size > 1)
  const axesContext = useContext(ResultsAxesContext)
  const initialAxes = preferredResultAxes(
    names,
    { x: varying[0] ?? names[0] ?? '', y: varying[1] ?? names.find((name) => name !== varying[0]) ?? '' },
    // Match the Linear tab before either tab has been visited, but keep
    // explicit Optimization overrides independent and editable.
    axesContext?.optimization ?? axesContext?.linear ??
      (run.linear ? initialLinearResultAxes(run.linear) : undefined),
  )
  const [view, setView] = useState<'landscape' | 'history'>('landscape')
  const [showPath, setShowPath] = useState(true)
  const [showFixedControls, setShowFixedControls] = useState(false)
  const [x, setX] = useState(initialAxes.x)
  const [y, setY] = useState(initialAxes.y)
  const [mode, setMode] = useState<LandscapeMode>(run.linear ? 'slice' : 'projection')
  const [count, setCount] = useState(samples.length)
  const [fixedOverrides, setFixedOverrides] = useState<Record<string, number>>({})
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  useEffect(() => { setCount(samples.length) }, [samples.length])

  const shownCount = Math.max(1, Math.min(count, samples.length))
  const shown = samples.slice(0, shownCount)
  const currentBest = bestSample(shown)
  const overallBest = bestSample(samples)
  const linear = run.linear
  const linearParameterStart = linear ? Math.max(0, linear.columns.indexOf('point_id') + 1) : 0
  const linearMetricIndex = linear?.columns.indexOf('metric') ?? -1
  const linearNames = linear && linearMetricIndex > linearParameterStart ? linear.columns.slice(linearParameterStart, linearMetricIndex) : []
  const variedLinear = linearNames.filter((name) => linear && storedValues(linear, name).length > 1)
  const compatible = Boolean(linear && names.every((name) => linear.columns.includes(name))
    && variedLinear.every((name) => names.includes(name)))
  // Even a one-cell Linear dataset is a valid exact slice: it locates
  // an optimization sample, although it cannot form a two-dimensional heatmap.
  const canSlice = compatible && x !== y && Boolean(linear)
    && storedValues(linear!, x).length >= 1 && storedValues(linear!, y).length >= 1
  const effectiveMode: LandscapeMode = mode === 'slice' && canSlice ? 'slice' : 'projection'
  const otherNames = linear ? names.filter((name) => name !== x && name !== y && linear.columns.includes(name)) : []
  const fixed = otherNames.reduce<Record<string, number>>((values, name) => {
    const options = linear ? storedValues(linear, name) : []
    const proposed = fixedOverrides[name]
    const value = options.includes(proposed) ? proposed : nearestStoredValue(options, overallBest?.values[name])
    if (value !== undefined) values[name] = value
    return values
  }, {})
  const fixedKey = JSON.stringify(fixed)
  const slice = useMemo(() => canSlice && effectiveMode === 'slice' && linear
    ? linearObjectiveSlice(linear, x, y, fixed) : null,
  [canSlice, effectiveMode, linear, x, y, fixedKey])

  const evaluations = samples.map((sample) => sample.evaluation)
  const { evaluated: metrics, bestSoFar: bestHistory } = objectiveHistoryForPlot(samples)
  // A single evaluated (or unmasked) point is not a history curve.
  const historyAvailable = metrics.filter((value) => value !== null).length >= 2
  useEffect(() => { if (!historyAvailable) setView('landscape') }, [historyAvailable])
  const selected = selectedIndex == null || selectedIndex >= shown.length ? null : shown[selectedIndex]
  const display = (name: string) => parameterLabel(parameters, name)
  const canPlot = x !== y && names.length >= 2
  const chooseX = (next: string) => {
    const nextY = next === y ? (names.find((name) => name !== next) ?? '') : y
    setX(next)
    setY(nextY)
    axesContext?.onChange('optimization', { x: next, y: nextY })
  }
  const chooseY = (next: string) => {
    const nextX = next === x ? (names.find((name) => name !== next) ?? '') : x
    setX(nextX)
    setY(next)
    axesContext?.onChange('optimization', { x: nextX, y: next })
  }

  if (!samples.length) return <Alert severity="info">No optimizer evaluations with finite objective values are available.</Alert>

  return <Stack spacing={1.1}>
    <Paper variant="outlined" sx={{ p: 0.9 }}>
      <Stack direction="row" useFlexGap spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700, mr: 'auto' }}>
          {view === 'landscape' ? 'Optimization landscape' : 'Optimization history'}
        </Typography>
        <Button size="small" variant={view === 'landscape' ? 'contained' : 'outlined'} onClick={() => setView('landscape')}>Landscape</Button>
        <Button size="small" variant={view === 'history' ? 'contained' : 'outlined'} disabled={!historyAvailable} onClick={() => setView('history')}>History</Button>
        <Chip size="small" variant="outlined" label={samples.length.toLocaleString() + ' evaluations'} />
      </Stack>
    </Paper>
    {view === 'landscape' && <Paper variant="outlined" sx={{ p: 1.2 }}>
      <Stack spacing={0.9}>
        {canPlot ? <>
          <Stack direction="row" useFlexGap spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 140, width: 148 }}>
              <InputLabel id="optimizer-x-label">X axis</InputLabel>
              <Select labelId="optimizer-x-label" label="X axis" value={x} onChange={(event) => chooseX(event.target.value)}>
                {names.map((name) => <MenuItem key={name} value={name}>{display(name)}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140, width: 148 }}>
              <InputLabel id="optimizer-y-label">Y axis</InputLabel>
              <Select labelId="optimizer-y-label" label="Y axis" value={y} onChange={(event) => chooseY(event.target.value)}>
                {names.map((name) => <MenuItem key={name} value={name}>{display(name)}</MenuItem>)}
              </Select>
            </FormControl>
            <Button size="small" variant={effectiveMode === 'projection' ? 'contained' : 'outlined'} onClick={() => setMode('projection')}>Projection</Button>
            <Button size="small" variant={effectiveMode === 'slice' ? 'contained' : 'outlined'} disabled={!canSlice} onClick={() => setMode('slice')}>Slice · Linear</Button>
            <Button size="small" variant={showPath ? 'contained' : 'outlined'} color="inherit" onClick={() => setShowPath((current) => !current)} aria-pressed={showPath}>Trajectory</Button>
            {effectiveMode === 'slice' && otherNames.length > 0 && <>
              <Button size="small" variant={showFixedControls ? 'outlined' : 'text'}
                aria-expanded={showFixedControls} onClick={() => setShowFixedControls((current) => !current)}>
                {showFixedControls ? 'Hide fixed' : 'Fixed values'} ({otherNames.length})
              </Button>
              <Typography variant="caption" color="text.secondary" title={otherNames.map((name) => display(name) + '=' + displayNumber(fixed[name])).join(' · ')}
                sx={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {otherNames.map((name) => display(name) + '=' + displayNumber(fixed[name])).join(' · ')}
              </Typography>
            </>}
          </Stack>
          {effectiveMode === 'slice' && otherNames.length > 0 && showFixedControls && <Stack direction="row" useFlexGap spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            {otherNames.map((name) => <FormControl size="small" sx={{ minWidth: 155 }} key={name}>
              <InputLabel id={'optimizer-fixed-' + name}>{display(name)}</InputLabel>
              <Select labelId={'optimizer-fixed-' + name} label={display(name)} value={fixed[name] ?? ''} onChange={(event) => setFixedOverrides((previous) => ({ ...previous, [name]: Number(event.target.value) }))}>
                {storedValues(linear!, name).map((value) => <MenuItem key={value} value={value}>{displayNumber(value)}</MenuItem>)}
              </Select>
            </FormControl>)}
          </Stack>}
          {!canSlice && effectiveMode === 'projection' && <Typography variant="caption" color="text.secondary">Linear slice unavailable for these axes</Typography>}
          <OptimizerScatter samples={shown} allSamples={samples} selectedIndex={selectedIndex} onSelect={setSelectedIndex}
            xName={x} yName={y} mode={effectiveMode} slice={slice} fixed={fixed} parameters={parameters} showPath={showPath} />
          {selected && <Paper variant="outlined" sx={{ p: 1.1 }}>
            <Stack direction="row" useFlexGap spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="subtitle2">Selected evaluation {displayNumber(selected.evaluation)}</Typography>
              <Chip size="small" variant="outlined" label={'metric = ' + displayNumber(selected.metric)} />
              {names.map((name) => <Chip key={name} size="small" variant="outlined" label={display(name) + ' = ' + displayNumber(selected.values[name])} />)}
              {effectiveMode === 'slice' && <Chip size="small" variant="outlined" label={sampleOnSlice(selected, fixed) ? 'On Linear slice' : 'Projected (off slice)'} />}
            </Stack>
          </Paper>}
          <Box sx={{ maxWidth: 670, width: '100%', mx: 'auto', px: 1 }}>
            <Typography variant="caption" sx={{ mb: 0.6, display: 'block' }} color="text.secondary">
              {shown.length} / {samples.length} evaluations · best {displayNumber(currentBest?.metric)}
            </Typography>
            <Slider aria-label="Evaluations shown" value={shownCount} min={1} max={samples.length} step={1}
              disabled={samples.length <= 1} valueLabelDisplay="auto" onChange={(_, value) => setCount(value as number)} />
          </Box>
        </> : <Alert severity="info">At least two parameter columns are required to display a two-dimensional optimization landscape.</Alert>}
      </Stack>
    </Paper>}
    {view === 'history' && historyAvailable && <Stack spacing={1.5}>
    <Paper variant="outlined" sx={{ p: 1.7 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>Objective</Typography>
      <LineChart height={290} margin={{ bottom: 45, left: 80 }}
        xAxis={[{ data: evaluations, scaleType: 'linear', label: 'Evaluation number', tickMinStep: 1, valueFormatter: (value: number | null) => displayNumber(value) }]}
        yAxis={[{ label: 'metric', width: 80, valueFormatter: (value: number | null) => displayNumber(value) }]}
        series={[
          { data: metrics, label: 'Evaluated objective', showMark: samples.length <= 60, curve: 'linear', valueFormatter: (value: number | null) => displayNumber(value) },
          { data: bestHistory, label: 'Best so far', showMark: samples.length <= 60, curve: 'linear', valueFormatter: (value: number | null) => displayNumber(value) },
        ]} grid={{ horizontal: true }} />
    </Paper>
    <Divider sx={{ my: 0.6 }} />
    <Stack spacing={1}>
      <Typography variant="h6">Parameters</Typography>
      {names.length ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.2 }}>
        {names.map((name) => <Paper key={name} variant="outlined" sx={{ p: 1.1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.8 }}>{display(name)}</Typography>
          <LineChart height={215} margin={{ bottom: 38, left: 80 }}
            xAxis={[{ data: evaluations, scaleType: 'linear', label: 'Evaluation number', tickMinStep: 1, valueFormatter: (value: number | null) => displayNumber(value) }]}
            yAxis={[{ label: display(name), width: 84, valueFormatter: (value: number | null) => displayNumber(value) }]}
            series={[{ data: samples.map((sample) => Number.isFinite(sample.values[name]) ? sample.values[name] : null), label: display(name), showMark: samples.length <= 60, curve: 'linear', valueFormatter: (value: number | null) => displayNumber(value) }]}
            grid={{ horizontal: true }} />
        </Paper>)}
      </Box> : <Alert severity="info">No optimizer parameter columns are available.</Alert>}
    </Stack>
    </Stack>}
  </Stack>
}
