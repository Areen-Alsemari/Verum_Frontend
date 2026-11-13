import { STATE_COLOR, isFailure, statusText } from '../lib/agentState'
import { label } from '../lib/labels'
import type { AgentInfo, AgentRunState, RunState } from '../state/runState'
import { AgentIcon } from './AgentIcon'
import { Unknown } from './Unknown'

interface Props {
  agents: AgentInfo[]
  run: RunState
  selected: string | null
  onSelect: (role: string) => void
}

/** The agents in the order the service lists them, with the status of the latest window exactly as received. */
export function AgentBoard({ agents, run, selected, onSelect }: Props) {
  return (
    <section className="panel board" aria-labelledby="board-h">
      <h2 id="board-h" className="label panel-title">Agents{run.windowIndex !== null && <span className="control-help"> · window {run.windowIndex}</span>}</h2>
      {agents.length === 0 ? (
        <p className="state-msg">Not available: the service names the agents in its first window result, which has not arrived yet.</p>
      ) : (
        <ol className="board-grid agent-grid">
          {agents.map((a) => (
            <li key={a.role_key}>
              <AgentCard info={a} st={run.agents[a.role_key]} selected={selected === a.role_key} onClick={() => onSelect(a.role_key)} />
            </li>
          ))}
        </ol>
      )}
      <p className="control-help">Dependencies between agents, timing and per-agent report text are not available from the service.</p>
    </section>
  )
}

function AgentCard({ info, st, selected, onClick }: { info: AgentInfo; st: AgentRunState | undefined; selected: boolean; onClick: () => void }) {
  const state = st?.state ?? 'idle'
  const text = statusText(state, st?.status)
  const fail = isFailure(state)
  return (
    <button
      type="button" onClick={onClick}
      className={`agent-card st-${state}${selected ? ' is-selected' : ''}`}
      style={{ ['--st' as string]: STATE_COLOR[state] }}
      aria-label={`${info.order}. ${info.name}: ${text}${st?.issueCodes[0] ? `, issue: ${label(st.issueCodes[0])}` : ''}. Open details.`}
      aria-pressed={selected}
    >
      <span className="agent-head">
        <span className="agent-ico"><AgentIcon role={info.role_key} /></span>
        <span className="agent-name"><span className="agent-order">{info.order}</span> {info.name}</span>
      </span>
      <span className="agent-state"><span className="state-dot" aria-hidden="true" />{text}</span>
      <dl className="agent-facts">
        <div><dt>Issue codes</dt><dd>{st && st.state !== 'idle' ? st.issueCodes.length : '—'}</dd></div>
        <div><dt>Report id</dt><dd>{st?.reportId ? <code title={st.reportId}>{st.reportId}</code> : st && st.state !== 'idle' ? <Unknown what="report id" /> : '—'}</dd></div>
      </dl>
      {st?.issueCodes[0] && <span className={`issue-code${fail ? ' is-fail' : ''}`} title={st.issueCodes[0]}>{label(st.issueCodes[0])}</span>}
      {fail && <span className="agent-null">No report</span>}
    </button>
  )
}
