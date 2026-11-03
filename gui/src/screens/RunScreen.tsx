import { useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined'
import PauseRoundedIcon from '@mui/icons-material/PauseRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import TerminalRoundedIcon from '@mui/icons-material/TerminalRounded'
import { StatusChip } from '../components/StatusChip'
import { getJcoAdapter } from '../services/jcoAdapter'
import { useAppStore } from '../store'
import type { StageId } from '../types'
import { configuredStageSummary } from '../utils/runSummary'
import { nextRunStage } from '../utils/runStages'

const logColors = { INFO: '#b7cadb', WARN: '#f2c97d', ERROR: '#f19a9a', PROGRESS: '#77c9ae' }
const ETA_WINDOW = 7
const ETA_MIN_SAMPLES = 3

export function formatStageCompletion(value?: string): string {
  if (!value) return 'Completed'
  const localized = value.match(/^(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2}):(\d{2})$/)
  if (localized) return `${localized[1]}/${localized[2]}/${localized[3]} · ${localized[4]}:${localized[5]}:${localized[6]}`
  const runIdStyle = value.match(/^(\d{4})-(\d{2})-(\d{2})\s*·\s*(\d{2})[-:](\d{2})[-:](\d{2})/)
  if (runIdStyle) return `${runIdStyle[3]}/${runIdStyle[2]}/${runIdStyle[1]} · ${runIdStyle[4]}:${runIdStyle[5]}:${runIdStyle[6]}`
  return value
}

function formatEstimatedTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ${String(seconds % 60).padStart(2, '0')} s`
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${String(minutes % 60).padStart(2, '0')} min`
}

function median(values: number[]): number {
  const ordered = [...values].sort((a, b) => a - b)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2
}

interface EtaTracker {
  stageId: StageId
  lastProgress: number
  lastTimestampMs: number
  intervalCount: number
  secondsPerPercent: number[]
}

interface RunScreenProps {
  desktop: boolean
  cancelling: boolean
  onRunAll: () => Promise<void>
  onRunStage: (stage: StageId) => Promise<void>
  onStop: () => Promise<void>
}

