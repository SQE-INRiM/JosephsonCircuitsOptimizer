import type { ResultsBundle, StageId } from '../types'
import { ConnectedResults as CompactConnectedResults } from './ConnectedResultsCompact'
import { EnhancedStageResults } from './EnhancedStageResults'
import { HarmonicBalanceResultsWithUnits } from './HarmonicBalanceResultsWithUnits'

export function ConnectedResults({ results, stage, onResultsChanged, activeRunId }: { results: ResultsBundle; stage: StageId; onResultsChanged: (results: ResultsBundle) => void; activeRunId?: string | null }) {
  if (stage === 'linear') return <CompactConnectedResults results={results} stage={stage} onResultsChanged={onResultsChanged} activeRunId={activeRunId} />
  if (stage === 'hb') return <HarmonicBalanceResultsWithUnits results={results} activeRunId={activeRunId} />
  return <EnhancedStageResults results={results} stage={stage} onResultsChanged={onResultsChanged} activeRunId={activeRunId} />
}
