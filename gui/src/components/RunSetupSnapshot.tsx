import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded'
import type { RunResults } from '../types'

type SnapshotSection = ReturnType<typeof runSetupSections>[number]

type SnapshotRow = {
  name: string
  value: unknown
}

function displayValue(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (Array.isArray(value)) return value.length ? `[${value.map((item) => displayValue(item)).join(', ')}]` : '[]'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function snapshotRows(value: unknown, prefix = ''): SnapshotRow[] {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [{ name: prefix, value }] : []
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([name, child]) => {
    const path = prefix ? `${prefix}.${name}` : name
    if (child != null && typeof child === 'object' && !Array.isArray(child)) return snapshotRows(child, path)
    return [{ name: path, value: child }]
  })
}

export function runSetupSections(run: RunResults | undefined) {
  return [
    { key: 'parameters', label: 'Device parameters', value: run?.setupSnapshot?.parameters },
    { key: 'sources', label: 'Sources', value: run?.setupSnapshot?.sources },
    { key: 'simulation', label: 'Simulation', value: run?.setupSnapshot?.simulation },
    { key: 'optimizer', label: 'Optimizer', value: run?.setupSnapshot?.optimizer },
    { key: 'julia', label: 'Julia files', value: run?.setupSnapshot?.juliaFiles },
  ] as const
}

function SnapshotTable({ section }: { section: SnapshotSection }) {
  const rows = snapshotRows(section.value)

  if (!rows.length) {
    return <Typography color="text.secondary" sx={{ py: 3 }}>No stored {section.label.toLowerCase()} information is available for this run.</Typography>
  }

  return <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
    {rows.map((row, index) => <Box
      key={row.name}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(220px, 42%) minmax(0, 1fr)' },
        gap: { xs: 0.4, sm: 2 },
        alignItems: 'center',
        px: 1.6,
        py: 1.05,
        borderTop: index ? '1px solid' : 'none',
        borderColor: 'divider',
      }}
    >
      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, overflowWrap: 'anywhere' }}>{row.name}</Typography>
      <Typography variant="body2" sx={{ textAlign: { sm: 'right' }, fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{displayValue(row.value)}</Typography>
    </Box>)}
  </Paper>
}

function JuliaFilesView({ files }: { files?: Record<string, string> | null }) {
  const names = Object.keys(files ?? {}).sort()
  const [selectedFile, setSelectedFile] = useState(names[0] ?? '')
  const activeFile = names.includes(selectedFile) ? selectedFile : names[0] ?? ''

  if (!names.length) {
    return <Typography color="text.secondary" sx={{ py: 3 }}>No stored Julia source files are available for this run.</Typography>
  }

  return <Stack spacing={1.5}>
    <FormControl size="small" sx={{ minWidth: 300, alignSelf: 'flex-start' }}>
      <InputLabel>Julia file</InputLabel>
      <Select label="Julia file" value={activeFile} onChange={(event) => setSelectedFile(event.target.value)}>
        {names.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
      </Select>
    </FormControl>
    <Paper variant="outlined" sx={{ overflow: 'hidden', backgroundColor: '#101826' }}>
      <Box component="pre" sx={{ m: 0, p: 2, maxHeight: '52vh', overflow: 'auto', color: '#dce7f3', fontFamily: 'Cascadia Code, Consolas, monospace', fontSize: 12.5, lineHeight: 1.55, whiteSpace: 'pre', tabSize: 4 }}>
        {files?.[activeFile] ?? ''}
      </Box>
    </Paper>
  </Stack>
}

export function RunSetupSnapshot({ runs }: { runs: RunResults[] }) {
  const [open, setOpen] = useState(false)
  const [selectedRunId, setSelectedRunId] = useState(runs[0]?.id ?? '')
  const [sectionIndex, setSectionIndex] = useState(0)
  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? runs[0],
    [runs, selectedRunId],
  )

  if (!selectedRun) return null
  const sections = runSetupSections(selectedRun)
  const section = sections[Math.min(sectionIndex, sections.length - 1)]

  return <>
    <Button size="small" variant="contained" startIcon={<DescriptionRoundedIcon />} onClick={() => setOpen(true)}>Simulation info</Button>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="lg">
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6">Simulation info</Typography>
        <Typography variant="body2" color="text.secondary">Immutable inputs used by the selected run. These are independent of the Setup currently being edited.</Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <Stack spacing={0}>
          <Box sx={{ px: 2.5, pt: 2, pb: 1.2 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Stored run</InputLabel>
              <Select label="Stored run" value={selectedRun.id} onChange={(event) => setSelectedRunId(event.target.value)}>
                {runs.map((run) => <MenuItem key={run.id} value={run.id}>{run.id}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
          <Tabs
            value={sectionIndex}
            onChange={(_, next) => setSectionIndex(next)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ px: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
          >
            {sections.map((item) => <Tab key={item.key} label={item.label} />)}
          </Tabs>
          <Box sx={{ p: 2.5 }}>
            {section.key === 'julia'
              ? <JuliaFilesView files={selectedRun.setupSnapshot?.juliaFiles} />
              : <SnapshotTable section={section} />}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpen(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  </>
}
