import type { AgentInfo, Scenario } from '../api'
import type { RunState } from '../state/runState'
import { STATE_LABEL } from './agentState'
import { humanText, label } from './labels'

/** Facts for the KPI row. `null` means unknown (not yet in the data). Counts are counts of API items only. */
export interface Kpis {
  agentsComplete: number | null
  agentsTotal: number
  openIssues: number | null
  flaggedAssets: number | null
  decisionState: string | null
}

export function kpis(run: RunState): Kpis {
  const list = Object.values(run.agents)
  const started = run.status !== 'idle'
  const finished = list.filter((a) => a.finishedAt !== null)
  const flagged = run.bundle ? run.bundle.flagged_assets.length
    : run.flaggedAssetIds !== undefined && run.status === 'finished' ? run.flaggedAssetIds.length : null
  return {
    agentsComplete: started ? list.filter((a) => a.state === 'complete').length : null,
    agentsTotal: list.length,
    openIssues: started && finished.length > 0 ? list.reduce((n, a) => n + a.issues.length, 0) : null,
    flaggedAssets: flagged,
    decisionState: run.bundle?.final_decision_state ?? run.finalDecisionState ?? null,
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

/** "Needs attention" items, all taken from the run data. Failures first. */
export function attentionItems(run: RunState, agents: AgentInfo[]): AttentionItem[] {
  const out: AttentionItem[] = []
  const name = (k: string) => agents.find((a) => a.role_key === k)?.name ?? k
  for (const a of agents) {
    const st = run.agents[a.role_key]
    if (!st) continue
    const code = st.issues[0]?.code
    if (st.state === 'error' || st.state === 'rejected') {
      out.push({ key: `ag-${a.role_key}`, tone: 'fail', title: `${a.order}. ${name(a.role_key)}: ${STATE_LABEL[st.state]}`, code, detail: 'No report from this agent.', tab: 'agents' })
    }
  }
  for (const a of agents) {
    const st = run.agents[a.role_key]
    if (!st) continue
    if (st.state === 'degraded' || st.state === 'insufficient_evidence') {
      out.push({ key: `ag-${a.role_key}`, tone: st.state === 'degraded' ? 'warn' : 'info', title: `${a.order}. ${name(a.role_key)}: ${STATE_LABEL[st.state]}`, code: st.issues[0]?.code, tab: 'agents' })
    }
  }
  const flagged = run.bundle?.flagged_assets
  if (flagged) {
    for (const f of flagged) {
      out.push({ key: `fa-${f.asset}`, tone: 'accent', title: `${f.asset} flagged by ${f.flagged_by.length} agent${f.flagged_by.length === 1 ? '' : 's'}`, detail: f.note ? humanText(f.note) : undefined, tab: 'investigation' })
    }
  } else if (run.flaggedAssetIds) {
    for (const id of run.flaggedAssetIds) out.push({ key: `fa-${id}`, tone: 'accent', title: `${id} flagged`, tab: 'investigation' })
  }
  for (const u of run.bundle?.evidence_verification?.unresolved ?? []) {
    out.push({ key: `un-${u}`, tone: 'info', title: 'Unresolved', detail: humanText(u), tab: 'investigation' })
  }
  if (run.bundle?.flags.human_decision_required === true) {
    out.push({ key: 'decision', tone: 'accent', title: 'Awaiting human decision', detail: 'A person must review and decide; nothing happens automatically.', tab: 'inspection' })
  }
  return out
}

/** Plain sentences for the operations briefing, built only from run data. */
export function briefing(run: RunState, agents: AgentInfo[], scenario: Scenario | undefined): string[] {
  const title = scenario ? `“${scenario.title}”` : run.scenarioId ? `“${label(run.scenarioId)}”` : null
  if (run.status === 'idle') return ['No run yet. Choose a scenario and run it; the briefing is written from the run data.']
  const list = Object.values(run.agents)
  const done = list.filter((a) => a.finishedAt !== null).length
  const lines: string[] = []
  if (run.status === 'running') lines.push(`Scenario ${title ?? 'unknown'} is running: ${done} of ${list.length} agents have finished.`)
  else if (run.status === 'stopped') lines.push(`Scenario ${title ?? 'unknown'} was stopped after ${done} of ${list.length} agents finished.`)
  else if (run.status === 'failed') lines.push(`Scenario ${title ?? 'unknown'} failed: ${run.error ?? 'unknown error'}.`)
  else {
    const k = kpis(run)
    lines.push(`Scenario ${title ?? 'unknown'} finished: ${k.agentsComplete ?? 0} of ${k.agentsTotal} agents complete.`)
  }
  const name = (r: string) => agents.find((a) => a.role_key === r)?.name ?? r
  const failed = list.filter((a) => a.state === 'error' || a.state === 'rejected')
  if (failed.length) lines.push(`No report from ${failed.map((a) => `${name(a.role_key)} (${a.issues[0] ? label(a.issues[0].code) : 'no issue given'})`).join(', ')}.`)
  const flagged = run.bundle?.flagged_assets
  if (flagged) {
    lines.push(flagged.length === 0 ? 'No asset was flagged by any agent.'
      : `Flagged: ${flagged.map((f) => `${f.asset} (by ${f.flagged_by.length})`).join(', ')}. Condition is unconfirmed.`)
  }
  const ds = run.bundle?.final_decision_state ?? run.finalDecisionState
  if (run.status === 'finished') lines.push(`Decision state: ${ds ? label(ds) : 'unknown'}. A human decides what happens next.`)
  return lines
}
