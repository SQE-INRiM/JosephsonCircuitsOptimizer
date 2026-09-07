import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  Step,
  StepButton,
  Stepper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import CodeRoundedIcon from '@mui/icons-material/CodeRounded'
import DataObjectRoundedIcon from '@mui/icons-material/DataObjectRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import ElectricBoltRoundedIcon from '@mui/icons-material/ElectricBoltRounded'
import FunctionsRoundedIcon from '@mui/icons-material/FunctionsRounded'
import MemoryRoundedIcon from '@mui/icons-material/MemoryRounded'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
import { CircuitPreviewSection } from '../components/CircuitPreviewSection'
import { useAppStore } from '../store'
import type { ParameterMode, SetupStep, SourceAmplitudeUnit, SourceValueSpec } from '../types'
import { convertSourceValueSpec, DEFAULT_SOURCE_IMPEDANCE_OHM } from '../utils/sourceUnits'

const steps = ['Model & inputs', 'Computation', 'Metrics & constraints']
type AmplitudeMode = ParameterMode | 'Parametric'

function parametricSourceFunctions(code: string): string[] {
  const names: string[] = []
  const pattern = /\bfunction\s+([A-Za-z_]\w*)\s*\(\s*(?:device_params_set|device_parameters_set)\b[^)]*\)/g
  for (const match of code.matchAll(pattern)) if (!names.includes(match[1])) names.push(match[1])
  return names
}

function SectionHeading({ icon, title, description }: { icon: React.ReactElement; title: string; description: string }) {
  return (
    <Stack direction="row" spacing={1.3} sx={{ alignItems: 'center' }}>
      <Box sx={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 2, backgroundColor: 'primary.light', color: 'primary.main' }}>{icon}</Box>
      <Box>
        <Typography variant="h6">{title}</Typography>
        <Typography variant="body2" color="text.secondary">{description}</Typography>
      </Box>
    </Stack>
  )
}

function CodeDialog({ open, onClose, title, filename, value, onChange }: {
  open: boolean
  onClose: () => void
  title: string
  filename: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        <Stack direction="row" spacing={1.2} sx={{ alignItems: 'center' }}>
          <CodeRoundedIcon color="primary" />
          <Box>
            <Typography variant="h6">{title}</Typography>
            <Typography variant="caption" color="text.secondary">{filename}</Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <TextField
          className="code-editor"
          fullWidth
          multiline
          minRows={24}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          sx={{ '& .MuiOutlinedInput-root': { alignItems: 'flex-start', backgroundColor: '#101826', color: '#dce7f3' } }}
        />
      </DialogContent>
    </Dialog>
  )
}

function SourceValueEditor({ label, unit, spec, disabled = false, onChange }: { label: string; unit: string; spec: SourceValueSpec; disabled?: boolean; onChange: (spec: SourceValueSpec) => void }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, flex: 1, minWidth: 250, opacity: disabled ? 0.65 : 1 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{label} <Typography component="span" variant="caption" color="text.secondary">/ {unit}</Typography></Typography>
      <Stack spacing={1}>
        <Select size="small" value={spec.mode} disabled={disabled} onChange={(event) => onChange({ mode: event.target.value as ParameterMode, value: '', start: '', stop: '', step: '', values: '' })}>
          <MenuItem value="Fixed">Fixed</MenuItem>
          <MenuItem value="Range">Range</MenuItem>
          <MenuItem value="List">List</MenuItem>
        </Select>
        {spec.mode === 'Fixed' && <TextField size="small" label="Value" value={spec.value ?? ''} disabled={disabled} onChange={(event) => onChange({ ...spec, value: event.target.value })} />}
        {spec.mode === 'List' && <TextField size="small" label="Values" value={spec.values ?? ''} disabled={disabled} placeholder="[v1, v2] or v1, v2" onChange={(event) => onChange({ ...spec, values: event.target.value })} />}
        {spec.mode === 'Range' && (
          <Stack direction="row" spacing={1}>
            <TextField size="small" label="Start" value={spec.start ?? ''} disabled={disabled} onChange={(event) => onChange({ ...spec, start: event.target.value })} />
            <TextField size="small" label="Stop" value={spec.stop ?? ''} disabled={disabled} onChange={(event) => onChange({ ...spec, stop: event.target.value })} />
            <TextField size="small" label="Step" value={spec.step ?? ''} disabled={disabled} onChange={(event) => onChange({ ...spec, step: event.target.value })} />
          </Stack>
        )}
      </Stack>
    </Paper>
  )
}

