import { Chip } from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded'
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded'
import PauseCircleRoundedIcon from '@mui/icons-material/PauseCircleRounded'
import PlayCircleFilledRoundedIcon from '@mui/icons-material/PlayCircleFilledRounded'
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded'
import SyncProblemRoundedIcon from '@mui/icons-material/SyncProblemRounded'
import type { StageStatus } from '../types'

const definitions: Record<StageStatus, { label: string; color: string; background: string; icon: React.ReactElement }> = {
  not_ready: { label: 'Not ready', color: '#647382', background: '#edf0f2', icon: <PauseCircleRoundedIcon /> },
  ready: { label: 'Ready', color: '#235e83', background: '#e5f1f8', icon: <PlayCircleFilledRoundedIcon /> },
  running: { label: 'Running', color: '#8f5f1e', background: '#fff3dc', icon: <HourglassTopRoundedIcon /> },
  completed: { label: 'Completed', color: '#246750', background: '#e5f4ee', icon: <CheckCircleRoundedIcon /> },
  stale: { label: 'Stale', color: '#9a5d1b', background: '#fff0d7', icon: <SyncProblemRoundedIcon /> },
  failed: { label: 'Failed', color: '#a33b3b', background: '#fae6e6', icon: <ErrorRoundedIcon /> },
  cancelled: { label: 'Cancelled', color: '#6f5b7f', background: '#eee8f2', icon: <PauseCircleRoundedIcon /> },
  skipped: { label: 'Skipped', color: '#65717e', background: '#eef1f3', icon: <SkipNextRoundedIcon /> },
}

export function StatusChip({ status }: { status: StageStatus }) {
  const definition = definitions[status]
  return (
    <Chip
      size="small"
      icon={definition.icon}
      label={definition.label}
      sx={{ color: definition.color, backgroundColor: definition.background, '& .MuiChip-icon': { color: definition.color } }}
    />
  )
}
