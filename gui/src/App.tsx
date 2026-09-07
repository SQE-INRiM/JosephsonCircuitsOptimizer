import { useEffect, useState } from 'react'
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined'
import BoltRoundedIcon from '@mui/icons-material/BoltRounded'
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined'
import SettingsInputComponentRoundedIcon from '@mui/icons-material/SettingsInputComponentRounded'
import { SetupScreen } from './screens/SetupScreen'
import { RunScreen } from './screens/RunScreen'
import { ResultsScreen } from './screens/ResultsScreen'
import { useAppStore } from './store'
import { getJcoAdapter, isDesktopBridgeAvailable } from './services/jcoAdapter'
import type { ExampleDescriptor } from './services/jcoAdapter'
import type { NavigationSection, StageId } from './types'

const navigation: Array<{ id: NavigationSection; label: string; description: string; icon: React.ReactElement }> = [
  { id: 'setup', label: 'Setup', description: 'Model, computation, metrics', icon: <SettingsInputComponentRoundedIcon /> },
  { id: 'run', label: 'Run', description: 'Stages, progress, logs', icon: <PlayArrowRoundedIcon /> },
  { id: 'results', label: 'Results', description: 'Explore simulation data', icon: <AnalyticsOutlinedIcon /> },
]

export default function App() {
  const section = useAppStore((state) => state.section)
  const setSection = useAppStore((state) => state.setSection)
  const project = useAppStore((state) => state.project)
  const dirty = useAppStore((state) => state.dirty)
  const markSaved = useAppStore((state) => state.markSaved)
  const loadProject = useAppStore((state) => state.loadProject)
  const setResults = useAppStore((state) => state.setResults)
  const stages = useAppStore((state) => state.stages)
  const applyRunEvent = useAppStore((state) => state.applyRunEvent)
  const running = useAppStore((state) => state.running)
  const startDemoRun = useAppStore((state) => state.startDemoRun)
  const stopDemoRun = useAppStore((state) => state.stopDemoRun)
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [examples, setExamples] = useState<ExampleDescriptor[]>([])
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [juliaPath, setJuliaPath] = useState('julia')
  const [threads, setThreads] = useState(1)
  const desktop = isDesktopBridgeAvailable()

  useEffect(() => {
    const adapter = getJcoAdapter()
    if (!adapter) return
    return adapter.onRunEvent(async (event) => {
      applyRunEvent(event)
      if (event.type === 'run-started') setCancelling(false)
      if (event.type === 'run-finished') setCancelling(false)
      if (event.type === 'run-finished' && event.outcome === 'completed') {
        try { setResults(await adapter.readResults()) } catch (error) { setNotice(`Run completed, but results could not be indexed: ${String(error)}`) }
      }
    })
  }, [applyRunEvent, setResults])

  const refreshExamples = async () => {
    const adapter = getJcoAdapter()
    if (!adapter) return
    try { setExamples(await adapter.listExamples()) }
    catch (error) { setExamples([]); setNotice(`Examples could not be indexed: ${error instanceof Error ? error.message : String(error)}`) }
  }

  const perform = async (action: () => Promise<void>) => {
    setMenuAnchor(null)
    setBusy(true)
    try { await action() } catch (error) { setNotice(error instanceof Error ? error.message : String(error)) } finally { setBusy(false) }
  }

  const refreshResults = async () => {
    const adapter = getJcoAdapter()
    if (!adapter) return
    try { setResults(await adapter.readResults()) } catch (error) { setNotice(`Project opened, but existing results require a working Julia environment: ${String(error)}`) }
  }

  const openProject = () => perform(async () => {
    const adapter = getJcoAdapter()
    if (!adapter) return setNotice('Use the Windows desktop build to open .jco files.')
    const loaded = await adapter.openProject()
    if (loaded) { loadProject(loaded); await refreshResults(); setNotice(`Opened ${loaded.filename}`) }
  })

  const importWorkspace = () => perform(async () => {
    const adapter = getJcoAdapter()
    if (!adapter) return setNotice('Workspace import is available in the Windows desktop build.')
    const loaded = await adapter.importWorkspace()
    if (loaded) { loadProject(loaded); await refreshResults(); setNotice('Legacy workspace imported. Use Save As to create one .jco file.') }
  })

  const openExample = (fileName: string) => perform(async () => {
    const adapter = getJcoAdapter()
    if (!adapter) return setNotice('Bundled examples are available in the Windows desktop build.')
    const loaded = await adapter.openExample(fileName)
    loadProject(loaded)
    await refreshResults()
    setNotice(`Loaded example ${loaded.name}. Save As before modifying the original example.`)
  })

  const openSettings = () => perform(async () => {
    const adapter = getJcoAdapter()
    if (!adapter) return setNotice('Julia settings are available in the Windows desktop build.')
    const settings = await adapter.getSettings()
    setJuliaPath(settings.juliaPath)
    setThreads(settings.threads)
    setSettingsOpen(true)
  })

  const save = (saveAs = false) => perform(async () => {
    const adapter = getJcoAdapter()
    if (!adapter) { markSaved(); return setNotice('Preview state marked as saved. Desktop build writes the .jco file.') }
    const saved = await adapter.saveProject(project, saveAs)
    if (saved) { if (saved.project) loadProject(saved.project); else markSaved(); setNotice(`Saved ${saved.path}`) }
  })

  const exportWorkspace = () => perform(async () => {
    const adapter = getJcoAdapter()
    if (!adapter) return setNotice('Workspace ZIP export is available in the Windows desktop build.')
    const target = await adapter.exportWorkspace(project)
    if (target) setNotice(`Exported editable workspace to ${target}`)
  })

  const run = async (requestedStages?: StageId[]) => {
    const adapter = getJcoAdapter()
    if (!adapter) return startDemoRun()
    const selected = requestedStages ?? stages.filter((stage) => ['ready', 'stale', 'failed', 'cancelled'].includes(stage.status)).map((stage) => stage.id)
    if (!selected.length) return setNotice('No stage needs to be run.')
    try { await adapter.startRun({ project, stages: selected }) } catch (error) { setNotice(error instanceof Error ? error.message : String(error)) }
  }

  const stop = async () => {
    const adapter = getJcoAdapter()
    if (!adapter) return stopDemoRun()
    setCancelling(true)
    try {
      const result = await adapter.cancelRun(useAppStore.getState().currentRunId ?? 'current')
      if (!result.accepted) {
        setCancelling(false)
        setNotice(result.message || 'No simulation is running.')
      }
    } catch (error) {
      setCancelling(false)
      setNotice(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh', minHeight: 760, overflow: 'hidden' }}>
      <AppBar position="fixed" elevation={0} sx={{ zIndex: 1300, backgroundColor: '#101b2d', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <Toolbar sx={{ minHeight: '66px !important', gap: 2 }}>
          <Avatar variant="rounded" sx={{ width: 38, height: 38, background: 'linear-gradient(135deg,#d9a34b,#9c6723)', color: '#fff' }}>
            <BoltRoundedIcon />
          </Avatar>
          <Box sx={{ minWidth: 240 }}>
            <Typography sx={{ fontWeight: 760, letterSpacing: '-.01em', lineHeight: 1.1 }}>Josephson Circuits Optimizer</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.6)' }}>Project workspace prototype</Typography>
          </Box>
          <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,.12)', my: 1.4 }} />
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography noWrap sx={{ fontWeight: 700 }}>{project.name}{dirty ? ' *' : ''}</Typography>
              <Chip size="small" label={project.filename} sx={{ backgroundColor: 'rgba(255,255,255,.09)', color: 'rgba(255,255,255,.78)' }} />
            </Stack>
          </Box>
          <Chip size="small" label={desktop ? 'Desktop bridge' : 'Browser preview'} color={desktop ? 'success' : 'warning'} variant="outlined" sx={{ color: desktop ? '#a9dec9' : '#f1c77b', borderColor: desktop ? '#4c8a73' : '#9b753a' }} />
          <Chip size="small" label="Schema v1" sx={{ backgroundColor: 'rgba(255,255,255,.08)', color: '#d9e1e8' }} />
          <Tooltip title="Save project">
            <span>
              <IconButton color="inherit" disabled={!dirty || busy} onClick={() => save(false)}>
                <SaveRoundedIcon />
              </IconButton>
            </span>
          </Tooltip>
          <IconButton color="inherit" onClick={(event) => { setMenuAnchor(event.currentTarget); void refreshExamples() }}><MoreVertRoundedIcon /></IconButton>
          <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
            <MenuItem disabled={running} onClick={() => perform(async () => { const loaded = await getJcoAdapter()?.newProject(); if (loaded) loadProject(loaded) })}>New project</MenuItem>
            <MenuItem disabled={running} onClick={openProject}>Open .jco…</MenuItem>
            <MenuItem disabled={running} onClick={importWorkspace}><FolderOpenRoundedIcon fontSize="small" sx={{ mr: 1 }} />Import legacy folder…</MenuItem>
            <Divider />
            {examples.length
              ? examples.map((example) => <MenuItem key={example.fileName} disabled={running} onClick={() => openExample(example.fileName)}>Example · {example.name}</MenuItem>)
              : <MenuItem disabled>No bundled examples found</MenuItem>}
            <Divider />
            <MenuItem disabled={running} onClick={() => save(false)}>Save</MenuItem>
            <MenuItem disabled={running} onClick={() => save(true)}>Save As…</MenuItem>
            <MenuItem disabled={running} onClick={exportWorkspace}>Export editable workspace (.zip)…</MenuItem>
            <Divider />
            <MenuItem onClick={() => setNotice('Choose a dataset in Results, then use Export filtered data.')}>Export Data…</MenuItem>
            <MenuItem disabled={running} onClick={openSettings}>Julia settings…</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="aside" sx={{ width: 250, flexShrink: 0, backgroundColor: '#fff', borderRight: '1px solid', borderColor: 'divider', pt: '66px' }}>
        <Stack sx={{ height: '100%' }}>
          <Box sx={{ p: 2.2, pb: 1 }}>
            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: '.12em' }}>Workspace</Typography>
          </Box>
          <List sx={{ px: 1.2, pt: 0 }}>
            {navigation.map((item) => (
              <ListItemButton
                key={item.id}
                selected={section === item.id}
                onClick={() => setSection(item.id)}
                sx={{ borderRadius: 2, mb: 0.6, alignItems: 'flex-start', py: 1.2, '&.Mui-selected': { backgroundColor: 'primary.light', color: 'primary.main' } }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: 'inherit', mt: 0.2 }}>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.label}
                  secondary={item.description}
                  slotProps={{
                    primary: { sx: { fontWeight: 720 } },
                    secondary: { sx: { fontSize: 11.5 } },
                  }}
                />
              </ListItemButton>
            ))}
          </List>
          <Box sx={{ mt: 'auto', p: 2 }}>
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5, p: 1.6, backgroundColor: '#f8fafb' }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <ScienceOutlinedIcon color="primary" fontSize="small" />
                <Typography variant="subtitle2" sx={{ fontWeight: 750 }}>{project.name}</Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.7, display: 'block' }}>{project.parameters.length} parameters · {project.sources.length} sources<br />{project.workspaceInfo?.auxiliaryFiles.length ?? 0} auxiliary input files</Typography>
            </Box>
          </Box>
        </Stack>
      </Box>

      <Box component="main" className="content-scroll" sx={{ flex: 1, minWidth: 0, pt: '66px', overflow: 'auto' }}>
        <Box sx={{ p: { xs: 2.5, xl: 4 }, maxWidth: 1680, mx: 'auto' }}>
          {section === 'setup' && <SetupScreen />}
          {section === 'run' && <RunScreen desktop={desktop} cancelling={cancelling} onRunRemaining={() => run()} onRunStage={(stage) => run([stage])} onStop={stop} />}
          {section === 'results' && <ResultsScreen />}
        </Box>
      </Box>

      <Button
        variant="contained"
        color={running ? 'error' : 'primary'}
        startIcon={running ? undefined : <PlayArrowRoundedIcon />}
        onClick={running ? stop : () => run()}
        sx={{ position: 'fixed', right: 28, bottom: 24, zIndex: 1200, borderRadius: 99, px: 2.4, py: 1.15, boxShadow: '0 8px 24px rgba(16,43,74,.26)' }}
      >
        {running ? 'Stop run' : 'Run remaining'}
      </Button>
      <Snackbar open={Boolean(notice)} autoHideDuration={3600} onClose={() => setNotice('')} message={notice} />

      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Julia runtime</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField label="Julia executable" value={juliaPath} onChange={(event) => setJuliaPath(event.target.value)} helperText="Use “julia” when it is available in PATH, or enter the full path to julia.exe." /><TextField label="Threads" type="number" value={threads} onChange={(event) => setThreads(Math.max(1, Number(event.target.value)))} /><Typography variant="body2" color="text.secondary">The first setup downloads and precompiles the Julia packages declared by the bundled JCO library. It can take several minutes.</Typography></Stack></DialogContent>
        <DialogActions><Button onClick={() => setSettingsOpen(false)}>Cancel</Button><Button onClick={() => perform(async () => { const adapter = getJcoAdapter(); if (!adapter) return; await adapter.setSettings({ juliaPath, threads }); const result = await adapter.setupRuntime(); setNotice(result.message) })}>Save &amp; setup</Button><Button variant="contained" onClick={() => perform(async () => { await getJcoAdapter()?.setSettings({ juliaPath, threads }); setSettingsOpen(false); setNotice('Julia settings saved.') })}>Save settings</Button></DialogActions>
      </Dialog>
    </Box>
  )
}
