import type { AgentInfo, RunState } from '../state/runState'
import { AgentCard } from '../components/AgentCard'
import { QuietNote } from '../components/QuietNote'

interface Props {
  agents: AgentInfo[]
  run: RunState
  selected: string | null
  onSelect: (role: string) => void
  /** number of sensor readings received in this run (null = none yet) */
  readings?: number | null
}

/** The eight agents as equal cards in a responsive grid, in order, with arrows between them. */
export function WorkflowStrip({ agents, run, selected, onSelect, readings = null }: Props) {
  return (
    <section className="panel strip-panel" aria-labelledby="strip-h">
      <div className="panel-head">
        <h3 id="strip-h" className="label panel-title">Agent workflow</h3>
        <span className="control-help" title="Readings received from the plant sensors">Plant sensors{readings === null ? '' : ` · ${readings} readings received`}</span>
      </div>
      <QuietNote run={run} />
      <ol className="agent-grid">
        {agents.map((a) => (
          <li key={a.role_key} className="agent-grid-item">
            <AgentCard info={a} run={run} selected={selected === a.role_key} onClick={() => onSelect(a.role_key)} />
          </li>
        ))}
      </ol>
    </section>
  )
}
