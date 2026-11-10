import type { ReactNode } from 'react'
import type { AgentInfo, Scenario } from '../api'
import { DecisionPanel } from '../components/DecisionPanel'
import { attentionItems, briefing, kpis } from '../lib/briefing'
import type { TabId } from '../shell/routes'
import type { RunState } from '../state/runState'
import { Briefing } from './Briefing'
import { KpiRow } from './Kpis'
import { NeedsAttention } from './NeedsAttention'
import { WorkflowStrip } from './WorkflowStrip'

interface Props {
  agents: AgentInfo[]
  run: RunState
  scenario: Scenario | undefined
  simulated: boolean
  selectedAgent: string | null
  onSelectAgent: (r: string) => void
  onGo: (t: TabId) => void
  /** the facility view (3D or 2D); rendered in the stage */
  stage: ReactNode
  /** close-up of flagged assets, shown below the pipeline */
  focus?: ReactNode
  readings?: number | null
}

export function CommandCenter(p: Props) {
  const { run } = p
  return (
    <div className="cc">
      <div className="cc-main stack">
        <section className="stage panel" aria-label="Facility">
          <div className="stage-view">{p.stage}</div>
          {run.status !== 'idle' && (
            <div className="stage-overlay">
              <Briefing lines={briefing(run, p.agents, p.scenario)} simulated={p.simulated} />
            </div>
          )}
        </section>
        <WorkflowStrip agents={p.agents} run={run} selected={p.selectedAgent} onSelect={p.onSelectAgent} readings={p.readings} />
        {p.focus}
      </div>
      <aside className="cc-side stack">
        <KpiRow k={kpis(run)} />
        <NeedsAttention items={attentionItems(run, p.agents)} onGo={p.onGo} idle={run.status === 'idle'} />
        <section className="panel" aria-labelledby="hd-h">
          <h3 id="hd-h" className="label panel-title">Human decision</h3>
          <DecisionPanel compact roles={false}
            decision={run.bundle?.final_decision_state ?? run.finalDecisionState}
            verified={run.bundle ? run.bundle.verified : run.verified}
            flags={run.bundle?.flags} />
          <p className="advisory-note" role="note"><strong>Advisory only.</strong> A human decides. No automatic action is authorised.</p>
        </section>
      </aside>
    </div>
  )
}
