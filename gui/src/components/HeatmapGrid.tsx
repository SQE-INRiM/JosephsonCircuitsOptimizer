import { Box, Stack, Typography } from '@mui/material'
import { useAppStore } from '../store'
import type { SourceAmplitudeUnit } from '../types'
import { parameterLabel, sourceCoordinateLabel } from '../utils/resultUnits'

interface HeatmapGridProps {
  xLabels: Array<string | number>
  yLabels: Array<string | number>
  values: Array<Array<number | null>>
  valueLabel: string
  xAxisLabel?: string
  yAxisLabel?: string
  amplitudeUnit?: SourceAmplitudeUnit
  diverging?: boolean
  formatValue?: (value: number) => string
  onCellClick?: (rowIndex: number, columnIndex: number, value: number) => void
  selectedCell?: { rowIndex: number; columnIndex: number } | null
}

function interpolate(a: number, b: number, t: number) { return Math.round(a + (b - a) * t) }
function sequentialColor(value: number, min: number, max: number) {
  const t = max === min ? 0.5 : (value - min) / (max - min)
  const from = [237, 244, 250]; const middle = [68, 137, 171]; const to = [234, 173, 56]
  const local = t < 0.5 ? t * 2 : (t - 0.5) * 2; const left = t < 0.5 ? from : middle; const right = t < 0.5 ? middle : to
  return `rgb(${interpolate(left[0], right[0], local)},${interpolate(left[1], right[1], local)},${interpolate(left[2], right[2], local)})`
}
function divergingColor(value: number) {
  const t = Math.min(1, Math.abs(value)); const neutral = [246, 247, 248]; const end = value < 0 ? [49, 111, 151] : [210, 137, 48]
  return `rgb(${interpolate(neutral[0], end[0], t)},${interpolate(neutral[1], end[1], t)},${interpolate(neutral[2], end[2], t)})`
}

