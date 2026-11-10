import type { ApiClient, FacilityDto, MaintenanceReport, RunBundle, RunEvent } from '../types'
import { STATIC_FACILITY } from '../../facility'
import { buildMockReport } from './report'
import { AGENTS, SCENARIOS } from './data'
import { buildMockRun, type MockRun } from './engine'

let speed = 1
export const MOCK_SPEEDS = [0.5, 1, 2, 4, 8] as const
export function setMockSpeed(s: number): void { speed = s > 0 ? s : 1 }
export function getMockSpeed(): number { return speed }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Mock client: same interface as the real one, timed scripted events, no network. */
export function createMockClient(): ApiClient {
  const runs = new Map<string, MockRun>()
  let counter = 0
  return {
    mode: 'mock',
    async listAgents() { await sleep(10); return structuredClone(AGENTS) },
    async listScenarios() { await sleep(10); return structuredClone(SCENARIOS) },
    async startRun(req) {
      await sleep(10)
      counter += 1
      const run_id = `mock-${Date.now().toString(36)}-${counter}`
      runs.set(run_id, buildMockRun(run_id, req.scenario_id, req.controls))
      return { run_id }
    },
    streamEvents(runId, onEvent, onError) {
      const run = runs.get(runId)
      let closed = false
      let timer: ReturnType<typeof setTimeout> | undefined
      if (!run) {
        queueMicrotask(() => onError(new Error(`Unknown run ${runId}`)))
        return { close() { closed = true } }
      }
      let i = 0
      let prev = 0
      const next = () => {
        if (closed || i >= run.events.length) return
        const te = run.events[i]!
        const wait = Math.max(0, (te.at - prev) / speed)
        timer = setTimeout(() => {
          if (closed) return
          prev = te.at
          i += 1
          onEvent(te.event as RunEvent)
          next()
        }, wait)
      }
      next()
      return { close() { closed = true; if (timer) clearTimeout(timer) } }
    },
    async getRun(runId): Promise<RunBundle> {
      await sleep(10)
      const run = runs.get(runId)
      if (!run) throw new Error(`Unknown run ${runId}`)
      return structuredClone(run.bundle)
    },
    async getFacility(): Promise<FacilityDto> {
      await sleep(10)
      return {
        assets: STATIC_FACILITY.assets.map((a) => ({ asset_id: a.asset_id, kind: a.kind, label: a.label, position_hint: a.position_hint ?? null, connects_to: [...a.connects_to] })),
        sensors: STATIC_FACILITY.sensors.map((s) => ({ tag_id: s.tag_id, asset_id: s.asset_id, unit: s.unit, label: s.tag_id })),
      }
    },
    async getReport(runId): Promise<MaintenanceReport | null> {
      await sleep(10)
      const run = runs.get(runId)
      return run ? buildMockReport(runId, run) : null
    },
  }
}
