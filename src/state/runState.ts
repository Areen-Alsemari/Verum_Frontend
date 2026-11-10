import type {
  AgentInfo, AgentStatus, ExpectedVsObserved, Issue, MaintenanceReport, RoleKey, RunBundle, RunEvent, RunMessageEvent, SignalQuality,
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
  /** optional short summary from agent_finished */
  summary?: string | null
  /** asset ids this agent flagged (from agent_finished.flagged_asset_ids); undefined = not provided */
  flagged?: string[]
}

/** Latest sample per tag from sensor_reading events. */
export interface SensorSample {
  tag_id: string
  value: number | boolean | null
  unit: string
  quality: SignalQuality
  /** seconds since the start of the recorded window */
  t: number
  /** run time of the event (ms) */
  ts: number
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
  /** Asset ids flagged so far by agent_finished events (undefined until any agent reports flags). */
  flaggedAssetIds?: string[]
  /** asset id -> agents that flagged it, from agent_finished events */
  flaggedBy: Record<string, RoleKey[]>
  /** latest reading per tag id */
  sensors: Record<string, SensorSample>
  /** number of sensor_reading events received in this run */
  readingCount: number
  /** undefined = not loaded yet, null = the backend does not provide a report */
  report: MaintenanceReport | null | undefined
}

export type RunAction =
  | { type: 'reset'; agents: AgentInfo[] }
  | { type: 'begin'; scenarioId: string }
  | { type: 'event'; event: RunEvent }
  | { type: 'bundle'; bundle: RunBundle }
  | { type: 'report'; report: MaintenanceReport | null }
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
    flaggedAssetIds: undefined, flaggedBy: {}, sensors: {}, readingCount: 0, report: undefined,
  }
}

/** Pure reducer: turns the event stream into UI state. */
export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case 'reset':
      return initialRunState(action.agents)
    case 'begin':
      return { ...initialRunState(Object.values(state.agents).map((a) => ({ role_key: a.role_key, name: '', description: '', order: 0 }))), status: 'running', scenarioId: action.scenarioId }
    case 'bundle':
      return { ...state, bundle: action.bundle }
    case 'report':
      return { ...state, report: action.report }
    case 'stopped':
      if (state.status !== 'running') return state
      return { ...state, status: 'stopped' }
    case 'failed':
      return { ...state, status: 'failed', error: action.error }
    case 'event': {
      const e = action.event
      const lastTs = Math.max(state.lastTs, e.ts)
      switch (e.type) {
        case 'sensor_reading':
          return {
            ...state, lastTs, readingCount: state.readingCount + 1,
            sensors: { ...state.sensors, [e.tag_id]: { tag_id: e.tag_id, value: e.value ?? null, unit: e.unit, quality: e.quality ?? 'unknown', t: e.t, ts: e.ts } },
          }
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
          let flaggedBy = state.flaggedBy
          let flaggedAssetIds = state.flaggedAssetIds
          if (Array.isArray(e.flagged_asset_ids)) {
            flaggedBy = { ...flaggedBy }
            flaggedAssetIds = [...(flaggedAssetIds ?? [])]
            for (const id of e.flagged_asset_ids) {
              const by = flaggedBy[id] ?? []
              if (!by.includes(e.role_key)) flaggedBy[id] = [...by, e.role_key]
              if (!flaggedAssetIds.includes(id)) flaggedAssetIds.push(id)
            }
          }
          return {
            ...state, lastTs, flaggedBy, flaggedAssetIds,
            agents: {
              ...state.agents,
              [e.role_key]: {
                ...prev, state: agentUiState(e.status), finishedAt: e.ts, issues: e.issues,
                consumed: e.consumed_evidence_ids, report: e.report_summary,
                summary: e.summary, flagged: e.flagged_asset_ids,
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

export type ReadingTone = 'ok' | 'warn' | 'unknown'
/**
 * How a reading is shown. Missing, stale or suspect values are never shown as a normal value:
 * missing -> "unknown"; any other non-good quality -> its quality label.
 */
export function readingDisplay(r: SensorSample | undefined): { text: string; tone: ReadingTone; normal: boolean } {
  if (!r || r.value === null || r.value === undefined || r.quality === 'missing') return { text: 'unknown', tone: 'unknown', normal: false }
  if (r.quality !== 'good') return { text: String(r.quality), tone: 'warn', normal: false }
  const v = typeof r.value === 'boolean' ? (r.value ? 'true' : 'false') : String(r.value)
  return { text: r.unit && r.unit !== 'bool' ? `${v} ${r.unit}` : v, tone: 'ok', normal: true }
}

/** Flagged assets: from the bundle when available, otherwise from agent_finished events. */
export function flaggedAssets(s: RunState): { asset: string; by: RoleKey[]; note?: string; severity?: string }[] {
  if (s.bundle) return s.bundle.flagged_assets.map((f) => ({ asset: f.asset, by: f.flagged_by, note: f.note, severity: f.severity }))
  return (s.flaggedAssetIds ?? []).map((id) => ({ asset: id, by: s.flaggedBy[id] ?? [] }))
}
