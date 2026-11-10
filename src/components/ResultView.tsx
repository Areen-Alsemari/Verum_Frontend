import type { AgentInfo, RunBundle } from '../api'
import { humanize } from '../lib/format'
import type { RunState } from '../state/runState'
import { AssetChain } from './AssetChain'
import { Unknown, Value } from './Unknown'
import { DecisionPanel, FlagValue } from './DecisionPanel'

export { FlagValue }

function Block({ title, tag, children }: { title: string; tag?: string; children: React.ReactNode }) {
  const id = `blk-${title.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <section className="panel result-block" aria-labelledby={id}>
      <h3 id={id} className="label panel-title">{title}{tag && <span className="tag-advisory">{tag}</span>}</h3>
      {children}
    </section>
  )
}

function Ids({ ids }: { ids: string[] }) {
  return ids.length ? <span className="chips">{ids.map((i) => <code key={i} className="chip">{i}</code>)}</span> : <span className="control-help">none</span>
}

export function ResultView({ run, agents }: { run: RunState; agents: AgentInfo[] }) {
  const b: RunBundle | null = run.bundle
  const waiting = run.status === 'idle' ? 'Run a scenario to see the result here.'
    : run.status === 'running' ? 'The result appears when the run finishes.'
    : run.status === 'stopped' ? 'The run was stopped before it finished, so there is no result.'
    : run.status === 'failed' ? 'The run failed, so there is no result.' : 'Loading the result…'

  const decision = b?.final_decision_state ?? run.finalDecisionState
  const verified = b ? b.verified : run.verified
  const hypTitle = (id: string) => b?.hypotheses.find((h) => h.id === id)?.title ?? id

  return (
    <div className="result">
      <Block title="Human decision">
        <DecisionPanel decision={decision} verified={verified} flags={b?.flags} />
      </Block>

      {!b ? <p className="state-msg" role="status">{waiting}</p> : (
        <>
          <Block title="Asset chain"><AssetChain flagged={b.flagged_assets} agents={agents} /></Block>

          <Block title="Diagnostic hypotheses">
            {b.hypotheses.length === 0 ? <p className="control-help">No hypotheses were returned.</p> : (
              <ul className="cards">
                {b.hypotheses.map((h) => (
                  <li key={h.id} className="mini-card">
                    <div className="mini-head"><strong>{h.title}</strong>
                      <span className="pill">support: <Value value={h.support_level} what="support level">{humanize(String(h.support_level))}</Value></span></div>
                    <p className="control-help">{h.description}</p>
                    <p className="kv"><span>confidence</span> <Value value={h.confidence} what="confidence" /></p>
                    <p className="kv"><span>supporting</span> <Ids ids={h.supporting_evidence_ids} /></p>
                    <p className="kv"><span>conflicting</span> <Ids ids={h.conflicting_evidence_ids} /></p>
                  </li>
                ))}
              </ul>
            )}
          </Block>

          <Block title="Inspection options" tag="Advisory">
            {b.inspection_options.length === 0 ? <p className="control-help">No inspection options were returned.</p> : (
              <ul className="cards">
                {b.inspection_options.map((o) => (
                  <li key={o.id} className="mini-card">
                    <div className="mini-head"><strong>{o.title}</strong>
                      {o.recommended === true && <span className="pill">marked recommended by the API</span>}</div>
                    <p className="control-help">{o.rationale}</p>
                    <p className="kv"><span>targets</span> {o.targets.join(', ') || <Unknown what="targets" />}</p>
                    <p className="kv"><span>helps separate</span> {o.distinguishes.length ? o.distinguishes.map(hypTitle).join(', ') : <Unknown what="hypotheses" />}</p>
                  </li>
                ))}
              </ul>
            )}
          </Block>

          <Block title="Evidence verification">
            {!b.evidence_verification ? <p><Unknown what="evidence verification" /></p> : (
              <>
                <p className="kv"><span>state</span> <Value value={b.evidence_verification.state} what="state">{<code>{b.evidence_verification.state}</code>}</Value></p>
                <p className="kv"><span>checked</span> <Ids ids={b.evidence_verification.checked_evidence_ids} /></p>
                <p className="kv"><span>unresolved</span></p>
                {b.evidence_verification.unresolved.length === 0 ? <p className="control-help">nothing listed</p>
                  : <ul className="plain">{b.evidence_verification.unresolved.map((u) => <li key={u}>{u}</li>)}</ul>}
                <p className="kv"><span>notes</span> <Value value={b.evidence_verification.notes} what="notes" /></p>
              </>
            )}
          </Block>

          <Block title="Report summary">
            <p><Value value={b.report_summary} what="report summary" /></p>
          </Block>
        </>
      )}
    </div>
  )
}
