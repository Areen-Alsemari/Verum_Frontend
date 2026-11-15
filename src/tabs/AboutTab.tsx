import type { RunState } from '../state/runState'

/** About this demo. The long technical notes of the report are here, collapsed, and not in the report itself. */
export function AboutTab({ run }: { run: RunState }) {
  const rep = run.report.state === 'ok' ? run.report.report : null
  return (
    <div className="stack about">
      <section className="panel">
        <h3 className="label panel-title">About this demo</h3>
        <p>Demo with simulated plant data. A simulated gasoline terminal is replayed window by window, and eight agents look at each window.</p>
        <p>Verum is advisory only. A person decides what happens next, and the condition of the equipment is not confirmed by anything shown here.</p>
      </section>
      <section className="panel">
        <details className="details">
          <summary>Technical notes</summary>
          {!rep ? <p className="control-help">Run a scenario to see the technical notes of its report.</p> : (
            <>
              {(rep.missing_information ?? []).length > 0 && (
                <>
                  <h4 className="label">Missing information</h4>
                  <ul className="rp-list">{rep.missing_information.map((m, i) => <li key={i}>{m}</li>)}</ul>
                </>
              )}
              <h4 className="label">Limitations</h4>
              {(rep.limitations ?? []).length === 0 ? <p className="control-help">The report lists no limitations.</p> : <ul className="rp-list">{rep.limitations.map((m, i) => <li key={i}>{m}</li>)}</ul>}
            </>
          )}
        </details>
      </section>
    </div>
  )
}
