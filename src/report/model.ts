/**
 * Report model builder (pure). Turns the service's maintenance report and the run's readings into the sections of
 * the report an engineer reads: what was found, what changed, what to check. Everything comes from the service
 * response; a section with nothing to say is left out (null or empty), and nothing is written as "unknown".
 */
import type { MaintenanceReport } from '../api'
import { STATIC_FACILITY, type Facility } from '../facility'
import { candidateOf, highlightId, type Candidate } from '../lib/candidate'
import { inspectionChecklist, type CheckItem } from '../lib/inspection'
import { label } from '../lib/labels'
import { assetPhrase, hypothesisPhrase } from '../lib/plain'
import { scenarioName, SCENARIOS } from '../lib/scenarios'
import type { RunState } from '../state/runState'

export const FACILITY_NAME = 'Simulated gasoline terminal'
export const REPORT_LIMITATION = 'Advisory only: a person decides, and equipment condition is not confirmed.'
export const NOT_NARROWED = 'The affected equipment could not be narrowed down. Check the area around the readings below.'

export interface ReportModel {
  header: { facility: string; scenario: string | null; time: string | null; window: number; status: string | null }
  /** one plain sentence naming the suspected equipment and issue */
  found: string | null
  candidate: Candidate
  /** the asset to highlight in the picture, when the report names one that the layout has */
  assetId: string | null
  pictureLabel: string | null
  pictureCaption: string
  changes: string[]
  checks: CheckItem[]
}

const QUANTITY: Record<string, string> = { FT: 'Flow', PT: 'Pressure', LT: 'Level', TT: 'Temperature', LSHH: 'High level switch' }
const quantityOf = (tag: string) => QUANTITY[tag.split('-')[0] ?? ''] ?? 'Reading'

const fmt = (n: number): string => String(Number(Math.abs(n) >= 100 ? n.toFixed(0) : n.toPrecision(3)))

/** The readings that moved most between the first and the latest window on show, in plain words. */
export function readingChanges(run: RunState, facility: Facility = STATIC_FACILITY, max = 4): string[] {
  const first = new Map<string, { v: number; w: number }>()
  const last = new Map<string, { v: number; w: number; unit: string }>()
  for (const e of run.events) {
    if (e.type !== 'sensor_reading') continue
    for (const r of e.readings ?? []) {
      if (typeof r.value !== 'number' || r.quality !== 'good') continue
      if (!first.has(r.tag_id)) first.set(r.tag_id, { v: r.value, w: e.window_index })
      last.set(r.tag_id, { v: r.value, w: e.window_index, unit: r.unit })
    }
  }
  const moved: { tag: string; a: number; b: number; w1: number; w2: number; unit: string; rel: number }[] = []
  for (const [tag, a] of first) {
    const b = last.get(tag)
    if (!b || b.w === a.w) continue
    const denom = Math.max(Math.abs(a.v), Math.abs(b.v))
    if (denom === 0) continue
    const rel = (b.v - a.v) / denom
    if (Math.abs(rel) >= 0.05) moved.push({ tag, a: a.v, b: b.v, w1: a.w, w2: b.w, unit: b.unit, rel })
  }
  moved.sort((x, y) => Math.abs(y.rel) - Math.abs(x.rel))
  return moved.slice(0, max).map((m) => {
    const asset = facility.sensors.find((s) => s.tag_id === m.tag)?.asset_id
    const a = asset ? facility.assets.find((x) => x.asset_id === asset) : undefined
    // pipes and instruments that carry the tag itself are named by the tag alone
    const where = a && a.kind !== 'pipe' && asset !== m.tag ? ` at ${assetPhrase(facility, asset!)}` : ''
    const pct = Math.round(Math.abs((m.b - m.a) / (m.a === 0 ? m.b : m.a)) * 100)
    const dir = m.b > m.a ? 'rose' : 'fell'
    return `${quantityOf(m.tag)}${where} (${m.tag}) ${dir} from ${fmt(m.a)} to ${fmt(m.b)} ${m.unit}${Number.isFinite(pct) ? ` (${pct}%)` : ''}, between window ${m.w1} and window ${m.w2}.`
  })
}

function whenOf(r: MaintenanceReport): string | null {
  const t = r.context?.as_of_utc
  if (!t) return null
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return null
  return `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

export function buildReportModel(run: RunState, r: MaintenanceReport, window: number, facility: Facility = STATIC_FACILITY): ReportModel {
  const candidate = candidateOf(r)
  const assetId = highlightId(candidate, facility)
  let found: string | null = null
  if (candidate.kind === 'asset' || candidate.kind === 'tag' || candidate.kind === 'unlocalised') {
    const phrase = hypothesisPhrase(candidate.hypothesis, facility)
    found = candidate.kind === 'asset' ? `Suspected: ${phrase}. Suspected, confirm on site.` : `A possible issue was suggested: ${phrase}. Suspected, confirm on site.`
  }
  const ep = run.run?.episode_id
  const scenario = ep && SCENARIOS.some((s) => s.episode_id === ep) ? scenarioName(ep) : null
  const state = r.assessment_state ?? run.decision?.decision_state ?? null
  const pictureLabel = assetId ? `Suspected, confirm on site · ${assetPhrase(facility, assetId)}` : null
  return {
    header: { facility: FACILITY_NAME, scenario, time: whenOf(r), window, status: state ? `${label(state)}. A person decides what to do next.` : null },
    found,
    candidate,
    assetId,
    pictureLabel,
    pictureCaption: assetId ? `The suspected equipment is highlighted: ${assetPhrase(facility, assetId)}. Schematic, not to scale.` : NOT_NARROWED,
    changes: readingChanges(run, facility),
    checks: inspectionChecklist(r, facility),
  }
}
