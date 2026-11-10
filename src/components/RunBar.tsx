import type { Scenario } from '../api'
import type { RunStatus } from '../state/runState'

interface Props {
  scenarios: Scenario[]
  selectedId: string | null
  status: RunStatus
  onSelect: (id: string) => void
  onRun: () => void
  onStop: () => void
  onMore: () => void
}

/** Compact run controls for tabs other than "Scenarios and controls". */
export function RunBar({ scenarios, selectedId, status, onSelect, onRun, onStop, onMore }: Props) {
  const running = status === 'running'
  return (
    <div className="runbar glass" role="group" aria-label="Run controls">
      <label className="sr-only" htmlFor="runbar-scenario">Scenario</label>
      <select id="runbar-scenario" className="select runbar-select" value={selectedId ?? ''} disabled={running} onChange={(e) => onSelect(e.target.value)}>
        {scenarios.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
      </select>
      <button type="button" className="btn btn-primary" disabled={running || !selectedId} onClick={onRun}>Run</button>
      <button type="button" className="btn btn-danger" disabled={!running} onClick={onStop}>Stop</button>
      <button type="button" className="btn btn-ghost" onClick={onMore}>All controls</button>
    </div>
  )
}
