import type { Episode, RunMode } from '../api'
import { SCENARIOS, availability, scenarioName } from '../lib/scenarios'
import type { RunState, RunStatus } from '../state/runState'
import { PlaybackBar, type PlaybackInfo } from './PlaybackBar'
import { Select } from './Select'

export const SPEEDS = [60, 300, 1000, 10000, 1000000]
export const DEFAULT_SPEED = SPEEDS[0]!
export const OTHER = 'other'

/** Shown when GET /api/health reports a mode as off. */
const OFF_REASON = {
  replay: 'Replay is not available on this service.',
  live: 'Live is not available on this service.',
}

interface Props {
  mode: RunMode
  onMode: (m: RunMode) => void
  modes: { replay: boolean; live: boolean } | null
  episodes: Episode[] | null
  episodesError: string | null
  /** a scenario's episode_id, or OTHER when an episode was picked from the list */
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
  onReset: () => void
  /** playback of the run on show */
  run: RunState
  playback: PlaybackInfo
  onPause: () => void
  onResume: () => void
  onPrev: () => void
  onNext: () => void
  onRestart: () => void
  onLive: () => void
  onSeek: (n: number) => void
}

/**
 * The control panel. It only controls real runs of stored episodes; nothing here injects or changes a fault.
 * Groups: Scenario, Run settings, Playback.
 */
export function ControlPanel(p: Props) {
  const running = p.status === 'running' || p.status === 'starting'
  const replayOn = p.modes ? p.modes.replay : true
  const modeOptions = (['replay', 'live'] as const).map((m) => ({
    value: m, label: m === 'replay' ? 'Replay' : 'Live',
    disabled: p.modes ? !p.modes[m] : false,
    description: p.modes && !p.modes[m] ? OFF_REASON[m] : m === 'replay' ? 'Plays a stored episode' : 'Runs the agents on a stored episode',
  }))
  const modeNote = p.modes && !p.modes.live ? OFF_REASON.live : p.modes && !p.modes.replay ? OFF_REASON.replay : null
  const scenarioOptions = [
    ...SCENARIOS.map((s) => {
      const a = availability(s, p.episodes, p.serviceUp, replayOn)
      const n = p.episodes?.find((e) => e.episode_id === s.episode_id)?.windows
      return { value: s.episode_id, label: s.title, description: a.available ? `${s.description}${typeof n === 'number' ? ` ${n} window${n === 1 ? '' : 's'}.` : ''}` : a.reason, disabled: !a.available }
    }),
    { value: OTHER, label: 'Another stored episode', description: 'Pick one from the episode list' },
  ]
  // the test split is never offered
  const listed = (p.episodes ?? []).filter((e) => e.split !== 'test')
  const epOptions = [
    { value: '', label: 'Use the scenario above', description: 'Or pick a stored episode from the list' },
    ...listed.map((e) => ({ value: e.episode_id, label: `${scenarioName(e.episode_id)}${scenarioName(e.episode_id) === e.episode_id ? '' : ` · ${e.episode_id}`}`, description: `${e.windows} window${e.windows === 1 ? '' : 's'}` })),
  ]
  const chosen = SCENARIOS.find((s) => s.episode_id === p.scenarioId)
  const scenarioOk = p.scenarioId === OTHER ? p.episodeId !== '' : !!chosen && availability(chosen, p.episodes, p.serviceUp, replayOn).available
  const canRun = p.serviceUp && !running && (scenarioOk || p.episodeId !== '') && p.episodes !== null && p.episodes.length > 0 && (p.modes ? p.modes[p.mode] : true)
  const started = p.run.status !== 'idle' && p.run.status !== 'starting'
  return (
    <section className="panel control-panel" aria-labelledby="cp-h">
      <div className="panel-head">
        <h3 id="cp-h" className="label panel-title">Control panel</h3>
        <button type="button" className="btn btn-ghost" onClick={p.onReset} disabled={running}>Reset to defaults</button>
      </div>
      <div className="cp-groups">
        <fieldset className="cp-group" aria-labelledby="cp-g-scenario">
          <legend id="cp-g-scenario" className="cp-legend">Scenario</legend>
          <Select id="scenario-switch" label="Scenario" value={p.scenarioId} options={scenarioOptions} disabled={running || !p.serviceUp} onChange={p.onScenario} />
          <Select id="run-episode" label="Stored episode" value={p.episodeId} options={epOptions} disabled={running || listed.length === 0} onChange={p.onEpisode} />
          <p className="control-help">Demo with simulated plant data.</p>
        </fieldset>
        <fieldset className="cp-group" aria-labelledby="cp-g-settings">
          <legend id="cp-g-settings" className="cp-legend">Run settings</legend>
          <Select id="run-mode" label="Mode" value={p.mode} options={modeOptions} disabled={running || !p.serviceUp} onChange={(v) => p.onMode(v as RunMode)} />
          <Select id="run-speed" label="Playback speed" value={String(p.speed)}
            options={SPEEDS.map((n) => ({ value: String(n), label: `×${new Intl.NumberFormat('en-US').format(n)}` }))}
            disabled={running} onChange={(v) => p.onSpeed(Number(v))} />
          <label className="check">
            <input type="checkbox" checked={p.revealTruth} disabled={running} onChange={(e) => p.onRevealTruth(e.target.checked)} />
            <span>Reveal the simulated truth after the run</span>
          </label>
          {modeNote && <p className="control-help" role="status">{modeNote}</p>}
        </fieldset>
        <fieldset className="cp-group cp-playback" aria-labelledby="cp-g-play">
          <legend id="cp-g-play" className="cp-legend">Playback</legend>
          <div className="playback-row">
            <button type="button" className="btn btn-primary" disabled={!canRun} onClick={p.onRun}>Run</button>
            {running && <button type="button" className="btn btn-danger" onClick={p.onStop} title="Stops watching this run">Stop</button>}
          </div>
          {started
            ? <PlaybackBar run={p.run} playback={p.playback} onPause={p.onPause} onResume={p.onResume} onPrev={p.onPrev} onNext={p.onNext} onRestart={p.onRestart} onLive={p.onLive} onSeek={p.onSeek} />
            : <p className="control-help">Run plays every window by itself at the chosen speed.</p>}
        </fieldset>
      </div>
      {p.episodesError && <p className="control-help" role="status">{p.episodesError}</p>}
    </section>
  )
}
