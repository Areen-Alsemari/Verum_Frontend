import type { AgentInfo, MaintenanceReport } from '../api'
import { STATE_COLOR, STATE_LABEL } from '../lib/agentState'
import type { RunState } from '../state/runState'
import { Unknown } from './Unknown'

/** Per-agent status, issue codes and report id. Failures are red with their code and never shown as complete. */
export function AgentOutcomes({ agents, run, report }: { agents: AgentInfo[]; run: RunState; report: MaintenanceReport | null | undefined }) {
  const rid = (k: string) => report?.source_reports.find((s) => s.agent === k)?.report_id
  return (
    <table className="outcomes">
      <thead><tr><th>Agent</th><th>Status</th><th>Issue codes</th><th>Report id</th><th>Consumed</th></tr></thead>
      <tbody>
        {agents.map((a) => {
          const st = run.agents[a.role_key]
          const ui = st?.state ?? 'idle'
          const fail = ui === 'error' || ui === 'rejected'
          return (
            <tr key={a.role_key} className={fail ? 'is-fail' : ''}>
              <td>{a.order}. {a.name}</td>
              <td><span className="agent-state" style={{ ['--st' as string]: STATE_COLOR[ui] }}><span className="state-dot" aria-hidden="true" />{STATE_LABEL[ui]}</span></td>
              <td>{st?.issues.length ? st.issues.map((i) => <code key={i.code} className={`issue-code${fail ? ' is-fail' : ''}`}>{i.code} </code>) : st?.report !== undefined ? <span className="control-help">none</span> : <Unknown what="issues" />}</td>
              <td>{st?.report === null ? <span className="agent-null">no report (null)</span> : rid(a.role_key) ? <code>{rid(a.role_key)}</code> : <Unknown what="report id" />}</td>
              <td>{st?.consumed.length ? <span className="chips">{st.consumed.map((c) => <code key={c} className="chip">{c}</code>)}</span> : st?.report !== undefined ? <span className="control-help">none</span> : <Unknown what="consumed reports" />}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
