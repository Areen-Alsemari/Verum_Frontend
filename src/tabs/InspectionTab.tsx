import { Block, Ids, reportNotice } from '../components/Block'
import { DecisionPanel } from '../components/DecisionPanel'
import { Unknown } from '../components/Unknown'
import { label } from '../lib/labels'
import type { RunState } from '../state/runState'

/** Inspection options (advisory, from the report) and Agent 8's decision. There is no approve, execute or dispatch control. */
export function InspectionTab({ run, onRetryReport }: { run: RunState; onRetryReport: () => void }) {
  const r = run.report
  return (
    <div className="grid-main-side">
      <div className="stack">
        <Block title="Inspection options" tag="Advisory">
          <p className="control-help block-intro">Options for the inspector to consider, from the maintenance report. They are not instructions and nothing is scheduled.</p>
          {r.state !== 'ok' ? reportNotice(r, onRetryReport) : r.report.inspection_options.length === 0 ? (
            <p className="control-help">The report lists no inspection options for window {r.window}.</p>
          ) : (
            <ul className="cards">
              {r.report.inspection_options.map((o) => (
                <li key={`${o.action_id}-${o.target_asset}`} className="mini-card">
                  <div className="mini-head"><strong><code>{o.action_id}</code> on <code>{o.target_asset}</code></strong><span className="pill">{label(o.feasibility)}</span></div>
                  <p className="kv"><span>cost</span> {typeof o.cost_usd === 'number' ? `${o.cost_usd} USD (as given)` : <Unknown what="cost" />}</p>
                  <p className="kv"><span>duration</span> {typeof o.duration_min === 'number' ? `${o.duration_min} min (as given)` : <Unknown what="duration" />}</p>
                  <p className="kv"><span>preconditions</span> <Unknown what="preconditions" /></p>
                  <p className="kv"><span>source report</span> <code>{o.source_report_id}</code></p>
                  <p className="kv"><span>evidence</span> <Ids ids={o.evidence_ids} /></p>
                </li>
              ))}
            </ul>
          )}
        </Block>
        {r.state === 'ok' && r.report.next_steps && r.report.next_steps.length > 0 && (
          <Block title="Next steps in the report">
            <ul className="rp-list">{r.report.next_steps.map((n) => <li key={n.description}>{n.description}</li>)}</ul>
          </Block>
        )}
      </div>
      <section className="panel" aria-labelledby="await-h">
        <h3 id="await-h" className="label panel-title">Awaiting human decision</h3>
        <DecisionPanel decision={run.decision} />
        <p className="advisory-note" role="note"><strong>Advisory only.</strong> A human decides. No automatic action is authorised.</p>
      </section>
    </div>
  )
}
