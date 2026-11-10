import { afterEach, describe, expect, it, vi } from 'vitest'
import { AGENTS } from '../src/api/mock/data'
import { buildMockRun } from '../src/api/mock/engine'
import { createMockClient } from '../src/api/mock'
import { buildMockReport } from '../src/api/mock/report'
import { createRealClient } from '../src/api/real'
import type { RunEvent } from '../src/api/types'
import { STATIC_FACILITY, facilityFromDto, snapshotMismatch } from '../src/facility'
import { flaggedAssets, initialRunState, readingDisplay, runReducer, type RunState } from '../src/state/runState'

const feed = (events: RunEvent[], s: RunState = initialRunState(AGENTS)) => events.reduce((st, e) => runReducer(st, { type: 'event', event: e }), s)

describe('reducer: sensor readings', () => {
  it('keeps the latest sample per tag and counts readings', () => {
    const s = feed([
      { type: 'sensor_reading', ts: 10, tag_id: 'PT-001', value: 6.2, unit: 'barg', quality: 'good', t: 0 },
      { type: 'sensor_reading', ts: 20, tag_id: 'PT-001', value: 6.1, unit: 'barg', quality: 'good', t: 60 },
      { type: 'sensor_reading', ts: 20, tag_id: 'LT-101', value: null, unit: 'm', quality: 'missing', t: 60 },
    ])
    expect(s.readingCount).toBe(3)
    expect(s.sensors['PT-001']).toMatchObject({ value: 6.1, t: 60 })
    expect(s.sensors['LT-101']?.value).toBeNull()
    expect(s.messages).toHaveLength(0)
  })

  it('never shows a missing, stale or suspect value as a normal value or as 0', () => {
    expect(readingDisplay(undefined)).toMatchObject({ text: 'unknown', normal: false })
    expect(readingDisplay({ tag_id: 'x', value: null, unit: 'barg', quality: 'missing', t: 0, ts: 0 }).text).toBe('unknown')
    expect(readingDisplay({ tag_id: 'x', value: 0, unit: 'barg', quality: 'missing', t: 0, ts: 0 }).text).toBe('unknown')
    expect(readingDisplay({ tag_id: 'x', value: 5, unit: 'barg', quality: 'stale', t: 0, ts: 0 })).toMatchObject({ text: 'stale', normal: false })
    expect(readingDisplay({ tag_id: 'x', value: 5, unit: 'barg', quality: 'suspect', t: 0, ts: 0 })).toMatchObject({ text: 'suspect', normal: false })
    expect(readingDisplay({ tag_id: 'x', value: 0, unit: 'barg', quality: 'good', t: 0, ts: 0 })).toMatchObject({ text: '0 barg', normal: true })
    expect(readingDisplay({ tag_id: 'x', value: false, unit: 'bool', quality: 'good', t: 0, ts: 0 }).text).toBe('false')
  })
})

describe('reducer: flagged assets from agent_finished', () => {
  it('collects flagged ids and the agents that flagged them', () => {
    const s = feed([
      { type: 'agent_finished', ts: 1, role_key: 'anomaly_detection', status: 'complete', issues: [], consumed_evidence_ids: [], report_summary: 'x', flagged_asset_ids: ['XV-PAI'] },
      { type: 'agent_finished', ts: 2, role_key: 'topology_dependency', status: 'complete', issues: [], consumed_evidence_ids: [], report_summary: 'y', flagged_asset_ids: ['XV-PAI', 'E-PA1'], summary: 'short' },
    ])
    expect(s.flaggedAssetIds).toEqual(['XV-PAI', 'E-PA1'])
    expect(s.flaggedBy['XV-PAI']).toEqual(['anomaly_detection', 'topology_dependency'])
    expect(s.agents['topology_dependency']?.summary).toBe('short')
    expect(flaggedAssets(s).find((f) => f.asset === 'XV-PAI')?.by).toHaveLength(2)
  })

  it('leaves flags undefined for an older backend that does not send them', () => {
    const s = feed([{ type: 'agent_finished', ts: 1, role_key: 'anomaly_detection', status: 'complete', issues: [], consumed_evidence_ids: [], report_summary: 'x' }])
    expect(s.flaggedAssetIds).toBeUndefined()
    expect(s.agents['anomaly_detection']?.flagged).toBeUndefined()
  })

  it('stores the report, or null when not provided', () => {
    const s = initialRunState(AGENTS)
    expect(s.report).toBeUndefined()
    expect(runReducer(s, { type: 'report', report: null }).report).toBeNull()
  })
})

