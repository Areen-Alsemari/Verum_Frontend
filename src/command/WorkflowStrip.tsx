import type { AgentInfo } from '../api'
import { STATE_COLOR, STATE_LABEL } from '../lib/agentState'
import { formatMs } from '../lib/format'
import { elapsedMs, topIssue, type RunState } from '../state/runState'
import { AgentIcon } from '../components/AgentIcon'
import { Unknown } from '../components/Unknown'

interface Props {
  agents: AgentInfo[]
  run: RunState
  selected: string | null
  onSelect: (role: string) => void
  /** number of sensor_reading events received in this run (null = none yet / not provided) */
  readings?: number | null
}

/** Horizontal, live eight-agent workflow. Failed agents are red with their issue code and never shown as complete. */
export function WorkflowStrip({ agents, run, selected, onSelect, readings = null }: Props) {
  return (
    <section className="panel strip-panel" aria-labelledby="strip-h">
      <div className="panel-head">
        <h3 id="strip-h" className="label panel-title">Agent workflow</h3>
        <span className="control-help">Simulated stream (replay of recorded windows)</span>
      </div>
      <ol className="strip">
        <li className="strip-step strip-input">
          <div className="strip-card st-input">
            <span className="strip-name">Sensor stream</span>
            <span className="strip-state">{readings === null ? <Unknown what="readings received" /> : `${readings} readings`}</span>
            <span className="control-help">simulated</span>
          </div>
        </li>
        {agents.map((a) => {
          const st = run.agents[a.role_key]
          const ui = st?.state ?? 'idle'
          const issue = st ? topIssue(st.issues) : null
          const fail = ui === 'error' || ui === 'rejected'
          const ms = st ? formatMs(elapsedMs(st, run.lastTs)) : null
          return (
            <li key={a.role_key} className="strip-step">
              <button
                type="button"
                className={`strip-card st-${ui}${selected === a.role_key ? ' is-selected' : ''}`}
                style={{ ['--st' as string]: STATE_COLOR[ui] }}
                aria-label={`${a.order}. ${a.name}: ${STATE_LABEL[ui]}${issue ? `, issue ${issue.code}` : ''}`}
                onClick={() => onSelect(a.role_key)}
              >
                <span className="strip-top"><span className="agent-ico"><AgentIcon role={a.role_key} size={18} /></span><span className="agent-order">{a.order}</span></span>
                <span className="strip-name">{a.name}</span>
                <span className="agent-state"><span className="state-dot" aria-hidden="true" />{STATE_LABEL[ui]}</span>
                <span className="strip-meta">{ms ?? ''}</span>
                {issue && <span className={`issue-code${fail ? ' is-fail' : ''}`}>{issue.code}</span>}
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
