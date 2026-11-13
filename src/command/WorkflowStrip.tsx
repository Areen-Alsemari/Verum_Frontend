import { STATE_COLOR, isFailure, statusText } from '../lib/agentState'
import type { AgentInfo, RunState } from '../state/runState'
import { AgentIcon } from '../components/AgentIcon'
import { Unknown } from '../components/Unknown'
import { label } from '../lib/labels'

interface Props {
  agents: AgentInfo[]
  run: RunState
  selected: string | null
  onSelect: (role: string) => void
  /** number of sensor_reading events received in this run (null = none yet) */
  readings?: number | null
}

/** Horizontal, live eight-agent workflow. Failed agents are red with their issue code and never shown as complete. */
export function WorkflowStrip({ agents, run, selected, onSelect, readings = null }: Props) {
  return (
    <section className="panel strip-panel" aria-labelledby="strip-h">
      <div className="panel-head">
        <h3 id="strip-h" className="label panel-title">Agent workflow</h3>
        <span className="control-help">{run.mode ? `${run.mode} run` : 'No run yet'}{run.windowIndex !== null ? `, window ${run.windowIndex}` : ''}</span>
      </div>
      <ol className="strip">
        <li className="strip-step strip-input">
          <div className="strip-card st-input">
            <span className="strip-top"><span className="strip-num" aria-hidden="true">in</span></span>
            <span className="strip-name">Sensor stream</span>
            <span className="strip-status">{readings === null ? <Unknown what="readings received" /> : `${readings} sensor events`}</span>
            <span className="strip-issue strip-muted">synthetic</span>
          </div>
        </li>
        {agents.map((a) => {
          const st = run.agents[a.role_key]
          const ui = st?.state ?? 'idle'
          const issue = st?.issueCodes[0] ?? null
          const fail = isFailure(ui)
          const text = statusText(ui, st?.status)
          return (
            <li key={a.role_key} className="strip-step">
              <button
                type="button"
                className={`strip-card st-${ui}${selected === a.role_key ? ' is-selected' : ''}`}
                style={{ ['--st' as string]: STATE_COLOR[ui] }}
                aria-label={`${a.order}. ${a.name}: ${text}${issue ? `, issue: ${label(issue)}` : ''}`}
                onClick={() => onSelect(a.role_key)}
              >
                <span className="strip-top">
                  <span className="strip-num">{a.order}</span>
                  <span className="agent-ico"><AgentIcon role={a.role_key} size={16} /></span>
                  
                </span>
                <span className="strip-name">{a.name}</span>
                <span className="strip-status"><span className="state-dot" aria-hidden="true" /><span className="strip-status-text">{text}</span></span>
                {issue
                  ? <span className={`issue-code strip-issue${fail ? ' is-fail' : ''}`} title={issue}>{label(issue)}</span>
                  : <span className="strip-issue" aria-hidden="true" />}
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
