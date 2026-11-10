import type { ControlValues, SensorReadingEvent, SignalQuality } from '../types'
import { STATIC_FACILITY as F, assetById } from '../../facility'

/**
 * Scripted sensor samples for the mock ("simulated stream, replay of recorded windows").
 * Baselines are demo values: tank levels use the declared initial levels from the facility specs,
 * the rest are plausible fixed numbers for a demo. Deterministic (seeded), no randomness between runs.
 */
const BASE: Record<string, number | boolean> = {
  'FT-001': 598, 'FT-201': 596, 'PT-001': 6.2, 'PT-201': 1.4, 'PT-202A': 8.6, 'PT-202B': 1.4, 'PT-203': 5.1,
  'TT-001': 24.5, 'TT-101': 23.8, 'TT-102': 23.9, 'TT-103': 24.1,
  'P-101A': true, 'P-101B': false, 'XV-PBI': false, 'XV-PBO': false,
}
const NOISE: Record<string, number> = { m3: 3, barg: 0.04, C: 0.08, m: 0.004 }

function baseline(tag: string, assetId: string | null, unit: string): number | boolean {
  if (tag in BASE) return BASE[tag]!
  if (unit === 'bool') return tag.startsWith('LSHH') ? false : true
  if (unit === 'm' && assetId) {
    const lvl = (assetById(F, assetId)?.specs as { initial_level_m?: number } | undefined)?.initial_level_m
    if (typeof lvl === 'number') return lvl
  }
  return 0
}

/** small deterministic PRNG (mulberry32) */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface StreamPlan {
  scenarioId: string
  controls: ControlValues
  /** asset where the fault sits, null for none */
  faultAsset: string | null
  /** tag ids whose pressure drops (near the fault) */
  droppingTags: string[]
  /** kPa per hour */
  dropRate: number
  /** tags that become suspect */
  suspectTags: string[]
  /** tags that stop reporting halfway */
  missingTags: string[]
}

/** One batch of readings for every tag every `step` ms of run time, from 0 to `end`. */
export function sensorReadings(plan: StreamPlan, end: number, step = 600): { at: number; event: SensorReadingEvent }[] {
  const out: { at: number; event: SensorReadingEvent }[] = []
  const r = rng(plan.scenarioId.length * 7919 + 17)
  const ticks = Math.max(1, Math.floor(end / step))
  const windowStepS = 60 // each tick replays one minute of the recorded window
  for (let i = 0; i <= ticks; i++) {
    const at = 60 + i * step
    if (at > end) break
    const t = i * windowStepS
    for (const s of F.sensors) {
      const base = baseline(s.tag_id, s.asset_id, s.unit)
      let value: number | boolean | null
      let quality: SignalQuality = 'good'
      if (typeof base === 'boolean') value = base
      else {
        const n = (NOISE[s.unit.startsWith('m3') ? 'm3' : s.unit] ?? 0.01) * (r() * 2 - 1)
        let v = base + n
        if (plan.droppingTags.includes(s.tag_id)) v -= (plan.dropRate / 100) * (t / 3600) * 10 // kPa/h -> bar/h, replay compressed 10x
        value = Math.round(v * 1000) / 1000
      }
      if (plan.suspectTags.includes(s.tag_id) && i >= ticks / 3) quality = 'suspect'
      if (plan.missingTags.includes(s.tag_id) && i >= ticks / 2) { value = null; quality = 'missing' }
      out.push({ at, event: { type: 'sensor_reading', ts: at, tag_id: s.tag_id, value, unit: s.unit, quality, t } })
    }
  }
  return out
}
