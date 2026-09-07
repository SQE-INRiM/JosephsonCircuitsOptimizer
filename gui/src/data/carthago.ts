import type { ParameterSpec, SourceSpec, StageState } from '../types'

export const carthagoParameters: ParameterSpec[] = [
  { id: 'N', name: 'N', mode: 'Fixed', value: '700', unit: 'cells', role: 'Fixed model' },
  { id: 'I0', name: 'I0', mode: 'Fixed', value: '2.19e-6', unit: 'A', role: 'Design' },
  { id: 'r', name: 'r', mode: 'Fixed', value: '0.07', unit: '—', role: 'Design' },
  { id: 'Cj0', name: 'Cj0', mode: 'Fixed', value: '124e-15', unit: 'F', role: 'Design' },
  { id: 'Cg', name: 'Cg', mode: 'Fixed', value: '250e-15', unit: 'F', role: 'Design' },
]

export const carthagoSources: SourceSpec[] = [
  {
    id: 'source_1',
    name: 'Source 1',
    port: 1,
    isDc: false,
    frequency: { mode: 'Fixed', value: '7.0' },
    linearAmplitude: { mode: 'Fixed', value: '0' },
    nonlinearAmplitude: { mode: 'List', values: '0, 1e-11, 5.623413e-7, 6.309573e-7, 7.079458e-7, 7.943282e-7, 8.912509e-7, 1e-6, 1.122018e-6, 1.258925e-6, 1.412538e-6, 1.584893e-6, 1.778279e-6' },
  },
  {
    id: 'source_2',
    name: 'Source 2',
    port: 3,
    isDc: true,
    frequency: { mode: 'Fixed', value: '0' },
    linearAmplitude: { mode: 'Fixed', value: '1.894e-3' },
    nonlinearAmplitude: { mode: 'Range', start: '1.894e-3', step: '100e-6', stop: '1.894e-3' },
  },
]

export const initialStages: StageState[] = [
  {
    id: 'linear',
    label: 'Linear',
    shortLabel: 'LIN',
    status: 'completed',
    completedAt: '22 Jul 2026 · 14:24',
    duration: undefined,
    detail: 'Frequency-domain linear sweep and configured metrics',
    points: 1,
    progress: 100,
  },
  {
    id: 'optimization',
    label: 'Optimization',
    shortLabel: 'OPT',
    status: 'skipped',
    detail: 'Selects the best device configuration when a parameter sweep is present',
    points: 0,
    progress: 0,
  },
  {
    id: 'hb',
    label: 'Harmonic balance',
    shortLabel: 'HB',
    status: 'ready',
    detail: 'Nonlinear sweep using the configured source frequencies and amplitudes',
    points: 13,
    progress: 0,
  },
]

export const pumpAmplitudes = [0.562, 0.631, 0.708, 0.794, 0.891, 1.0, 1.122, 1.259, 1.413, 1.585, 1.778]

export const linearI0Values = [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0]
export const linearCgValues = [100, 125, 150, 175, 200, 225, 250, 275, 300]

export const linearMetric = linearCgValues.map((cg) =>
  linearI0Values.map((i0) => {
    const basin = 0.42 * (i0 - 2.25) ** 2 + 0.00008 * (cg - 235) ** 2
    const ridge = 0.35 * Math.sin(i0 * 2.1) * Math.cos(cg / 42)
    return Number((3.1 + basin + ridge).toFixed(3))
  }),
)

export const objectiveHistory = [
  8.4, 7.9, 7.2, 6.8, 6.2, 5.9, 5.5, 5.1, 4.8, 4.65, 4.48, 4.41, 4.31, 4.27, 4.24,
]

export const correlationLabels = ['I0', 'Cg', 'r', 'Cj0', 'S11 mean', 'Δk', 'Objective']
export const correlationMatrix = correlationLabels.map((_, row) =>
  correlationLabels.map((__, col) => {
    if (row === col) return 1
    const sign = (row + col) % 3 === 0 ? -1 : 1
    return Number((sign * (0.08 + (((row + 2) * (col + 3)) % 8) / 10)).toFixed(2))
  }),
)

export function gainTrace(amplitude: number) {
  const x = Array.from({ length: 81 }, (_, index) => 5 + index * 0.05)
  const peak = Math.max(0, 18 * (amplitude - 0.55) / 1.23)
  const y = x.map((frequency) => {
    const envelope = Math.exp(-((frequency - 7) ** 4) / 2.1)
    const ripple = 0.42 * Math.sin((frequency - 5) * 9 + amplitude * 1.7)
    return Number((peak * envelope + ripple - 0.3).toFixed(3))
  })
  return { x, y }
}
