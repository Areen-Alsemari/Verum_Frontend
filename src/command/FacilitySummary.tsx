import { STATIC_FACILITY, kindLabel, kindRank } from '../facility'

/** Text summary of the facility, used in the stage until the facility view loads. */
export function FacilitySummary() {
  const f = STATIC_FACILITY
  const by = new Map<string, number>()
  for (const a of f.assets) by.set(a.kind, (by.get(a.kind) ?? 0) + 1)
  return (
    <div className="facility-summary">
      <p className="label">Simulated gasoline terminal</p>
      <p className="facility-count">{f.assets.length} assets · {f.sensors.length} sensors</p>
      <ul className="chips">
        {[...by.entries()].sort((a, b) => kindRank(a[0]) - kindRank(b[0])).map(([k, n]) => <li key={k} className="chip">{n} {kindLabel(k)}</li>)}
      </ul>
      <p className="control-help">Schematic, not to scale.</p>
    </div>
  )
}
