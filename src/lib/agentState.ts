import type { AgentUiState } from '../state/runState'

export const STATE_LABEL: Record<AgentUiState, string> = {
  idle: 'Idle',
  running: 'Running',
  complete: 'Complete',
  degraded: 'Degraded',
  insufficient_evidence: 'Insufficient evidence',
  error: 'Error',
  rejected: 'Rejected by runner',
}

/** CSS colour per state; green only for "complete". Both failure states are red. */
export const STATE_COLOR: Record<AgentUiState, string> = {
  idle: 'var(--line-strong)',
  running: 'var(--amber-hi)',
  complete: 'var(--green)',
  degraded: 'var(--yellow)',
  insufficient_evidence: 'var(--blue)',
  error: 'var(--red)',
  rejected: 'var(--red)',
}
