import { useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, FormControl, IconButton, InputLabel, MenuItem, Paper, Select, Stack, Tab, Tabs, Tooltip, Typography } from '@mui/material'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import { ConnectedResults } from '../components/ConnectedResults'
import { NonlinearFeedbackResults } from '../components/NonlinearFeedbackResults'
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
  const [feedbackView, setFeedbackView] = useState(false)
  const [selectedCycle, setSelectedCycle] = useState(0)

  // Select the run once, independently of the currently displayed stage.
  const selectedRun = results?.runs.find((run) => run.id === selectedRunId) ?? results?.runs[0]
  const optimizationDisabled = !hasVaryingDeviceParameters(project)
  const visibleStage = optimizationDisabled && stage === 'optimization' ? 'linear' : stage
  const stageIndex = visibleStage === 'linear' ? 0 : visibleStage === 'optimization' ? 1 : 2
  const hasResults = Boolean(results?.runs.length)
  const hasFeedback = Boolean(selectedRun?.feedback || selectedRun?.cycles?.length)
  const availableCycles = [...new Set([0, ...(selectedRun?.cycles?.map((entry) => entry.cycle) ?? [])])]
    .filter((cycle) => Number.isSafeInteger(cycle) && cycle >= 0).sort((a, b) => a - b)
  const activeCycle = availableCycles.includes(selectedCycle) ? selectedCycle : 0
  const cyclePosition = availableCycles.indexOf(activeCycle)
  const selectCycle = (cycle: number) => {
    setSelectedCycle(cycle)
    // A cycle is a stage-specific inspection, not a filter on the whole-run convergence chart.
    setFeedbackView(false)
  }
  const cycleData = selectedRun?.cycles?.find((entry) => entry.cycle === activeCycle)
  const inspectedRun = selectedRun && activeCycle > 0 && cycleData
    ? {
        ...selectedRun,
        cycle: activeCycle,
        linear: cycleData.linear,
        optimization: cycleData.optimization,
        nonlinear: cycleData.nonlinear,
        optimalParameters: cycleData.optimalParameters,
        savedLinear: cycleData.savedLinear,
        savedNonlinear: cycleData.savedNonlinear,
        traces: cycleData.traces,
      } : selectedRun
  const inspectedBundle = inspectedRun && activeCycle > 0 && results
    ? { ...results, runs: [inspectedRun] } : results
  const selectedTable = visibleStage === 'linear' ? inspectedRun?.linear
    : visibleStage === 'optimization' ? inspectedRun?.optimization : inspectedRun?.nonlinear
  const selectedHistoryCount = activeCycle === 0 ? optimizerHistoryCount(selectedRun) : 0

  useEffect(() => {
    if (optimizationDisabled && stage === 'optimization') setStage('linear')
  }, [optimizationDisabled, stage, setStage])
  useEffect(() => { setSelectedCycle(0); setFeedbackView(false) }, [selectedRun?.id])
  useEffect(() => { if (!hasFeedback && feedbackView) setFeedbackView(false) }, [hasFeedback, feedbackView])

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
      const target = await adapter.exportData({ runId: selectedRun.id, cycle: activeCycle, stage: visibleStage, format: 'csv', metrics: [], filters: {} })
      if (target) setActionStatus(`Exported to ${target}`)
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : String(error))
    }
  }

  return <Stack spacing={2.5}>
    <Stack direction="row" sx={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <Box><Typography variant="h4">Result explorer</Typography><Typography color="text.secondary" sx={{ mt: 0.6 }}>Completed runs stay available independently of the setup currently being edited.</Typography></Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        {running && <Chip color="info" variant="outlined" label={currentRunId ? `Run in progress · ${currentRunId}` : 'Run in progress'} />}
        {hasResults && <ResultsRunManager results={results!} activeRunId={running ? currentRunId : null} onResultsChanged={setResults} />}
        <Button variant="outlined" disabled={refreshing} onClick={() => void refresh()}>{refreshing ? 'Refreshing…' : 'Refresh results'}</Button>
      </Stack>
    </Stack>

    {hasResults && selectedRun && <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: { xs: 240, sm: 310 }, maxWidth: 480, flexGrow: { xs: 1, md: 0 } }}>
          <InputLabel id="results-run-select-label">Run</InputLabel>
          <Select labelId="results-run-select-label" label="Run" value={selectedRun.id} onChange={(event) => setSelectedRunId(event.target.value)}>
            {results!.runs.map((run) => <MenuItem key={run.id} value={run.id}>{run.id}{running && run.id === currentRunId ? ' · running' : ''}</MenuItem>)}
          </Select>
        </FormControl>
        <Button size="small" variant="outlined" disabled={!selectedTable || deleting} onClick={() => void exportSelectedStage()}>Export CSV…</Button>
        <RunSetupSnapshot runs={results!.runs} initialRunId={selectedRun.id} />
        <Button size="small" color="error" variant="outlined" disabled={deleting || (running && selectedRun.id === currentRunId)} onClick={() => void deleteSelectedRun()}>{deleting ? 'Deleting…' : 'Delete run'}</Button>
        <Box sx={{ flexGrow: 1 }} />
        <Chip size="small" label={`${results!.runs.length} stored runs`} color="success" variant="outlined" />
      </Stack>
    </Paper>}

    <Box sx={{ pt: hasResults ? 2 : 0, borderTop: hasResults ? '1px solid' : 'none', borderColor: 'divider' }}>
      <Paper variant="outlined" sx={{ px: 1.5 }}>
        {hasFeedback && <Box role="group" aria-label="Feedback cycles"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.7, pt: 1.1, pb: 0.25, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, pr: 0.5 }}>Cycles</Typography>
          <IconButton aria-label="Previous cycle" size="small" disabled={cyclePosition <= 0}
            onClick={() => selectCycle(availableCycles[cyclePosition - 1])}>
            <ChevronLeftRoundedIcon fontSize="small" />
          </IconButton>
          <Box sx={{ display: 'flex', gap: 0.5, overflowX: 'auto', flex: 1, minWidth: 0, py: 0.5, scrollbarWidth: 'thin' }}>
            {availableCycles.map((cycle) => {
              const status = selectedRun?.cycles?.find((entry) => entry.cycle === cycle)?.status
              return <Tooltip key={cycle} describeChild title={cycle === 0 ? 'Original run (before correction)' : status === 'completed' ? 'Completed feedback cycle' : 'Cycle data may be incomplete'}>
                <Button size="small" sx={{ flexShrink: 0, minWidth: 'auto', px: 1.5 }}
                  variant={activeCycle === cycle ? 'contained' : 'outlined'}
                  aria-pressed={activeCycle === cycle} onClick={() => selectCycle(cycle)}>
                  {cycle === 0 ? '0 · baseline' : 'Cycle ' + cycle}
                </Button>
              </Tooltip>
            })}
          </Box>
          <IconButton aria-label="Next cycle" size="small" disabled={cyclePosition >= availableCycles.length - 1}
            onClick={() => selectCycle(availableCycles[cyclePosition + 1])}>
            <ChevronRightRoundedIcon fontSize="small" />
          </IconButton>
        </Box>}
        <Tabs value={feedbackView && hasFeedback ? 3 : stageIndex} variant="scrollable" scrollButtons="auto"
          onChange={(_, index) => {
            if (index === 3) setFeedbackView(true)
            else {
              setFeedbackView(false)
              setStage((index === 0 ? 'linear' : index === 1 ? 'optimization' : 'hb') as StageId)
            }
          }}>
          <Tab label="Linear" />
          <Tab label="Optimization" disabled={optimizationDisabled} />
          <Tab label="Harmonic balance" />
          {hasFeedback && <Tab label="Nonlinear feedback" sx={(theme) => ({
            color: theme.palette.secondary.main,
            '&.Mui-selected': { color: theme.palette.secondary.main },
          })} />}
        </Tabs>
      </Paper>
    </Box>

    {refreshError && <Alert severity="warning">Stored Results could not be refreshed: {refreshError}. The last successfully indexed runs remain visible.</Alert>}
    {actionStatus && <Alert severity={actionStatus.startsWith('Exported') ? 'success' : 'warning'} onClose={() => setActionStatus('')}>{actionStatus}</Alert>}
    {!feedbackView && visibleStage === 'optimization' && inspectedRun && !inspectedRun.optimization && (
      activeCycle > 0
        ? <Alert severity="info">Optimization data for Cycle {activeCycle} is not available yet.</Alert>
        : <Alert severity={selectedHistoryCount > 0 ? 'warning' : 'info'}><strong>Selected-run Optimization diagnostic:</strong> {inspectedRun.id} · status {runStatus(inspectedRun)} · Linear table {inspectedRun.linear ? 'readable' : 'missing'} · Optimization table missing · bookkeeping cost history {selectedHistoryCount} evaluations.{selectedHistoryCount > 0 ? ' The optimizer history exists in bookkeeping, so the remaining failure is in Optimization persistence/indexing rather than in running the optimizer itself.' : ' No optimizer cost history is visible in bookkeeping for this run.'}</Alert>
    )}
    {hasResults && feedbackView && hasFeedback && selectedRun
      ? <NonlinearFeedbackResults run={selectedRun} />
      : hasResults && inspectedBundle
        ? <ConnectedResults key={selectedRun?.id + ':' + activeCycle + ':' + visibleStage}
            results={inspectedBundle} stage={visibleStage} selectedRunId={selectedRun?.id} />
        : <Alert severity="info">{running ? 'No completed numerical dataset is available yet for this project.' : 'Run a simulation to populate the Result explorer.'}</Alert>}
  </Stack>
}