export function HeatmapGrid({ xLabels, yLabels, values, valueLabel, xAxisLabel, yAxisLabel, amplitudeUnit = 'A', diverging = false, formatValue, onCellClick, selectedCell }: HeatmapGridProps) {
  const projectParameters = useAppStore((state) => state.project.parameters)
  const axisLabel = (label?: string) => {
    if (!label) return ''
    const parameter = parameterLabel(projectParameters, label)
    return parameter !== label ? parameter : sourceCoordinateLabel(label, amplitudeUnit)
  }
  const axisValue = (axisName: string | undefined, value: string | number) => {
    if (axisName && /^source_\d+_frequency$/i.test(axisName)) {
      const numeric = Number(value)
      if (Number.isFinite(numeric)) return numeric.toFixed(2)
    }
    return value
  }
  const finite = values.flat().filter((value): value is number => value !== null && Number.isFinite(value))
  const min = finite.length ? Math.min(...finite) : 0; const max = finite.length ? Math.max(...finite) : 1

  // Sequential landscapes must fit the available panel without horizontal scrolling.
  // Every data column gets exactly one equally-sized CSS-grid column. Long numerical
  // labels are rotated inside that same column, so their correspondence is explicit.
  const columns = `${diverging ? 88 : 76}px repeat(${xLabels.length}, minmax(0, 1fr))`

  // Sequential landscapes represent physical X/Y axes. DOM rows run top-to-bottom,
  // so reverse them to keep the numerical Y axis increasing bottom-to-top.
  // Correlation matrices are categorical/symmetric and keep their original row order.
  const displayedRows = values.map((row, index) => ({ row, originalIndex: index, label: yLabels[index] }))
  if (!diverging) displayedRows.reverse()

  const displayedSelected = selectedCell && !diverging
    ? { rowIndex: values.length - 1 - selectedCell.rowIndex, columnIndex: selectedCell.columnIndex }
    : selectedCell
  const interactiveLandscape = Boolean(onCellClick) && !diverging

  return <Stack className={interactiveLandscape ? 'jco-interactive-landscape-heatmap' : undefined} spacing={1.1} sx={{ width: '100%', maxWidth: diverging ? undefined : 1240, mx: diverging ? undefined : 'auto', pb: 0.5 }}>
    <Stack direction="row" spacing={1} sx={{ alignItems: 'stretch', minWidth: 0 }}>
      {yAxisLabel && <Typography variant="caption" color="text.secondary" sx={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', textAlign: 'center', alignSelf: 'center', fontWeight: 700 }}>{axisLabel(yAxisLabel)}</Typography>}
      <Box className="heatmap-grid" sx={{ gridTemplateColumns: columns, flex: 1, minWidth: 0, '& .heatmap-cell': { minHeight: diverging ? 30 : 26 } }}>
        {displayedRows.map(({ row, originalIndex, label }, displayRowIndex) => [
          <Typography key={`label-${label}-${displayRowIndex}`} variant="caption" color="text.secondary" sx={{ pr: 1, textAlign: 'right', alignSelf: 'center', whiteSpace: 'nowrap' }}>{axisValue(yAxisLabel, label)}</Typography>,
          ...row.map((value, columnIndex) => {
            const selected = displayedSelected?.rowIndex === displayRowIndex && displayedSelected?.columnIndex === columnIndex
            const masked = value === null || !Number.isFinite(value)
            const displayedY = axisValue(yAxisLabel, label)
            const displayedX = axisValue(xAxisLabel, xLabels[columnIndex])
            return <Box key={`${displayRowIndex}-${columnIndex}`} className="heatmap-cell" title={masked ? `${displayedY} × ${displayedX} · ${valueLabel}: masked / unavailable` : `${displayedY} × ${displayedX} · ${valueLabel}: ${formatValue ? formatValue(value) : value}`} onClick={masked || !onCellClick ? undefined : () => onCellClick(originalIndex, columnIndex, value)} sx={{ backgroundColor: masked ? '#ffffff' : diverging ? divergingColor(value) : sequentialColor(value, min, max), cursor: masked || !onCellClick ? 'default' : 'pointer', outline: selected ? '3px solid' : undefined, outlineColor: selected ? 'text.primary' : undefined, outlineOffset: selected ? '-3px' : undefined }} />
          }),
        ])}
        <Box />
        {xLabels.map((label, index) => diverging
          ? <Typography key={`x-${label}-${index}`} variant="caption" color="text.secondary" sx={{ textAlign: 'center', pt: 0.5, whiteSpace: 'nowrap' }}>{axisValue(xAxisLabel, label)}</Typography>
          : <Box key={`x-${label}-${index}`} title={String(axisValue(xAxisLabel, label))} sx={{ height: 96, position: 'relative', overflow: 'visible' }}>
              <Typography variant="caption" color="text.secondary" sx={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%) rotate(-55deg)', transformOrigin: 'top center', whiteSpace: 'nowrap', fontSize: 10.5, lineHeight: 1 }}>{axisValue(xAxisLabel, label)}</Typography>
            </Box>)}
      </Box>
    </Stack>
    {xAxisLabel && <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', fontWeight: 700, mt: '6px !important' }}>{axisLabel(xAxisLabel)}</Typography>}
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
      <Typography variant="caption" color="text.secondary">{finite.length ? (formatValue ? formatValue(min) : min) : '—'}</Typography>
      <Box sx={{ width: 150, height: 8, borderRadius: 99, background: diverging ? 'linear-gradient(90deg,#316f97,#f6f7f8,#d28930)' : 'linear-gradient(90deg,#edf4fa,#4489ab,#eaad38)' }} />
      <Typography variant="caption" color="text.secondary">{finite.length ? (formatValue ? formatValue(max) : max) : '—'}</Typography>
      <Typography variant="caption" sx={{ fontWeight: 700 }}>{valueLabel}</Typography>
    </Stack>
  </Stack>
}
