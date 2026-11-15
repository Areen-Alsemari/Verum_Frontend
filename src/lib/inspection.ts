import type { MaintenanceReport } from '../api'
import { STATIC_FACILITY, type Facility } from '../facility'
import { label } from './labels'
import { assetArea, assetPhrase } from './plain'

export interface CheckItem {
  key: string
  /** "Inspect pump P-101A" */
  text: string
  /** where on the plant, when the layout knows */
  where: string | null
  /** short plain facts: time, cost, feasibility when it is known */
  facts: string[]
}

/** The inspection options of a report as a checklist in plain words. Facts the service did not give are left out. */
export function inspectionChecklist(r: MaintenanceReport | null | undefined, facility: Facility = STATIC_FACILITY): CheckItem[] {
  return (r?.inspection_options ?? []).map((o, i) => {
    const facts: string[] = []
    if (typeof o.duration_min === 'number') facts.push(`about ${Math.round(o.duration_min)} min`)
    if (typeof o.cost_usd === 'number') facts.push(`estimated cost ${Math.round(o.cost_usd)} USD`)
    if (o.feasibility && o.feasibility !== 'unknown') facts.push(label(o.feasibility).toLowerCase())
    return { key: `${o.action_id}-${i}`, text: `Inspect ${assetPhrase(facility, o.target_asset)}`, where: assetArea(facility, o.target_asset), facts }
  })
}
