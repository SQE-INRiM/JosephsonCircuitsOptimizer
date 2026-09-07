import { useEffect, useMemo, useState } from 'react'
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

// Presentation cache only: resolved previews survive renderer navigation/unmounts, but are
// never serialized into the .jco project. A different project gets a different cache entry.
const previewCache = new Map<string, CachedPreview>()

export function CircuitPreviewSection() {
  const project = useAppStore((state) => state.project)
  const projectKey = previewProjectKey(project)
  const cached = previewCache.get(projectKey)
  const [data, setData] = useState<CircuitPreviewData | null>(() => cached?.data ?? null)
  const [generatedFingerprint, setGeneratedFingerprint] = useState<string | null>(() => cached?.generatedFingerprint ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const currentFingerprint = useMemo(() => previewFingerprint(project.circuitCode, project.parameters), [project.circuitCode, project.parameters])
  const stale = Boolean(data && generatedFingerprint !== currentFingerprint)

  useEffect(() => {
    const projectCached = previewCache.get(projectKey)
    setData(projectCached?.data ?? null)
    setGeneratedFingerprint(projectCached?.generatedFingerprint ?? null)
    setError(null)
  }, [projectKey])

  const generate = async () => {
    const adapter = getJcoAdapter()
    if (!adapter) {
      setError('Circuit preview is available in the desktop JCO application.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const preview = await adapter.previewCircuit(project)
      previewCache.set(projectKey, { data: preview, generatedFingerprint: currentFingerprint })
      setData(preview)
      setGeneratedFingerprint(currentFingerprint)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setLoading(false)
    }
  }

  return <CircuitPreview data={data} loading={loading} error={error} stale={stale} onGenerate={generate} />
}
