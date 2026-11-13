import { label } from './labels'

/** What the UI shows for an agent in the current window. Only what the service sent; nothing is inferred. */
export type AgentUiState = 'idle' | 'complete' | 'degraded' | 'insufficient_evidence' | 'error' | 'rejected' | 'nostatus' | 'other'

/** `undefined` = no window result yet; `null` = the service sent no status for this agent. */
export function agentUiState(status: string | null | undefined): AgentUiState {
  if (status === undefined) return 'idle'
  if (status === null) return 'nostatus'
  if (status === 'complete' || status === 'degraded' || status === 'insufficient_evidence' || status === 'error') return status
  if (status === 'rejected_by_runner') return 'rejected'
  return 'other'
}

export const STATE_LABEL: Record<AgentUiState, string> = {
  idle: 'No result yet',
  complete: 'Complete',
  degraded: 'Degraded',
  insufficient_evidence: 'Insufficient evidence',
  error: 'Error',
  rejected: 'Rejected by runner',
  nostatus: 'No status given',
  other: 'Other status',
}

/** Text for an agent status exactly as received (unknown statuses are shown by their own name). */
export function statusText(ui: AgentUiState, raw: string | null | undefined): string {
  return ui === 'other' && raw ? label(raw) : STATE_LABEL[ui]
}

/** CSS colour per state; green only for "complete". Failure states are red. */
export const STATE_COLOR: Record<AgentUiState, string> = {
  idle: 'var(--line-strong)',
  complete: 'var(--green)',
  degraded: 'var(--yellow)',
  insufficient_evidence: 'var(--blue)',
  error: 'var(--red)',
  rejected: 'var(--red)',
  nostatus: 'var(--red)',
  other: 'var(--line-strong)',
}

export const isFailure = (s: AgentUiState) => s === 'error' || s === 'rejected' || s === 'nostatus'
