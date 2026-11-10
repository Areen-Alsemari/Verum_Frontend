import type {
  AgentInfo, ApiClient, FacilityDto, MaintenanceReport, RunBundle, RunEvent, RunStream, Scenario, StartRunRequest, StartRunResponse,
} from './types'

const EVENT_TYPES = ['run_started', 'agent_started', 'message', 'agent_finished', 'run_finished', 'sensor_reading'] as const

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

/** For optional endpoints: 404/501 or a network error means "not provided" (null), not a failure. */
async function optional<T>(p: Promise<Response>): Promise<T | null> {
  try {
    const res = await p
    if (res.status === 404 || res.status === 501) return null
    return await json<T>(res)
  } catch {
    return null
  }
}

/** Real client. `base` may be empty to use the Vite dev proxy on /api. */
export function createRealClient(base = ''): ApiClient {
  const url = (p: string) => `${base.replace(/\/$/, '')}${p}`
  return {
    mode: 'real',
    listAgents: () => fetch(url('/api/agents')).then((r) => json<AgentInfo[]>(r)),
    listScenarios: () => fetch(url('/api/scenarios')).then((r) => json<Scenario[]>(r)),
    startRun: (req: StartRunRequest) =>
      fetch(url('/api/runs'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      }).then((r) => json<StartRunResponse>(r)),
    getRun: (id: string) => fetch(url(`/api/runs/${encodeURIComponent(id)}`)).then((r) => json<RunBundle>(r)),
    getFacility: () => optional<FacilityDto>(fetch(url('/api/facility'))),
    getReport: (id: string) => optional<MaintenanceReport>(fetch(url(`/api/runs/${encodeURIComponent(id)}/report`))),
    streamEvents(runId, onEvent, onError): RunStream {
      const es = new EventSource(url(`/api/runs/${encodeURIComponent(runId)}/events`))
      let done = false
      const handle = (raw: MessageEvent<string>) => {
        try {
          const data = JSON.parse(raw.data) as RunEvent
          onEvent(data)
          if (data.type === 'run_finished') {
            done = true
            es.close()
          }
        } catch (e) {
          onError(e instanceof Error ? e : new Error(String(e)))
        }
      }
      // Servers may send either named events or a bare `data:` line; accept both.
      for (const t of EVENT_TYPES) es.addEventListener(t, handle as EventListener)
      es.onmessage = handle
      es.onerror = () => {
        if (done) return
        es.close()
        onError(new Error('Event stream interrupted'))
      }
      return { close: () => es.close() }
    },
  }
}
