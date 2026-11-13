import { kindLabel, kindRank, type Facility } from './index'

const SWATCH: Record<string, string> = {
  tank: 'sw-tank', pump: 'sw-pump', isolation_valve: 'sw-valve', pipe: 'sw-pipe', pressure_transmitter: 'sw-pt',
}

export function FacilityLegend({ facility }: { facility: Facility }) {
  const kinds = [...new Set(facility.assets.map((a) => a.kind))].sort((a, b) => kindRank(a) - kindRank(b))
  return (
    <aside className="facility-legend glass" aria-label="Legend">
      <ul>
        {kinds.map((k) => <li key={k}><span className={`sw ${SWATCH[k] ?? 'sw-generic'}`} aria-hidden="true" />{kindLabel(k)}</li>)}
        <li><span className="sw sw-junction" aria-hidden="true" />Graph node (not an asset)</li>
        <li><span className="sw sw-sensor" aria-hidden="true" />Sensor (good)</li>
        <li><span className="sw sw-sensor-warn" aria-hidden="true" />Sensor suspect or stale</li>
        <li><span className="sw sw-sensor-unknown" aria-hidden="true" />Sensor value not available</li>
        <li><span className="sw sw-flag" aria-hidden="true" />Flagged by agents</li>
      </ul>
      <p className="legend-note">Simulated terminal. Schematic, not to scale. Flow left to right.</p>
    </aside>
  )
}