describe('mock additions', () => {
  it('streams readings for every facility tag with facility ids only', () => {
    const run = buildMockRun('r', 'developing_fault', {})
    const tags = new Set(run.events.filter((e) => e.event.type === 'sensor_reading').map((e) => (e.event as { tag_id: string }).tag_id))
    expect(tags).toEqual(new Set(STATIC_FACILITY.sensors.map((x) => x.tag_id)))
  })

  it('agent_finished flags match the bundle', () => {
    const run = buildMockRun('r', 'developing_fault', {})
    const s = feed(run.events.map((e) => e.event))
    expect(new Set(s.flaggedAssetIds)).toEqual(new Set(run.bundle.flagged_assets.map((f) => f.asset)))
  })

  it('marks the dropped sensor missing in the dropout case', () => {
    const run = buildMockRun('r', 'quiet_window', { sensor_dropout: true })
    const s = feed(run.events.map((e) => e.event))
    expect(readingDisplay(s.sensors['PT-001']).text).toBe('unknown')
  })

  it('builds a report in the backend shape with fixed review flags', () => {
    for (const id of ['quiet_window', 'developing_fault', 'agent_conflict', 'agent_failure']) {
      const r = buildMockReport('r', buildMockRun('r', id, {}))
      expect(r).toMatchObject({ report_type: 'maintenance_assessment', review_status: 'human_review_required', advisory_only: true,
        human_decision_required: true, automatic_action_authorized: false, equipment_condition_confirmed: false })
      expect(r.limitations.at(-1)).toMatch(/Advisory assessment only/)
      expect(r.source_reports.every((x) => x.content_sha256 === undefined)).toBe(true)
    }
    const fail = buildMockReport('r', buildMockRun('r', 'agent_failure', {}))
    expect(fail.missing_information).toContain('Missing agent report: topology_dependency')
    expect(fail.missing_information.some((m) => m.includes('AGENT_INVALID_RESPONSE'))).toBe(true)
  })

  it('takes inspection cost and duration from the facility catalogue', () => {
    const r = buildMockReport('r', buildMockRun('r', 'developing_fault', { fault_location: 'XV-PAI' }))
    const opt = r.inspection_options.find((o) => o.target_asset === 'XV-PAI')!
    const cat = STATIC_FACILITY.inspection_catalog!.find((c) => c.action_id === opt.action_id)!
    expect(cat.target_kind).toBe('isolation_valve')
    expect([opt.cost_usd, opt.duration_min]).toEqual([cat.cost_usd, cat.duration_min])
  })

  it('mock client serves facility and report', async () => {
    const c = createMockClient()
    const f = await c.getFacility()
    expect(f?.assets).toHaveLength(49)
    const { run_id } = await c.startRun({ scenario_id: 'quiet_window', controls: {} })
    expect((await c.getReport(run_id))?.report_id).toBe(`maintenance-AN-${run_id}`)
  })
})

describe('real client: optional endpoints degrade', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('returns null on 404 or network error instead of failing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })))
    const c = createRealClient('')
    expect(await c.getFacility()).toBeNull()
    expect(await c.getReport('x')).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await c.getFacility()).toBeNull()
  })
})

describe('facility from the API', () => {
  it('overrides the snapshot and reports differing ids', () => {
    const f = facilityFromDto({ assets: [{ asset_id: 'TK-101', kind: 'tank', label: 'TK-101', connects_to: [] }, { asset_id: 'TK-999', kind: 'tank', label: 'x', connects_to: [] }], sensors: [] })
    expect(f.origin).toBe('api')
    expect(f.assets[0]?.position_hint).toEqual(STATIC_FACILITY.assets[0]?.position_hint)
    expect(snapshotMismatch(f)).toContain('TK-999')
  })
})

describe('mock stream plausibility', () => {
  it('never produces negative gauge pressure in the four scenarios at the maximum drop rate', () => {
    for (const [id, c] of [['developing_fault', { pressure_drop_rate: 40, fault_location: 'PT-201' }], ['agent_conflict', {}], ['agent_failure', {}], ['quiet_window', {}]] as const) {
      const run = buildMockRun('r', id, c)
      for (const e of run.events) if (e.event.type === 'sensor_reading' && e.event.unit === 'barg' && typeof e.event.value === 'number') expect(e.event.value).toBeGreaterThan(0)
    }
  })
})
