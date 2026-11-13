/**
 * The only module that talks to the Verum run service.
 * Base URL: VITE_API_URL, default http://localhost:8765. See docs/service_api.md in the backend repo.
 */
import {
  EVENT_TYPES,
  type CreateRunRequest, type EpisodeList, type Health, type ReportResponse, type RunInfo, type RunMode,
  type RunStatusInfo, type ServiceEvent, type ServiceFacility, type TruthResponse,
} from './serviceTypes'

export const DEFAULT_API_URL = 'http://localhost:8765'

export function apiBase(): string {
  const v = (import.meta.env.VITE_API_URL as string | undefined)?.trim()
  return (v || DEFAULT_API_URL).replace(/\/+$/, '')
}

/** The service could not be reached at all (not running, wrong URL, or blocked by CORS). */
export class ServiceUnavailableError extends Error {
  constructor(public readonly base: string) {
    super(`The run service is not reachable at ${base}.`)
    this.name = 'ServiceUnavailableError'
  }
}

/** The service answered with an error status. `message` is the service's own `error` text when it gave one. */
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const base = apiBase()
  try {
    return await fetch(`${base}${path}`, init)
  } catch {
    throw new ServiceUnavailableError(base)
  }
}

async function errorOf(res: Response): Promise<ApiError> {
  let msg = `${res.status} ${res.statusText}`.trim()
  try {
    const body = (await res.json()) as { error?: unknown }
    if (typeof body.error === 'string' && body.error) msg = body.error
  } catch { /* no JSON body */ }
  return new ApiError(res.status, msg)
}

async function getJson<T>(path: string): Promise<T> {
  const res = await request(path)
  if (!res.ok) throw await errorOf(res)
  return (await res.json()) as T
}

export const health = () => getJson<Health>('/api/health')
export const getFacility = () => getJson<ServiceFacility>('/api/facility')
export const getEpisodes = (mode: RunMode) => getJson<EpisodeList>(`/api/episodes?mode=${mode}`)
export const getRunStatus = (runId: string) => getJson<RunStatusInfo>(`/api/runs/${encodeURIComponent(runId)}/status`)

export async function createRun(req: CreateRunRequest): Promise<RunInfo> {
  const res = await request('/api/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) throw await errorOf(res)
  return (await res.json()) as RunInfo
}

export type ReportResult =
  | { state: 'ok'; data: ReportResponse }
  /** 409: the run has not finished yet. Not an error. */
  | { state: 'pending' }

/** Call only after the run is done. Default is the last window; `window` picks another by window index. */
export async function getReport(runId: string, window?: number): Promise<ReportResult> {
  const q = window === undefined ? '' : `?window=${encodeURIComponent(String(window))}`
  const res = await request(`/api/runs/${encodeURIComponent(runId)}/report${q}`)
  if (res.status === 409) return { state: 'pending' }
  if (!res.ok) throw await errorOf(res)
  return { state: 'ok', data: (await res.json()) as ReportResponse }
}

export type TruthResult =
  | { state: 'ok'; data: TruthResponse }
  /** 400 or 404: truth is not enabled for this run (or the run is unknown). Expected, not a failure. */
  | { state: 'unavailable'; status: number; message: string }

export async function getTruth(runId: string): Promise<TruthResult> {
  const res = await request(`/api/runs/${encodeURIComponent(runId)}/truth`)
  if (res.status === 400 || res.status === 404) {
    const e = await errorOf(res)
    return { state: 'unavailable', status: res.status, message: e.message }
  }
  if (!res.ok) throw await errorOf(res)
  return { state: 'ok', data: (await res.json()) as TruthResponse }
}

// ---- event stream ----------------------------------------------------------

export type ConnectionState = 'open' | 'reconnecting' | 'closed' | 'lost'

export interface StreamHandlers {
  onEvent: (e: ServiceEvent) => void
  onConnection?: (s: ConnectionState) => void
  /** an event that could not be parsed, or that made the handler throw; the stream carries on */
  onMalformed?: (info: { type: string; raw: string; reason: string }) => void
}

export interface StreamOptions {
  /** resume after this sequence number */
  after?: number
  /** how many times to re-open a closed connection before giving up (default 5) */
  maxReconnects?: number
  /** first retry delay in ms; doubles each time (default 1000) */
  retryDelayMs?: number
}

export interface RunStream {
  close(): void
}

const ES_CLOSED = 2

/**
 * Opens the run's SSE stream with one listener per named event type.
 * A dropped connection is resumed by the browser with Last-Event-ID; if the connection is closed for good,
 * a new one is opened with `?after=<last seq>`. Events with a sequence number already seen are ignored.
 * The stream is closed on `done` and by `close()`.
 */
export function openStream(runId: string, h: StreamHandlers, opts: StreamOptions = {}): RunStream {
  const maxReconnects = opts.maxReconnects ?? 5
  const baseDelay = opts.retryDelayMs ?? 1000
  let lastSeq = opts.after ?? -1
  let closed = false
  let attempts = 0
  let es: EventSource | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const finish = (state: ConnectionState) => {
    closed = true
    if (timer) clearTimeout(timer)
    es?.close()
    h.onConnection?.(state)
  }

  const handle = (type: string, m: MessageEvent<string>) => {
    if (closed) return
    let ev: ServiceEvent
    try {
      const parsed = JSON.parse(m.data) as unknown
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object')
      ev = { ...(parsed as object), type } as ServiceEvent
    } catch (e) {
      h.onMalformed?.({ type, raw: String(m.data).slice(0, 200), reason: e instanceof Error ? e.message : 'unparseable' })
      return
    }
    if (typeof ev.seq === 'number') {
      if (ev.seq <= lastSeq) return
      lastSeq = ev.seq
    }
    try {
      h.onEvent(ev)
    } catch (e) {
      h.onMalformed?.({ type, raw: String(m.data).slice(0, 200), reason: e instanceof Error ? e.message : 'handler failed' })
    }
    if (type === 'done') finish('closed')
  }

  const connect = () => {
    const after = lastSeq >= 0 ? `?after=${lastSeq}` : ''
    const source = new EventSource(`${apiBase()}/api/runs/${encodeURIComponent(runId)}/events${after}`)
    es = source
    source.onopen = () => {
      attempts = 0
      h.onConnection?.('open')
    }
    for (const t of EVENT_TYPES) source.addEventListener(t, ((m: MessageEvent<string>) => handle(t, m)) as EventListener)
    source.onerror = () => {
      if (closed) return
      if (source.readyState !== ES_CLOSED) {
        // the browser is reconnecting by itself and sends Last-Event-ID
        h.onConnection?.('reconnecting')
        return
      }
      source.close()
      if (attempts >= maxReconnects) {
        finish('lost')
        return
      }
      h.onConnection?.('reconnecting')
      const delay = baseDelay * 2 ** attempts
      attempts += 1
      timer = setTimeout(() => { if (!closed) connect() }, delay)
    }
  }

  connect()
  return {
    close() {
      if (closed) return
      closed = true
      if (timer) clearTimeout(timer)
      es?.close()
    },
  }
}
