import { isFailure, statusText } from './agentState'
import { label } from './labels'
import { scenarioName } from './scenarios'
import { agentList, type AgentInfo, type RunState } from '../state/runState'
import { persistenceSentence } from './plain'

/** Figures an operator uses, taken from the run data only. `null` means nothing yet. */
export interface Kpis {
  windowsAnalysed: number | null
  alerts: number | null
  /** equipment named by the report as a candidate (0 or 1); null until a report exists for the window on show */
  equipmentFlagged: number | null
  agentsResponded: number | null
  agentsTotal: number
  /** per-agent detail for tooltips and the developer view */
  agentsComplete: number | null
  agentsLimited: number | null
  agentsInsufficient: number | null
  agentsFailed: number | null
  issueCodes: number | null
  runnerNotes: string[]
  decisionState: string | null
}

export function kpis(run: RunState, flagged: number | null = null): Kpis {
  const list = Object.values(run.agents)
  const have = run.windowsSeen > 0
  return {
    windowsAnalysed: have ? run.windowsSeen : null,
    alerts: run.status === 'idle' || run.status === 'starting' ? null : run.alerts.length,
    equipmentFlagged: flagged,
    agentsResponded: have ? list.filter((a) => !isFailure(a.state)).length : null,
    agentsTotal: list.length,
    agentsComplete: have ? list.filter((a) => a.state === 'complete').length : null,
    agentsLimited: have ? list.filter((a) => a.state === 'degraded').length : null,
    agentsInsufficient: have ? list.filter((a) => a.state === 'insufficient_evidence').length : null,
    agentsFailed: have ? list.filter((a) => isFailure(a.state)).length : null,
    issueCodes: have ? list.reduce((n, a) => n + a.issueCodes.length, 0) : null,
    runnerNotes: run.runnerNotes,
    decisionState: run.decision?.decision_state ?? null,
  }
}

export type Tone = 'fail' | 'warn' | 'info' | 'accent'
export interface AttentionItem {
  key: string
  tone: Tone
  title: string
  detail?: string
  code?: string
  tab: 'agents' | 'investigation' | 'inspection' | 'log'
}

/**
 * "Needs attention" items from the latest window. Alerts, the suspected equipment, agents that gave no result and the
 * open decision are always listed; agents that only had limited data are listed in the developer view.
 */
export function attentionItems(run: RunState, agents: AgentInfo[], opts: { dev?: boolean; suspected?: string | null } = {}): AttentionItem[] {
  const out: AttentionItem[] = []
  const rows = agents
    .map((a) => ({ a, st: run.agents[a.role_key] }))
    .filter((x) => x.st && (isFailure(x.st.state) || (opts.dev && x.st.state !== 'idle' && x.st.state !== 'complete')))
  for (const { a, st } of rows) {
    const s = st!
    out.push({
      key: `ag-${a.role_key}`,
      tone: isFailure(s.state) ? 'fail' : 'warn',
      title: isFailure(s.state) ? `${a.name} gave no result` : `${a.name}: ${statusText(s.state, s.status)}`,
      code: opts.dev ? s.issueCodes[0] : undefined,
      tab: 'agents',
    })
  }
  if (opts.suspected) out.push({ key: 'suspected', tone: 'accent', title: `Suspected: ${opts.suspected}`, detail: 'Unconfirmed. Check on site.', tab: 'investigation' })
  for (const al of run.alerts) {
    out.push({ key: `al-${al.seq}`, tone: 'accent', title: `Alert in window ${al.window_index}`, detail: al.message, tab: 'investigation' })
  }
  if (run.decision?.human_decision_required === true) {
    out.push({ key: 'decision', tone: 'accent', title: 'Awaiting human decision', detail: 'A person must review and decide; nothing happens automatically.', tab: 'inspection' })
  }
  return out
}

/** Plain sentences for the operations briefing, built only from service data. */
export function briefing(run: RunState): string[] {
  if (run.status === 'idle') return ['No run yet. Choose a mode and an episode, then start a run.']
  if (run.status === 'starting') return ['Creating the run…']
  const agents = agentList(run)
  const lines: string[] = []
  const w = run.windowIndex !== null ? `window ${run.windowIndex}` : 'no window yet'
  const mode = run.mode ?? 'not available'
  const ep = scenarioName(run.run?.episode_id)
  if (run.viewing) lines.push(`Viewing window ${run.viewing.index} of ${run.viewing.total} of the ${mode} run of ${ep}.`)
  else if (run.status === 'running') lines.push(`A ${mode} run of ${ep} is running; latest: ${w}.`)
  else if (run.status === 'stopped') lines.push(`Watching stopped at ${w} of a ${mode} run of ${ep}. The service may still be running it.`)
  else if (run.status === 'failed') lines.push(`The ${mode} run of ${ep} failed: ${run.error ?? 'no reason given'}`)
  else lines.push(`The ${mode} run of ${ep} finished after ${plural(run.done?.windows)}.`)
  const failed = agents.filter((a) => isFailure(run.agents[a.role_key]?.state ?? 'idle'))
  if (failed.length) lines.push(`No status or an error from ${failed.map((a) => a.name).join(', ')}.`)
  const rule = persistenceSentence(run.persistence)
  if (run.alerts.length) lines.push(`${run.alerts.length} alert${run.alerts.length === 1 ? '' : 's'} so far; the latest says: ${run.alerts[run.alerts.length - 1]!.message}.`)
  else if (rule) lines.push(rule)
  const ds = run.decision?.decision_state
  if (run.windowsSeen > 0) lines.push(`Decision state: ${ds ? label(ds) : 'not available'}. A person decides what happens next.`)
  return lines
}

/** "1 window", "12 windows", or "an unspecified number of windows". */
export function plural(n: number | null | undefined): string {
  return typeof n === 'number' ? `${n} window${n === 1 ? '' : 's'}` : 'an unspecified number of windows'
}

export const QUIET_WINDOW_NOTE = 'Quiet window: no alert was raised in this window.'

/**
 * True only when the service says so: the latest window result carries a settled persistence statement with
 * `alarming === false` and no alert event was received for that window. `alarming: null` means the rule is not
 * settled (for example too few windows yet), `undefined` means no window result: both give false, never a guess.
 */
export function isQuietWindow(run: RunState): boolean {
  if (run.persistence?.alarming !== false) return false
  if (run.resultWindowIndex === null) return false
  return !run.alerts.some((a) => a.window_index === run.resultWindowIndex)
}

/** "3 complete · 5 with limited inputs", plus failures and insufficient evidence only when there are some. */
export function agentBreakdown(k: Pick<Kpis, 'agentsComplete' | 'agentsLimited' | 'agentsInsufficient' | 'agentsFailed'>, sep = ', '): string {
  const parts = [`${k.agentsComplete ?? 0} complete`, `${k.agentsLimited ?? 0} with limited inputs`]
  if (k.agentsInsufficient) parts.push(`${k.agentsInsufficient} with insufficient evidence`)
  if (k.agentsFailed) parts.push(`${k.agentsFailed} failed or gave no status`)
  return parts.join(sep)
}
