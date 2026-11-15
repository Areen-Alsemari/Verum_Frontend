import { Block, reportNotice } from '../components/Block'
import { DecisionPanel } from '../components/DecisionPanel'
import { inspectionChecklist } from '../lib/inspection'
import type { RunState } from '../state/runState'

/** What to check: the report's inspection options as a plain checklist. There is no approve, execute or dispatch control. */
export function InspectionTab({ run, onRetryReport }: { run: RunState; onRetryReport: () => void }) {
  const r = run.report
  const items = r.state === 'ok' ? inspectionChecklist(r.report) : []
  const steps = r.state === 'ok' ? (r.report.next_steps ?? []) : []
  return (
    <div className="grid-main-side">
      <div className="stack">
        <Block title="What to check" tag="Advisory">
          <p className="control-help block-intro">Checks for an inspector to consider. They are suggestions and nothing is scheduled.</p>
          {r.state !== 'ok' ? reportNotice(r, onRetryReport) : items.length === 0 ? (
            <p className="control-help">The report suggests no checks for this window.</p>
          ) : (
            <ul className="checklist">
              {items.map((it) => (
                <li key={it.key} className="check-item">
                  <span className="check-box" aria-hidden="true" />
                  <span>
                    <strong>{it.text}</strong>
                    {it.where && <span className="control-help"> · {it.where}</span>}
                    {it.facts.length > 0 && <span className="control-help check-facts">{it.facts.join(' · ')}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Block>
        {steps.length > 0 && (
          <Block title="Next steps">
            <ul className="rp-list">{steps.map((n) => <li key={n.description}>{n.description}</li>)}</ul>
          </Block>
        )}
      </div>
      <section className="panel" aria-labelledby="await-h">
        <h3 id="await-h" className="label panel-title">Awaiting human decision</h3>
        <DecisionPanel decision={run.decision} />
        <p className="advisory-note" role="note"><strong>Advisory only.</strong> A person decides. No automatic action is authorised.</p>
      </section>
    </div>
  )
}
