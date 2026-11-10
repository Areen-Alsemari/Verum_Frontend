import type { Check, EvidenceVerification, Hypothesis, InspectionOption } from '../api'
import { Unknown, Value } from './Unknown'
import { humanText, label } from '../lib/labels'

export function Block({ title, tag, children, className }: { title: string; tag?: string; children: React.ReactNode; className?: string }) {
  const id = `blk-${title.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <section className={`panel result-block${className ? ` ${className}` : ''}`} aria-labelledby={id}>
      <h3 id={id} className="label panel-title">{title}{tag && <span className="tag-advisory">{tag}</span>}</h3>
      {children}
    </section>
  )
}

export function Ids({ ids }: { ids: string[] }) {
  return ids.length ? <span className="chips">{ids.map((i) => <code key={i} className="chip">{i}</code>)}</span> : <span className="control-help">none</span>
}

export function Hypotheses({ hyps }: { hyps: Hypothesis[] }) {
  if (hyps.length === 0) return <p className="control-help">No hypotheses were returned.</p>
  return (
    <ul className="cards">
      {hyps.map((h) => (
        <li key={h.id} className="mini-card">
          <div className="mini-head"><strong>{h.title}</strong>
            <span className="pill">support: <Value value={h.support_level} what="support level">{label(h.support_level)}</Value></span></div>
          <p className="control-help">{humanText(h.description)}</p>
          <p className="kv"><span>status</span> unconfirmed</p>
          <p className="kv"><span>confidence</span> <Value value={h.confidence} what="confidence" /></p>
          <p className="kv"><span>supporting</span> <Ids ids={h.supporting_evidence_ids} /></p>
          <p className="kv"><span>conflicting</span> <Ids ids={h.conflicting_evidence_ids} /></p>
        </li>
      ))}
    </ul>
  )
}

const OUTCOME: Record<Check['outcome'], { text: string; cls: string }> = {
  pass: { text: 'met', cls: 'res-pass' },
  fail: { text: 'unmet', cls: 'res-fail' },
  unknown: { text: 'unknown', cls: 'res-none' },
}

export function Preconditions({ checks }: { checks: Check[] | undefined }) {
  if (!checks) return <p className="kv"><span>preconditions</span> <Unknown what="preconditions" /></p>
  if (checks.length === 0) return <p className="kv"><span>preconditions</span> none listed</p>
  return (
    <div className="kv kv-block">
      <span>preconditions</span>
      <ul className="pre-list">
        {checks.map((c) => {
          const o = OUTCOME[c.outcome] ?? OUTCOME.unknown
          return <li key={c.check_id}><span className={`chip-res ${o.cls}`}>{o.text}</span> {c.description}</li>
        })}
      </ul>
    </div>
  )
}

/** Cost and duration are shown only when the API gives them. */
function CostDuration({ cost, duration }: { cost?: number | null; duration?: number | null }) {
  return (
    <>
      {typeof cost === 'number' && <p className="kv"><span>cost</span> {cost} USD <span className="control-help">(as given)</span></p>}
      {typeof duration === 'number' && <p className="kv"><span>duration</span> {duration} min <span className="control-help">(as given)</span></p>}
    </>
  )
}

export function InspectionOptions({ options, hypTitle }: { options: InspectionOption[]; hypTitle: (id: string) => string }) {
  if (options.length === 0) return <p className="control-help">No inspection options were returned.</p>
  return (
    <ul className="cards">
      {options.map((o) => (
        <li key={o.id} className="mini-card">
          <div className="mini-head"><strong>{o.title}</strong>
            {o.recommended === true && <span className="pill">marked recommended by the API</span>}
            {o.action_id && <span className="pill" title="Inspection catalogue action">{o.action_id}</span>}</div>
          <p className="control-help">{o.rationale}</p>
          <p className="kv"><span>targets</span> {o.targets.length ? <Ids ids={o.targets} /> : <Unknown what="targets" />}</p>
          <p className="kv"><span>helps separate</span> {o.distinguishes.length ? o.distinguishes.map(hypTitle).join(', ') : <Unknown what="hypotheses" />}</p>
          <p className="kv"><span>feasibility</span> {o.feasibility ? <span title={o.feasibility}>{label(o.feasibility)}</span> : <Unknown what="feasibility" />}</p>
          <Preconditions checks={o.precondition_checks} />
          <CostDuration cost={o.cost_usd} duration={o.duration_min} />
        </li>
      ))}
    </ul>
  )
}

export function Evidence({ ev }: { ev: EvidenceVerification | null }) {
  if (!ev) return <p><Unknown what="evidence verification" /></p>
  return (
    <>
      <p className="kv"><span>state</span> <Value value={ev.state} what="state">{<span title={String(ev.state)}>{label(ev.state)}</span>}</Value></p>
      <p className="kv"><span>checked</span> <Ids ids={ev.checked_evidence_ids} /></p>
      <p className="kv"><span>unresolved</span></p>
      {ev.unresolved.length === 0 ? <p className="control-help">nothing listed</p>
        : <ul className="plain">{ev.unresolved.map((u) => <li key={u}>{humanText(u)}</li>)}</ul>}
      <p className="kv"><span>notes</span> <Value value={ev.notes} what="notes" /></p>
    </>
  )
}
