import { describe, expect, it } from 'vitest'
import { STATIC_FACILITY as F, serviceMismatch, unknownIds } from '../src/facility'

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

  it('reports ids from a run that the facility does not know', () => {
    expect(unknownIds(F, ['TK-101', 'FT-001', 'storage_tank'])).toEqual(['storage_tank'])
  })

  it('compares service ids with the layout snapshot in both directions and ignores withheld tags', () => {
    const api = { assets: F.assets.map((a) => ({ asset_id: a.asset_id })).filter((a) => a.asset_id !== 'TK-101').concat([{ asset_id: 'NEW-1' }]),
      tags: [...F.sensors.map((s) => ({ tag_id: s.tag_id, status: 'emit' })), { tag_id: 'XX-9', status: 'withheld' }] }
    expect(serviceMismatch(api)).toEqual(['NEW-1', 'TK-101'])
  })
})
