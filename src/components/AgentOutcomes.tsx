import { STATE_COLOR, isFailure, statusText } from '../lib/agentState'
import { label } from '../lib/labels'
import type { AgentInfo, RunState } from '../state/runState'
import { Unknown } from './Unknown'

/** Per-agent status, runner issue codes and report id for the latest window. Failures are red and never shown as complete. */
export function AgentOutcomes({ agents, run }: { agents: AgentInfo[]; run: RunState }) {
  if (agents.length === 0) return <p className="state-msg">Not available: no window result has arrived yet.</p>
  return (
    <table className="outcomes">
      <thead><tr><th>Agent</th><th>Status (as received)</th><th>Runner issue codes</th><th>Report id</th></tr></thead>
      <tbody>
        {agents.map((a) => {
          const st = run.agents[a.role_key]
          const ui = st?.state ?? 'idle'
          const fail = isFailure(ui)
          return (
            <tr key={a.role_key} className={fail ? 'is-fail' : ''}>
              <td>{a.order}. {a.name}</td>
              <td><span className="agent-state" style={{ ['--st' as string]: STATE_COLOR[ui] }}><span className="state-dot" aria-hidden="true" />{statusText(ui, st?.status)}</span></td>
              <td>{st?.issueCodes.length ? st.issueCodes.map((c) => <span key={c} className={`issue-code${fail ? ' is-fail' : ''}`} title={c}>{label(c)} </span>) : ui === 'idle' ? <Unknown what="issue codes" /> : <span className="control-help">none</span>}</td>
              <td>{st?.reportId ? <code>{st.reportId}</code> : fail ? <span className="agent-null">No report</span> : <Unknown what="report id" />}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
