import type { ReactNode } from 'react'
import { Unknown } from '../components/Unknown'
import type { ReportModel } from './model'
import { label, yesNo } from '../lib/labels'

/** Text that comes from the API is wrapped so tests can tell UI wording from data. */
function Api({ children }: { children: ReactNode }) {
  return <span data-api="">{children}</span>
}

function Section({ n, title, tag, children, className }: { n: number; title: string; tag?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rp-section${className ? ` ${className}` : ''}`} aria-labelledby={`rp-${n}`}>
      <h3 id={`rp-${n}`} className="rp-h"><span className="rp-n">{n}</span>{title}{tag && <span className="tag-advisory">{tag}</span>}</h3>
      {children}
    </section>
  )
}

const U = ({ what }: { what: string }) => <Unknown what={what} />
const Code = ({ v }: { v: string }) => <code><Api>{v}</Api></code>
/** a code from the API shown as its readable label */
const L = ({ v }: { v: string }) => <span title={v}><Api>{label(v)}</Api></span>
const IdList = ({ ids }: { ids: string[] }) => ids.length ? <span className="rp-ids">{ids.map((i) => <Code key={i} v={i} />)}</span> : <span className="rp-muted">none listed</span>

interface Props {
  model: ReportModel
}

/** The maintenance report card. The same markup is used on screen and for the A4 print layout. */
export function ReportCard({ model: m }: Props) {
  const h = m.header
  const f = m.flags
  const flag = (v: boolean | null) => (typeof v === 'boolean' ? <strong className="rp-flag"><Api>{yesNo(v)}</Api></strong> : <U what="flag" />)
  return (
    <article className="report-card" aria-label="Maintenance report">
      <header className="rp-header">
        <div className="rp-brand">
          <img src="/brand/logo-mark.png" alt="" className="rp-logo" />
          <div>
            <p className="rp-wordmark">VERUM</p>
            <p className="rp-tagline">Industrial diagnostic intelligence</p>
          </div>
        </div>
        <div className="rp-title-wrap">
          <h2 className="rp-title">Maintenance assessment report</h2>
          <p className="rp-banner" role="note">{h.banner}</p>
        </div>
      </header>
      <dl className="rp-meta">
        <div><dt>Report id</dt><dd>{h.reportId ? <Code v={h.reportId} /> : <U what="report id" />}</dd></div>
        <div><dt>Analysis id</dt><dd>{h.analysisId ? <Code v={h.analysisId} /> : <U what="analysis id" />}</dd></div>
        <div><dt>Run</dt><dd>{h.run ? <><Code v={h.run} /> · <Api>{h.mode ?? 'mode not available'}</Api></> : <U what="run" />}</dd></div>
        <div><dt>Window</dt><dd>{h.window !== null ? <>window <Api>{h.window}</Api></> : <U what="window" />}{h.asOfS !== null ? <> · as of <Api>{h.asOfS}</Api> s</> : null}{h.asOfUtc ? <> · <Api>{h.asOfUtc}</Api></> : null}</dd></div>
        <div><dt>Data release</dt><dd>{h.dataRelease ? <L v={h.dataRelease} /> : <U what="data release" />}</dd></div>
        <div><dt>Assessment state</dt><dd>{h.assessmentState ? <L v={h.assessmentState} /> : <U what="assessment state" />}</dd></div>
        <div><dt>Review status</dt><dd>{h.reviewStatus ? <L v={h.reviewStatus} /> : <U what="review status" />}</dd></div>
      </dl>

      <Section n={1} title="Summary">
        {m.summary.map((s) => <p key={s} className="rp-p"><Api>{s}</Api></p>)}
      </Section>

      <Section n={2} title="Affected assets">
        <p className="rp-p"><U what="affected assets" /> The service does not list flagged assets. Inspection options below name their target asset.</p>
      </Section>

      <Section n={3} title="Observations">
        {m.observations.length === 0 ? <p className="rp-muted">No observations were reported.</p> : (
          <table className="rp-table">
            <thead><tr><th>Statement</th><th>Source report</th><th>Evidence ids</th></tr></thead>
            <tbody>{m.observations.map((o, k) => (
              <tr key={k}><td><Api>{o.statement}</Api></td><td>{o.source ? <Code v={o.source} /> : <U what="source report" />}</td><td><IdList ids={o.evidence} /></td></tr>
            ))}</tbody>
          </table>
        )}
      </Section>

      <Section n={4} title="Hypotheses" tag="Unconfirmed">
        {m.hypotheses.length === 0 ? <p className="rp-muted">The report lists no hypotheses. Support level and confidence are not available from the service.</p> : (
          <table className="rp-table">
            <thead><tr><th>Hypothesis (unconfirmed)</th><th>Source report</th><th>Evidence ids</th></tr></thead>
            <tbody>{m.hypotheses.map((x, k) => (
              <tr key={k}><td><Api>{x.statement}</Api></td><td>{x.source ? <Code v={x.source} /> : <U what="source report" />}</td><td><IdList ids={x.evidence} /></td></tr>
            ))}</tbody>
          </table>
        )}
      </Section>

      <Section n={5} title="Inspection options for the inspector to consider" tag="Advisory">
        {m.options.length === 0 ? <p className="rp-muted">The report lists no inspection options.</p> : m.options.map((o, k) => (
          <div key={k} className="rp-option">
            <p><Code v={o.actionId} /> on <Code v={o.target} /></p>
            <p>Feasibility: {o.feasibility ? <L v={o.feasibility} /> : <U what="feasibility" />} · Preconditions: <U what="preconditions" /></p>
            <p>Cost: {o.costUsd !== null ? <><Api>{o.costUsd}</Api> USD</> : <U what="cost" />} · Duration: {o.durationMin !== null ? <><Api>{o.durationMin}</Api> min</> : <U what="duration" />}</p>
            <p className="rp-muted">Source: {o.source ? <Code v={o.source} /> : <U what="source report" />} · Evidence: <IdList ids={o.evidence} /></p>
          </div>
        ))}
        {m.nextSteps.length > 0 && <ul className="rp-list">{m.nextSteps.map((n) => <li key={n}><Api>{n}</Api></li>)}</ul>}
      </Section>

      <Section n={6} title="What is unknown or missing">
        {m.unknowns.length === 0 ? <p className="rp-muted">Nothing listed as missing by the run data.</p> : (
          <ul className="rp-unknowns">{m.unknowns.map((u, k) => (
            <li key={k} className={`sev-${u.severity}`}>{u.code && <strong className="rp-code"><Api>{label(u.code)}</Api></strong>} <Api>{u.text}</Api>{u.code && <span className="rp-raw"> (code {u.code})</span>}</li>
          ))}</ul>
        )}
      </Section>

      <Section n={7} title="Human decision" className="rp-decision">
        <p className="rp-p">The flags below are shown exactly as given. A human decides what happens next; no automatic action is authorised by this report.</p>
        <dl className="rp-flags">
          <div><dt><Api>{label('advisory_only')}</Api></dt><dd>{flag(f.advisory_only)}</dd></div>
          <div><dt><Api>{label('human_decision_required')}</Api></dt><dd>{flag(f.human_decision_required)}</dd></div>
          <div><dt><Api>{label('automatic_action_authorized')}</Api></dt><dd>{flag(f.automatic_action_authorized)}</dd></div>
          <div><dt><Api>{label('equipment_condition_confirmed')}</Api></dt><dd>{flag(f.equipment_condition_confirmed)}</dd></div>
          <div><dt>Decision state</dt><dd>{m.decisionState ? <L v={m.decisionState} /> : <U what="decision state" />}</dd></div>
        </dl>
        <div className="rp-signoff">
          <p className="rp-signoff-title">Reviewer sign-off (completed on paper; this is not a system action)</p>
          <div className="rp-fields">
            {['Name', 'Role', 'Date', 'Signature'].map((x) => <div key={x} className="rp-field"><span>{x}</span><span className="rp-line" /></div>)}
          </div>
        </div>
      </Section>

      <Section n={8} title="Traceability appendix" className="rp-trace">
        {m.trace.reportIds.length === 0 ? <p>Source reports: <U what="source reports" /></p> : (
          <table className="rp-table">
            <thead><tr><th>Report id</th><th>Agent</th><th>Content hash (SHA-256)</th></tr></thead>
            <tbody>{m.trace.reportIds.map((r) => (
              <tr key={r.id}><td><Code v={r.id} /></td><td><Api>{r.agent}</Api></td><td>{r.hash ? <code className="rp-hash"><Api>{r.hash}</Api></code> : <U what="hash" />}</td></tr>
            ))}</tbody>
          </table>
        )}
        <p>Evidence ids: <IdList ids={m.trace.evidenceIds} /></p>
        <p>Reference data hash (SHA-256): {m.trace.referenceSha ? <code className="rp-hash"><Api>{m.trace.referenceSha}</Api></code> : <U what="reference snapshot hash" />}</p>
      </Section>

      <Section n={9} title="Limitations">
        {m.limitations.length === 0 ? <p className="rp-muted">The report lists no limitations.</p> : <ul className="rp-list">{m.limitations.map((l, k) => <li key={k}><Api>{l}</Api></li>)}</ul>}
      </Section>

      <footer className="rp-footer">Advisory only. A human decides. No automatic action is authorised. Synthetic data.</footer>
    </article>
  )
}
