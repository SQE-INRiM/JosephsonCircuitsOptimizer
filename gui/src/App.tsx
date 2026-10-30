import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  AppBar,
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
  LinearProgress,
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
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded'
import ZoomOutRoundedIcon from '@mui/icons-material/ZoomOutRounded'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import SettingsBrightnessRoundedIcon from '@mui/icons-material/SettingsBrightnessRounded'
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
import type { ThemePreference } from './theme'

const navigation: Array<{ id: NavigationSection; label: string; description: string; icon: React.ReactElement }> = [
  { id: 'setup', label: 'Setup', description: 'Model, computation, metrics', icon: <SettingsInputComponentRoundedIcon /> },
  { id: 'run', label: 'Run', description: 'Stages, progress, logs', icon: <PlayArrowRoundedIcon /> },
  { id: 'results', label: 'Results', description: 'Explore simulation data', icon: <AnalyticsOutlinedIcon /> },
]

export default function App({ themePreference = 'system', onThemePreferenceChange }: {
  themePreference?: ThemePreference
  onThemePreferenceChange?: (value: ThemePreference) => void
} = {}) {
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
  const [runtimePreparing, setRuntimePreparing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [juliaPath, setJuliaPath] = useState('julia')
  const [threads, setThreads] = useState(1)
  const [zoom, setZoom] = useState(100)
  const [draggingProject, setDraggingProject] = useState(false)
  const desktop = isDesktopBridgeAvailable()
  const startupInitialized = useRef(false)
  const initialProjectLoad = useRef<Promise<void>>(Promise.resolve())
  const fileDragActive = useRef(false)

  useEffect(() => {
    const adapter = getJcoAdapter()
    if (!adapter?.getZoom) return
    let active = true
    void adapter.getZoom().then((percent) => { if (active) setZoom(percent) }).catch(() => {})
    const unsubscribe = adapter.onZoomChanged?.((percent) => { if (active) setZoom(percent) })
    return () => { active = false; unsubscribe?.() }
  }, [])

  const applyZoom = async (value: number) => {
    try {
      const next = await getJcoAdapter()?.setZoom?.(value)
      if (next != null) setZoom(next)
    } catch (error) {
      setNotice('Unable to change zoom: ' + String(error))
    }
  }

  useEffect(() => {
    const adapter = getJcoAdapter()
    if (!adapter) return
    return adapter.onRunEvent(async (event) => {
      applyRunEvent(event)
      if (event.type === 'run-started') setCancelling(false)
      if (event.type === 'run-finished') setCancelling(false)
      if (event.type === 'run-finished') {
        try { setResults(await adapter.readResults()) } catch (error) { setNotice(`Run completed, but results could not be indexed: ${String(error)}`) }
      }
    })
  }, [applyRunEvent, setResults])

  useEffect(() => {
    if (!desktop || startupInitialized.current) return
    startupInitialized.current = true
    const adapter = getJcoAdapter()
    if (!adapter) return
    setRuntimePreparing(true)
    void adapter.setupRuntime()
      .catch((error) => {
        setNotice('Julia environment setup failed: ' + (error instanceof Error ? error.message : String(error)))
      })
      .finally(() => setRuntimePreparing(false))
    // Serialize an early file drop with the startup project initialization.
    // Otherwise a late 'newProject' response can overwrite a dropped project
    // after the user has already started editing it.
    initialProjectLoad.current = Promise.all([adapter.newProject(), adapter.listExamples()])
      .then(([loaded, listedExamples]) => {
        loadProject(loaded)
        setExamples(listedExamples)
      })
      .catch((error) => {
        setNotice(`New project could not be initialized: ${error instanceof Error ? error.message : String(error)}`)
      })
  }, [desktop, loadProject])

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
    if (running) return setNotice('Stop the active simulation before opening another project.')
    if (dirty && !window.confirm('Unsaved changes will be lost when you open another project. Continue?')) return
    const loaded = await adapter.openProject()
    if (loaded) { loadProject(loaded); await refreshResults(); setNotice(`Opened ${loaded.filename}`) }
  })

  useEffect(() => {
    if (!desktop) return
    const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files') || Boolean(event.dataTransfer?.files?.length)
    const clearDrag = () => {
      fileDragActive.current = false
      setDraggingProject(false)
    }
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      fileDragActive.current = true
      setDraggingProject(true)
    }
    const over = (event: DragEvent) => {
      if (!hasFiles(event) && !fileDragActive.current) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }
    const leave = (event: DragEvent) => {
      if (!event.relatedTarget) clearDrag()
    }
    const drop = (event: DragEvent) => {
      const wasFileDrag = hasFiles(event) || fileDragActive.current
      clearDrag() // also clear if Chromium omits the file type on drop
      if (!wasFileDrag) return
      event.preventDefault() // prevent Chromium from navigating away on file drops
      const files = Array.from(event.dataTransfer?.files ?? [])
      if (files.length !== 1 || !files[0].name.toLowerCase().endsWith('.jco')) {
        setNotice('Drop exactly one .jco project file.')
        return
      }
      if (busy || running) {
        setNotice('Opening a project is unavailable while the app is busy or a simulation is running.')
        return
      }
      if (dirty && !window.confirm('Unsaved changes will be lost when you open another project. Continue?')) return
      void perform(async () => {
        await initialProjectLoad.current
        const adapter = getJcoAdapter()
        if (!adapter?.openDroppedProject) throw new Error('Project file drop is unavailable in this desktop version.')
        const loaded = await adapter.openDroppedProject(files[0])
        if (loaded) { loadProject(loaded); await refreshResults(); setNotice(`Opened ${loaded.filename}`) }
      })
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    window.addEventListener('dragend', clearDrag)
    window.addEventListener('blur', clearDrag)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
      window.removeEventListener('dragend', clearDrag)
      window.removeEventListener('blur', clearDrag)
    }
  }, [desktop, busy, running, dirty, loadProject, setResults])

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
    setNotice(`Loaded example ${loaded.name}. You can run it directly; use Save As if you want to keep changes or results.`)
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
    <Box sx={{ display: 'flex', height: '100vh', minHeight: 0, overflow: 'hidden' }}>
      <AppBar position="fixed" elevation={0} sx={{ zIndex: 1300, backgroundColor: '#0B1F3B', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <Toolbar sx={{ minHeight: '66px !important', gap: 2 }}>
          <Box component="img" src="./jco-app-icon.svg" alt="JCO application icon" sx={{ width: 38, height: 38, flexShrink: 0, borderRadius: 1 }} />
          <Box sx={{ minWidth: { xs: 175, lg: 240 } }}>
            <Typography sx={{ fontWeight: 760, letterSpacing: '-.01em', lineHeight: 1.1 }}>Josephson Circuits Optimizer</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.6)' }}>Superconducting circuit design</Typography>
          </Box>
          <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,.12)', my: 1.4 }} />
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography noWrap sx={{ fontWeight: 700 }}>{project.name}{dirty ? ' *' : ''}</Typography>
              <Chip size="small" label={project.filename} sx={{ backgroundColor: 'rgba(255,255,255,.09)', color: 'rgba(255,255,255,.78)' }} />
            </Stack>
          </Box>
          <Chip size="small" label={desktop ? 'Desktop bridge' : 'Browser preview'} color={desktop ? 'success' : 'warning'} variant="outlined" sx={{ display: { xs: 'none', xl: 'flex' }, color: desktop ? '#a9dec9' : '#f1c77b', borderColor: desktop ? '#4c8a73' : '#9b753a' }} />
          <Chip size="small" label="Schema v1" sx={{ display: { xs: 'none', lg: 'flex' }, backgroundColor: 'rgba(255,255,255,.08)', color: '#d9e1e8' }} />
          {desktop && <Stack direction="row" spacing={0.2} sx={{ alignItems: 'center', border: '1px solid rgba(255,255,255,.2)', borderRadius: 2, px: 0.3 }}>
              <Tooltip title="Zoom out · Ctrl+−"><span><IconButton color="inherit" size="small" disabled={zoom <= 50} onClick={() => void applyZoom(zoom - 10)} aria-label="Zoom out"><ZoomOutRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Reset zoom · Ctrl+0"><Button color="inherit" size="small" onClick={() => void applyZoom(100)} aria-label="Reset zoom" sx={{ minWidth: 50, color: '#fff' }}>{zoom}%</Button></Tooltip>
              <Tooltip title="Zoom in · Ctrl++"><span><IconButton color="inherit" size="small" disabled={zoom >= 150} onClick={() => void applyZoom(zoom + 10)} aria-label="Zoom in"><ZoomInRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
            </Stack>}
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
            <MenuItem onClick={() => { setMenuAnchor(null); setAboutOpen(true) }}>About JCO…</MenuItem>
            <Divider />
            <MenuItem disabled sx={{ opacity: '1 !important', fontWeight: 750 }}>Appearance</MenuItem>
            {(['light', 'dark', 'system'] as const).map((choice) => <MenuItem
              key={choice} selected={themePreference === choice}
              onClick={() => { onThemePreferenceChange?.(choice); setMenuAnchor(null) }}>
              {choice === 'light' ? <LightModeRoundedIcon fontSize="small" sx={{ mr: 1.2 }} />
                : choice === 'dark' ? <DarkModeRoundedIcon fontSize="small" sx={{ mr: 1.2 }} />
                : <SettingsBrightnessRoundedIcon fontSize="small" sx={{ mr: 1.2 }} />}
              {choice === 'light' ? 'Light' : choice === 'dark' ? 'Dark' : 'System'}
              {themePreference === choice ? ' ✓' : ''}
            </MenuItem>)}
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="aside" sx={{ width: 250, flexShrink: 0, backgroundColor: 'background.paper', borderRight: '1px solid', borderColor: 'divider', pt: '66px' }}>
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
                sx={{ borderRadius: 2, mb: 0.6, alignItems: 'center', py: 1.2, '&.Mui-selected': { backgroundColor: 'primary.light', color: 'primary.main' } }}
              >
                <ListItemIcon sx={{ minWidth: 44, width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'inherit' }}>{item.icon}</ListItemIcon>
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
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5, p: 1.6, backgroundColor: 'background.default' }}>
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
          {runtimePreparing && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>Preparing Julia environment...</Typography>
              <Typography variant="body2">First-time setup can take several minutes. You can keep editing; simulations will start automatically when Julia is ready.</Typography>
              <LinearProgress sx={{ mt: 1.2 }} />
            </Alert>
          )}
          {section === 'setup' && project.name === 'New project' && !project.workspaceInfo?.projectPath && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Start from this new project, or open a bundled example from the ⋮ menu.
            </Alert>
          )}
          {section === 'setup' && <SetupScreen onRunRemaining={() => run()} onStop={stop} running={running} />}
          {section === 'run' && <RunScreen desktop={desktop} cancelling={cancelling} onRunRemaining={() => run()} onRunStage={(stage) => run([stage])} onStop={stop} />}
          {section === 'results' && <ResultsScreen />}
        </Box>
      </Box>

      {section !== 'setup' && (
        <Button
          variant="contained"
          color={running ? 'error' : 'primary'}
          startIcon={running ? undefined : <PlayArrowRoundedIcon />}
          onClick={running ? stop : () => run()}
          sx={{ position: 'fixed', right: 28, bottom: 24, zIndex: 1200, borderRadius: 99, px: 2.4, py: 1.15, boxShadow: '0 8px 24px rgba(16,43,74,.26)' }}
        >
          {running ? 'Stop run' : 'Run remaining'}
        </Button>
      )}
      {draggingProject && <Box role="status" aria-label="Drop .jco project" sx={{ position: 'fixed', inset: 0, zIndex: 1600, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(13,29,49,.72)', border: '4px dashed', borderColor: 'secondary.main' }}>
        <Box sx={{ backgroundColor: 'background.paper', color: 'text.primary', borderRadius: 3, p: 5, textAlign: 'center', boxShadow: 8 }}>
          <Typography variant="h5">Drop your .jco project here</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>Opens the project just like Open .jco…</Typography>
        </Box>
      </Box>}
      <Snackbar open={Boolean(notice)} autoHideDuration={3600} onClose={() => setNotice('')} message={notice} />

      <Dialog open={aboutOpen} onClose={() => setAboutOpen(false)} fullWidth maxWidth="sm" aria-labelledby="jco-about-title">
        <DialogTitle id="jco-about-title">About JCO</DialogTitle>
        <DialogContent>
          <Box component="img" src="./jco-logo.svg" alt="JCO — Josephson Circuits Optimizer" sx={{ display: 'block', width: '100%', maxWidth: 445, height: 'auto', mx: 'auto', borderRadius: 1.5 }} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Explore and optimize superconducting Josephson circuits with linear analysis, surrogate optimization and nonlinear harmonic balance.
          </Typography>
        </DialogContent>
        <DialogActions><Button onClick={() => setAboutOpen(false)}>Close</Button></DialogActions>
      </Dialog>

      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Julia runtime</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField label="Julia executable" value={juliaPath} onChange={(event) => setJuliaPath(event.target.value)} helperText="Use “julia” when it is available in PATH, or enter the full path to julia.exe." /><TextField label="Threads" type="number" value={threads} onChange={(event) => setThreads(Math.max(1, Number(event.target.value)))} /><Typography variant="body2" color="text.secondary">The first setup downloads and precompiles the Julia packages declared by the bundled JCO library. It can take several minutes.</Typography></Stack></DialogContent>
        <DialogActions><Button onClick={() => setSettingsOpen(false)}>Cancel</Button><Button onClick={() => perform(async () => { const adapter = getJcoAdapter(); if (!adapter) return; await adapter.setSettings({ juliaPath, threads }); const result = await adapter.setupRuntime(); setNotice(result.message) })}>Save &amp; setup</Button><Button variant="contained" onClick={() => perform(async () => { await getJcoAdapter()?.setSettings({ juliaPath, threads }); setSettingsOpen(false); setNotice('Julia settings saved.') })}>Save settings</Button></DialogActions>
      </Dialog>
    </Box>
  )
}