export function RunScreen({ desktop, cancelling, onRunAll, onRunStage, onStop }: RunScreenProps) {
  const stages = useAppStore((state) => state.stages)
  const logs = useAppStore((state) => state.logs)
  const running = useAppStore((state) => state.running)
  const currentRunId = useAppStore((state) => state.currentRunId)
  const project = useAppStore((state) => state.project)
  const active = stages.find((stage) => stage.status === 'running')
  const nextStage = nextRunStage(stages)
  const nextStageState = stages.find((stage) => stage.id === nextStage)
  const [logOpen, setLogOpen] = useState(false)
  const [activeEta, setActiveEta] = useState<{ stageId: StageId; seconds: number } | null>(null)
  const [backendEta, setBackendEta] = useState<{ stageId: StageId; seconds: number } | null>(null)
  const etaTracker = useRef<EtaTracker | null>(null)
  const projectPath = project.workspaceInfo?.projectPath

  // The Julia progress reporter is the authoritative ETA source. It measures real
  // completed configurations, excludes warm-up and emits a rolling-median estimate.
  // Keep the local estimator only as a browser/demo fallback.
  useEffect(() => {
    const adapter = getJcoAdapter()
    if (!adapter) return
    return adapter.onRunEvent((event) => {
      if (event.type === 'stage-status' && event.status === 'running') setBackendEta(null)
      if (event.type === 'progress' && event.etaSeconds !== undefined && Number.isFinite(event.etaSeconds)) {
        setBackendEta({ stageId: event.stage, seconds: Math.max(0, event.etaSeconds) })
      }
      if (event.type === 'run-finished') setBackendEta(null)
    })
  }, [])

  useEffect(() => {
    if (!active) {
      etaTracker.current = null
      setActiveEta(null)
      return
    }

    const now = Date.now()
    const tracker = etaTracker.current
    if (!tracker || tracker.stageId !== active.id) {
      etaTracker.current = {
        stageId: active.id,
        lastProgress: active.progress,
        lastTimestampMs: now,
        intervalCount: 0,
        secondsPerPercent: [],
      }
      setActiveEta(null)
      return
    }

    if (active.progress <= tracker.lastProgress || active.progress >= 100) return

    const elapsedSeconds = (now - tracker.lastTimestampMs) / 1000
    const progressDelta = active.progress - tracker.lastProgress
    tracker.lastProgress = active.progress
    tracker.lastTimestampMs = now
    tracker.intervalCount += 1

    if (tracker.intervalCount > 1 && elapsedSeconds > 0 && progressDelta > 0) {
      tracker.secondsPerPercent.push(elapsedSeconds / progressDelta)
      if (tracker.secondsPerPercent.length > ETA_WINDOW) tracker.secondsPerPercent.shift()
    }

    if (tracker.secondsPerPercent.length >= ETA_MIN_SAMPLES) {
      const seconds = median(tracker.secondsPerPercent) * (100 - active.progress)
      setActiveEta({ stageId: active.id, seconds: Math.max(0, seconds) })
    } else {
      setActiveEta(null)
    }
  }, [active?.id, active?.progress])


  return <Stack spacing={2.5}>
    <Stack direction="row" sx={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <Box><Typography variant="h4">Simulation run</Typography><Typography color="text.secondary" sx={{ mt: 0.6 }}>Run starts a fresh Linear → Optimization → Harmonic balance pipeline. Run next step advances only when earlier stages are valid.</Typography></Box>
      <Stack direction="row" spacing={1.2}>
        {nextStage && <Button variant="outlined" disabled={running || cancelling || !desktop} onClick={() => onRunStage(nextStage)}>Run {nextStage === 'hb' ? 'Nonlinear' : nextStageState?.label ?? 'next step'}</Button>}
        <Button variant="contained" color={running ? 'error' : 'primary'} disabled={cancelling || (!running && !desktop)} startIcon={running ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />} onClick={running ? onStop : onRunAll}>{cancelling ? 'Stopping Julia…' : running ? 'Stop simulation' : 'Run'}</Button>
      </Stack>
    </Stack>

    <Paper variant="outlined" sx={{ p: 2.4 }}><Stack direction="row" spacing={1.2} sx={{ alignItems: 'stretch' }}>
      {stages.map((stage, index) => {
        const authoritativeEta = backendEta?.stageId === stage.id ? backendEta.seconds : null
        const fallbackEta = activeEta?.stageId === stage.id ? activeEta.seconds : null
        const etaSeconds = authoritativeEta ?? fallbackEta
        return <Stack key={stage.id} direction="row" sx={{ flex: 1, alignItems: 'center' }} spacing={1.2}>
          <Paper variant="outlined" sx={{ flex: 1, minHeight: 218, p: 2.1, borderWidth: stage.status === 'running' ? 2 : 1, borderColor: stage.status === 'running' ? 'secondary.main' : 'divider', backgroundColor: stage.status === 'running' ? 'action.hover' : 'background.paper' }}>
            <Stack spacing={1.5} sx={{ height: '100%' }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}><Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'grid', placeItems: 'center', backgroundColor: stage.status === 'completed' ? 'action.selected' : stage.status === 'running' ? 'action.hover' : 'background.default', color: stage.status === 'completed' ? 'success.main' : stage.status === 'running' ? 'secondary.dark' : 'primary.main', fontWeight: 800 }}>{stage.shortLabel}</Box><StatusChip status={stage.status} /></Stack>
              <Box><Typography variant="h6">{stage.label}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, minHeight: 42 }}>{stage.detail}</Typography></Box>
              <Box sx={{ mt: 'auto !important' }}>
                {stage.status === 'running' ? stage.progress > 0
                  ? <Stack spacing={0.8}>
                      <Stack direction="row" sx={{ justifyContent: 'space-between' }}><Typography variant="caption" color="text.secondary">{Math.round((stage.points * stage.progress) / 100)} / {stage.points}</Typography><Typography variant="caption" sx={{ fontWeight: 700 }}>{stage.progress}%</Typography></Stack>
                      <LinearProgress variant="determinate" value={stage.progress} color="secondary" sx={{ height: 7, borderRadius: 99 }} />
                      <Stack direction="row" spacing={0.6} sx={{ alignItems: 'center' }}><AccessTimeRoundedIcon color="action" sx={{ fontSize: 15 }} /><Typography variant="caption" color="text.secondary">Estimated remaining: {etaSeconds == null ? 'collecting timing samples…' : formatEstimatedTime(etaSeconds)}</Typography></Stack>
                    </Stack>
                  : <Stack spacing={0.8}><Typography variant="caption" color="text.secondary">Starting… · timing warm-up excluded from estimate</Typography><LinearProgress color="secondary" sx={{ height: 7, borderRadius: 99 }} /></Stack>
                : stage.status === 'completed' ? <Stack spacing={0.5}><Stack direction="row" spacing={0.7} sx={{ alignItems: 'center' }}><CheckCircleRoundedIcon color="success" sx={{ fontSize: 16 }} /><Typography variant="caption" sx={{ fontWeight: 700 }}>{formatStageCompletion(stage.completedAt)}</Typography></Stack>{stage.duration && <Stack direction="row" spacing={0.7} sx={{ alignItems: 'center' }}><AccessTimeRoundedIcon color="action" sx={{ fontSize: 16 }} /><Typography variant="caption" color="text.secondary">{stage.duration}</Typography></Stack>}</Stack>
                : <Stack direction="row" spacing={0.7} sx={{ alignItems: 'center' }}><CircleOutlinedIcon color="disabled" sx={{ fontSize: 16 }} /><Typography variant="caption" color="text.secondary">{configuredStageSummary(project, stage.id)}</Typography></Stack>}
              </Box>
            </Stack>
          </Paper>
          {index < stages.length - 1 && <ArrowForwardRoundedIcon color="disabled" />}
        </Stack>
      })}
    </Stack></Paper>

    <Paper variant="outlined" sx={{ p: 2.2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
        <Box><Typography variant="h6">Current run</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{desktop ? 'Run identity and project destination.' : 'Browser preview only: progress is simulated because Julia is available only in the desktop application.'}</Typography></Box>
        <Button variant="outlined" startIcon={<TerminalRoundedIcon />} onClick={() => setLogOpen(true)}>Simulation log{logs.length ? ` (${logs.length})` : ''}</Button>
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} sx={{ mt: 2 }}>
        <Box><Typography variant="caption" color="text.secondary">Run ID</Typography><Typography sx={{ fontFamily: 'monospace', fontSize: 13 }}>{currentRunId ?? 'Not started'}</Typography></Box>
        <Box sx={{ minWidth: 0, flex: 1 }}><Typography variant="caption" color="text.secondary">Project file</Typography><Typography variant="body2" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{projectPath ?? 'Unsaved — use Save As before a real run'}</Typography></Box>
        {active && <Box><Typography variant="caption" color="text.secondary">Active stage</Typography><Typography variant="body2" sx={{ fontWeight: 700 }}>{active.label}</Typography></Box>}
      </Stack>
    </Paper>

    <Dialog open={logOpen} onClose={() => setLogOpen(false)} fullWidth maxWidth="lg">
      <DialogTitle><Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><TerminalRoundedIcon color="primary" /><span>Simulation log</span><Stack direction="row" spacing={0.7} sx={{ ml: 'auto' }}>{(['INFO', 'WARN', 'ERROR', 'PROGRESS'] as const).map((level) => <Chip key={level} label={level} size="small" variant="outlined" />)}</Stack></Stack></DialogTitle>
      <DialogContent sx={{ p: '0 !important' }}><Box className="log-scroll" sx={{ height: 'min(68vh, 620px)', overflow: 'auto', backgroundColor: '#0d1521', color: '#dce7f3', p: 1.8, fontFamily: 'Cascadia Code, Consolas, monospace', fontSize: 12.5 }}>{logs.map((entry) => <Box key={entry.id} sx={{ display: 'grid', gridTemplateColumns: '72px 78px 1fr', py: 0.32 }}><Box component="span" sx={{ color: '#718294' }}>{entry.time}</Box><Box component="span" sx={{ color: logColors[entry.level], fontWeight: 700 }}>[{entry.level}]</Box><Box component="span">{entry.message}</Box></Box>)}{active && <Box sx={{ color: '#77c9ae', mt: 0.8 }}>▌ waiting for next backend event…</Box>}</Box></DialogContent>
    </Dialog>
  </Stack>
}
