import type { Decision } from '../api'
import { Unknown, isMissing } from './Unknown'
import { label, yesNo } from '../lib/labels'

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
      <span className="flag-name" title={name}>{label(name)}</span>
      <strong className={`flag-val flag-${String(value)}`} title={typeof value === 'boolean' ? `${name} = ${String(value)} (as given)` : undefined}>{typeof value === 'boolean' ? yesNo(value) : <Unknown what={label(name)} />}</strong>
    </div>
  )
}

interface Props {
  /** Agent 8's decision from the latest window result; undefined/null = none received */
  decision: Decision | null | undefined
  roles?: boolean
  compact?: boolean
}

/** The fixed human-decision panel. Shows the decision state and the flags exactly as received; it has no action controls. */
export function DecisionPanel({ decision, roles = true, compact = false }: Props) {
  return (
    <div className={`decision-panel${compact ? ' is-compact' : ''}`}>
      <div className="decision-head">
        <img src="/brand/icons/decision-owner.png" alt="" className="role-img decision-img" />
        <p className="decision-title">A human decides what happens next.</p>
      </div>
      <div className="decision-rows">
        <div className="flag-row decision-state">
          <span className="flag-name">Decision state</span>
          <strong className="flag-val">{isMissing(decision?.decision_state) ? <Unknown what="decision state" /> : <span title={String(decision!.decision_state)}>{label(String(decision!.decision_state))}</span>}</strong>
        </div>
        <FlagValue name="advisory_only" value={decision?.advisory_only} />
        <FlagValue name="human_decision_required" value={decision?.human_decision_required} />
        <FlagValue name="automatic_action_authorized" value={decision?.automatic_action_authorized} />
        <FlagValue name="equipment_condition_confirmed" value={decision?.equipment_condition_confirmed} />
      </div>
      {roles && (
        <>
          <p className="roles-title">Who decides</p>
          <ul className="roles">
            {ROLES.map((r) => (
              <li key={r.icon}>
                <img src={`/brand/icons/${r.icon}.png`} alt="" className="role-img" />
                <span><strong>{r.name}</strong><span className="control-help">{r.text}</span></span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
