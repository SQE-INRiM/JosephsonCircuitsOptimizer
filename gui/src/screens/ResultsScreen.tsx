import { useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Tab, Tabs, Typography } from '@mui/material'
import { ConnectedResults } from '../components/ConnectedResults'
import { ResultsRunManager } from '../components/ResultsRunManager'
import { RunSetupSnapshot } from '../components/RunSetupSnapshot'
import { getJcoAdapter } from '../services/jcoAdapter'
import { useAppStore } from '../store'
import { hasVaryingDeviceParameters } from '../utils/runSummary'
import type { RunResults, StageId } from '../types'

function optimizerHistoryCount(run: RunResults | undefined) {
  const metadata = run?.metadata as { results?: { metric_history?: { metrics?: unknown[] } } } | null | undefined
  const metrics = metadata?.results?.metric_history?.metrics
  return Array.isArray(metrics) ? metrics.length : 0
}
function runStatus(run: RunResults | undefined) { const value = run?.status?.status; return typeof value === 'string' ? value : 'unknown' }

export function ResultsScreen() {
  const stage = useAppStore((state) => state.resultsStage)
  const project = useAppStore((state) => state.project)
  const setStage = useAppStore((state) => state.setResultsStage)
  const selectedRunId = useAppStore((state) => state.selectedResultsRunId)
  const setSelectedRunId = useAppStore((state) => state.setSelectedResultsRunId)
  const results = useAppStore((state) => state.results)
  const setResults = useAppStore((state) => state.setResults)
  const running = useAppStore((state) => state.running)
  const currentRunId = useAppStore((state) => state.currentRunId)
  const [refreshError, setRefreshError] = useState('')
  const [actionStatus, setActionStatus] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Select the run once, independently of the currently displayed stage.
  const selectedRun = results?.runs.find((run) => run.id === selectedRunId) ?? results?.runs[0]
  const optimizationDisabled = !hasVaryingDeviceParameters(project)
  const visibleStage = optimizationDisabled && stage === 'optimization' ? 'linear' : stage
  const stageIndex = visibleStage === 'linear' ? 0 : visibleStage === 'optimization' ? 1 : 2
  const hasResults = Boolean(results?.runs.length)
  const selectedTable = visibleStage === 'linear' ? selectedRun?.linear : visibleStage === 'optimization' ? selectedRun?.optimization : selectedRun?.nonlinear
  const selectedHistoryCount = optimizerHistoryCount(selectedRun)

  useEffect(() => {
    if (optimizationDisabled && stage === 'optimization') setStage('linear')
  }, [optimizationDisabled, stage, setStage])

  const refresh = async (cancelled?: () => boolean) => {
    const adapter = getJcoAdapter(); if (!adapter) return
    setRefreshing(true)
    try { const next = await adapter.readResults(); if (!cancelled?.()) { setResults(next); setRefreshError('') } }
    catch (error) { if (!cancelled?.()) setRefreshError(error instanceof Error ? error.message : String(error)) }
    finally { if (!cancelled?.()) setRefreshing(false) }
  }

  useEffect(() => { const adapter = getJcoAdapter(); if (!adapter) return; let cancelled = false; void refresh(() => cancelled); return () => { cancelled = true } }, [running, setResults])

  const deleteSelectedRun = async () => {
    if (!selectedRun || deleting) return
    if (selectedRun.id === currentRunId && running) {
      setActionStatus('The active running simulation cannot be deleted.')
      return
    }
    if (!window.confirm(`Delete ${selectedRun.id} and all of its stored numerical results? This cannot be undone.`)) return
    const adapter = getJcoAdapter()
    if (!adapter) return setActionStatus('Desktop result bridge is unavailable.')
    setDeleting(true)
    setActionStatus('')
    try {
      const next = await adapter.deleteRun(selectedRun.id)
      setResults(next)
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setDeleting(false)
    }
  }

  const exportSelectedStage = async () => {
    if (!selectedRun || !selectedTable) return
    const adapter = getJcoAdapter()
    if (!adapter) return setActionStatus('Desktop result bridge is unavailable.')
    setActionStatus('')
    try {
      const target = await adapter.exportData({ runId: selectedRun.id, stage: visibleStage, format: 'csv', metrics: [], filters: {} })
      if (target) setActionStatus(`Exported to ${target}`)
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : String(error))
    }
  }

  return <Stack spacing={2.5}>
    <Stack direction="row" sx={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <Box><Typography variant="h4">Result explorer</Typography><Typography color="text.secondary" sx={{ mt: 0.6 }}>Completed runs stay available independently of the setup currently being edited.</Typography></Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>{running && <Chip color="info" variant="outlined" label={currentRunId ? `Run in progress · ${currentRunId}` : 'Run in progress'} />}<Button variant="outlined" disabled={refreshing} onClick={() => void refresh()}>{refreshing ? 'Refreshing…' : 'Refresh results'}</Button></Stack>
    </Stack>

    {hasResults && selectedRun && <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: { xs: 240, sm: 310 }, maxWidth: 480, flexGrow: { xs: 1, md: 0 } }}>
          <InputLabel id="results-run-select-label">Run</InputLabel>
          <Select labelId="results-run-select-label" label="Run" value={selectedRun.id} onChange={(event) => setSelectedRunId(event.target.value)}>
            {results!.runs.map((run) => <MenuItem key={run.id} value={run.id}>{run.id}{running && run.id === currentRunId ? ' · running' : ''}</MenuItem>)}
          </Select>
        </FormControl>
        <Chip size="small" label={`${results!.runs.length} stored runs`} color="success" variant="outlined" />
        <Box sx={{ flexGrow: 1 }} />
        <RunSetupSnapshot runs={results!.runs} initialRunId={selectedRun.id} />
        <ResultsRunManager results={results!} activeRunId={running ? currentRunId : null} onResultsChanged={setResults} />
        <Button size="small" color="error" variant="outlined" disabled={deleting || (running && selectedRun.id === currentRunId)} onClick={() => void deleteSelectedRun()}>{deleting ? 'Deleting…' : 'Delete run'}</Button>
        <Button size="small" variant="outlined" disabled={!selectedTable || deleting} onClick={() => void exportSelectedStage()}>Export CSV…</Button>
      </Stack>
    </Paper>}

    <Box sx={{ pt: hasResults ? 2 : 0, borderTop: hasResults ? '1px solid' : 'none', borderColor: 'divider' }}>
      <Paper variant="outlined" sx={{ px: 2 }}>
        <Tabs value={stageIndex} onChange={(_, index) => setStage((index === 0 ? 'linear' : index === 1 ? 'optimization' : 'hb') as StageId)}>
          <Tab label="Linear" />
          <Tab label="Optimization" disabled={optimizationDisabled} />
          <Tab label="Harmonic balance" />
        </Tabs>
      </Paper>
    </Box>

    {running && <Alert severity="info">A new simulation is running. Previously stored runs remain available below. The active run is refreshed when its run state changes rather than continuously re-indexing all stored data.</Alert>}
    {refreshError && <Alert severity="warning">Stored Results could not be refreshed: {refreshError}. The last successfully indexed runs remain visible.</Alert>}
    {actionStatus && <Alert severity={actionStatus.startsWith('Exported') ? 'success' : 'warning'} onClose={() => setActionStatus('')}>{actionStatus}</Alert>}
    {visibleStage === 'optimization' && selectedRun && !selectedRun.optimization && <Alert severity={selectedHistoryCount > 0 ? 'warning' : 'info'}><strong>Selected-run Optimization diagnostic:</strong> {selectedRun.id} · status {runStatus(selectedRun)} · Linear table {selectedRun.linear ? 'readable' : 'missing'} · Optimization table missing · bookkeeping cost history {selectedHistoryCount} evaluations.{selectedHistoryCount > 0 ? ' The optimizer history exists in bookkeeping, so the remaining failure is in Optimization persistence/indexing rather than in running the optimizer itself.' : ' No optimizer cost history is visible in bookkeeping for this run.'}</Alert>}
    {hasResults ? <ConnectedResults results={results!} stage={visibleStage} selectedRunId={selectedRun?.id} /> : <Alert severity="info">{running ? 'No completed numerical dataset is available yet for this project.' : 'Run a simulation to populate the Result explorer.'}</Alert>}
  </Stack>
}
