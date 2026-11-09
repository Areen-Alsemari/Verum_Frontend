import type { ExpectedVsObserved, Scenario } from '../api'
import { KIND_COLOR, KIND_LABEL } from '../lib/format'
import type { ScenarioResult } from '../state/useRunController'
import { Unknown, isMissing } from './Unknown'

export function Chip({ passed }: { passed: boolean | null | undefined }) {
  if (passed === true) return <span className="chip-res res-pass">pass</span>
  if (passed === false) return <span className="chip-res res-fail">fail</span>
  return <span className="chip-res res-none">not evaluated</span>
}

export function overall(checks: ExpectedVsObserved[]): boolean | null {
  if (checks.length === 0) return null
  if (checks.some((c) => c.passed === false)) return false
  return checks.every((c) => c.passed === true) ? true : null
}

interface Props { scenarios: Scenario[]; results: Record<string, ScenarioResult>; activeId: string | null }

export function ScenarioChecks({ scenarios, results, activeId }: Props) {
  return (
    <section className="panel" aria-labelledby="checks-h">
      <h2 id="checks-h" className="label panel-title">Observed vs expected</h2>
      <div className="checks-grid">
        {scenarios.map((s) => {
          const r = results[s.id]
          return (
            <article key={s.id} className={`check-card${activeId === s.id ? ' is-active' : ''}`} style={{ ['--kind' as string]: KIND_COLOR[s.kind] }}>
              <header className="check-head">
                <strong>{s.title}</strong>
                <span className="kind-badge">{KIND_LABEL[s.kind]}</span>
                {r ? <Chip passed={overall(r.checks)} /> : <span className="chip-res res-none">not run</span>}
              </header>
              <p className="control-help">Expected: {s.expected.summary}</p>
              {!r ? <p className="control-help"><Unknown what="observed result" /></p> : (
                <table className="check-table">
                  <thead><tr><th scope="col">Check</th><th scope="col">Observed</th><th scope="col">Result</th></tr></thead>
                  <tbody>
                    {r.checks.map((c, i) => (
                      <tr key={i}>
                        <td>{c.check}</td>
                        <td>{isMissing(c.observed) ? <Unknown what="observed" /> : c.observed}</td>
                        <td><Chip passed={c.passed} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
