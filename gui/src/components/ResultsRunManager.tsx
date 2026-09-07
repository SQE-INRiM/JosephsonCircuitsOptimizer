import { useMemo, useState } from 'react'
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, ListItemText, MenuItem, Select, Stack } from '@mui/material'
import type { ResultsBundle } from '../types'
import { getJcoAdapter } from '../services/jcoAdapter'

export function ResultsRunManager({ results, activeRunId, onResultsChanged }: { results: ResultsBundle; activeRunId?: string | null; onResultsChanged: (results: ResultsBundle) => void }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [deleting, setDeleting] = useState(false)
  const [status, setStatus] = useState('')
  const removable = useMemo(() => results.runs.map((run) => run.id).filter((id) => id !== activeRunId), [results, activeRunId])

  const deleteSelected = async () => {
    const targets = selected.filter((id) => removable.includes(id))
    if (!targets.length) return
    if (!window.confirm(`Delete ${targets.length} selected run${targets.length === 1 ? '' : 's'} and all stored numerical results? This cannot be undone.`)) return
    const adapter = getJcoAdapter()
    if (!adapter) return setStatus('Desktop result bridge is unavailable.')
    setDeleting(true)
    setStatus(`Deleting ${targets.length} run${targets.length === 1 ? '' : 's'} in the background…`)
    setOpen(false)
    let latest = results
    let deleted = 0
    try {
      for (const runId of targets) {
        latest = await adapter.deleteRun(runId)
        deleted += 1
        onResultsChanged(latest)
      }
      setSelected([])
      setStatus(`Deleted ${deleted} run${deleted === 1 ? '' : 's'}.`)
    } catch (error) {
      onResultsChanged(latest)
      setSelected(targets.slice(deleted))
      setStatus(`${deleted ? `Deleted ${deleted} run${deleted === 1 ? '' : 's'} before the error. ` : ''}${error instanceof Error ? error.message : String(error)}`)
    } finally { setDeleting(false) }
  }

  return <>
    <Button size="small" variant="outlined" onClick={() => setOpen(true)}>{deleting ? 'Deleting runs…' : 'Manage runs'}</Button>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>Manage stored runs</DialogTitle>
      <DialogContent><Stack spacing={1.2} sx={{ pt: 0.5 }}>
        <FormControl size="small" fullWidth><InputLabel>Runs to delete</InputLabel><Select multiple label="Runs to delete" value={selected} onChange={(event) => setSelected(typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value)} renderValue={(value) => `${value.length} selected`} disabled={deleting}>{results.runs.map((run) => { const disabled = run.id === activeRunId; return <MenuItem key={run.id} value={run.id} disabled={disabled}><Checkbox size="small" checked={selected.includes(run.id)} disabled={disabled} /><ListItemText primary={run.id} secondary={disabled ? 'Active run · protected from deletion' : undefined} /></MenuItem> })}</Select></FormControl>
        <Stack direction="row" spacing={1}><Button size="small" onClick={() => setSelected(removable)} disabled={!removable.length || deleting}>Select all removable</Button><Button size="small" onClick={() => setSelected([])} disabled={!selected.length || deleting}>Clear</Button></Stack>
        {status && <Alert severity={status.startsWith('Deleted') && !status.includes('error') ? 'success' : status.startsWith('Deleting') ? 'info' : 'warning'}>{status}</Alert>}
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setOpen(false)}>Close</Button><Button color="error" variant="contained" onClick={deleteSelected} disabled={!selected.length || deleting}>{deleting ? 'Deleting…' : `Delete selected (${selected.length})`}</Button></DialogActions>
    </Dialog>
  </>
}
