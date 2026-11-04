import { useEffect, useId, useMemo, useState } from 'react'
import { Alert, Box, Button, Chip, Divider, FormControl, InputLabel, MenuItem, Paper, Select, Slider, Stack, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { LineChart } from '@mui/x-charts/LineChart'
import type { ParameterSpec, ResultTable, RunResults } from '../types'
import { useAppStore } from '../store'
import { parameterLabel } from '../utils/resultUnits'
import {
  bestSample, linearObjectiveSlice, nearestStoredValue, optimizerParameterNames,
  optimizerSamples, runningBest, sampleOnSlice, storedValues,
} from '../utils/optimizationLandscape'
import type { LinearSlice, OptimizerSample } from '../utils/optimizationLandscape'
import { sequentialColor } from './HeatmapGrid'

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
  samples, allSamples, selectedIndex, onSelect, xName, yName, mode, slice, fixed, parameters,
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
  const bestIndex = best ? samples.indexOf(best) : -1
  const gridBest = mode === 'slice' && slice
    ? slice.values.flatMap((row, yi) => row.map((value, xi) => value == null
      ? null : { x: slice.x[xi], y: slice.y[yi], value })).filter((point): point is { x: number; y: number; value: number } => point !== null)
      .reduce<{ x: number; y: number; value: number } | null>((lowest, point) => !lowest || point.value < lowest.value ? point : lowest, null)
    : null
  const dark = theme.palette.mode === 'dark'
  const ticks = Array.from({ length: 5 }, (_, index) => index / 4)
  const plotColor = theme.palette.text.secondary

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
            return <rect key={'cell-' + yi + '-' + xi} x={x0} y={y0} width={Math.max(0, x1 - x0)} height={Math.max(0, y1 - y0)}
              fill={value == null ? (dark ? '#314052' : '#ffffff') : sequentialColor(value, min, max)}
              stroke={dark ? '#304258' : '#e8edf2'} strokeWidth={0.9}>
              <title>{xName + '=' + displayNumber(slice.x[xi]) + ', ' + yName + '=' + displayNumber(slice.y[yi]) + ': ' + (value == null ? 'masked / unavailable' : displayNumber(value))}</title>
            </rect>
          }))}
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
          {best && Number.isFinite(best.values[xName]) && Number.isFinite(best.values[yName]) && <circle
            cx={xPosition(best.values[xName])} cy={yPosition(best.values[yName])} r={11} fill="none" stroke="#d18a23" strokeWidth={3.6} pointerEvents="none" />}
          {gridBest && <polygon
            points={[
              [xPosition(gridBest.x), yPosition(gridBest.y) - 10],
              [xPosition(gridBest.x) + 10, yPosition(gridBest.y)],
              [xPosition(gridBest.x), yPosition(gridBest.y) + 10],
              [xPosition(gridBest.x) - 10, yPosition(gridBest.y)],
            ].map((point) => point.join(',')).join(' ')}
            fill="#183951" stroke="#ffffff" strokeWidth={2} pointerEvents="none">
            <title>{'Lowest stored Linear cell: ' + displayNumber(gridBest.value)}</title>
          </polygon>}
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
      <Typography variant="caption" color="text.secondary">{samples.length.toLocaleString()} evaluations displayed</Typography>
      <Typography variant="caption" sx={{ color: '#b67b21', fontWeight: 700 }}>◯ Best sampled</Typography>
      {mode === 'slice' && <><Typography variant="caption" color="text.secondary">● White: on slice · Grey: projected</Typography><Typography variant="caption" color="text.secondary">◆ Lowest Linear grid cell</Typography></>}
      <Box sx={{ flexGrow: 1 }} />
      <Typography variant="caption" color="text.secondary">{displayNumber(min)}</Typography>
      <Box sx={{ width: 150, height: 8, borderRadius: 8, background: 'linear-gradient(90deg,#edf4fa,#4489ab,#eaad38)' }} />
      <Typography variant="caption" color="text.secondary">{displayNumber(max)}</Typography>
      <Typography variant="caption" color="text.secondary">{mode === 'slice' ? 'Linear metric' : 'Sampled metric'}</Typography>
    </Stack>
    {bestIndex >= 0 && <Typography variant="body2" color="text.secondary">
      Best sampled through evaluation {displayNumber(samples[bestIndex].evaluation)}: {displayNumber(best!.metric)}.
      A lowest sampled or gridded value is not evidence of the global minimum.
    </Typography>}
  </Stack>
}