function SourceAmplitudeEditor({ label, unit, impedanceOhm, spec, parametricFunctions, onSpecChange, onUnitChange, onParametricSelect, onEditParametric }: {
  label: string
  unit: SourceAmplitudeUnit
  impedanceOhm: number
  spec: SourceValueSpec
  parametricFunctions: string[]
  onSpecChange: (spec: SourceValueSpec) => void
  onUnitChange: (unit: SourceAmplitudeUnit, spec: SourceValueSpec) => void
  onParametricSelect: (functionName: string) => void
  onEditParametric: () => void
}) {
  const selectedFunction = String(spec.value ?? '').trim()
  const isParametric = spec.mode === 'Fixed' && parametricFunctions.includes(selectedFunction)
  const mode: AmplitudeMode = isParametric ? 'Parametric' : spec.mode
  const displayUnit: SourceAmplitudeUnit = isParametric ? 'A' : unit

  return (
    <Paper variant="outlined" sx={{ p: 1.5, flex: 1, minWidth: 250 }}>
      <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center' }}>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>{label}</Typography>
        <Select
          size="small"
          value={displayUnit}
          disabled={isParametric}
          onChange={(event) => {
            const nextUnit = event.target.value as SourceAmplitudeUnit
            onUnitChange(nextUnit, convertSourceValueSpec(spec, unit, nextUnit, impedanceOhm))
          }}
          sx={{ minWidth: 82 }}
        >
          <MenuItem value="A">A</MenuItem>
          <MenuItem value="dBm">dBm</MenuItem>
        </Select>
      </Stack>
      <Stack spacing={1}>
        <Select
          size="small"
          value={mode}
          onChange={(event) => {
            const nextMode = event.target.value as AmplitudeMode
            if (nextMode === 'Parametric') onParametricSelect(parametricFunctions[0] ?? '')
            else onSpecChange({ mode: nextMode, value: '', start: '', stop: '', step: '', values: '' })
          }}
        >
          <MenuItem value="Fixed">Fixed</MenuItem>
          <MenuItem value="Range">Range</MenuItem>
          <MenuItem value="List">List</MenuItem>
          <MenuItem value="Parametric">Parametric</MenuItem>
        </Select>
        {mode === 'Fixed' && <TextField size="small" label={`Value / ${unit}`} value={spec.value ?? ''} onChange={(event) => onSpecChange({ ...spec, value: event.target.value })} />}
        {mode === 'List' && <TextField size="small" label={`Values / ${unit}`} value={spec.values ?? ''} placeholder={unit === 'dBm' ? '-90, -85, -80' : '[v1, v2] or v1, v2'} onChange={(event) => onSpecChange({ ...spec, values: event.target.value })} />}
        {mode === 'Range' && (
          <Stack direction="row" spacing={1}>
            <TextField size="small" label="Start" value={spec.start ?? ''} onChange={(event) => onSpecChange({ ...spec, start: event.target.value })} />
            <TextField size="small" label="Stop" value={spec.stop ?? ''} onChange={(event) => onSpecChange({ ...spec, stop: event.target.value })} />
            <TextField size="small" label="Step" value={spec.step ?? ''} onChange={(event) => onSpecChange({ ...spec, step: event.target.value })} />
          </Stack>
        )}
        {mode === 'Parametric' && (
          <Stack direction="row" spacing={1}>
            <TextField select size="small" label="Julia function" value={selectedFunction} onChange={(event) => onParametricSelect(event.target.value)} fullWidth>
              {parametricFunctions.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
            </TextField>
            <Button variant="outlined" onClick={onEditParametric} sx={{ whiteSpace: 'nowrap' }}>Edit functions</Button>
          </Stack>
        )}
        {mode === 'Parametric' && parametricFunctions.length === 0 && <Alert severity="warning">Define a function with <code>device_params_set</code> as its first argument.</Alert>}
        {mode === 'Parametric' && <Typography variant="caption" color="text.secondary">The selected Julia function is evaluated for each device configuration and must return source current in A.</Typography>}
        {mode !== 'Parametric' && unit === 'dBm' && <Typography variant="caption" color="text.secondary">Converted to source current at save/run using Z₀ = {impedanceOhm} Ω. Use -Inf for an off-state (0 A).</Typography>}
      </Stack>
    </Paper>
  )
}

function ModelStep() {
  const panel = useAppStore((state) => state.setupPanel)
  const setPanel = useAppStore((state) => state.setSetupPanel)
  const project = useAppStore((state) => state.project)
  const updateParameter = useAppStore((state) => state.updateParameter)
  const addParameter = useAppStore((state) => state.addParameter)
  const removeParameter = useAppStore((state) => state.removeParameter)
  const updateCircuitCode = useAppStore((state) => state.updateCircuitCode)
  const updateSource = useAppStore((state) => state.updateSource)
  const addSource = useAppStore((state) => state.addSource)
  const removeSource = useAppStore((state) => state.removeSource)
  const updateParametricSourcesCode = useAppStore((state) => state.updateParametricSourcesCode)
  const [circuitOpen, setCircuitOpen] = useState(false)
  const [parametricOpen, setParametricOpen] = useState(false)

  const functions = parametricSourceFunctions(project.parametricSourcesCode ?? '')
  const calibrationFiles = project.auxiliaryTextFiles ?? {}
  const panelIndex = panel === 'circuit' ? 0 : panel === 'parameters' ? 1 : 2
  const missingParameters = project.parameters.filter((parameter) => parameter.circuitStatus === 'missing')
  const totalConfigurations = project.parameters.reduce((total, parameter) => {
    if (parameter.mode === 'Fixed') return total
    if (parameter.mode === 'List') return total * Math.max(1, (parameter.values ?? '').split(',').filter(Boolean).length)
    const start = Number(parameter.start)
    const stop = Number(parameter.stop)
    const step = Number(parameter.step)
    return total * (Number.isFinite(start + stop + step) && step > 0 ? Math.floor((stop - start) / step) + 1 : 1)
  }, 1)

  const setCalibrationFiles = (auxiliaryTextFiles: Record<string, string>) => {
    useAppStore.setState((state) => ({
      dirty: true,
      project: { ...state.project, auxiliaryTextFiles },
      stages: state.stages.map((stage) => stage.status === 'running' ? stage : { ...stage, status: stage.id === 'optimization' && stage.status === 'skipped' ? 'skipped' : 'stale', progress: 0 }),
    }))
  }

  const addCalibrationFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...calibrationFiles }
    for (const file of Array.from(event.target.files ?? [])) {
      if (!/\.txt$/i.test(file.name)) continue
      next[file.name] = await file.text()
    }
    setCalibrationFiles(next)
    event.target.value = ''
  }

  const removeCalibrationFile = (name: string) => {
    const next = { ...calibrationFiles }
    delete next[name]
    setCalibrationFiles(next)
  }

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <Tabs value={panelIndex} onChange={(_, index) => setPanel(index === 0 ? 'circuit' : index === 1 ? 'parameters' : 'sources')} sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab icon={<CodeRoundedIcon />} iconPosition="start" label="Circuit" />
        <Tab icon={<DataObjectRoundedIcon />} iconPosition="start" label={`Device parameters (${project.parameters.length})`} />
        <Tab icon={<ElectricBoltRoundedIcon />} iconPosition="start" label={`Sources (${project.sources.length})`} />
      </Tabs>

      {panel === 'circuit' && (
        <Box sx={{ p: 2.5 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <SectionHeading icon={<CodeRoundedIcon />} title="Circuit model" description="Opening a project does not execute Julia; generate the preview explicitly or run the simulation to resolve the circuit." />
            <Button variant="outlined" startIcon={<CodeRoundedIcon />} onClick={() => setCircuitOpen(true)}>Circuit definition</Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>user_circuit.jl · {project.circuitCode.split('\n').length} lines</Typography>
          <CircuitPreviewSection />
          <CodeDialog open={circuitOpen} onClose={() => setCircuitOpen(false)} title="Circuit definition" filename="user_circuit.jl" value={project.circuitCode} onChange={updateCircuitCode} />
        </Box>
      )}

      {panel === 'parameters' && (
        <Box sx={{ p: 2.5 }}>
          <Stack direction="row" sx={{ mb: 2, justifyContent: 'space-between', alignItems: 'center' }}>
            <SectionHeading icon={<DataObjectRoundedIcon />} title="Device parameter space" description="Choose a fixed value, a regular range, or an explicit list for every model parameter." />
            <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={addParameter}>Add parameter</Button>
          </Stack>
          {missingParameters.length > 0 && <Alert severity="warning" sx={{ mb: 2 }}>{missingParameters.length} circuit parameter{missingParameters.length === 1 ? '' : 's'} still need a value.</Alert>}
          <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Table size="small">
              <TableHead><TableRow><TableCell>Name</TableCell><TableCell width={125}>Mode</TableCell><TableCell>Value / Start</TableCell><TableCell>Stop</TableCell><TableCell>Step / Values</TableCell><TableCell width={100}>Unit</TableCell><TableCell width={120}>Circuit</TableCell><TableCell width={54} /></TableRow></TableHead>
              <TableBody>
                {project.parameters.map((parameter) => (
                  <TableRow key={parameter.id} hover>
                    <TableCell><Tooltip title={parameter.circuitStatus === 'unused' ? 'Manual parameter name' : 'Rename this parameter in the circuit code'}><TextField value={parameter.name} disabled={parameter.circuitStatus !== 'unused'} onChange={(event) => updateParameter(parameter.id, { name: event.target.value })} sx={{ width: 110 }} /></Tooltip></TableCell>
                    <TableCell><Select value={parameter.mode} onChange={(event) => updateParameter(parameter.id, { mode: event.target.value as ParameterMode })} size="small" fullWidth><MenuItem value="Fixed">Fixed</MenuItem><MenuItem value="Range">Range</MenuItem><MenuItem value="List">List</MenuItem></Select></TableCell>
                    <TableCell><TextField value={parameter.mode === 'Range' ? parameter.start ?? '' : parameter.mode === 'List' ? '' : parameter.value ?? ''} disabled={parameter.mode === 'List'} onChange={(event) => updateParameter(parameter.id, parameter.mode === 'Range' ? { start: event.target.value } : { value: event.target.value })} /></TableCell>
                    <TableCell><TextField value={parameter.stop ?? ''} disabled={parameter.mode !== 'Range'} onChange={(event) => updateParameter(parameter.id, { stop: event.target.value })} /></TableCell>
                    <TableCell><TextField value={parameter.mode === 'List' ? parameter.values ?? '' : parameter.step ?? ''} disabled={parameter.mode === 'Fixed'} placeholder={parameter.mode === 'List' ? 'v1, v2, v3' : ''} onChange={(event) => updateParameter(parameter.id, parameter.mode === 'List' ? { values: event.target.value } : { step: event.target.value })} /></TableCell>
                    <TableCell><TextField value={parameter.unit} onChange={(event) => updateParameter(parameter.id, { unit: event.target.value })} /></TableCell>
                    <TableCell><Chip size="small" label={parameter.circuitStatus === 'configured' ? 'Connected' : parameter.circuitStatus === 'missing' ? 'Needs value' : 'Manual'} color={parameter.circuitStatus === 'configured' ? 'success' : parameter.circuitStatus === 'missing' ? 'warning' : 'default'} variant={parameter.circuitStatus === 'unused' ? 'outlined' : 'filled'} /></TableCell>
                    <TableCell><Tooltip title={parameter.circuitStatus === 'unused' ? 'Remove parameter' : 'Remove its reference from the circuit code first'}><span><IconButton size="small" aria-label={`Remove ${parameter.name}`} disabled={parameter.circuitStatus !== 'unused'} onClick={() => removeParameter(parameter.id)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></span></Tooltip></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Paper variant="outlined" sx={{ px: 2, py: 1.2, minWidth: 180 }}><Typography variant="caption" color="text.secondary">Configurations</Typography><Typography variant="h6">{totalConfigurations.toLocaleString()}</Typography></Paper>
            <Alert severity={totalConfigurations === 1 ? 'info' : 'success'} sx={{ flex: 1 }}>{totalConfigurations === 1 ? 'Single-point project: Optimization will be skipped automatically.' : `${totalConfigurations} points will enter the linear design sweep.`}</Alert>
          </Stack>
        </Box>
      )}

      {panel === 'sources' && (
        <Box sx={{ p: 2.5 }}>
          <Stack direction="row" sx={{ mb: 2, justifyContent: 'space-between', alignItems: 'center' }}>
            <SectionHeading icon={<ElectricBoltRoundedIcon />} title="Sources & drives" description="Use fixed/swept amplitudes or bind a source to a Julia function of the current device parameters." />
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" startIcon={<CodeRoundedIcon />} onClick={() => setParametricOpen(true)}>Parametric functions</Button>
              <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={addSource}>Add source</Button>
            </Stack>
          </Stack>
          <Stack spacing={1.5}>
            {project.sources.map((source) => {
              const impedanceOhm = source.impedanceOhm ?? DEFAULT_SOURCE_IMPEDANCE_OHM
              const linearUnit = source.linearAmplitudeUnit ?? 'A'
              const nonlinearUnit = source.nonlinearAmplitudeUnit ?? 'A'
              return (
                <Paper key={source.id} variant="outlined" sx={{ p: 2 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 1.5, alignItems: { md: 'center' } }}>
                    <Typography variant="subtitle1" sx={{ minWidth: 120, fontWeight: 600 }}>{source.name}</Typography>
                    <TextField label="Port" type="number" value={source.port} onChange={(event) => updateSource(source.id, { port: Math.max(1, Number(event.target.value)) })} sx={{ width: 100 }} />
                    <FormControlLabel control={<Checkbox checked={source.isDc} onChange={(event) => updateSource(source.id, { isDc: event.target.checked, frequency: event.target.checked ? { mode: 'Fixed', value: '0' } : source.frequency.mode === 'Fixed' && Number(source.frequency.value) === 0 ? { mode: 'Fixed', value: '1' } : source.frequency })} />} label={source.isDc ? 'DC source · zero mode' : 'AC source'} />
                    <TextField label="Z₀" type="number" value={impedanceOhm} onChange={(event) => updateSource(source.id, { impedanceOhm: Math.max(Number.EPSILON, Number(event.target.value)) })} slotProps={{ input: { endAdornment: <Typography variant="caption" color="text.secondary">Ω</Typography> } }} sx={{ width: 120 }} />
                    <Box sx={{ flex: 1 }} />
                    <Tooltip title="Remove source"><IconButton color="error" onClick={() => removeSource(source.id)}><DeleteOutlineRoundedIcon /></IconButton></Tooltip>
                  </Stack>
                  <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.5}>
                    <SourceValueEditor label="Frequency" unit="GHz" spec={source.frequency} disabled={source.isDc} onChange={(frequency) => updateSource(source.id, { frequency })} />
                    <SourceAmplitudeEditor
                      label="Linear amplitude"
                      unit={linearUnit}
                      impedanceOhm={impedanceOhm}
                      spec={source.linearAmplitude}
                      parametricFunctions={functions}
                      onSpecChange={(linearAmplitude) => updateSource(source.id, { linearAmplitude })}
                      onUnitChange={(linearAmplitudeUnit, linearAmplitude) => updateSource(source.id, { linearAmplitudeUnit, linearAmplitude })}
                      onParametricSelect={(functionName) => updateSource(source.id, { linearAmplitude: { mode: 'Fixed', value: functionName }, linearAmplitudeUnit: 'A' })}
                      onEditParametric={() => setParametricOpen(true)}
                    />
                    <SourceAmplitudeEditor
                      label="Nonlinear amplitude"
                      unit={nonlinearUnit}
                      impedanceOhm={impedanceOhm}
                      spec={source.nonlinearAmplitude}
                      parametricFunctions={functions}
                      onSpecChange={(nonlinearAmplitude) => updateSource(source.id, { nonlinearAmplitude })}
                      onUnitChange={(nonlinearAmplitudeUnit, nonlinearAmplitude) => updateSource(source.id, { nonlinearAmplitudeUnit, nonlinearAmplitude })}
                      onParametricSelect={(functionName) => updateSource(source.id, { nonlinearAmplitude: { mode: 'Fixed', value: functionName }, nonlinearAmplitudeUnit: 'A' })}
                      onEditParametric={() => setParametricOpen(true)}
                    />
                  </Stack>
                </Paper>
              )
            })}
          </Stack>
          {project.sources.length === 0 && <Alert severity="warning">Add at least one non-DC source before running a simulation.</Alert>}

          <Paper variant="outlined" sx={{ mt: 1.5, px: 1.5, py: 1.2 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Box sx={{ minWidth: 160 }}><Typography variant="subtitle2">Calibration files</Typography><Typography variant="caption" color="text.secondary">Stored inside user_inputs/</Typography></Box>
              {Object.keys(calibrationFiles).map((name) => <Chip key={name} label={name} onDelete={() => removeCalibrationFile(name)} />)}
              <Box sx={{ flex: 1 }} />
              <Button component="label" size="small" variant="outlined" startIcon={<AddRoundedIcon />}>
                Add .txt
                <input hidden type="file" accept=".txt,text/plain" multiple onChange={addCalibrationFiles} />
              </Button>
            </Stack>
          </Paper>

          <Alert severity="info" sx={{ mt: 1.5 }}>Parametric functions keep the existing JCO contract: the function name is stored in the drive configuration, JCO evaluates it with <code>device_params_set</code>, and the function returns current in A. Attached .txt calibration files are packed into the .jco project.</Alert>
          <CodeDialog open={parametricOpen} onClose={() => setParametricOpen(false)} title="Parametric source functions" filename="user_parametric_sources.jl" value={project.parametricSourcesCode ?? ''} onChange={updateParametricSourcesCode} />
        </Box>
      )}
    </Paper>
  )
}

function NumberField({ label, value, suffix, onChange }: { label: string; value: number; suffix?: string; onChange: (value: number) => void }) {
  return <TextField fullWidth label={label} type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} slotProps={suffix ? { input: { endAdornment: <Typography variant="caption" color="text.secondary">{suffix}</Typography> } } : undefined} />
}

function ComputationStep() {
  const project = useAppStore((state) => state.project)
  const config = project.computation
  const update = useAppStore((state) => state.updateComputation)
  const frequencyPoints = Math.floor(((config.frequencyStopGHz - config.frequencyStartGHz) * 1000) / config.frequencyStepMHz) + 1
  const variableParameterCount = project.parameters.filter((parameter) => parameter.mode !== 'Fixed').length

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', xl: 'row' }} spacing={2} sx={{ alignItems: 'stretch' }}>
        <Card variant="outlined" sx={{ flex: 1 }}><CardContent>
          <SectionHeading icon={<TuneRoundedIcon />} title="Linear sweep" description="Low-power response and design-space metrics." />
          <Stack spacing={2} sx={{ mt: 2.5 }}>
            <Stack direction="row" spacing={1.5}><NumberField label="Start" value={config.frequencyStartGHz} suffix="GHz" onChange={(value) => update({ frequencyStartGHz: value })} /><NumberField label="Stop" value={config.frequencyStopGHz} suffix="GHz" onChange={(value) => update({ frequencyStopGHz: value })} /><NumberField label="Step" value={config.frequencyStepMHz} suffix="MHz" onChange={(value) => update({ frequencyStepMHz: value })} /></Stack>
            <Alert severity="info"><strong>{frequencyPoints.toLocaleString()}</strong> frequency points per circuit configuration</Alert>
          </Stack>
        </CardContent></Card>

        <Card variant="outlined" sx={{ flex: 1 }}><CardContent>
          <SectionHeading icon={<FunctionsRoundedIcon />} title="Optimization" description="Surrogate model and acquisition strategy." />
          <Stack spacing={2} sx={{ mt: 2.5 }}>
            <Stack direction="row" spacing={1.5}><NumberField label="Iterations" value={config.optimizerIterations} onChange={(value) => update({ optimizerIterations: value })} /><NumberField label="Samples / iteration" value={config.samplesPerIteration} onChange={(value) => update({ samplesPerIteration: value })} /><NumberField label="Random seed" value={config.randomSeed} onChange={(value) => update({ randomSeed: value })} /></Stack>
            <Stack direction="row" spacing={1.5}>
              <TextField select label="Surrogate" value={config.surrogate} onChange={(event) => update({ surrogate: event.target.value })} fullWidth><MenuItem value="Kriging">Kriging</MenuItem><MenuItem value="RadialBasis">Radial basis</MenuItem><MenuItem value="SecondOrderPolynomial">Second-order polynomial</MenuItem></TextField>
              <TextField select label="Strategy" value={config.strategy} onChange={(event) => update({ strategy: event.target.value })} fullWidth><MenuItem value="SRBF">SRBF</MenuItem><MenuItem value="EI">Expected improvement</MenuItem><MenuItem value="LCBS">Lower confidence bound</MenuItem></TextField>
              <TextField select label="Sampler" value={config.sampler} onChange={(event) => update({ sampler: event.target.value })} fullWidth><MenuItem value="RandomSample">Random</MenuItem><MenuItem value="SobolSample">Sobol</MenuItem><MenuItem value="LatinHypercubeSample">Latin hypercube</MenuItem></TextField>
            </Stack>
            {variableParameterCount === 0
              ? <Alert severity="warning">Optimization is skipped because all device parameters are fixed.</Alert>
              : <Alert severity="success">Optimization enabled · {variableParameterCount} variable device parameter{variableParameterCount === 1 ? '' : 's'}.</Alert>}
          </Stack>
        </CardContent></Card>
      </Stack>

      <Card variant="outlined"><CardContent>
        <SectionHeading icon={<MemoryRoundedIcon />} title="Harmonic and solver settings" description="Stage-specific harmonic truncation and shared JosephsonCircuits hbsolve controls." />
        <Stack spacing={2.5} sx={{ mt: 2.5 }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
            <Paper variant="outlined" sx={{ p: 2, flex: 1 }}><Typography variant="subtitle2" sx={{ mb: 1.5 }}>Linear stage harmonics</Typography><Stack direction="row" spacing={1.5}><NumberField label="Strong-tone harmonics" value={config.linearStrongToneHarmonics} onChange={(value) => update({ linearStrongToneHarmonics: value })} /><NumberField label="Modulation harmonics" value={config.linearModulationHarmonics} onChange={(value) => update({ linearModulationHarmonics: value })} /></Stack></Paper>
            <Paper variant="outlined" sx={{ p: 2, flex: 1 }}><Typography variant="subtitle2" sx={{ mb: 1.5 }}>Nonlinear stage harmonics</Typography><Stack direction="row" spacing={1.5}><NumberField label="Strong-tone harmonics" value={config.nonlinearStrongToneHarmonics} onChange={(value) => update({ nonlinearStrongToneHarmonics: value })} /><NumberField label="Modulation harmonics" value={config.nonlinearModulationHarmonics} onChange={(value) => update({ nonlinearModulationHarmonics: value })} /></Stack></Paper>
          </Stack>
          <Divider />
          <Box>
            <Typography variant="subtitle2">Shared hbsolve controls</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>These values are used by both the linear design sweep and the nonlinear pumped sweep.</Typography>
            <Stack spacing={1.5}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 1.5 }}><NumberField label="Max solver iterations" value={config.maxSimulatorIterations} onChange={(value) => update({ maxSimulatorIterations: value })} /><NumberField label="Residual tolerance (ftol)" value={config.solverFtol} onChange={(value) => update({ solverFtol: value })} /><NumberField label="Switch-off line search tolerance" value={config.switchOffLineSearchTolerance} onChange={(value) => update({ switchOffLineSearchTolerance: value })} /><NumberField label="Minimum line-search step (alphamin)" value={config.alphaMin} onChange={(value) => update({ alphaMin: value })} /></Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 1.5 }}>
                <TextField label="Max intermodulation order" value={config.maxIntermodOrder} helperText="Use Inf for no additional truncation" onChange={(event) => update({ maxIntermodOrder: event.target.value })} fullWidth />
                <NumberField label="Frequency batches" value={config.solverBatches} onChange={(value) => update({ solverBatches: value })} />
                <TextField select label="Node sorting" value={config.nodeSorting} onChange={(event) => update({ nodeSorting: event.target.value as typeof config.nodeSorting })} fullWidth><MenuItem value="number">Numeric node names</MenuItem><MenuItem value="name">Text node names</MenuItem><MenuItem value="none">Circuit order</MenuItem></TextField>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}><FormControlLabel control={<Checkbox checked={config.threeWaveMixing} onChange={(event) => update({ threeWaveMixing: event.target.checked })} />} label="Three-wave mixing" /><FormControlLabel control={<Checkbox checked={config.fourWaveMixing} onChange={(event) => update({ fourWaveMixing: event.target.checked })} />} label="Four-wave mixing" /></Stack>
              <Alert severity="info">Frequency batches set to 0 use all Julia threads. DC inclusion is determined automatically from the source configuration.</Alert>
            </Stack>
          </Box>
        </Stack>
      </CardContent></Card>
    </Stack>
  )
}

