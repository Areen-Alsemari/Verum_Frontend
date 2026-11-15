import { Unknown } from '../components/Unknown'
import { STATIC_FACILITY } from '../facility'
import { assetPhrase, mechanismName } from '../lib/plain'
import { TRUTH_LABEL } from '../tabs/TruthPanel'
import type { TruthState } from '../state/runState'

/** The simulation truth for the window of the report, in its own panel. Shown only for a run started with reveal truth. */
export function TruthCompare({ truth, window }: { truth: TruthState; window: number | null }) {
  if (truth.state === 'off') return null
  const w = truth.state === 'ok' && window !== null ? truth.truth.windows.find((x) => x.window_index === window) : undefined
  return (
    <section className="panel truth-block truth-compare" aria-labelledby="truth-c-h">
      <h3 id="truth-c-h" className="label panel-title">Simulation truth<span className="tag-advisory">Not seen by the agents</span></h3>
      <p className="truth-label" role="note"><strong>{TRUTH_LABEL}</strong></p>
      {(truth.state === 'waiting' || truth.state === 'loading') && <p className="control-help">Requested once the run is done.</p>}
      {truth.state === 'unavailable' && <p className="control-help">No simulation truth is available for this run.</p>}
      {truth.state === 'error' && <p className="control-help">The simulation truth could not be loaded.</p>}
      {truth.state === 'ok' && (window === null ? <p className="control-help">Shown once the report is loaded, for the report&apos;s window.</p> : !w ? (
        <p className="control-help">The service gave no truth for window {window}.</p>
      ) : (
        <>
          <p className="kv"><span>window</span> {w.window_index}</p>
          <p className="kv"><span>fault</span> {typeof w.fault === 'boolean' ? (w.fault ? 'Yes' : 'No') : <Unknown what="fault" />}</p>
          <p className="kv"><span>equipment at fault</span> {w.asset_ids?.length ? w.asset_ids.map((a) => <code key={a} className="chip">{assetPhrase(STATIC_FACILITY, a)}</code>) : 'none'}</p>
          <p className="kv"><span>cause</span> {w.mechanisms?.length ? w.mechanisms.map(mechanismName).join(', ') : 'none'}</p>
        </>
      ))}
    </section>
  )
}
