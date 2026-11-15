import type { ReactNode } from 'react'
import { DecisionPanel } from '../components/DecisionPanel'
import { attentionItems, briefing, kpis } from '../lib/briefing'
import type { TabId } from '../shell/routes'
import { agentList, type RunState } from '../state/runState'
import { Briefing } from './Briefing'
import { TruthCompare } from './TruthCompare'
import { SCORE_FOOTNOTE, candidateFromReport } from '../lib/candidate'
import { STATIC_FACILITY } from '../facility'
import { assetPhrase, mechanismName } from '../lib/plain'
import { KpiRow } from './Kpis'
import { NeedsAttention } from './NeedsAttention'
import { WorkflowStrip } from './WorkflowStrip'

interface Props {
  run: RunState
  selectedAgent: string | null
  onSelectAgent: (r: string) => void
  onGo: (t: TabId) => void
  /** the facility view (3D or 2D); rendered in the stage */
  stage: ReactNode
  /** the candidate asset the stage highlights, if any (from Agent 5's hypotheses; never from the truth) */
  highlighted: string | null
  /** developer view on */
  dev?: boolean
}

export function CommandCenter(p: Props) {
  const { run } = p
  const agents = agentList(run)
  const { candidate } = candidateFromReport(run.report, run.windowIndex)
  const flagged = candidate.kind === 'waiting' ? null : p.highlighted ? 1 : 0
  const suspected = p.highlighted && candidate.kind === 'asset' ? assetPhrase(STATIC_FACILITY, p.highlighted) : null
  return (
    <div className="cc">
      <div className="cc-main stack">
        <section className="stage panel" aria-label="Facility">
          <div className="stage-view">{p.stage}</div>
          {noAssetLine(candidate) && <p className="stage-candidate-line" role="status">{noAssetLine(candidate)}</p>}
          {run.status !== 'idle' && (
            <div className="stage-overlay">
              <Briefing lines={briefing(run)} />
            </div>
          )}
        </section>
        <p className="control-help facility-source" role="status">
          {p.highlighted && <>{SCORE_FOOTNOTE}{' '}</>}
          Schematic layout, not to scale.
        </p>
        <WorkflowStrip agents={agents} run={run} selected={p.selectedAgent} onSelect={p.onSelectAgent} readings={run.status === 'idle' ? null : run.events.filter((e) => e.type === 'sensor_reading').length} />
      </div>
      <aside className="cc-side stack">
        <TruthCompare truth={run.truth} window={run.windowIndex} />
        <KpiRow k={kpis(run, flagged)} dev={p.dev} />
        <NeedsAttention items={attentionItems(run, agents, { dev: p.dev, suspected })} onGo={p.onGo} idle={run.status === 'idle'} />
        <section className="panel" aria-labelledby="hd-h">
          <h3 id="hd-h" className="label panel-title">Human decision</h3>
          <DecisionPanel compact roles={false} decision={run.decision} />
          <p className="advisory-note" role="note"><strong>Advisory only.</strong> A human decides. No automatic action is authorised.</p>
        </section>
      </aside>
    </div>
  )
}

/** One short line in the 3D view when the report names no asset. Nothing before the report exists. */
function noAssetLine(c: ReturnType<typeof candidateFromReport>['candidate']): string | null {
  switch (c.kind) {
    case 'waiting': return null
    case 'asset': return STATIC_FACILITY.assets.some((a) => a.asset_id === c.hypothesis.assetId) ? null : 'Agent 5 named equipment that is not in the layout.'
    case 'tag': return `Agent 5 did not localise an asset in this window (it named sensor ${c.hypothesis.tagId} for ${mechanismName(c.hypothesis.mechanism)}).`
    default: return 'Agent 5 did not localise an asset in this window.'
  }
}
