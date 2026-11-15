import { STATIC_FACILITY, type Facility } from '../facility'
import type { AgentUiState } from './agentState'
import { STATE_COLOR, isFailure, statusText } from './agentState'
import { candidateOf } from './candidate'
import { assetPhrase, hypothesisPhrase, noteText } from './plain'
import type { AgentRunState, ReportState, RunState } from '../state/runState'

/** What each agent does, in one plain line. */
export const AGENT_DESCRIPTION: Record<string, string> = {
  predictive_health: 'Looks at where pressures, flows and levels are heading.',
  anomaly_detection: 'Checks whether the readings depart from normal.',
  topology_dependency: 'Follows the piping to see which equipment the readings connect to.',
  historical_asset_intelligence: 'Looks at past records of the equipment involved.',
  diagnostic_reasoning: 'Ranks the possible causes.',
  inspection_planning: 'Suggests what to inspect.',
  inspection_quality_documentation: 'Checks that inspection work is recorded properly.',
  evidence_verification_decision: 'Checks the evidence and sets the decision state for a person to review.',
}

const images = import.meta.glob('../assets/agents/agent-*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

/** The character image of agent n (1 to 8), or null when there is none (the card then shows the icon). */
export function agentImage(order: number): string | null {
  return images[`../assets/agents/agent-${order}.png`] ?? null
}

export interface AgentDisplay {
  /** "Working", "Done", "Done, limited data", "Needs more data", or the failure text */
  text: string
  color: string
  state: AgentUiState | 'working'
  /** the service's reason for a limited agent, if it gave one */
  reason: string | null
}

/** How an agent is shown. The real status is not changed: only the words around it. */
export function agentDisplay(st: AgentRunState | undefined, run: RunState): AgentDisplay {
  const state = st?.state ?? 'idle'
  const running = run.status === 'running' || run.status === 'starting'
  const reason = st && st.issueCodes.length ? st.issueCodes.map(noteText).join('; ') : null
  if (running && (state === 'idle' || run.windowIndex !== run.resultWindowIndex)) return { text: 'Working', color: 'var(--amber)', state: 'working', reason: null }
  if (state === 'idle') return { text: 'Waiting', color: STATE_COLOR.idle, state, reason: null }
  if (state === 'complete') return { text: 'Done', color: STATE_COLOR.complete, state, reason: null }
  if (state === 'degraded') return { text: 'Done, limited data', color: STATE_COLOR.degraded, state, reason }
  if (state === 'insufficient_evidence') return { text: 'Needs more data', color: STATE_COLOR.insufficient_evidence, state, reason }
  return { text: statusText(state, st?.status), color: STATE_COLOR[state], state, reason: isFailure(state) ? reason : null }
}

const plainFirstSentence = (s: string): string | null => {
  const first = s.split(/[;.]/)[0]?.trim() ?? ''
  if (first.length < 8 || /[_=]/.test(first)) return null
  return first.length > 150 ? `${first.slice(0, 147)}…` : first
}

/**
 * One plain sentence on what an agent contributed in the window on show, only when the report holds something that
 * can be attributed to it (through the report's list of source reports). Otherwise null.
 */
export function contributionFor(role: string, report: ReportState, window: number | null, facility: Facility = STATIC_FACILITY): string | null {
  if (report.state !== 'ok' || window === null || report.window !== window) return null
  const r = report.report
  const ids = new Set((r.source_reports ?? []).filter((s) => s.agent === role).map((s) => s.report_id))
  if (ids.size === 0) return null
  const findings = (r.findings ?? []).filter((f) => ids.has(f.source_report_id))
  const options = (r.inspection_options ?? []).filter((o) => ids.has(o.source_report_id))
  const hyps = findings.filter((f) => f.kind === 'hypothesis')
  if (hyps.length) {
    const c = candidateOf({ ...r, findings: hyps })
    if (c.kind === 'asset' || c.kind === 'tag' || c.kind === 'unlocalised') {
      const phrase = hypothesisPhrase(c.hypothesis, facility)
      return `Ranked ${phrase}${phrase.includes(',') ? ',' : ''} as the top candidate.`
    }
    return null
  }
  if (options.length) {
    const targets = [...new Set(options.map((o) => assetPhrase(facility, o.target_asset)))]
    return `Suggested ${options.length} ${options.length === 1 ? 'check' : 'checks'}: ${targets.join(', ')}.`
  }
  for (const f of findings) {
    const s = plainFirstSentence(f.statement)
    if (s) return `${s}.`
  }
  return null
}
