/**
 * API contract (proposed). Kept in one file so it is easy to change.
 * The human-readable copy is docs/api-contract.md.
 *
 * The HTTP endpoints are not verified against a running backend (the Verum checkout has no HTTP
 * service). The report shape follows the backend's contracts/reports/maintenance_report.schema.json.
 * Every addition is optional so an older backend still works; missing data shows as "unknown".
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
  /** Optional addition: asset ids (facility ids) this agent flagged. */
  flagged_asset_ids?: string[]
  /** Optional addition: a short per-agent summary line. */
  summary?: string | null
}

/** Signal quality as given by the stream. Anything other than "good" is never shown as a normal value. */
export type SignalQuality = 'good' | 'suspect' | 'stale' | 'missing' | (string & {})

/** Optional addition: one replayed sensor sample. `t` is seconds since the start of the recorded window. */
export interface SensorReadingEvent {
  type: 'sensor_reading'
  ts: number
  tag_id: string
  /** null when the sample is missing */
  value: number | boolean | null
  unit: string
  quality: SignalQuality
  t: number
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
  | SensorReadingEvent
  | RunStartedEvent
  | AgentStartedEvent
  | RunMessageEvent
  | AgentFinishedEvent
  | RunFinishedEvent

// ---- result bundle: GET /api/runs/{id} -----------------------------------

export type Severity = 'info' | 'warning' | 'critical'
/** An asset id of the simulated terminal, exactly as in the facility definition (e.g. TK-101, XV-R000, E-PA2). */
export type AssetId = string

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

/** A check as defined in the backend common schema (pass / fail / unknown). */
export interface Check {
  check_id: string
  description: string
  outcome: 'pass' | 'fail' | 'unknown'
  evidence_ids: string[]
}

export type Feasibility = 'eligible_for_human_review' | 'blocked' | 'unknown'

export interface InspectionOption {
  id: string
  title: string
  rationale: string
  targets: AssetId[]
  /** Hypothesis ids this option would help to tell apart. */
  distinguishes: string[]
  /** Shown as a label only when the API sets it. */
  recommended?: boolean
  /** Optional additions, matching Agent 6 (inspection_planning) option fields. */
  action_id?: string
  feasibility?: Feasibility
  precondition_checks?: Check[]
  cost_usd?: number | null
  duration_min?: number | null
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

// ---- facility: GET /api/facility (optional addition) -----------------------

export interface FacilityAssetDto {
  asset_id: string
  kind: string
  label: string
  position_hint?: number[] | null
  connects_to: string[]
}
export interface FacilitySensorDto {
  tag_id: string
  asset_id: string | null
  unit: string
  label?: string
}
export interface FacilityDto {
  assets: FacilityAssetDto[]
  sensors: FacilitySensorDto[]
}

// ---- maintenance report: GET /api/runs/{id}/report (optional addition) -----
// Shape of Agent 7's build_report output (contracts/reports/maintenance_report.schema.json).

export interface ReportContext {
  case_id?: string
  analysis_id?: string
  revision?: number
  as_of_s?: number
  as_of_utc?: string | null
  data_release?: string
  reference_snapshot_sha256?: string
  scope_id?: string
  execution_mode?: string
}
export interface SourceReport {
  report_id: string
  agent: RoleKey
  content_sha256?: string
}
export interface Finding {
  finding_id: string
  kind: 'observation' | 'hypothesis' | 'inspection_check' | 'assessment' | (string & {})
  statement: string
  measurement?: { value: number; unit: string } | null
  source_report_id: string
  evidence_ids: string[]
}
export interface ReportInspectionOption {
  action_id: string
  target_asset: string
  feasibility: Feasibility
  cost_usd?: number | null
  duration_min?: number | null
  source_report_id: string
  evidence_ids: string[]
  /** Not in the report schema; carried from Agent 6 when available. */
  precondition_checks?: Check[]
}
export interface NextStep {
  description: string
  source_report_id: string
  evidence_ids: string[]
}
export interface MaintenanceReport {
  report_version?: string
  report_id: string
  context?: ReportContext
  report_type?: string
  title?: string
  review_status?: string
  assessment_state?: string | null
  source_reports: SourceReport[]
  findings: Finding[]
  inspection_options: ReportInspectionOption[]
  next_steps?: NextStep[]
  missing_information: string[]
  limitations: string[]
  narrative?: { provider?: string; model?: string | null; prompt_id?: string | null; text?: string; source_report_ids?: string[] } | null
  advisory_only?: boolean | null
  human_decision_required?: boolean | null
  automatic_action_authorized?: boolean | null
  equipment_condition_confirmed?: boolean | null
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
  /** null when the backend does not provide it (the UI then uses the static snapshot). */
  getFacility(): Promise<FacilityDto | null>
  /** null when the backend does not provide it (the UI then shows "unknown"). */
  getReport(runId: string): Promise<MaintenanceReport | null>
}
