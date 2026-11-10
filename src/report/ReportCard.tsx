import type { ReactNode } from 'react'
import { Facility2D } from '../facility/Facility2D'
import { neighbours } from '../facility/geometry'
import type { Facility } from '../facility'
import { Unknown } from '../components/Unknown'
import type { ReportModel } from './model'
import { humanText, label, yesNo } from '../lib/labels'

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
  facility: Facility
}

/** The maintenance report card. The same markup is used on screen and for the A4 print layout. */
export function ReportCard({ model: m, facility }: Props) {
  const h = m.header
  const f = m.decision.flags
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
          <p className="rp-banner" role="note">{h.banner}{h.source === 'mock' ? ' · demo data' : ''}</p>
        </div>
      </header>
      <dl className="rp-meta">
        <div><dt>Report id</dt><dd>{h.reportId ? <Code v={h.reportId} /> : <U what="report id" />}</dd></div>
        <div><dt>Analysis id</dt><dd>{h.analysisId ? <Code v={h.analysisId} /> : <U what="analysis id" />}</dd></div>
        <div><dt>Scenario</dt><dd>{h.scenario ? <Api>{h.scenario}</Api> : <U what="scenario" />}</dd></div>
        <div><dt>Time window</dt><dd>{h.asOfS !== null ? <>up to <Api>{h.asOfS}</Api> s of the replayed window</> : <U what="time window" />}{h.asOfUtc ? <> · <Api>{h.asOfUtc}</Api></> : null}</dd></div>
        <div><dt>Data release</dt><dd>{h.dataRelease ? <L v={h.dataRelease} /> : <U what="data release" />}</dd></div>
        <div><dt>Assessment state</dt><dd>{h.assessmentState ? <L v={h.assessmentState} /> : <U what="assessment state" />}</dd></div>
        <div><dt>Review status</dt><dd>{h.reviewStatus ? <L v={h.reviewStatus} /> : <U what="review status" />}</dd></div>
      </dl>

      <Section n={1} title="Summary">
        {m.summary.map((s) => <p key={s} className="rp-p"><Api>{s}</Api></p>)}
      </Section>

      <Section n={2} title={m.affected.length === 1 ? 'Affected asset' : 'Affected assets'}>
        {m.affected.length === 0 ? <p className="rp-muted">No asset was flagged by any agent.</p> : m.affected.map((a) => (
          <div key={a.assetId} className="rp-asset">
            <div className="rp-asset-img">
              {a.snapshot ? (
                <img src={a.snapshot} alt={`3D close-up of ${a.assetId} with its sensors, schematic`} />
              ) : (
                <div className="rp-asset-2d"><Facility2D facility={facility} flagged={new Map([[a.assetId, { by: a.flaggedBy }]])} selectedId={a.assetId} onSelect={() => {}} only={neighbours(facility, a.assetId)} interactive={false} /></div>
              )}
              <p className="rp-caption">{a.snapshot ? '3D snapshot from the focus view at report time.' : '2D close-up (3D snapshot not available).'} Schematic, not to scale.</p>
            </div>
            <div className="rp-asset-info">
              <p className="rp-asset-id"><Code v={a.assetId} /></p>
              <p>{a.kind ? <Api>{a.kind}</Api> : <U what="kind" />} · {a.area ? <Api>{a.area}</Api> : <U what="area" />}</p>
              <p>Flagged by {a.flaggedBy.length} agent{a.flaggedBy.length === 1 ? '' : 's'}: <Api>{a.flaggedBy.join(', ') || 'unknown'}</Api></p>
              <p>Severity: {a.severity ? <L v={a.severity} /> : <U what="severity" />}</p>
              {a.note && <p>Note: <Api>{humanText(a.note)}</Api></p>}
              <table className="rp-table">
                <thead><tr><th>Sensor</th><th>Last value</th><th>Quality</th></tr></thead>
                <tbody>
                  {a.sensors.length === 0 ? <tr><td colSpan={3} className="rp-muted">No tag is tied to this asset in the source data.</td></tr> : a.sensors.map((s) => (
                    <tr key={s.tag}><td><Code v={s.tag} /></td><td>{s.value === 'unknown' ? <U what={s.tag} /> : <Api>{s.value}</Api>}</td><td>{s.quality ? <L v={s.quality} /> : <U what="quality" />}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
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
        {m.hypotheses.length === 0 ? <p className="rp-muted">No hypotheses were returned.</p> : (
          <table className="rp-table">
            <thead><tr><th>Hypothesis (unconfirmed)</th><th>Support</th><th>Confidence</th><th>Supporting</th><th>Conflicting</th></tr></thead>
            <tbody>{m.hypotheses.map((x) => (
              <tr key={x.title}><td><strong><Api>{x.title}</Api></strong><br /><span className="rp-muted"><Api>{humanText(x.description)}</Api></span></td>
                <td>{x.support ? <L v={x.support} /> : <U what="support" />}</td>
                <td>{x.confidence !== null ? <Api>{x.confidence}</Api> : <U what="confidence" />}</td>
                <td><IdList ids={x.supporting} /></td><td><IdList ids={x.conflicting} /></td></tr>
            ))}</tbody>
          </table>
        )}
      </Section>

      <Section n={5} title="Inspection options for the inspector to consider" tag="Advisory">
        {m.options.length === 0 ? <p className="rp-muted">No inspection options were returned.</p> : m.options.map((o, k) => (
          <div key={k} className="rp-option">
            <p><strong><Api>{o.title}</Api></strong> {o.actionId && <Code v={o.actionId} />}</p>
            <p>Targets: <IdList ids={o.targets} /> · Feasibility: {o.feasibility ? <L v={o.feasibility} /> : <U what="feasibility" />}</p>
            {o.preconditions === null ? <p>Preconditions: <U what="preconditions" /></p> : (
              <ul className="rp-pre">{o.preconditions.map((p) => <li key={p.description}><span className={`rp-status st-${p.status}`}>{p.status}</span> <Api>{p.description}</Api></li>)}</ul>
            )}
            {(o.costUsd !== null || o.durationMin !== null) && (
              <p>{o.costUsd !== null && <>Cost: <Api>{o.costUsd}</Api> USD</>}{o.costUsd !== null && o.durationMin !== null && ' · '}{o.durationMin !== null && <>Duration: <Api>{o.durationMin}</Api> min</>} <span className="rp-muted">(as given)</span></p>
            )}
            <p className="rp-muted">Source: {o.source ? <Code v={o.source} /> : <U what="source report" />} · Evidence: <IdList ids={o.evidence} /></p>
          </div>
        ))}
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
          <div><dt><Api>{label('human_decision_required')}</Api></dt><dd>{flag(f.human_decision_required)}</dd></div>
          <div><dt><Api>{label('automatic_action_authorized')}</Api></dt><dd>{flag(f.automatic_action_authorized)}</dd></div>
          <div><dt><Api>{label('equipment_condition_confirmed')}</Api></dt><dd>{flag(f.equipment_condition_confirmed)}</dd></div>
          <div><dt>Decision state</dt><dd>{m.decision.decisionState ? <L v={m.decision.decisionState} /> : <U what="decision state" />}</dd></div>
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
        {m.limitations === null ? <p><U what="limitations" /></p> : <ul className="rp-list">{m.limitations.map((l) => <li key={l}><Api>{l}</Api></li>)}</ul>}
      </Section>

      <footer className="rp-footer">Advisory only. A human decides. No automatic action is authorised. Simulated data; facility layout is schematic, not to scale.</footer>
    </article>
  )
}
