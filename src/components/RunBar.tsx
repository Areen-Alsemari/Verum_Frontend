import type { Scenario } from '../api'
import { KIND_COLOR, KIND_LABEL } from '../lib/format'
import { humanText } from '../lib/labels'
import type { RunStatus } from '../state/runState'
import { Select } from './Select'

interface Props {
  scenarios: Scenario[]
  selectedId: string | null
  status: RunStatus
  onSelect: (id: string) => void
  onRun: () => void
  onStop: () => void
  onMore: () => void
  /** step-by-step mode: the Next event button lives here so the run can be watched with the card closed */
  stepMode?: boolean
  queued?: number
  onNext?: () => void
}

/** Command center scenario switcher with Run, Stop and All controls. */
export function RunBar({ scenarios, selectedId, status, onSelect, onRun, onStop, onMore, stepMode = false, queued = 0, onNext }: Props) {
  const running = status === 'running'
  const options = scenarios.map((s) => ({
    value: s.id, label: s.title, description: humanText(s.description),
    badge: { text: KIND_LABEL[s.kind], color: KIND_COLOR[s.kind] },
  }))
  return (
    <div className="scenario-bar glass" role="group" aria-label="Scenario and run controls">
      <Select id="scenario-switch" variant="hero" label="Scenario" value={selectedId ?? ''} options={options} disabled={running || options.length === 0} onChange={onSelect} />
      <div className="scenario-actions">
        <button type="button" className="btn btn-primary" disabled={running || !selectedId} onClick={onRun}>Run</button>
        {running && stepMode && (
          <button type="button" className="btn" disabled={queued === 0} onClick={onNext}>Next event ({queued} waiting)</button>
        )}
        <button type="button" className="btn btn-danger" disabled={!running} onClick={onStop}>Stop</button>
        <button type="button" className="btn btn-ghost" aria-haspopup="dialog" onClick={onMore}>All controls</button>
      </div>
    </div>
  )
}