export function OptimizationResultsView({ run, table }: { run: RunResults; table: ResultTable }) {
  const parameters = useAppStore((state) => state.project.parameters)
  const samples = useMemo(() => optimizerSamples(table), [table])
  const names = useMemo(() => optimizerParameterNames(table), [table])
  const varying = names.filter((name) => new Set(samples.map((sample) => sample.values[name]).filter(Number.isFinite)).size > 1)
  const [x, setX] = useState(varying[0] ?? names[0] ?? '')
  const [y, setY] = useState(varying[1] ?? names.find((name) => name !== x) ?? '')
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
  const canSlice = compatible && x !== y && Boolean(linear)
    && storedValues(linear!, x).length >= 2 && storedValues(linear!, y).length >= 2
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

  const evaluations = shown.map((sample) => sample.evaluation)
  const metrics = shown.map((sample) => sample.metric)
  const bestHistory = runningBest(shown)
  const selected = selectedIndex == null || selectedIndex >= shown.length ? null : shown[selectedIndex]
  const display = (name: string) => parameterLabel(parameters, name)
  const canPlot = x !== y && names.length >= 2
  const chooseX = (next: string) => {
    setX(next)
    if (next === y) setY(names.find((name) => name !== next) ?? '')
  }
  const chooseY = (next: string) => {
    setY(next)
    if (next === x) setX(names.find((name) => name !== next) ?? '')
  }

  if (!samples.length) return <Alert severity="info">No optimizer evaluations with finite objective values are available.</Alert>

  return <Stack spacing={2}>
    <Paper variant="outlined" sx={{ p: 1.6 }}>
      <Stack spacing={1.6}>
        <Stack direction="row" useFlexGap spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="h6">Optimization landscape</Typography>
          <Chip size="small" label={samples.length.toLocaleString() + ' optimizer evaluations'} variant="outlined" />
        </Stack>
        {canPlot ? <>
          <Stack direction="row" useFlexGap spacing={1.1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel id="optimizer-x-label">X axis</InputLabel>
              <Select labelId="optimizer-x-label" label="X axis" value={x} onChange={(event) => chooseX(event.target.value)}>
                {names.map((name) => <MenuItem key={name} value={name}>{display(name)}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel id="optimizer-y-label">Y axis</InputLabel>
              <Select labelId="optimizer-y-label" label="Y axis" value={y} onChange={(event) => chooseY(event.target.value)}>
                {names.map((name) => <MenuItem key={name} value={name}>{display(name)}</MenuItem>)}
              </Select>
            </FormControl>
            <Button size="small" variant={effectiveMode === 'projection' ? 'contained' : 'outlined'} onClick={() => setMode('projection')}>Projection</Button>
            <Button size="small" variant={effectiveMode === 'slice' ? 'contained' : 'outlined'} disabled={!canSlice} onClick={() => setMode('slice')}>Slice · Linear</Button>
          </Stack>
          {effectiveMode === 'slice' && otherNames.length > 0 && <Stack direction="row" useFlexGap spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">Fixed Linear coordinates:</Typography>
            {otherNames.map((name) => <FormControl size="small" sx={{ minWidth: 155 }} key={name}>
              <InputLabel id={'optimizer-fixed-' + name}>{display(name)}</InputLabel>
              <Select labelId={'optimizer-fixed-' + name} label={display(name)} value={fixed[name] ?? ''} onChange={(event) => setFixedOverrides((previous) => ({ ...previous, [name]: Number(event.target.value) }))}>
                {storedValues(linear!, name).map((value) => <MenuItem key={value} value={value}>{displayNumber(value)}</MenuItem>)}
              </Select>
            </FormControl>)}
          </Stack>}
          {effectiveMode === 'slice' ? <Typography variant="body2" color="text.secondary">
            Exact stored Linear metric cells, with no interpolation. Only points matching all fixed coordinates belong to this slice; grey points are 2D projections of other optimizer evaluations.
          </Typography> : <Typography variant="body2" color="text.secondary">
            Every evaluated configuration projected onto two selected parameters. Point color encodes its own evaluated objective; no surrogate surface is assumed.
            {!canSlice ? ' A compatible two-parameter Linear grid is unavailable for this run and axis pair.' : ''}
          </Typography>}
          <OptimizerScatter samples={shown} allSamples={samples} selectedIndex={selectedIndex} onSelect={setSelectedIndex}
            xName={x} yName={y} mode={effectiveMode} slice={slice} fixed={fixed} parameters={parameters} />
          {selected && <Paper variant="outlined" sx={{ p: 1.1 }}>
            <Stack direction="row" useFlexGap spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="subtitle2">Selected evaluation {displayNumber(selected.evaluation)}</Typography>
              <Chip size="small" variant="outlined" label={'metric = ' + displayNumber(selected.metric)} />
              {names.map((name) => <Chip key={name} size="small" variant="outlined" label={display(name) + ' = ' + displayNumber(selected.values[name])} />)}
              {effectiveMode === 'slice' && <Chip size="small" variant="outlined" label={sampleOnSlice(selected, fixed) ? 'On Linear slice' : 'Projected (off slice)'} />}
            </Stack>
          </Paper>}
          <Box sx={{ maxWidth: 670, width: '100%', mx: 'auto', px: 1 }}>
            <Typography variant="body2" sx={{ mb: 0.8 }} color="text.secondary">
              Evaluations shown: {shown.length} / {samples.length} · current best: {displayNumber(currentBest?.metric)}
            </Typography>
            <Slider aria-label="Evaluations shown" value={shownCount} min={1} max={samples.length} step={1}
              disabled={samples.length <= 1} valueLabelDisplay="auto" onChange={(_, value) => setCount(value as number)} />
          </Box>
        </> : <Alert severity="info">At least two parameter columns are required to display a two-dimensional optimization landscape.</Alert>}
      </Stack>
    </Paper>
    <Paper variant="outlined" sx={{ p: 1.7 }}>
      <Typography variant="h6">Best sampled objective</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Evaluated objective and running minimum versus evaluation number. The plotted history follows the same evaluation limit as the landscape.</Typography>
      <LineChart height={355} margin={{ bottom: 55, left: 90 }}
        xAxis={[{ data: evaluations, scaleType: 'linear', label: 'Evaluation number', tickMinStep: 1, valueFormatter: (value: number | null) => displayNumber(value) }]}
        yAxis={[{ label: 'metric', width: 80, valueFormatter: (value: number | null) => displayNumber(value) }]}
        series={[
          { data: metrics, label: 'Evaluated objective', showMark: shown.length <= 60, curve: 'linear', valueFormatter: (value: number | null) => displayNumber(value) },
          { data: bestHistory, label: 'Best so far', showMark: shown.length <= 60, curve: 'linear', valueFormatter: (value: number | null) => displayNumber(value) },
        ]} grid={{ horizontal: true }} />
    </Paper>
    <Divider sx={{ my: 0.6 }} />
    <Stack spacing={1}>
      <Typography variant="h6">Parameter history</Typography>
      <Typography variant="body2" color="text.secondary">Every optimizer parameter, including constant ones, plotted at its raw stored value. No metric weighting or normalization.</Typography>
      {names.length ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' }, gap: 1.4 }}>
        {names.map((name) => <Paper key={name} variant="outlined" sx={{ p: 1.3, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.8 }}>{display(name)}</Typography>
          <LineChart height={280} margin={{ bottom: 45, left: 95 }}
            xAxis={[{ data: evaluations, scaleType: 'linear', label: 'Evaluation number', tickMinStep: 1, valueFormatter: (value: number | null) => displayNumber(value) }]}
            yAxis={[{ label: display(name), width: 84, valueFormatter: (value: number | null) => displayNumber(value) }]}
            series={[{ data: shown.map((sample) => Number.isFinite(sample.values[name]) ? sample.values[name] : null), label: display(name), showMark: shown.length <= 60, curve: 'linear', valueFormatter: (value: number | null) => displayNumber(value) }]}
            grid={{ horizontal: true }} />
        </Paper>)}
      </Box> : <Alert severity="info">No optimizer parameter columns are available.</Alert>}
    </Stack>
  </Stack>
}
