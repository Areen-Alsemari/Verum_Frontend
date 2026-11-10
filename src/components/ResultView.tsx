import type { AgentInfo, RunBundle } from '../api'
import type { RunState } from '../state/runState'
import { AssetChain } from './AssetChain'
import { Value } from './Unknown'
import { DecisionPanel, FlagValue } from './DecisionPanel'
import { Block, Evidence, Hypotheses, InspectionOptions } from './ResultBlocks'

export { FlagValue }

export function waitingText(run: RunState): string {
  return run.status === 'idle' ? 'Run a scenario to see the result here.'
    : run.status === 'running' ? 'The result appears when the run finishes.'
    : run.status === 'stopped' ? 'The run was stopped before it finished, so there is no result.'
    : run.status === 'failed' ? 'The run failed, so there is no result.' : 'Loading the result…'
}

/** The whole result bundle in one column (used by tests and as a compact summary). */
export function ResultView({ run, agents }: { run: RunState; agents: AgentInfo[] }) {
  const b: RunBundle | null = run.bundle
  const decision = b?.final_decision_state ?? run.finalDecisionState
  const verified = b ? b.verified : run.verified
  const hypTitle = (id: string) => b?.hypotheses.find((h) => h.id === id)?.title ?? id

  return (
    <div className="result">
      <Block title="Human decision">
        <DecisionPanel decision={decision} verified={verified} flags={b?.flags} />
      </Block>
      {!b ? <p className="state-msg" role="status">{waitingText(run)}</p> : (
        <>
          <Block title="Flagged assets"><AssetChain flagged={b.flagged_assets} agents={agents} /></Block>
          <Block title="Diagnostic hypotheses"><Hypotheses hyps={b.hypotheses} /></Block>
          <Block title="Inspection options" tag="Advisory"><InspectionOptions options={b.inspection_options} hypTitle={hypTitle} /></Block>
          <Block title="Evidence verification"><Evidence ev={b.evidence_verification} /></Block>
          <Block title="Report summary"><p><Value value={b.report_summary} what="report summary" /></p></Block>
        </>
      )}
    </div>
  )
}
