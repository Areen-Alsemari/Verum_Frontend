import { formatFactor } from '../lib/format'
import { Unknown } from './Unknown'
import type { RunState } from '../state/runState'

const CONNECTION: Record<string, string> = {
  none: '', open: 'stream connected', reconnecting: 'stream dropped, reconnecting', closed: 'stream closed', lost: 'stream lost',
}

/** Always visible on every screen: the run's mode and the time-compression note, as received. */
export function ModeBar({ run }: { run: RunState }) {
  const tc = run.timeCompression
  return (
    <div className="mode-bar" data-episode-id={run.run?.episode_id} role="region" aria-label="Run mode and time compression">
      <span className="mode-item"><span className="label">Mode</span>{run.mode ? <strong className={`mode-val mode-${run.mode}`}>{run.mode}</strong> : <Unknown what="mode" />}</span>
      <span className="mode-item"><span className="label">Time compression</span>{tc ? <strong>{formatFactor(tc.factor)}</strong> : <Unknown what="time compression" />}</span>
      <span className="mode-note">{tc?.note ? tc.note : <Unknown what="time compression note" />}</span>
      <span className="mode-note">{run.dataNote ?? 'Synthetic data from the simulator; not plant data.'}</span>
      {CONNECTION[run.connection] && <span className={`mode-conn conn-${run.connection}`} role="status">{CONNECTION[run.connection]}</span>}
    </div>
  )
}
