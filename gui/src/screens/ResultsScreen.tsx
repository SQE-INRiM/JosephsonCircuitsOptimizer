import { useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, Paper, Stack, Tab, Tabs, Typography } from '@mui/material'
import { ConnectedResults } from '../components/ConnectedResults'
import { ResultsRunManager } from '../components/ResultsRunManager'
import { RunSetupSnapshot } from '../components/RunSetupSnapshot'
import { getJcoAdapter } from '../services/jcoAdapter'
import { useAppStore } from '../store'
import type { RunResults, StageId } from '../types'

function optimizerHistoryCount(run: RunResults | undefined) {
  const metadata = run?.metadata as { results?: { metric_history?: { metrics?: unknown[] } } } | null | undefined
  const metrics = metadata?.results?.metric_history?.metrics
  return Array.isArray(metrics) ? metrics.length : 0
}
function runStatus(run: RunResults | undefined) { const value = run?.status?.status; return typeof value === 'string' ? value : 'unknown' }

export function ResultsScreen() {
  const stage = useAppStore((state) => state.resultsStage)
  const setStage = useAppStore((state) => state.setResultsStage)
  const results = useAppStore((state) => state.results)
  const setResults = useAppStore((state) => state.setResults)
  const running = useAppStore((state) => state.running)
  const currentRunId = useAppStore((state) => state.currentRunId)
  const [refreshError, setRefreshError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const stageIndex = stage === 'linear' ? 0 : stage === 'optimization' ? 1 : 2
  const hasResults = Boolean(results?.runs.length)
  const latestRun = results?.runs[0]
  const latestHistoryCount = optimizerHistoryCount(latestRun)

  const refresh = async (cancelled?: () => boolean) => {
    const adapter = getJcoAdapter(); if (!adapter) return
    setRefreshing(true)
    try { const next = await adapter.readResults(); if (!cancelled?.()) { setResults(next); setRefreshError('') } }
    catch (error) { if (!cancelled?.()) setRefreshError(error instanceof Error ? error.message : String(error)) }
    finally { if (!cancelled?.()) setRefreshing(false) }
  }

  useEffect(() => { const adapter = getJcoAdapter(); if (!adapter) return; let cancelled = false; void refresh(() => cancelled); return () => { cancelled = true } }, [running, setResults])

  return <Stack spacing={2.5}>
    <Stack direction="row" sx={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <Box><Typography variant="h4">Result explorer</Typography><Typography color="text.secondary" sx={{ mt: 0.6 }}>Completed runs stay available independently of the setup currently being edited.</Typography></Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>{running && <Chip color="info" variant="outlined" label={currentRunId ? `Run in progress · ${currentRunId}` : 'Run in progress'} />}<Button variant="outlined" disabled={refreshing} onClick={() => void refresh()}>{refreshing ? 'Refreshing…' : 'Refresh results'}</Button></Stack>
    </Stack>

    <Paper variant="outlined" sx={{ px: 2 }}><Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Tabs value={stageIndex} onChange={(_, index) => setStage((index === 0 ? 'linear' : index === 1 ? 'optimization' : 'hb') as StageId)} sx={{ flex: 1 }}><Tab label="Linear" /><Tab label="Optimization" /><Tab label="Harmonic balance" /></Tabs>
      <Chip label={hasResults ? `${results!.runs.length} stored runs` : running ? 'Waiting for stored results' : 'No stored results'} color={hasResults ? 'success' : running ? 'info' : 'default'} variant="outlined" />
      {hasResults && <RunSetupSnapshot runs={results!.runs} />}
      {hasResults && <ResultsRunManager results={results!} activeRunId={running ? currentRunId : null} onResultsChanged={setResults} />}
    </Stack></Paper>

    {running && <Alert severity="info">A new simulation is running. Previously stored runs remain available below. The active run is refreshed when its run state changes rather than continuously re-indexing all stored data.</Alert>}
    {refreshError && <Alert severity="warning">Stored Results could not be refreshed: {refreshError}. The last successfully indexed runs remain visible.</Alert>}
    {stage === 'optimization' && latestRun && !latestRun.optimization && <Alert severity={latestHistoryCount > 0 ? 'warning' : 'info'}><strong>Latest-run Optimization diagnostic:</strong> {latestRun.id} · status {runStatus(latestRun)} · Linear table {latestRun.linear ? 'readable' : 'missing'} · Optimization table missing · bookkeeping cost history {latestHistoryCount} evaluations.{latestHistoryCount > 0 ? ' The optimizer history exists in bookkeeping, so the remaining failure is in Optimization persistence/indexing rather than in running the optimizer itself.' : ' No optimizer cost history is visible in bookkeeping for this run.'}</Alert>}
    {hasResults ? <ConnectedResults results={results!} stage={stage} onResultsChanged={setResults} activeRunId={running ? currentRunId : null} /> : <Alert severity="info">{running ? 'No completed numerical dataset is available yet for this project.' : 'Run a simulation to populate the Result explorer.'}</Alert>}
  </Stack>
}
