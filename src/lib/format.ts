import type { ScenarioKind } from '../api/types'

/** "more_evidence_required" -> "more evidence required". The raw code is always kept alongside by callers. */
export function humanize(code: string): string {
  return code.replace(/_/g, ' ')
}

export function formatMs(ms: number | null): string | null {
  if (ms === null || Number.isNaN(ms)) return null
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`
}

export function formatTs(ts: number): string {
  const s = ts / 1000
  return `+${s.toFixed(2)}s`
}

export const KIND_LABEL: Record<ScenarioKind, string> = {
  normal: 'Normal', fault: 'Fault', conflict: 'Conflict', failure: 'Failure',
}
/** CSS colour variable per scenario kind (always paired with the text label). */
export const KIND_COLOR: Record<ScenarioKind, string> = {
  normal: 'var(--blue)', fault: 'var(--orange)', conflict: 'var(--yellow)', failure: 'var(--red)',
}
