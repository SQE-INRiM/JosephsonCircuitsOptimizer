import { useMemo } from 'react'
import { Alert, Box, Button, Chip, Divider, Paper, Stack, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { LineChart } from '@mui/x-charts/LineChart'
import type { FeedbackCycleSummary, RunResults } from '../types'
import { useAppStore } from '../store'
import { parameterLabel } from '../utils/resultUnits'

function display(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value === 0) return '0'
  return Math.abs(value) < 1e-3 || Math.abs(value) >= 1e4
    ? value.toExponential(3) : Number(value.toPrecision(5)).toString()
}

function hasValue(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value)
}

export function NonlinearFeedbackResults({
  run, onOpenCycle,
}: {
  run: RunResults
  onOpenCycle: (cycle: number) => void
}) {
  const theme = useTheme()
  const parameters = useAppStore((state) => state.project.parameters)
  const entries = useMemo(() =>
    (run.feedback?.cycles ?? []).filter((item) =>
      item.status === 'completed' && Number.isSafeInteger(item.cycle) && item.cycle >= 0,
    ).sort((a, b) => a.cycle - b.cycle), [run.feedback])
  const cycles = entries.map((item) => item.cycle)
  const names = [...new Set(entries.flatMap((entry) => Object.keys(entry.parameters ?? {})))]
  const active = run.cycles ?? []
  const incomplete = active.filter((cycle) => !entries.some((entry) => entry.cycle === cycle.cycle))
  const accent = theme.palette.secondary.main

  const openMark = (_event: unknown, item: { dataIndex?: number }) => {
    const cycle = cycles[item.dataIndex ?? -1]
    if (cycle !== undefined) onOpenCycle(cycle)
  }
  const graphSeries = (values: Array<number | null>, label: string) => ({
    data: values,
    label,
    showMark: true,
    curve: 'linear' as const,
    valueFormatter: (value: number | null) => display(value),
  })

  if (!run.feedback && !active.length) {
    return <Alert severity="info">This run does not contain nonlinear feedback cycles.</Alert>
  }

  return <Stack spacing={1.5}>
    <Paper variant="outlined" sx={{ p: 1.7, borderTop: '3px solid', borderTopColor: accent }}>
      <Stack direction="row" alignItems="center" useFlexGap spacing={1} sx={{ flexWrap: 'wrap', mb: 1.1 }}>
        <Typography variant="h6" sx={{ color: accent }}>Nonlinear feedback</Typography>
        <Chip size="small" variant="outlined" label={Math.max(0, entries.length - 1) + ' corrected cycles'} />
      </Stack>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Performance convergence</Typography>
      <Typography variant="caption" color="text.secondary">
        Best evaluated HB performance per cycle · Cycle 0 is the uncorrected baseline
      </Typography>
      {entries.length ? <LineChart height={290} margin={{ left: 78, bottom: 48 }}
        xAxis={[{ data: cycles, scaleType: 'linear', label: 'Feedback cycle', tickMinStep: 1 }]}
        yAxis={[{ width: 72, valueFormatter: (value: number | null) => display(value) }]}
        series={[graphSeries(entries.map((entry) => hasValue(entry.performance) ? entry.performance : null), 'Performance')]}
        grid={{ horizontal: true }} onMarkClick={openMark} />
        : <Alert severity="info" sx={{ mt: 1 }}>No completed feedback cycle has been saved yet.</Alert>}
      <Stack direction="row" spacing={0.7} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        {entries.map((entry: FeedbackCycleSummary) => <Button key={entry.cycle} size="small" variant="outlined"
          onClick={() => onOpenCycle(entry.cycle)}
          sx={{ color: accent, borderColor: alpha(accent, 0.35) }}>
          Cycle {entry.cycle}
        </Button>)}
        {incomplete.map((entry) => <Chip key={entry.cycle} size="small" variant="outlined" color="warning"
          label={'Cycle ' + entry.cycle + ' · incomplete'} />)}
      </Stack>
    </Paper>
    {names.length > 0 && <>
      <Divider sx={{ my: 0.3 }} />
      <Typography variant="h6">Parameter convergence</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.2 }}>
        {names.map((name) => <Paper key={name} variant="outlined" sx={{ p: 1.2, minWidth: 0 }}>
          <Typography variant="subtitle2">{parameterLabel(parameters, name)}</Typography>
          <LineChart height={205} margin={{ bottom: 42, left: 82 }}
            xAxis={[{ data: cycles, scaleType: 'linear', label: 'Cycle', tickMinStep: 1 }]}
            yAxis={[{ width: 76, valueFormatter: (value: number | null) => display(value) }]}
            series={[graphSeries(entries.map((entry) => {
              const value = entry.parameters?.[name]
              return hasValue(value) ? value : null
            }), parameterLabel(parameters, name))]}
            grid={{ horizontal: true }} onMarkClick={openMark} />
        </Paper>)}
      </Box>
    </>}
  </Stack>
}
