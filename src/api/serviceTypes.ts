/**
 * Types of the Verum run service (docs/service_api.md in the backend repo).
 * Fields the service may leave out are optional or nullable; the UI shows those as "not available".
 */

export type RunMode = 'replay' | 'live'

export interface Health {
  status: string
  service?: string
  modes: { replay: boolean; live: boolean }
}

export interface Episode {
  episode_id: string
  split: string
  windows: number
}
export interface EpisodeList {
  mode: RunMode
  episodes: Episode[]
}

export interface FacilityEdge {
  edge_id: string
  from_node: string
  to_node: string
  route_id?: string
}
export interface FacilityTag {
  tag_id: string
  /** "emit" or "withheld" */
  status: string
  element_id?: string | null
  quantity?: string
  unit?: string
  kind?: string
  range_lo?: number | null
  range_hi?: number | null
  sample_interval_s?: number | null
}
export interface ServiceFacility {
  source?: string
  nodes: string[]
  edges: FacilityEdge[]
  assets: { asset_id: string; kind: string }[]
  tags: FacilityTag[]
  pumps?: string[]
  valves?: string[]
}

export interface CreateRunRequest {
  mode: RunMode
  speed?: number
  episode_id?: string
  reveal_truth?: boolean
}
export interface RunInfo {
  run_id: string
  mode: RunMode
  speed: number
  episode_id: string
  split: string
  reveal_truth: boolean
  status: string
  events: number
  links: { events: string; report: string; truth: string; status: string }
}
export interface RunStatusInfo {
  run_id: string
  mode: RunMode
  speed: number
  episode_id: string
  split: string
  reveal_truth: boolean
  /** running | completed | failed | stopped */
  status: string
  events: number
}

export interface TimeCompression {
  factor: number
  note: string
}

interface EventBase {
  seq: number
  run_id: string
  mode: RunMode
  time_compression: TimeCompression
  /** the service's statement that the data is synthetic */
  data: string
}

export interface Reading {
  tag_id: string
  unit: string
  /** null when the tag has no latest value */
  value: number | boolean | null
  mean?: number | null
  minimum?: number | null
  maximum?: number | null
  quality: string
  availability: string
}
export interface SensorReadingEvent extends EventBase {
  type: 'sensor_reading'
  window_index: number
  as_of_s: number
  lookback_s?: number
  readings: Reading[]
}

export interface AgentWindowStatus {
  /** null when the agent failed; runner_issue_codes then says why */
  status: string | null
  report_id: string | null
  runner_issue_codes: string[]
}
export interface Decision {
  decision_state: string | null
  advisory_only: boolean | null
  human_decision_required: boolean | null
  automatic_action_authorized: boolean | null
  equipment_condition_confirmed: boolean | null
}
export interface Persistence {
  rule: { k: number; n: number; threshold: number | null }
  windows_held: number
  windows_exceeding: number
  windows_unknown: number
  alarming: boolean | null
}
export interface WindowResultEvent extends EventBase {
  type: 'window_result'
  window_index: number
  as_of_s: number
  agents: Record<string, AgentWindowStatus>
  decision: Decision | null
  persistence: Persistence | null
  runner_note_codes: string[]
}

export interface AlertEvent extends EventBase {
  type: 'alert'
  window_index: number
  as_of_s: number
  source: string
  rule: { k: number; n: number; threshold: number | null }
  windows_exceeding: number
  windows_held: number
  message: string
}

export interface DoneEvent extends EventBase {
  type: 'done'
  /** completed | failed | stopped */
  status: string
  windows: number
  error_type: string | null
}

export type ServiceEvent = SensorReadingEvent | WindowResultEvent | AlertEvent | DoneEvent
export const EVENT_TYPES = ['sensor_reading', 'window_result', 'alert', 'done'] as const

// ---- report (Agent 7) -----------------------------------------------------

export interface ReportFinding {
  finding_id: string
  kind: string
  statement: string
  measurement?: { value: number; unit: string } | null
  source_report_id: string
  evidence_ids: string[]
}
export interface ReportInspectionOption {
  action_id: string
  target_asset: string
  feasibility: string
  cost_usd?: number | null
  duration_min?: number | null
  source_report_id: string
  evidence_ids: string[]
}
export interface MaintenanceReport {
  report_version?: string
  report_id: string
  context?: {
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
  report_type?: string
  title?: string
  review_status?: string
  assessment_state?: string | null
  source_reports: { report_id: string; agent: string; content_sha256?: string }[]
  findings: ReportFinding[]
  inspection_options: ReportInspectionOption[]
  next_steps?: { description: string; source_report_id: string; evidence_ids: string[] }[]
  missing_information: string[]
  limitations: string[]
  narrative?: { provider?: string; text?: string } | null
  advisory_only?: boolean | null
  human_decision_required?: boolean | null
  automatic_action_authorized?: boolean | null
  equipment_condition_confirmed?: boolean | null
}
export interface ReportResponse {
  run_id: string
  mode: RunMode
  window_index: number
  windows_available: number[]
  report: MaintenanceReport
}

// ---- simulation truth ------------------------------------------------------

export interface TruthWindow {
  window_index: number
  as_of_s: number
  fault: boolean | null
  asset_ids: string[]
  fault_types: string[]
  mechanisms: string[]
}
export interface TruthResponse {
  label: string
  run_id: string
  mode: RunMode
  episode_id: string
  windows: TruthWindow[]
}
