import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, ServiceUnavailableError, createRun, getReport, getTruth, openStream, type ConnectionState } from '../src/api/client'
import type { ServiceEvent } from '../src/api'
import { initialRunState, runReducer } from '../src/state/runState'

class FakeEventSource {
  static instances: FakeEventSource[] = []
  readyState = 0
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  closed = false
  listeners: Record<string, ((m: MessageEvent<string>) => void)[]> = {}
  constructor(public url: string) { FakeEventSource.instances.push(this) }
  addEventListener(t: string, f: (m: MessageEvent<string>) => void) { (this.listeners[t] ??= []).push(f) }
  close() { this.closed = true; this.readyState = 2 }
  open() { this.readyState = 1; this.onopen?.() }
  emit(type: string, data: unknown) {
    const raw = typeof data === 'string' ? data : JSON.stringify(data)
    for (const f of this.listeners[type] ?? []) f({ data: raw } as MessageEvent<string>)
  }
}
const ev = (type: string, seq: number, extra: object = {}) => ({
  type, seq, run_id: 'R-1', mode: 'replay', time_compression: { factor: 60, note: 'n' }, data: 'synthetic', ...extra,
})
const last = () => FakeEventSource.instances[FakeEventSource.instances.length - 1]!

beforeEach(() => {
  FakeEventSource.instances = []
  vi.stubGlobal('EventSource', FakeEventSource)
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

function collect(opts = {}) {
  const events: ServiceEvent[] = []
  const conn: ConnectionState[] = []
  const bad: string[] = []
  const stream = openStream('R-1', { onEvent: (e) => events.push(e), onConnection: (s) => conn.push(s), onMalformed: (m) => bad.push(m.type) }, opts)
  return { events, conn, bad, stream }
}

describe('event stream', () => {
  it('listens per named event type and delivers events in order', () => {
    const { events } = collect()
    const es = last()
    expect(es.url).toBe('http://localhost:8765/api/runs/R-1/events')
    expect(Object.keys(es.listeners).sort()).toEqual(['alert', 'done', 'sensor_reading', 'window_result'])
    es.emit('sensor_reading', ev('sensor_reading', 0, { window_index: 1, readings: [] }))
    es.emit('window_result', ev('window_result', 1, { window_index: 1 }))
    es.emit('alert', ev('alert', 2, { window_index: 1 }))
    expect(events.map((e) => e.type)).toEqual(['sensor_reading', 'window_result', 'alert'])
  })

  it('closes the stream on done and ignores anything after it', () => {
    const { events, conn } = collect()
    const es = last()
    es.emit('window_result', ev('window_result', 0))
    es.emit('done', ev('done', 1, { status: 'completed', windows: 1, error_type: null }))
    es.emit('alert', ev('alert', 2))
    expect(es.closed).toBe(true)
    expect(conn).toContain('closed')
    expect(events.map((e) => e.type)).toEqual(['window_result', 'done'])
  })

  it('closes on request (unmount)', () => {
    const { stream } = collect()
    stream.close()
    expect(last().closed).toBe(true)
  })

  it('does not crash on a malformed event and keeps reading', () => {
    const { events, bad } = collect()
    const es = last()
    es.emit('window_result', '{not json')
    es.emit('alert', '[1,2]')
    es.emit('alert', ev('alert', 0))
    expect(bad).toEqual(['window_result', 'alert'])
    expect(events).toHaveLength(1)
  })

  it('does not crash when the handler throws', () => {
    const bad: string[] = []
    openStream('R-1', { onEvent: () => { throw new Error('boom') }, onMalformed: (m) => bad.push(m.reason) })
    last().emit('alert', ev('alert', 0))
    expect(bad).toEqual(['boom'])
  })

  it('ignores events already seen (duplicates after a resume)', () => {
    const { events } = collect()
    const es = last()
    es.emit('alert', ev('alert', 3))
    es.emit('alert', ev('alert', 3))
    es.emit('alert', ev('alert', 2))
    es.emit('alert', ev('alert', 4))
    expect(events.map((e) => e.seq)).toEqual([3, 4])
  })

  it('lets the browser resume while it is reconnecting, and reports it', () => {
    const { conn } = collect()
    const es = last()
    es.readyState = 0
    es.onerror?.()
    expect(conn).toEqual(['reconnecting'])
    expect(es.closed).toBe(false)
    expect(FakeEventSource.instances).toHaveLength(1)
  })

  it('opens a new connection after the last seq when the old one is closed for good', () => {
    vi.useFakeTimers()
    const { conn } = collect({ retryDelayMs: 100 })
    const es = last()
    es.emit('window_result', ev('window_result', 7))
    es.readyState = 2
    es.onerror?.()
    expect(conn).toEqual(['reconnecting'])
    vi.advanceTimersByTime(100)
    expect(FakeEventSource.instances).toHaveLength(2)
    expect(last().url).toBe('http://localhost:8765/api/runs/R-1/events?after=7')
  })

  it('gives up with "lost" after the allowed retries', () => {
    vi.useFakeTimers()
    const { conn } = collect({ retryDelayMs: 10, maxReconnects: 2 })
    for (let i = 0; i < 3; i++) {
      last().readyState = 2
      last().onerror?.()
      vi.advanceTimersByTime(1000)
    }
    expect(conn[conn.length - 1]).toBe('lost')
    expect(FakeEventSource.instances).toHaveLength(3)
  })

  it('can start after a given sequence number', () => {
    collect({ after: 12 })
    expect(last().url).toContain('?after=12')
  })
})

describe('reducer on the stream', () => {
  it('turns window results into agent state without inventing values', () => {
    let s = initialRunState()
    const agents = {
      predictive_health: { status: 'complete', report_id: 'r1', runner_issue_codes: [] },
      anomaly_detection: { status: null, report_id: null, runner_issue_codes: ['AGENT_ERROR'] },
    }
    s = runReducer(s, { type: 'event', event: ev('window_result', 0, { window_index: 1, as_of_s: 300, agents, decision: null, persistence: null, runner_note_codes: [] }) as unknown as ServiceEvent })
    expect(s.agents.predictive_health!.state).toBe('complete')
    expect(s.agents.anomaly_detection!.state).toBe('nostatus')
    expect(s.agents.anomaly_detection!.status).toBeNull()
    expect(s.decision).toBeNull()
    expect(s.mode).toBe('replay')
    expect(s.timeCompression?.note).toBe('n')
  })
})

describe('HTTP calls', () => {
  const reply = (status: number, body: unknown) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })))

  it('treats 409 from the report as "not finished yet", not an error', async () => {
    reply(409, { error: 'run has not finished' })
    await expect(getReport('R-1')).resolves.toEqual({ state: 'pending' })
  })

  it('asks for a given window with ?window=N', async () => {
    reply(200, { run_id: 'R-1', window_index: 3, windows_available: [1, 3], report: {} })
    await getReport('R-1', 3)
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe('http://localhost:8765/api/runs/R-1/report?window=3')
  })

  it('treats 404 and 400 from the truth as "unavailable" with the service message', async () => {
    reply(404, { error: 'truth is not enabled for this run' })
    await expect(getTruth('R-1')).resolves.toEqual({ state: 'unavailable', status: 404, message: 'truth is not enabled for this run' })
    reply(400, { error: 'not a validation episode' })
    expect(await getTruth('R-1')).toMatchObject({ state: 'unavailable', status: 400 })
  })

  it('raises the service error text when a run cannot be created', async () => {
    reply(400, { error: 'speed must be above 0 and at most 1e+06' })
    await expect(createRun({ mode: 'replay', speed: 0 })).rejects.toMatchObject({ status: 400, message: 'speed must be above 0 and at most 1e+06' })
    await expect(createRun({ mode: 'replay', speed: 0 })).rejects.toBeInstanceOf(ApiError)
  })

  it('reports an unreachable service', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await expect(createRun({ mode: 'replay' })).rejects.toBeInstanceOf(ServiceUnavailableError)
  })
})

describe('agent numbers', () => {
  it('are fixed by role, whatever order the service sends', async () => {
    const { agentList } = await import('../src/state/runState')
    const keys = ['inspection_quality_documentation', 'predictive_health', 'evidence_verification_decision', 'topology_dependency',
      'historical_asset_intelligence', 'inspection_planning', 'anomaly_detection', 'diagnostic_reasoning']
    const agents = Object.fromEntries(keys.map((k) => [k, { status: 'complete', report_id: null, runner_issue_codes: [] }]))
    const s = runReducer(initialRunState(), { type: 'event', event: ev('window_result', 0, { window_index: 1, as_of_s: 300, agents, decision: null, persistence: null, runner_note_codes: [] }) as unknown as ServiceEvent })
    expect(agentList(s).map((a) => [a.order, a.role_key])).toEqual([
      [1, 'predictive_health'], [2, 'anomaly_detection'], [3, 'topology_dependency'], [4, 'historical_asset_intelligence'],
      [5, 'diagnostic_reasoning'], [6, 'inspection_planning'], [7, 'inspection_quality_documentation'], [8, 'evidence_verification_decision'],
    ])
    expect(agentList(initialRunState()).map((a) => a.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
})
