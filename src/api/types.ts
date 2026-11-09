/**
 * API contract (proposed). Kept in one file so it is easy to change.
 * The human-readable copy is docs/api-contract.md.
 *
 * Nothing here is verified against a running backend: no backend code was
 * available when this was written.
 */

export type RoleKey =
  | 'predictive_health'
  | 'anomaly_detection'
  | 'topology_dependency'
  | 'historical_asset_intelligence'
  | 'diagnostic_reasoning'
  | 'inspection_planning'
  | 'inspection_quality_documentation'
  | 'evidence_verification_decision'

/** GET /api/agents */
export interface AgentInfo {
  role_key: RoleKey
  name: string
  description: string
  order: number
  /** Upstream agents whose reports this agent may consume. Optional; if absent the UI draws a straight chain by `order`. */
  depends_on?: RoleKey[]
}

export type ScenarioKind = 'normal' | 'fault' | 'conflict' | 'failure'

export interface ControlOption {
  value: string
  label: string
}

/** One adjustable input of a scenario. The UI renders these generically. */
export interface ControlSpec {
  id: string
  label: string
  type: 'slider' | 'toggle' | 'select'
  /** slider only */
  min?: number
  max?: number
  step?: number
  /** slider: number, toggle: boolean, select: string */
  default: number | boolean | string
  unit?: string
  help?: string
  /** select only */
  options?: ControlOption[]
}

export type ControlValue = number | boolean | string
export type ControlValues = Record<string, ControlValue>

export interface ExpectedResult {
  summary: string
  checks: string[]
}

/** GET /api/scenarios */
export interface Scenario {
  id: string
  title: string
  description: string
  kind: ScenarioKind
  expected: ExpectedResult
  controls: ControlSpec[]
}

/** POST /api/runs  body */
export interface StartRunRequest {
  scenario_id: string
  controls: ControlValues
}
/** POST /api/runs  response */
export interface StartRunResponse {
  run_id: string
}

// ---- agent outcome -------------------------------------------------------

export type AgentStatus =
  | 'complete'
  | 'degraded'
  | 'insufficient_evidence'
  | 'error'
  | 'rejected_by_runner'

export interface Issue {
  /** machine code, e.g. AGENT_ERROR, AGENT_INVALID_RESPONSE */
  code: string
  message?: string
  severity?: 'info' | 'warning' | 'error'
}

// ---- SSE events: GET /api/runs/{id}/events -------------------------------
// Every event carries `ts` (milliseconds since the run started).

export type MessageKind = 'request' | 'response' | 'attachment' | 'issue'

/** `from`/`to` are a role_key or "runner". */
export type Party = RoleKey | 'runner'

export interface RunStartedEvent {
  type: 'run_started'
  ts: number
  run_id: string
  scenario_id: string
}
export interface AgentStartedEvent {
  type: 'agent_started'
  ts: number
  role_key: RoleKey
}
export interface RunMessageEvent {
  type: 'message'
  ts: number
  from: Party
  to: Party
  kind: MessageKind
  summary: string
  payload: unknown
}
export interface AgentFinishedEvent {
  type: 'agent_finished'
  ts: number
  role_key: RoleKey
  status: AgentStatus
  issues: Issue[]
  consumed_evidence_ids: string[]
  /** null when the agent returned no usable report */
  report_summary: string | null
}
export interface ExpectedVsObserved {
  check: string
  expected: string
  /** null = could not be observed */
  observed: string | null
  /** null = not evaluated */
  passed: boolean | null
}
export interface RunFinishedEvent {
  type: 'run_finished'
  ts: number
  final_decision_state: string | null
  verified: boolean | null
  expected_vs_observed: ExpectedVsObserved[]
}

export type RunEvent =
  | RunStartedEvent
  | AgentStartedEvent
  | RunMessageEvent
  | AgentFinishedEvent
  | RunFinishedEvent

// ---- result bundle: GET /api/runs/{id} -----------------------------------

export type Severity = 'info' | 'warning' | 'critical'
export type AssetId = 'storage_tank' | 'pump' | 'valve' | 'pipeline' | 'sensor' | 'terminal'

export interface FlaggedAsset {
  asset: AssetId
  flagged_by: RoleKey[]
  note?: string
  severity?: Severity
}

export interface Hypothesis {
  id: string
  title: string
  description: string
  /** Qualitative label given by the agent, e.g. "leading", "alternative", "not_excluded". */
  support_level: string | null
  /** Only shown if present. Never derived by the UI. */
  confidence: number | null
  supporting_evidence_ids: string[]
  conflicting_evidence_ids: string[]
}

export interface InspectionOption {
  id: string
  title: string
  rationale: string
  targets: AssetId[]
  /** Hypothesis ids this option would help to tell apart. */
  distinguishes: string[]
  /** Shown as a label only when the API sets it. */
  recommended?: boolean
}

export interface EvidenceVerification {
  state: string | null
  checked_evidence_ids: string[]
  unresolved: string[]
  notes: string | null
}

export interface DecisionFlags {
  human_decision_required: boolean | null
  automatic_action_authorized: boolean | null
  equipment_condition_confirmed: boolean | null
}

export interface RunBundle {
  run_id: string
  scenario_id: string
  controls: ControlValues
  final_decision_state: string | null
  verified: boolean | null
  flags: DecisionFlags
  flagged_assets: FlaggedAsset[]
  /** Agent 5 */
  hypotheses: Hypothesis[]
  /** Agent 6 (advisory) */
  inspection_options: InspectionOption[]
  /** Agent 8 */
  evidence_verification: EvidenceVerification | null
  /** Agent 7 */
  report_summary: string | null
  /** Per-agent report text, null where the agent returned no report. */
  agent_reports: Partial<Record<RoleKey, string | null>>
  expected_vs_observed: ExpectedVsObserved[]
}

// ---- client interface ----------------------------------------------------

export interface RunStream {
  close(): void
}

export interface ApiClient {
  readonly mode: 'real' | 'mock'
  listAgents(): Promise<AgentInfo[]>
  listScenarios(): Promise<Scenario[]>
  startRun(req: StartRunRequest): Promise<StartRunResponse>
  /** Open the event stream. `onError` is called for transport failures only. */
  streamEvents(runId: string, onEvent: (e: RunEvent) => void, onError: (err: Error) => void): RunStream
  getRun(runId: string): Promise<RunBundle>
}
