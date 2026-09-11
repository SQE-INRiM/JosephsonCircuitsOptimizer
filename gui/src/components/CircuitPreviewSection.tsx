import { useEffect, useMemo, useState } from 'react'
import { Typography } from '@mui/material'
import { CircuitPreview } from './CircuitPreview'
import { useAppStore } from '../store'
import { getJcoAdapter, type CircuitPreviewData } from '../services/jcoAdapter'
import type { ParameterSpec, ProjectModel } from '../types'

function previewFingerprint(circuitCode: string, parameters: ParameterSpec[]) {
  return JSON.stringify({
    circuitCode,
    parameters: parameters.map(({ name, mode, value, start, stop, step, values }) => ({ name, mode, value, start, stop, step, values })),
  })
}

function previewProjectKey(project: ProjectModel) {
  return project.workspaceInfo?.projectPath ?? project.filename ?? project.name
}

type CachedPreview = {
  data: CircuitPreviewData
  generatedFingerprint: string
}

type PreviewJob = {
  promise: Promise<CircuitPreviewData>
  generatedFingerprint: string
}

// Presentation-only state: previews and in-flight generation survive renderer navigation and
// unmounts, but are never serialized into the .jco project.
const previewCache = new Map<string, CachedPreview>()
const previewJobs = new Map<string, PreviewJob>()
const previewErrors = new Map<string, string>()

export function CircuitPreviewSection() {
  const project = useAppStore((state) => state.project)
  const projectKey = previewProjectKey(project)
  const cached = previewCache.get(projectKey)
  const [data, setData] = useState<CircuitPreviewData | null>(() => cached?.data ?? null)
  const [generatedFingerprint, setGeneratedFingerprint] = useState<string | null>(() => cached?.generatedFingerprint ?? null)
  const [loading, setLoading] = useState(() => previewJobs.has(projectKey))
  const [error, setError] = useState<string | null>(() => previewErrors.get(projectKey) ?? null)
  const currentFingerprint = useMemo(() => previewFingerprint(project.circuitCode, project.parameters), [project.circuitCode, project.parameters])
  const stale = Boolean(data && generatedFingerprint !== currentFingerprint)

  useEffect(() => {
    let active = true
    const projectCached = previewCache.get(projectKey)
    const projectJob = previewJobs.get(projectKey)
    setData(projectCached?.data ?? null)
    setGeneratedFingerprint(projectCached?.generatedFingerprint ?? null)
    setError(previewErrors.get(projectKey) ?? null)
    setLoading(Boolean(projectJob))

    if (projectJob) {
      void projectJob.promise
        .then(() => {
          if (!active) return
          const completed = previewCache.get(projectKey)
          setData(completed?.data ?? null)
          setGeneratedFingerprint(completed?.generatedFingerprint ?? null)
          setError(null)
        })
        .catch((caught) => {
          if (!active) return
          setError(caught instanceof Error ? caught.message : String(caught))
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }

    return () => { active = false }
  }, [projectKey])

  const generate = async () => {
    const adapter = getJcoAdapter()
    if (!adapter) {
      setError('Circuit preview is available in the desktop JCO application.')
      return
    }

    const existingJob = previewJobs.get(projectKey)
    if (existingJob) {
      setLoading(true)
      return
    }

    const generatedFingerprint = currentFingerprint
    previewErrors.delete(projectKey)
    setLoading(true)
    setError(null)

    const promise = adapter.previewCircuit(project)
    previewJobs.set(projectKey, { promise, generatedFingerprint })

    try {
      const preview = await promise
      previewCache.set(projectKey, { data: preview, generatedFingerprint })
      setData(preview)
      setGeneratedFingerprint(generatedFingerprint)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught)
      previewErrors.set(projectKey, message)
      setError(message)
    } finally {
      if (previewJobs.get(projectKey)?.promise === promise) previewJobs.delete(projectKey)
      setLoading(false)
    }
  }

  return <>
    <CircuitPreview data={data} loading={loading} error={error} stale={stale} onGenerate={generate} />
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
      Generating the circuit preview can take a while, especially for complex circuits. You can continue configuring parameters, sources, computation, and metrics while it runs.
    </Typography>
  </>
}
