import type { ResultsBundle, StageId } from '../types'
import { ConnectedResults as CompactConnectedResults } from './ConnectedResultsCompact'
import { EnhancedStageResults } from './EnhancedStageResults'
import { HarmonicBalanceResultsWithUnits } from './HarmonicBalanceResultsWithUnits'

export function ConnectedResults({ results, stage, selectedRunId }: { results: ResultsBundle; stage: StageId; selectedRunId?: string | null }) {
  if (stage === 'linear') return <CompactConnectedResults results={results} stage={stage} selectedRunId={selectedRunId} />
  if (stage === 'hb') return <HarmonicBalanceResultsWithUnits results={results} selectedRunId={selectedRunId} />
  return <EnhancedStageResults results={results} stage={stage} selectedRunId={selectedRunId} />
}
