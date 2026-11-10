import type { DecisionFlags } from '../api'
import { humanize } from '../lib/format'
import { Unknown, isMissing } from './Unknown'

export const ROLES = [
  { icon: 'operator', name: 'Operator', text: 'Starts runs and watches the pipeline.' },
  { icon: 'inspector', name: 'Inspector', text: 'Carries out any inspection and records what is found.' },
  { icon: 'analyst', name: 'Analyst', text: 'Reads the evidence and the competing hypotheses.' },
  { icon: 'reviewer', name: 'Reviewer', text: 'Checks the report against the evidence trail.' },
] as const

/** A boolean flag shown exactly as the API gave it: true, false or unknown. */
export function FlagValue({ name, value }: { name: string; value: boolean | null | undefined }) {
  return (
    <div className="flag-row">
      <code>{name}</code>
      <strong className={`flag-val flag-${String(value)}`}>{typeof value === 'boolean' ? String(value) : <Unknown what={name} />}</strong>
    </div>
  )
}

interface Props {
  decision: string | null | undefined
  verified: boolean | null | undefined
  flags: DecisionFlags | null | undefined
  roles?: boolean
  compact?: boolean
}

/** The fixed human-decision panel. Shows state and flags only; it has no action controls. */
export function DecisionPanel({ decision, verified, flags, roles = true, compact = false }: Props) {
  return (
    <div className={`decision-panel${compact ? ' is-compact' : ''}`}>
      <div className="decision">
        <img src="/brand/icons/decision-owner.png" alt="" className={`role-img${compact ? '' : ' role-img-lg'}`} />
        <div>
          <p className="decision-title">A human decides what happens next.</p>
          <div className="decision-state">
            <span className="label">Decision state</span>
            <strong>{isMissing(decision) ? <Unknown what="decision state" /> : <><code>{decision}</code> <span className="control-help">({humanize(String(decision))})</span></>}</strong>
          </div>
          <div className="decision-state">
            <span className="label">Verified</span>
            <strong>{typeof verified === 'boolean' ? String(verified) : <Unknown what="verified" />}</strong>
          </div>
          <FlagValue name="human_decision_required" value={flags?.human_decision_required} />
          <FlagValue name="automatic_action_authorized" value={flags?.automatic_action_authorized} />
          <FlagValue name="equipment_condition_confirmed" value={flags?.equipment_condition_confirmed} />
        </div>
      </div>
      {roles && (
        <ul className="roles">
          {ROLES.map((r) => (
            <li key={r.icon}><img src={`/brand/icons/${r.icon}.png`} alt="" className="role-img" /><span><strong>{r.name}</strong><br /><span className="control-help">{r.text}</span></span></li>
          ))}
        </ul>
      )}
    </div>
  )
}
