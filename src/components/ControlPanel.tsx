import { MOCK_SPEEDS, getMockSpeed, setMockSpeed, type ControlSpec, type ControlValue, type ControlValues, type Scenario } from '../api'
import type { RunAllProgress } from '../state/useRunController'

interface Props {
  scenario: Scenario | null
  values: ControlValues
  running: boolean
  stepMode: boolean
  queued: number
  runAll: RunAllProgress | null
  isMock: boolean
  onChange: (id: string, v: ControlValue) => void
  onReset: () => void
  onRun: () => void
  onRunStep: () => void
  onNext: () => void
  onRunAll: () => void
  onStop: () => void
}

function readout(spec: ControlSpec, v: ControlValue | undefined): string {
  if (v === undefined) return ''
  if (spec.type === 'toggle') return v ? 'on' : 'off'
  if (spec.type === 'select') return spec.options?.find((o) => o.value === v)?.label ?? String(v)
  return spec.unit ? `${v} ${spec.unit}` : String(v)
}

function Control({ spec, value, disabled, onChange }: { spec: ControlSpec; value: ControlValue | undefined; disabled: boolean; onChange: (v: ControlValue) => void }) {
  const id = `ctl-${spec.id}`
  const shown = value ?? spec.default
  return (
    <div className="control">
      <div className="control-head">
        <label htmlFor={id} id={`${id}-l`} className="control-label">{spec.label}</label>
        <output htmlFor={id} className="control-value">{readout(spec, shown)}</output>
      </div>
      {spec.type === 'slider' && (
        <input
          id={id} type="range" className="slider" disabled={disabled}
          min={spec.min ?? 0} max={spec.max ?? 100} step={spec.step ?? 1} value={Number(shown)}
          aria-valuetext={readout(spec, shown)}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      )}
      {spec.type === 'toggle' && (
        <button
          id={id} type="button" role="switch" aria-checked={Boolean(shown)} aria-labelledby={`${id}-l`}
          className={`switch${shown ? ' is-on' : ''}`} disabled={disabled}
          onClick={() => onChange(!shown)}
        >
          <span className="switch-knob" />
        </button>
      )}
      {spec.type === 'select' && (
        <select id={id} className="select" disabled={disabled} value={String(shown)} onChange={(e) => onChange(e.target.value)}>
          {(spec.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
      {spec.help && <p className="control-help">{spec.help}</p>}
    </div>
  )
}

export function ControlPanel(p: Props) {
  const canRun = !!p.scenario && !p.running
  return (
    <section className="panel" aria-labelledby="controls-h">
      <h2 id="controls-h" className="label panel-title">Controls</h2>
      {!p.scenario && <p className="state-msg">Select a scenario to see its controls.</p>}
      {p.scenario && p.scenario.controls.length === 0 && <p className="control-help">This scenario has no adjustable controls.</p>}
      {p.scenario?.controls.map((spec) => (
        <Control key={`${p.scenario!.id}-${spec.id}`} spec={spec} value={p.values[spec.id]} disabled={p.running} onChange={(v) => p.onChange(spec.id, v)} />
      ))}
      <button type="button" className="btn btn-ghost btn-block" disabled={!canRun} onClick={p.onReset}>Reset to defaults</button>

      {p.isMock && (
        <div className="control speed">
          <label className="control-label" htmlFor="mock-speed">Demo playback speed</label>
          <select id="mock-speed" className="select" defaultValue={String(getMockSpeed())} onChange={(e) => setMockSpeed(Number(e.target.value))}>
            {MOCK_SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
          </select>
        </div>
      )}

      <div className="run-buttons">
        <button type="button" className="btn btn-primary" disabled={!canRun} onClick={p.onRun}>Run</button>
        <button type="button" className="btn" disabled={!canRun} onClick={p.onRunStep}>Run step by step</button>
        <button type="button" className="btn" disabled={!(p.running && p.stepMode && p.queued > 0)} onClick={p.onNext}>
          Next event{p.running && p.stepMode ? ` (${p.queued} waiting)` : ''}
        </button>
        <button type="button" className="btn" disabled={p.running || !p.scenario} onClick={p.onRunAll}
          title="Runs every scenario one after another with its default controls">Run all scenarios</button>
        <button type="button" className="btn btn-danger" disabled={!p.running} onClick={p.onStop}>Stop</button>
      </div>
      {p.runAll && <p className="control-help" role="status">Running scenario {p.runAll.index + 1} of {p.runAll.total}</p>}
    </section>
  )
}
