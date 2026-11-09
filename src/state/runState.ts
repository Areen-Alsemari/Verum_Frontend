import type {
  AgentInfo, AgentStatus, ExpectedVsObserved, Issue, RoleKey, RunBundle, RunEvent, RunMessageEvent,
} from '../api/types'

export type AgentUiState = 'idle' | 'running' | 'complete' | 'degraded' | 'insufficient_evidence' | 'error' | 'rejected'

export interface AgentRunState {
  role_key: RoleKey
  state: AgentUiState
  startedAt: number | null
  finishedAt: number | null
  issues: Issue[]
  consumed: string[]
  /** undefined until the agent finishes; null = finished without a report */
  report: string | null | undefined
}

export type RunStatus = 'idle' | 'running' | 'finished' | 'stopped' | 'failed'

export interface LoggedMessage extends RunMessageEvent {
  /** sequence number in arrival order */
  seq: number
}

export interface RunState {
  status: RunStatus
  runId: string | null
  scenarioId: string | null
  agents: Record<string, AgentRunState>
  messages: LoggedMessage[]
  /** ts of the latest event seen (ms since run start) */
  lastTs: number
  finalDecisionState: string | null | undefined
  verified: boolean | null | undefined
  expectedVsObserved: ExpectedVsObserved[]
  bundle: RunBundle | null
  error: string | null
}

export type RunAction =
  | { type: 'reset'; agents: AgentInfo[] }
  | { type: 'event'; event: RunEvent }
  | { type: 'bundle'; bundle: RunBundle }
  | { type: 'stopped' }
  | { type: 'failed'; error: string }

export function agentUiState(status: AgentStatus): AgentUiState {
  return status === 'rejected_by_runner' ? 'rejected' : status
}

export function initialRunState(agents: AgentInfo[] = []): RunState {
  const map: Record<string, AgentRunState> = {}
  for (const a of agents) {
    map[a.role_key] = { role_key: a.role_key, state: 'idle', startedAt: null, finishedAt: null, issues: [], consumed: [], report: undefined }
  }
  return {
    status: 'idle', runId: null, scenarioId: null, agents: map, messages: [], lastTs: 0,
    finalDecisionState: undefined, verified: undefined, expectedVsObserved: [], bundle: null, error: null,
  }
}

/** Pure reducer: turns the event stream into UI state. */
export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case 'reset':
      return initialRunState(action.agents)
    case 'bundle':
      return { ...state, bundle: action.bundle }
    case 'stopped':
      if (state.status !== 'running') return state
      return { ...state, status: 'stopped' }
    case 'failed':
      return { ...state, status: 'failed', error: action.error }
    case 'event': {
      const e = action.event
      const lastTs = Math.max(state.lastTs, e.ts)
      switch (e.type) {
        case 'run_started':
          return { ...state, status: 'running', runId: e.run_id, scenarioId: e.scenario_id, lastTs }
        case 'agent_started': {
          const prev = state.agents[e.role_key]
          if (!prev) return { ...state, lastTs }
          return { ...state, lastTs, agents: { ...state.agents, [e.role_key]: { ...prev, state: 'running', startedAt: e.ts } } }
        }
        case 'message':
          return { ...state, lastTs, messages: [...state.messages, { ...e, seq: state.messages.length }] }
        case 'agent_finished': {
          const prev = state.agents[e.role_key]
          if (!prev) return { ...state, lastTs }
          return {
            ...state, lastTs,
            agents: {
              ...state.agents,
              [e.role_key]: {
                ...prev, state: agentUiState(e.status), finishedAt: e.ts, issues: e.issues,
                consumed: e.consumed_evidence_ids, report: e.report_summary,
              },
            },
          }
        }
        case 'run_finished':
          return {
            ...state, lastTs, status: 'finished', finalDecisionState: e.final_decision_state,
            verified: e.verified, expectedVsObserved: e.expected_vs_observed,
          }
      }
    }
  }
}

/** Elapsed ms for an agent, or null if it has not started. Uses event timestamps only. */
export function elapsedMs(a: AgentRunState, lastTs: number): number | null {
  if (a.startedAt === null) return null
  return (a.finishedAt ?? lastTs) - a.startedAt
}

const SEVERITY_RANK: Record<string, number> = { error: 0, warning: 1, info: 2 }
/** The most severe issue (first one wins on ties). */
export function topIssue(issues: Issue[]): Issue | null {
  if (issues.length === 0) return null
  return [...issues].sort((a, b) => (SEVERITY_RANK[a.severity ?? 'info'] ?? 3) - (SEVERITY_RANK[b.severity ?? 'info'] ?? 3))[0] ?? null
}
