import { describe, expect, it } from 'vitest'
import { SCENARIOS } from '../src/api/mock/data'
import { buildMockRun } from '../src/api/mock/engine'
import { STATIC_FACILITY as F, assetOptions, unknownIds } from '../src/facility'

describe('facility snapshot', () => {
  it('holds the 49 declared assets and 30 tags of the reference terminal', () => {
    expect(F.assets).toHaveLength(49)
    expect(F.sensors).toHaveLength(30)
    const byKind: Record<string, number> = {}
    for (const a of F.assets) byKind[a.kind] = (byKind[a.kind] ?? 0) + 1
    expect(byKind).toEqual({ tank: 3, pump: 2, isolation_valve: 11, pipe: 28, pressure_transmitter: 5 })
  })

  it('has unique ids and every kind set', () => {
    const ids = F.assets.map((a) => a.asset_id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(F.assets.every((a) => typeof a.kind === 'string' && a.kind.length > 0)).toBe(true)
    expect(new Set(F.sensors.map((s) => s.tag_id)).size).toBe(30)
  })

  it('ties every sensor to an existing asset or to none, never to an invented id', () => {
    const ids = new Set(F.assets.map((a) => a.asset_id))
    for (const s of F.sensors) if (s.asset_id !== null) expect(ids.has(s.asset_id)).toBe(true)
    expect(F.sensors.filter((s) => s.asset_id === null).map((s) => s.tag_id)).toEqual(['LSHH-101', 'LSHH-102', 'LSHH-103'])
  })

  it('has a schematic position for every asset', () => {
    for (const a of F.assets) expect(a.position_hint).toHaveLength(3)
  })

  it('generates the fault-location control from the facility, not a fixed list', () => {
    const ctl = SCENARIOS.find((s) => s.id === 'developing_fault')!.controls.find((c) => c.id === 'fault_location')!
    expect(ctl.options).toEqual(assetOptions(F))
    expect(ctl.options).toHaveLength(49)
  })

  it('reports ids from a run that the facility does not know', () => {
    expect(unknownIds(F, ['TK-101', 'FT-001', 'storage_tank'])).toEqual(['storage_tank'])
  })

  it('mock runs only use facility ids', () => {
    for (const s of SCENARIOS) {
      const { bundle } = buildMockRun('x', s.id, {})
      const ids = [...bundle.flagged_assets.map((f) => f.asset), ...bundle.inspection_options.flatMap((o) => o.targets)]
      expect(unknownIds(F, ids)).toEqual([])
    }
  })
})
