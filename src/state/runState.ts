import type { ConnectionState } from '../api/client'
import type {
  AlertEvent, Decision, DoneEvent, MaintenanceReport, Persistence, RunInfo, RunMode, ServiceEvent, TimeCompression, TruthResponse,
} from '../api/serviceTypes'
import { agentUiState, type AgentUiState } from '../lib/agentState'
import { ROLE_NUMBER, label } from '../lib/labels'

/** An agent as shown in the UI. Names are the readable form of the role key; the service sends no other metadata. */
export interface AgentInfo {
  role_key: string
  name: string
  /** fixed number of the role (ROLE_NUMBER); a role the map does not know is numbered after the eight */
  order: number
}

export interface AgentRunState {
  role_key: string
  state: AgentUiState
  /** status exactly as received; null = the service sent none */
  status: string | null | undefined
  reportId: string | null
  issueCodes: string[]
  windowIndex: number | null
}

export interface SensorSample {
  tag_id: string
  value: number | boolean | null
  unit: string
  quality: string
  availability?: string
  mean?: number | null
  minimum?: number | null
  maximum?: number | null
  /** as_of_s of the window the sample belongs to */
  t: number
}

export type RunStatus = 'idle' | 'starting' | 'running' | 'finished' | 'stopped' | 'failed'
export type Connection = 'none' | ConnectionState

export interface LoggedEvent {
  event: ServiceEvent
}

export type ReportState =
  | { state: 'idle' }
  | { state: 'waiting' }
  | { state: 'loading' }
  /** 409 */
  | { state: 'pending' }
  | { state: 'ok'; window: number; windowsAvailable: number[]; report: MaintenanceReport }
  | { state: 'error'; message: string }

export type TruthState =
  | { state: 'off' }
  | { state: 'waiting' }
  | { state: 'loading' }
  | { state: 'ok'; truth: TruthResponse }
  | { state: 'unavailable'; message: string }
  | { state: 'error'; message: string }

export interface RunState {
  status: RunStatus
  connection: Connection
  run: RunInfo | null
  /** mode and time compression as given by the latest event (or by the run when no event has arrived) */
  mode: RunMode | null
  timeCompression: TimeCompression | null
  dataNote: string | null
  lastSeq: number
  events: ServiceEvent[]
  sensors: Record<string, SensorSample>
  windowIndex: number | null
  /** window of the latest window_result (persistence and decision belong to it) */
  resultWindowIndex: number | null
  asOfS: number | null
  agentOrder: string[]
  agents: Record<string, AgentRunState>
  decision: Decision | null | undefined
  persistence: Persistence | null | undefined
  runnerNotes: string[]
  alerts: AlertEvent[]
  windowsSeen: number
  done: DoneEvent | null
  error: string | null
  /** events that could not be parsed */
  malformed: number
  report: ReportState
  truth: TruthState
  /** set when the view is held at an earlier window: its position among the windows received */
  viewing: { index: number; total: number } | null
}

export type RunAction =
  | { type: 'starting' }
  | { type: 'created'; run: RunInfo }
  | { type: 'event'; event: ServiceEvent }
  | { type: 'connection'; state: ConnectionState }
  | { type: 'malformed' }
  | { type: 'failed'; error: string }
  | { type: 'stopped' }
  | { type: 'report'; report: ReportState }
  | { type: 'truth'; truth: TruthState }

export function initialRunState(): RunState {
  return {
    status: 'idle', connection: 'none', run: null, mode: null, timeCompression: null, dataNote: null, lastSeq: -1,
    events: [], sensors: {}, windowIndex: null, resultWindowIndex: null, asOfS: null, agentOrder: [], agents: {},
    decision: undefined, persistence: undefined, runnerNotes: [], alerts: [], windowsSeen: 0,
    done: null, error: null, malformed: 0, report: { state: 'idle' }, truth: { state: 'off' }, viewing: null,
  }
}

/**
 * The eight agents by their fixed numbers, then any other role the service sent (numbered after them, in the
 * order received). The number never depends on the order of the events.
 */
export function agentList(s: RunState): AgentInfo[] {
  const known = Object.keys(ROLE_NUMBER).sort((a, b) => ROLE_NUMBER[a]! - ROLE_NUMBER[b]!)
  const extra = s.agentOrder.filter((k) => !(k in ROLE_NUMBER))
  return [...known, ...extra].map((k, i) => ({ role_key: k, name: label(k), order: ROLE_NUMBER[k] ?? known.length + 1 + (i - known.length) }))
}

