import type { ServiceEvent } from '../api'
import { initialRunState, runReducer, type RunState } from './runState'

/**
 * Playback of the windows already received. The service streams a real run at its own pace; the UI can hold the
 * view at an earlier window (pause), step back and forth, and play on. Nothing is requested or invented:
 * the view is the same reducer applied to the first `n` events that were received.
 */
export interface WindowEnd {
  window: number
  /** number of received events up to and including the last event of this window */
  end: number
}

/** Window boundaries in arrival order. The `done` event belongs to no window. */
export function windowEnds(events: ServiceEvent[]): WindowEnd[] {
  const out: WindowEnd[] = []
  events.forEach((e, i) => {
    if (e.type === 'done' || typeof e.window_index !== 'number') return
    const last = out[out.length - 1]
    if (last && last.window === e.window_index) last.end = i + 1
    else out.push({ window: e.window_index, end: i + 1 })
  })
  return out
}

/** The next window boundary after `n` events, or null when `n` is already at or past the last received window. */
export function nextEnd(ends: WindowEnd[], n: number): WindowEnd | null {
  return ends.find((w) => w.end > n) ?? null
}

/** The previous window boundary before `n` events, or null when there is none. */
export function prevEnd(ends: WindowEnd[], n: number): WindowEnd | null {
  for (let i = ends.length - 1; i >= 0; i--) if (ends[i]!.end < n) return ends[i]!
  return null
}

/** The window shown when the view holds `n` events. */
export function windowAt(ends: WindowEnd[], n: number): WindowEnd | null {
  let hit: WindowEnd | null = null
  for (const w of ends) if (w.end <= n) hit = w
  return hit
}

/**
 * What the screens show when the view holds `n` events: agents, sensors, persistence, alerts and decision as they
 * were after those events. Run-level facts that are not part of a window (status, connection, report, truth) are
 * kept as they are.
 */
export function projectRun(live: RunState, n: number): RunState {
  if (n >= live.events.length) return live
  let s: RunState = { ...initialRunState(), run: live.run, mode: live.mode, status: live.status }
  for (const event of live.events.slice(0, Math.max(0, n))) s = runReducer(s, { type: 'event', event })
  const ends = windowEnds(live.events)
  const here = windowAt(ends, n)
  const behind = ends.some((w) => w.end > n)
  return {
    ...s, viewing: behind && here ? { index: ends.indexOf(here) + 1, total: ends.length } : null, status: live.status, connection: live.connection, run: live.run, error: live.error, malformed: live.malformed,
    report: live.report, truth: live.truth, done: live.done, lastSeq: live.lastSeq,
  }
}