function MetricsStep() {
  const project = useAppStore((state) => state.project)
  const updateMetricsCode = useAppStore((state) => state.updateMetricsCode)
  const [metricsOpen, setMetricsOpen] = useState(false)
  const [helpersOpen, setHelpersOpen] = useState(false)
  const hasCost = project.metrics.some((metric) => metric.source === 'user_cost')
  const hasPerformance = project.metrics.some((metric) => metric.source === 'user_performance')
  const updateHelpersCode = (helpersCode: string) => {
    useAppStore.setState((state) => ({
      dirty: true,
      project: { ...state.project, helpersCode },
      stages: state.stages.map((stage) => stage.status === 'running' ? stage : { ...stage, status: stage.id === 'optimization' && stage.status === 'skipped' ? 'skipped' : 'stale', progress: 0 }),
    }))
  }
  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionHeading icon={<FunctionsRoundedIcon />} title="Cost & performance outputs" description="The list is generated from the named values returned by the two Julia functions." />
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<CodeRoundedIcon />} onClick={() => setMetricsOpen(true)}>Cost & performance</Button>
            <Button variant="outlined" startIcon={<CodeRoundedIcon />} onClick={() => setHelpersOpen(true)}>Metric helpers</Button>
          </Stack>
        </Stack>
        <Alert severity="info" sx={{ my: 2 }}>The first value returned by <code>user_cost</code> is minimized. The first value returned by <code>user_performance</code> is maximized. Every later named value is saved for data analysis.</Alert>
        {(!hasCost || !hasPerformance) && <Alert severity="warning" sx={{ mb: 2 }}>Missing {!hasCost && !hasPerformance ? <><code>user_cost</code> and <code>user_performance</code></> : !hasCost ? <code>user_cost</code> : <code>user_performance</code>} definition.</Alert>}
        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Table size="small"><TableHead><TableRow><TableCell width={80}>Order</TableCell><TableCell>Julia function</TableCell><TableCell>Returned name</TableCell><TableCell>Use</TableCell></TableRow></TableHead><TableBody>{project.metrics.map((metric) => <TableRow key={metric.id} hover><TableCell>#{metric.position}</TableCell><TableCell><Chip size="small" variant="outlined" label={metric.source} /></TableCell><TableCell><Typography sx={{ fontFamily: 'monospace', fontSize: 13 }}>{metric.name}</Typography></TableCell><TableCell><Chip size="small" label={metric.purpose === 'Objective' ? `${metric.purpose} · ${metric.direction.toLowerCase()}` : 'Analysis metric'} color={metric.purpose === 'Objective' ? metric.source === 'user_cost' ? 'primary' : 'secondary' : 'default'} variant={metric.purpose === 'Objective' ? 'filled' : 'outlined'} /></TableCell></TableRow>)}</TableBody></Table>
        </TableContainer>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>Constraints and masks remain conditions inside <code>user_cost</code>. Return their measured quantities as additional named values when you also want them in the saved analysis dataset.</Typography>
      </Paper>
      <CodeDialog open={metricsOpen} onClose={() => setMetricsOpen(false)} title="Cost & performance" filename="user_cost_and_performance.jl" value={project.metricsCode} onChange={updateMetricsCode} />
      <CodeDialog open={helpersOpen} onClose={() => setHelpersOpen(false)} title="Metric helper functions" filename="user_metric_utils.jl" value={project.helpersCode ?? ''} onChange={updateHelpersCode} />
    </Stack>
  )
}