/** Pure reducer: turns the stream into UI state. Events already seen (by seq) are ignored. */
export function runReducer(state: RunState, a: RunAction): RunState {
  switch (a.type) {
    case 'starting':
      return { ...initialRunState(), status: 'starting' }
    case 'created':
      return {
        ...state, status: 'running', run: a.run, mode: a.run.mode,
        truth: a.run.reveal_truth ? { state: 'waiting' } : { state: 'off' },
        report: { state: 'waiting' },
      }
    case 'connection':
      return { ...state, connection: a.state }
    case 'malformed':
      return { ...state, malformed: state.malformed + 1 }
    case 'failed':
      return { ...state, status: 'failed', error: a.error }
    case 'stopped':
      return state.status === 'running' || state.status === 'starting' ? { ...state, status: 'stopped', connection: 'closed' } : state
    case 'report':
      return { ...state, report: a.report }
    case 'truth':
      return { ...state, truth: a.truth }
    case 'event': {
      const e = a.event
      if (typeof e.seq === 'number' && e.seq <= state.lastSeq) return state
      const base: RunState = {
        ...state,
        lastSeq: typeof e.seq === 'number' ? e.seq : state.lastSeq,
        events: [...state.events, e],
        mode: e.mode ?? state.mode,
        timeCompression: e.time_compression ?? state.timeCompression,
        dataNote: typeof e.data === 'string' ? e.data : state.dataNote,
      }
      switch (e.type) {
        case 'sensor_reading': {
          const sensors = { ...state.sensors }
          for (const r of e.readings ?? []) {
            sensors[r.tag_id] = {
              tag_id: r.tag_id, value: r.value ?? null, unit: r.unit, quality: r.quality, availability: r.availability,
              mean: r.mean, minimum: r.minimum, maximum: r.maximum, t: e.as_of_s,
            }
          }
          return { ...base, sensors, windowIndex: e.window_index, asOfS: e.as_of_s }
        }
        case 'window_result': {
          const order = state.agentOrder.length ? [...state.agentOrder] : Object.keys(e.agents ?? {})
          for (const k of Object.keys(e.agents ?? {})) if (!order.includes(k)) order.push(k)
          const agents: Record<string, AgentRunState> = {}
          for (const k of order) {
            const w = e.agents?.[k]
            agents[k] = {
              role_key: k, state: agentUiState(w ? w.status : undefined), status: w ? w.status : undefined,
              reportId: w?.report_id ?? null, issueCodes: w?.runner_issue_codes ?? [], windowIndex: w ? e.window_index : null,
            }
          }
          return {
            ...base, agentOrder: order, agents, windowIndex: e.window_index, resultWindowIndex: e.window_index, asOfS: e.as_of_s,
            decision: e.decision, persistence: e.persistence, runnerNotes: e.runner_note_codes ?? [], windowsSeen: state.windowsSeen + 1,
          }
        }
        case 'alert':
          return { ...base, alerts: [...state.alerts, e] }
        case 'done': {
          const status: RunStatus = e.status === 'completed' ? 'finished' : e.status === 'stopped' ? 'stopped' : 'failed'
          return {
            ...base, done: e, status,
            error: status === 'failed' ? `The run failed${e.error_type ? ` (${e.error_type})` : ''}.` : state.error,
          }
        }
      }
    }
  }
}

export type ReadingTone = 'ok' | 'warn' | 'unknown'
/**
 * How a reading is shown. A missing value is "not available"; a value whose quality is not "good",
 * or that was not measured, is shown by that label and never as a normal value.
 */
export function readingDisplay(r: SensorSample | undefined): { text: string; tone: ReadingTone; normal: boolean } {
  if (!r || r.value === null || r.value === undefined || r.quality === 'missing') return { text: 'not available', tone: 'unknown', normal: false }
  if (r.quality !== 'good') return { text: label(r.quality), tone: 'warn', normal: false }
  if (r.availability && r.availability !== 'measured') return { text: label(r.availability), tone: 'warn', normal: false }
  const v = typeof r.value === 'boolean' ? (r.value ? 'true' : 'false') : String(Number(r.value.toPrecision(5)))
  return { text: r.unit && r.unit !== 'bool' ? `${v} ${r.unit}` : v, tone: 'ok', normal: true }
}
