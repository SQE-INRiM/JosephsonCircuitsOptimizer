import { useMemo } from 'react'
import { Alert, Box, Chip, Divider, Paper, Stack, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { LineChart } from '@mui/x-charts/LineChart'
import type { RunResults } from '../types'
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

export function NonlinearFeedbackResults({ run }: { run: RunResults }) {
  const theme = useTheme()
  const parameters = useAppStore((state) => state.project.parameters)
  const entries = useMemo(() =>
    (run.feedback?.cycles ?? []).filter((item) =>
      item.status === 'completed' && Number.isSafeInteger(item.cycle) && item.cycle >= 0,
    ).sort((a, b) => a.cycle - b.cycle), [run.feedback])
  const cycles = entries.map((item) => item.cycle)
  const names = [...new Set(entries.flatMap((entry) => Object.keys(entry.parameters ?? {})))]
  const active = run.cycles ?? []
  const accent = theme.palette.secondary.main

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
      <Stack direction="row" useFlexGap spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 1.1 }}>
        <Typography variant="h6" sx={{ color: accent }}>Nonlinear feedback</Typography>
        <Chip size="small" variant="outlined" label={Math.max(0, entries.length - 1) + ' corrected cycles'} />
        {run.feedback?.stopping && <Chip size="small" variant="outlined"
          color={run.feedback.stopping.stop_reason === 'converged' ? 'success' : 'default'}
          label={run.feedback.stopping.stop_reason === 'converged' ? 'Converged' : 'Cycle limit reached'} />}
      </Stack>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Performance convergence</Typography>
      <Typography variant="caption" color="text.secondary">
        Best evaluated HB performance per cycle · Cycle 0 is the uncorrected baseline
      </Typography>
      {entries.length ? <LineChart height={290} margin={{ left: 78, bottom: 48 }}
        xAxis={[{ data: cycles, scaleType: 'linear', label: 'Feedback cycle', tickMinStep: 1 }]}
        yAxis={[{ width: 72, valueFormatter: (value: number | null) => display(value) }]}
        series={[graphSeries(entries.map((entry) => hasValue(entry.performance) ? entry.performance : null), 'Performance')]}
        grid={{ horizontal: true }} />
        : <Alert severity="info" sx={{ mt: 1 }}>No completed feedback cycle has been saved yet.</Alert>}
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
            grid={{ horizontal: true }} />
        </Paper>)}
      </Box>
    </>}
  </Stack>
}
