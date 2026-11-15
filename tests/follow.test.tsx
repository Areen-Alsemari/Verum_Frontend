import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServiceEvent } from '../src/api'
import { briefing } from '../src/lib/briefing'

const h = vi.hoisted(() => ({ onEvent: null as ((e: ServiceEvent) => void) | null }))
vi.mock('../src/api/client', () => ({
  createRun: vi.fn(async () => ({ run_id: 'R-1', mode: 'live', speed: 60, episode_id: 'EP-1', split: 'validation', reveal_truth: false, status: 'running', events: 0, links: {} })),
  openStream: vi.fn((_id: string, handlers: { onEvent: (e: ServiceEvent) => void }) => { h.onEvent = handlers.onEvent; return { close() {} } }),
  getReport: vi.fn(async () => ({ state: 'pending' })),
  getTruth: vi.fn(async () => ({ state: 'unavailable', status: 404, message: '' })),
}))
import { useRunController } from '../src/state/useRunController'

const base = { run_id: 'R-1', mode: 'live', time_compression: { factor: 60, note: 'n' }, data: 'synthetic' }
let seq = 0
const reading = (w: number) => ({ ...base, type: 'sensor_reading', seq: seq++, window_index: w, as_of_s: w * 300, readings: [] }) as unknown as ServiceEvent
const result = (w: number) => ({ ...base, type: 'window_result', seq: seq++, window_index: w, as_of_s: w * 300, agents: {}, decision: null, persistence: null, runner_note_codes: [] }) as unknown as ServiceEvent
const send = (...e: ServiceEvent[]) => act(() => { e.forEach((x) => h.onEvent!(x)) })

describe('a run plays by itself', () => {
  beforeEach(() => { seq = 0; h.onEvent = null })
  it('follows the newest window from the first to the last without any pick', async () => {
    const { result: r } = renderHook(() => useRunController())
    await act(async () => { await r.current.start({ mode: 'live', speed: 60, episode_id: 'EP-1' }) })
    const seen: (number | null)[] = []
    for (const w of [1, 2, 3, 4]) {
      send(reading(w), result(w))
      seen.push(r.current.view.windowIndex)
      expect(r.current.playback.atLiveEdge).toBe(true)
      expect(r.current.view.viewing).toBeNull()
    }
    expect(seen).toEqual([1, 2, 3, 4])
  })
  it('holds an earlier window when paused, says "Viewing window N of M", and Back to live follows again', async () => {
    const { result: r } = renderHook(() => useRunController())
    await act(async () => { await r.current.start({ mode: 'live', speed: 60, episode_id: 'EP-1' }) })
    send(reading(1), result(1), reading(2), result(2), reading(3), result(3))
    act(() => r.current.seek(1))
    expect(r.current.view.windowIndex).toBe(1)
    expect(r.current.view.viewing).toEqual({ index: 1, total: 3 })
    const text = briefing(r.current.view).join(' ')
    expect(text).toContain('Viewing window 1 of 3')
    expect(text).not.toMatch(/finished after/)
    send(reading(4), result(4))
    expect(r.current.view.windowIndex).toBe(1) // held while the run goes on
    act(() => r.current.live())
    expect(r.current.view.windowIndex).toBe(4)
    expect(r.current.playback.atLiveEdge).toBe(true)
  })
})