export function SetupScreen() {
  const step = useAppStore((state) => state.setupStep)
  const setStep = useAppStore((state) => state.setSetupStep)
  const project = useAppStore((state) => state.project)
  const updateProjectName = useAppStore((state) => state.updateProjectName)
  const missingParameterCount = project.parameters.filter((parameter) => parameter.circuitStatus === 'missing').length
  const go = (next: number) => setStep(Math.max(0, Math.min(2, next)) as SetupStep)

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}><Box><Typography variant="h4">Project setup</Typography><Typography color="text.secondary" sx={{ mt: 0.6 }}>Build the complete simulation input before starting expensive calculations.</Typography></Box><TextField label="Project name" value={project.name} onChange={(event) => updateProjectName(event.target.value)} sx={{ width: { xs: '100%', md: 360 } }} /></Stack>
      <Paper variant="outlined" sx={{ p: 2.2 }}><Stepper nonLinear activeStep={step} alternativeLabel>{steps.map((label, index) => <Step key={label} completed={index < step}><StepButton color="inherit" onClick={() => setStep(index as SetupStep)}>{label}</StepButton></Step>)}</Stepper></Paper>
      {step === 0 && <ModelStep />}
      {step === 1 && <ComputationStep />}
      {step === 2 && <MetricsStep />}
      <Paper variant="outlined" sx={{ p: 1.5 }}><Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}><CheckCircleOutlineRoundedIcon color={missingParameterCount ? 'warning' : 'success'} /><Box sx={{ flex: 1 }}><Typography variant="subtitle2">{missingParameterCount ? `${missingParameterCount} parameter${missingParameterCount === 1 ? '' : 's'} still need values` : 'Project setup complete'}</Typography><Typography variant="caption" color="text.secondary">{project.parameters.length} parameters · {project.sources.length} sources · {project.metrics.length} named metrics · schema {project.schemaVersion}</Typography></Box><Button startIcon={<ArrowBackRoundedIcon />} disabled={step === 0} onClick={() => go(step - 1)}>Back</Button><Button variant="contained" endIcon={<ArrowForwardRoundedIcon />} disabled={step === 2} onClick={() => go(step + 1)}>Next</Button></Stack></Paper>
    </Stack>
  )
}
