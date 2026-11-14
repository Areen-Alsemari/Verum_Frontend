import type { Episode, RunMode } from '../api'
import { SCENARIOS, availability } from '../lib/scenarios'
import type { RunStatus } from '../state/runState'
import { Select } from './Select'

export const SPEEDS = [60, 300, 1000, 10000, 1000000]
export const OTHER = 'other'

/** Shown when GET /api/health reports a mode as off. */
const OFF_REASON = {
  replay: 'Replay is off: the service reports no replay directory (it was started without --replay-dir).',
  live: 'Live is off: the service reports live mode is not enabled (it was started without --release).',
}

interface Props {
  mode: RunMode
  onMode: (m: RunMode) => void
  modes: { replay: boolean; live: boolean } | null
  episodes: Episode[] | null
  episodesError: string | null
  /** a scenario's episode_id, or OTHER to pick any episode from the list */
  scenarioId: string
  onScenario: (id: string) => void
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

/** Scenario switcher (full width, scenario on the left, actions on the right), with mode, speed and reveal truth. */
export function RunBar(p: Props) {
  const running = p.status === 'running' || p.status === 'starting'
  const replay = p.mode === 'replay'
  const replayOn = p.modes ? p.modes.replay : true
  const modeOptions = (['replay', 'live'] as const).map((m) => ({
    value: m, label: m === 'replay' ? 'Replay' : 'Live',
    disabled: p.modes ? !p.modes[m] : false,
    description: p.modes && !p.modes[m] ? OFF_REASON[m] : m === 'replay' ? 'Plays stored windows of the sample' : 'Runs the agents on a validation episode',
  }))
  const modeNote = p.modes && !p.modes.live ? OFF_REASON.live : p.modes && !p.modes.replay ? OFF_REASON.replay : null
  const scenarioOptions = [
    ...SCENARIOS.map((s) => {
      const a = availability(s, p.episodes, p.serviceUp, replayOn)
      const n = p.episodes?.find((e) => e.episode_id === s.episode_id)?.windows
      return { value: s.episode_id, label: s.title, description: a.available ? `${s.description}${typeof n === 'number' ? ` The service lists ${n} window${n === 1 ? '' : 's'}.` : ''}` : a.reason, disabled: !a.available }
    }),
    { value: OTHER, label: 'Any other episode', description: 'Choose an episode from the service list' },
  ]
  const epOptions = [{ value: '', label: 'Default (most windows)', description: 'The service picks the episode with the most windows' }, ...(p.episodes ?? []).map((e) => ({ value: e.episode_id, label: e.episode_id, description: `${e.split}, ${e.windows} window${e.windows === 1 ? '' : 's'}` }))]
  const chosen = SCENARIOS.find((s) => s.episode_id === p.scenarioId)
  const scenarioOk = !replay || p.scenarioId === OTHER || (!!chosen && availability(chosen, p.episodes, p.serviceUp, replayOn).available)
  const canRun = p.serviceUp && !running && scenarioOk && p.episodes !== null && p.episodes.length > 0 && (p.modes ? p.modes[p.mode] : true)
  return (
    <div className="scenario-bar glass run-bar" role="group" aria-label="Scenario and run controls">
      {replay && (
        <Select id="scenario-switch" variant="hero" label="Scenario" value={p.scenarioId} options={scenarioOptions} disabled={running || !p.serviceUp} onChange={p.onScenario} />
      )}
      <div className="run-bar-row">
        <Select id="run-mode" label="Mode" value={p.mode} options={modeOptions} disabled={running || !p.serviceUp} onChange={(v) => p.onMode(v as RunMode)} />
        {(!replay || p.scenarioId === OTHER) && (
          <Select id="run-episode" label="Episode" value={p.episodeId} options={epOptions} disabled={running || !p.episodes || p.episodes.length === 0} onChange={p.onEpisode} />
        )}
        <Select id="run-speed" label="Speed (time compression)" value={String(p.speed)}
          options={SPEEDS.map((n) => ({ value: String(n), label: `×${new Intl.NumberFormat('en-US').format(n)}` }))}
          disabled={running} onChange={(v) => p.onSpeed(Number(v))} />
        <label className="check">
          <input type="checkbox" checked={p.revealTruth} disabled={running} onChange={(e) => p.onRevealTruth(e.target.checked)} />
          <span>Reveal simulation truth after the run</span>
        </label>
      </div>
      <div className="scenario-actions">
        <button type="button" className="btn btn-primary" disabled={!canRun} onClick={p.onRun}>Run</button>
        <button type="button" className="btn btn-danger" disabled={!running} onClick={p.onStop} title="Stops watching. The service has no stop route, so it may keep running the run.">Stop watching</button>
      </div>
      {modeNote && <p className="control-help run-bar-note" role="status">{modeNote}</p>}
      {p.episodesError && <p className="control-help run-bar-note" role="status">{p.episodesError}</p>}
    </div>
  )
}
