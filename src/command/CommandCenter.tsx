import type { ReactNode } from 'react'
import { DecisionPanel } from '../components/DecisionPanel'
import { attentionItems, briefing, kpis } from '../lib/briefing'
import type { TabId } from '../shell/routes'
import { agentList, type RunState } from '../state/runState'
import { Briefing } from './Briefing'
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
}

export function CommandCenter(p: Props) {
  const { run } = p
  const agents = agentList(run)
  return (
    <div className="cc">
      <div className="cc-main stack">
        <section className="stage panel" aria-label="Facility">
          <div className="stage-view">{p.stage}</div>
          {run.status !== 'idle' && (
            <div className="stage-overlay">
              <Briefing lines={briefing(run)} />
            </div>
          )}
        </section>
        <WorkflowStrip agents={agents} run={run} selected={p.selectedAgent} onSelect={p.onSelectAgent} readings={run.status === 'idle' ? null : run.events.filter((e) => e.type === 'sensor_reading').length} />
      </div>
      <aside className="cc-side stack">
        <KpiRow k={kpis(run)} />
        <NeedsAttention items={attentionItems(run, agents)} onGo={p.onGo} idle={run.status === 'idle'} />
        <section className="panel" aria-labelledby="hd-h">
          <h3 id="hd-h" className="label panel-title">Human decision</h3>
          <DecisionPanel compact roles={false} decision={run.decision} />
          <p className="advisory-note" role="note"><strong>Advisory only.</strong> A human decides. No automatic action is authorised.</p>
        </section>
      </aside>
    </div>
  )
}
