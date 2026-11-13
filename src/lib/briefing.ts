import { isFailure, statusText, type AgentUiState } from './agentState'
import { label } from './labels'
import { agentList, type AgentInfo, type RunState } from '../state/runState'

/** Facts for the KPI row. `null` means not available (nothing received yet). Counts are counts of service items only. */
export interface Kpis {
  agentsComplete: number | null
  agentsTotal: number
  issueCodes: number | null
  alerts: number | null
  decisionState: string | null
}

export function kpis(run: RunState): Kpis {
  const list = Object.values(run.agents)
  const have = run.windowsSeen > 0
  return {
    agentsComplete: have ? list.filter((a) => a.state === 'complete').length : null,
    agentsTotal: list.length,
    issueCodes: have ? list.reduce((n, a) => n + a.issueCodes.length, 0) : null,
    alerts: run.status === 'idle' || run.status === 'starting' ? null : run.alerts.length,
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

/** "Needs attention" items, all taken from the latest window and the alerts. Failures first. */
export function attentionItems(run: RunState, agents: AgentInfo[]): AttentionItem[] {
  const out: AttentionItem[] = []
  const rank = (s: AgentUiState) => (isFailure(s) ? 0 : s === 'degraded' ? 1 : 2)
  const rows = agents
    .map((a) => ({ a, st: run.agents[a.role_key] }))
    .filter((x) => x.st && x.st.state !== 'idle' && x.st.state !== 'complete')
    .sort((x, y) => rank(x.st!.state) - rank(y.st!.state))
  for (const { a, st } of rows) {
    const s = st!
    out.push({
      key: `ag-${a.role_key}`,
      tone: isFailure(s.state) ? 'fail' : s.state === 'degraded' ? 'warn' : 'info',
      title: `${a.order}. ${a.name}: ${statusText(s.state, s.status)}`,
      code: s.issueCodes[0],
      detail: isFailure(s.state) ? 'No report from this agent.' : undefined,
      tab: 'agents',
    })
  }
  for (const al of run.alerts) {
    out.push({ key: `al-${al.seq}`, tone: 'accent', title: `Alert in window ${al.window_index}`, detail: al.message, tab: 'log' })
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
  const ep = run.run?.episode_id ?? 'not available'
  if (run.status === 'running') lines.push(`A ${mode} run on episode ${ep} is running; latest: ${w}.`)
  else if (run.status === 'stopped') lines.push(`Watching stopped at ${w} of a ${mode} run on episode ${ep}. The service may still be running it.`)
  else if (run.status === 'failed') lines.push(`The ${mode} run on episode ${ep} failed: ${run.error ?? 'no reason given'}`)
  else lines.push(`The ${mode} run on episode ${ep} finished after ${run.done?.windows ?? 'an unknown number of'} windows.`)
  const k = kpis(run)
  if (k.agentsComplete !== null) lines.push(`In the latest window ${k.agentsComplete} of ${k.agentsTotal} agents reported Complete.`)
  const failed = agents.filter((a) => isFailure(run.agents[a.role_key]?.state ?? 'idle'))
  if (failed.length) lines.push(`No status or an error from ${failed.map((a) => a.name).join(', ')}.`)
  if (run.alerts.length) lines.push(`${run.alerts.length} alert${run.alerts.length === 1 ? '' : 's'} so far; the latest says: ${run.alerts[run.alerts.length - 1]!.message}.`)
  const ds = run.decision?.decision_state
  if (run.windowsSeen > 0) lines.push(`Decision state: ${ds ? label(ds) : 'not available'}. A human decides what happens next.`)
  return lines
}
