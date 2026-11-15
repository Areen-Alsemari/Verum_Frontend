import type { TruthState } from '../state/runState'
import { Block } from '../components/Block'
import { Unknown } from '../components/Unknown'
import { label } from '../lib/labels'
import { STATIC_FACILITY } from '../facility'
import { assetPhrase, mechanismName } from '../lib/plain'

export const TRUTH_LABEL = 'simulation truth, not visible to the agents'

/** Shown only for a run that was started with reveal_truth. Kept apart from the agents' data. */
export function TruthPanel({ truth }: { truth: TruthState }) {
  if (truth.state === 'off') return null
  return (
    <Block title="Simulation truth" tag="Not seen by the agents" className="truth-block">
      <p className="truth-label" role="note"><strong>{TRUTH_LABEL}</strong></p>
      {truth.state === 'waiting' && <p className="control-help">Requested once the run is done.</p>}
      {truth.state === 'loading' && <p className="control-help">Loading…</p>}
      {truth.state === 'unavailable' && <p className="state-msg" role="status">No simulation truth is available for this run. {truth.message}</p>}
      {truth.state === 'error' && <p className="state-msg state-error" role="alert">The simulation truth could not be loaded. {truth.message}</p>}
      {truth.state === 'ok' && (truth.truth.windows.length === 0 ? <p className="control-help">The service returned no windows.</p> : (
        <table className="outcomes">
          <thead><tr><th>Window</th><th>As of (s)</th><th>Fault</th><th>Equipment at fault</th><th>Fault types</th><th>Cause</th></tr></thead>
          <tbody>
            {truth.truth.windows.map((w) => (
              <tr key={w.window_index}>
                <td>{w.window_index}</td><td>{w.as_of_s}</td>
                <td>{typeof w.fault === 'boolean' ? (w.fault ? 'Yes' : 'No') : <Unknown what="fault" />}</td>
                <td>{w.asset_ids?.length ? w.asset_ids.map((a) => <code key={a} className="chip">{assetPhrase(STATIC_FACILITY, a)}</code>) : <span className="control-help">none</span>}</td>
                <td>{w.fault_types?.length ? w.fault_types.map(label).join(', ') : <span className="control-help">none</span>}</td>
                <td>{w.mechanisms?.length ? w.mechanisms.map(mechanismName).join(', ') : <span className="control-help">none</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </Block>
  )
}
