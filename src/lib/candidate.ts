import type { MaintenanceReport } from '../api'
import { kindLabel, type Facility, type FlagInfo } from '../facility'
import type { ReportState } from '../state/runState'

/**
 * The candidate asset of Agent 5 (diagnostic reasoning). The service sends Agent 5's hypotheses only as report
 * findings of kind "hypothesis", with the asset, tag, mechanism and score written into the statement:
 *   "Unconfirmed hypothesis: pump (asset=P-101A, tag=None); score: decision_score=0.999648, method=..., calibration=None"
 * This reads only those findings. It never reads the simulation truth.
 */
export interface Hypothesis {
  findingId: string
  mechanism: string
  assetId: string | null
  tagId: string | null
  /** decision_score as sent: uncalibrated, not a probability */
  score: number
}

export type Candidate =
  /** the report is not available yet (or failed) */
  | { kind: 'waiting' }
  /** the report lists no hypothesis */
  | { kind: 'none' }
  /** hypotheses exist but the top one could not be read */
  | { kind: 'unreadable'; statement: string }
  | { kind: 'asset'; hypothesis: Hypothesis }
  | { kind: 'tag'; hypothesis: Hypothesis }
  | { kind: 'unlocalised'; hypothesis: Hypothesis }

const STATEMENT = /^Unconfirmed hypothesis:\s*(.+?)\s*\(asset=([^,)]*),\s*tag=([^)]*)\);\s*score:\s*decision_score=([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/

const orNull = (s: string): string | null => {
  const t = s.trim()
  return t === '' || t === 'None' || t === 'null' ? null : t
}

export function parseHypothesis(f: { finding_id: string; statement: string }): Hypothesis | null {
  const m = STATEMENT.exec(f.statement)
  if (!m) return null
  const score = Number(m[4])
  if (!Number.isFinite(score)) return null
  return { findingId: f.finding_id, mechanism: m[1]!, assetId: orNull(m[2]!), tagId: orNull(m[3]!), score }
}

/** The top hypothesis of a report: the highest score; on a tie, the one the agent listed first. */
export function candidateOf(report: MaintenanceReport | null | undefined): Candidate {
  const found = (report?.findings ?? []).filter((f) => f.kind === 'hypothesis')
  if (found.length === 0) return { kind: 'none' }
  const parsed = found.map(parseHypothesis).filter((h): h is Hypothesis => h !== null)
  if (parsed.length === 0) return { kind: 'unreadable', statement: found[0]!.statement }
  const top = parsed.reduce((best, h) => (h.score > best.score ? h : best))
  if (top.assetId) return { kind: 'asset', hypothesis: top }
  if (top.tagId) return { kind: 'tag', hypothesis: top }
  return { kind: 'unlocalised', hypothesis: top }
}

/** From the run's report state only. Truth is not an input. */
export function candidateFromReport(r: ReportState, shownWindow?: number | null): { candidate: Candidate; window: number | null } {
  if (r.state !== 'ok') return { candidate: { kind: 'waiting' }, window: null }
  // a report belongs to one window: when another window is on show, there is no candidate for it yet
  if (shownWindow !== undefined && shownWindow !== null && r.window !== shownWindow) return { candidate: { kind: 'waiting' }, window: null }
  return { candidate: candidateOf(r.report), window: r.window }
}

export const SCORE_FOOTNOTE = 'Candidate, unconfirmed. Ranking scores are uncalibrated and are not probabilities. The equipment condition is not confirmed.'

export const scoreText = (n: number) => n.toFixed(4)

/** The asset to highlight on the facility: only a candidate asset that exists in the layout. */
export function highlightId(c: Candidate, facility: Facility): string | null {
  if (c.kind !== 'asset') return null
  return facility.assets.some((a) => a.asset_id === c.hypothesis.assetId) ? c.hypothesis.assetId : null
}

/** What the 3D and 2D views show next to the highlighted asset. */
export function highlightNote(c: Candidate, facility: Facility): string {
  if (c.kind !== 'asset') return 'Candidate, unconfirmed'
  const a = facility.assets.find((x) => x.asset_id === c.hypothesis.assetId)
  const kind = a ? ` ${kindLabel(a.kind).toLowerCase()}` : ''
  return `Candidate, unconfirmed · ${c.hypothesis.assetId}${kind} · score ${scoreText(c.hypothesis.score)}`
}

/** The facility highlight for a candidate: at most one asset, labelled as unconfirmed. Empty when nothing is localised. */
export function flaggedFor(c: Candidate, facility: Facility): Map<string, FlagInfo> {
  const id = highlightId(c, facility)
  return new Map(id ? [[id, { by: [], note: highlightNote(c, facility) }]] : [])
}

/**
 * The asset the 3D camera goes to: a chosen asset first, otherwise the candidate asset of the report (never the
 * truth), unless Reset view was used for that candidate. Null means the overview: no zoom.
 */
export function cameraFocus(selected: string | null, candidateId: string | null, resetFor: string | null): string | null {
  if (selected) return selected
  return candidateId && resetFor !== candidateId ? candidateId : null
}
