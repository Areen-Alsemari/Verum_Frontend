import type { Scenario } from '../api/types'
import { KIND_COLOR, KIND_LABEL } from '../lib/format'

interface Props {
  scenarios: Scenario[]
  selectedId: string | null
  disabled: boolean
  onSelect: (id: string) => void
}

export function ScenarioPicker({ scenarios, selectedId, disabled, onSelect }: Props) {
  return (
    <section className="panel" aria-labelledby="scenarios-h">
      <h2 id="scenarios-h" className="label panel-title">Scenarios</h2>
      <div className="scenario-list" role="radiogroup" aria-labelledby="scenarios-h">
        {scenarios.map((s) => {
          const selected = s.id === selectedId
          return (
            <button
              key={s.id}
              data-scenario={s.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled && !selected}
              className={`scenario${selected ? ' is-selected' : ''}`}
              style={{ ['--kind' as string]: KIND_COLOR[s.kind] }}
              onClick={() => onSelect(s.id)}
            >
              <span className="scenario-head">
                <span className="scenario-title">{s.title}</span>
                <span className="kind-badge">{KIND_LABEL[s.kind]}</span>
              </span>
              <span className="scenario-desc">{s.description}</span>
              <span className="scenario-expected">
                <span className="label">Expected</span> {s.expected.summary}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
