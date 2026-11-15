import type { RunState } from '../state/runState'

export interface PlaybackInfo {
  /** null = following the latest received window */
  cursor: number | null
  playing: boolean
  atLiveEdge: boolean
  /** windows received so far */
  windows: number
  /** window on show and its position among the windows received */
  window: number | null
  index: number
}

interface Props {
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
 * Playback of a real run. A run plays by itself, window by window, and the view follows the newest window. These
 * controls only move what is shown: pausing, stepping or scrubbing holds the view at an earlier window, and
 * "Back to live" follows the run again. Nothing is injected and nothing is changed in the data.
 */
export function PlaybackBar({ run, playback: p, onPause, onResume, onPrev, onNext, onRestart, onLive, onSeek }: Props) {
  if (run.status === 'idle' || run.status === 'starting') return null
  const held = !p.atLiveEdge
  const running = run.status === 'running'
  return (
    <div className="playback-bar" role="group" aria-label="Playback">
      <div className="playback-row">
        {held && !p.playing
          ? <button type="button" className="btn btn-primary" onClick={onResume}>Resume</button>
          : <button type="button" className="btn" onClick={onPause} disabled={p.windows === 0}>Pause</button>}
        <button type="button" className="btn" onClick={onRestart} disabled={!run.run} title="Starts this run again with the same episode, mode, speed and truth setting">Restart</button>
        <button type="button" className="btn" onClick={onPrev} disabled={p.windows < 2 || p.index <= 1}>Previous window</button>
        <button type="button" className="btn" onClick={onNext} disabled={!held}>Next window</button>
        {held && <button type="button" className="btn btn-primary" onClick={onLive}>Back to live</button>}
      </div>
      {p.windows > 1 && (
        <label className="scrubber">
          <span className="sr-only">Window</span>
          <input type="range" min={1} max={p.windows} value={Math.max(1, p.index)} onChange={(e) => onSeek(Number(e.target.value))} aria-label="Window scrubber" aria-valuetext={`Window ${p.index} of ${p.windows}`} />
        </label>
      )}
      <span className="control-help playback-status" role="status">
        {p.window === null ? 'Waiting for the first window.' : held ? `Viewing window ${p.index} of ${p.windows}${p.playing ? ', playing on' : ''}.` : running ? `Following the run: window ${p.index} of ${p.windows} so far.` : `Window ${p.index} of ${p.windows}.`}
      </span>
    </div>
  )
}
