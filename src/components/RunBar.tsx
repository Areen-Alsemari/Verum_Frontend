import type { Episode, RunMode } from '../api'
import type { RunStatus } from '../state/runState'
import { Select } from './Select'

export const SPEEDS = [60, 300, 1000, 10000, 1000000]

interface Props {
  mode: RunMode
  onMode: (m: RunMode) => void
  modes: { replay: boolean; live: boolean } | null
  episodes: Episode[] | null
  episodesError: string | null
  episodeId: string
  onEpisode: (id: string) => void
  speed: number
  onSpeed: (n: number) => void
  revealTruth: boolean
  onRevealTruth: (v: boolean) => void
  status: RunStatus
  serviceUp: boolean
  onRun: () => void
  onStop: () => void
}

/** Mode, episode, playback speed and run buttons. */
export function RunBar(p: Props) {
  const running = p.status === 'running' || p.status === 'starting'
  const modeOptions = (['replay', 'live'] as const).map((m) => ({
    value: m, label: m === 'replay' ? 'Replay' : 'Live',
    description: p.modes && !p.modes[m] ? 'Not enabled on this service' : m === 'replay' ? 'Plays stored windows of the sample' : 'Runs the agents on a validation episode',
  }))
  const epOptions = [{ value: '', label: 'Default (most windows)', description: 'The service picks the episode with the most windows' }, ...(p.episodes ?? []).map((e) => ({ value: e.episode_id, label: e.episode_id, description: `${e.split}, ${e.windows} window${e.windows === 1 ? '' : 's'}` }))]
  const canRun = p.serviceUp && !running && p.episodes !== null && p.episodes.length > 0 && (p.modes ? p.modes[p.mode] : true)
  return (
    <div className="scenario-bar glass run-bar" role="group" aria-label="Run controls">
      <Select id="run-mode" label="Mode" value={p.mode} options={modeOptions} disabled={running || !p.serviceUp} onChange={(v) => p.onMode(v as RunMode)} />
      <Select id="run-episode" label="Episode" value={p.episodeId} options={epOptions} disabled={running || !p.episodes || p.episodes.length === 0} onChange={p.onEpisode} />
      <Select id="run-speed" label="Speed (time compression)" value={String(p.speed)}
        options={SPEEDS.map((n) => ({ value: String(n), label: `×${new Intl.NumberFormat('en-US').format(n)}` }))}
        disabled={running} onChange={(v) => p.onSpeed(Number(v))} />
      <label className="check">
        <input type="checkbox" checked={p.revealTruth} disabled={running} onChange={(e) => p.onRevealTruth(e.target.checked)} />
        <span>Reveal simulation truth after the run</span>
      </label>
      <div className="scenario-actions">
        <button type="button" className="btn btn-primary" disabled={!canRun} onClick={p.onRun}>Run</button>
        <button type="button" className="btn btn-danger" disabled={!running} onClick={p.onStop} title="Stops watching. The service has no stop route, so it may keep running the run.">Stop watching</button>
      </div>
      {p.episodesError && <p className="control-help run-bar-note" role="status">{p.episodesError}</p>}
    </div>
  )
}
