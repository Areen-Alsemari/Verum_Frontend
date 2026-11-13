import { QUIET_WINDOW_NOTE, isQuietWindow } from '../lib/briefing'
import type { RunState } from '../state/runState'

/** A note only: it changes no agent status, colour or text. Shown when the service reports a settled, quiet window. */
export function QuietNote({ run }: { run: RunState }) {
  if (!isQuietWindow(run)) return null
  return <p className="quiet-note" role="note">{QUIET_WINDOW_NOTE}</p>
}
