import { Suspense, useMemo } from 'react'
import { Boundary } from '../facility/FacilityView'
import { Facility2D } from '../facility/Facility2D'
import { neighbours } from '../facility/geometry'
import { assetById, kindLabel, sensorsForAsset, type Facility } from '../facility'
import { hasWebGL, usePrefersReducedMotion } from '../lib/env'
import { readingDisplay, type SensorSample } from '../state/runState'
import { Facility3D } from '../three/lazy'
import { Unknown } from '../components/Unknown'

export interface FlagEntry { asset: string; by: string[]; note?: string; severity?: string }

interface Props {
  facility: Facility
  flagged: FlagEntry[]
  readings: Record<string, SensorSample>
  focusId: string | null
  onFocus: (id: string) => void
  agentName: (role: string) => string
  twoD: boolean
  lowDetail: boolean
  title?: string
}

/** Close-up of a flagged asset: 3D (or 2D) view of it and its neighbours, its sensors and the agents that flagged it. */
export function FocusView({ facility, flagged, readings, focusId, onFocus, agentName, twoD, lowDetail, title = 'Focus view' }: Props) {
  const reduced = usePrefersReducedMotion()
  const webgl = useMemo(() => hasWebGL(), [])
  const current = flagged.find((f) => f.asset === focusId) ?? flagged[0]
  const flaggedMap = useMemo(() => new Map(flagged.map((f) => [f.asset, { by: f.by, severity: f.severity }])), [flagged])
  if (!current) return null
  const a = assetById(facility, current.asset)
  const tags = sensorsForAsset(facility, current.asset)
  const only = neighbours(facility, current.asset)
  const twoDView = <Facility2D facility={facility} flagged={flaggedMap} selectedId={current.asset} onSelect={() => {}} only={only} />
  return (
    <section className="panel focus-panel" aria-labelledby="focus-h">
      <div className="panel-head">
        <h3 id="focus-h" className="label panel-title">{title}</h3>
        {flagged.length > 1 && (
          <div className="chips focus-chips" role="group" aria-label="Flagged assets">
            {flagged.map((f) => (
              <button key={f.asset} type="button" className={`chip chip-btn${f.asset === current.asset ? ' is-on' : ''}`} aria-pressed={f.asset === current.asset} onClick={() => onFocus(f.asset)}>
                {f.asset}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="focus-body">
        <div className="focus-canvas">
          {twoD || !webgl ? <div className="focus-2d">{twoDView}</div> : (
            <Boundary fallback={<div className="focus-2d">{twoDView}</div>}>
              <Suspense fallback={<p className="state-msg facility-note" role="status">Loading the close-up…</p>}>
                <Facility3D facility={facility} flagged={flaggedMap} readings={readings} selectedId={null} onSelect={() => {}}
                  focusId={current.asset} lowDetail={lowDetail} reducedMotion={reduced} variant="focus" />
              </Suspense>
            </Boundary>
          )}
          <span className="focus-note">Close-up · schematic, not to scale</span>
        </div>
        <div className="focus-info">
          <p className="focus-id"><code>{current.asset}</code></p>
          <p className="control-help">{a ? `${kindLabel(a.kind)} · ${a.area ?? 'area unknown'}` : 'Not in the facility snapshot'}</p>
          <p className="kv"><span>flagged by</span> {current.by.length ? `${current.by.length} agent${current.by.length === 1 ? '' : 's'}` : <Unknown what="flagging agents" />}</p>
          {current.by.length > 0 && <ul className="plain">{current.by.map((r) => <li key={r}>{agentName(r)}</li>)}</ul>}
          <p className="kv"><span>severity</span> {current.severity ? <code>{current.severity}</code> : <Unknown what="severity" />}</p>
          {current.note && <p className="kv"><span>note</span> {current.note}</p>}
          <p className="kv"><span>connects to</span> {a?.connects_to.length ? <span className="chips">{a.connects_to.map((c) => <code key={c} className="chip">{c}</code>)}</span> : <Unknown what="connections" />}</p>
          <h4 className="label focus-sub">Sensors on this asset</h4>
          {tags.length === 0 ? <p className="control-help">No tag is tied to this asset in the source data.</p> : (
            <table className="sensor-table">
              <thead><tr><th>Tag</th><th>Value</th><th>Quality</th></tr></thead>
              <tbody>
                {tags.map((t) => {
                  const r = readings[t.tag_id]
                  const d = readingDisplay(r)
                  return (
                    <tr key={t.tag_id}>
                      <td><code>{t.tag_id}</code></td>
                      <td>{d.tone === 'unknown' ? <Unknown what={t.tag_id} /> : <span className={`tip-val tone-${d.tone}`}>{d.text}</span>}</td>
                      <td>{r ? <code>{String(r.quality)}</code> : <Unknown what="quality" />}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <p className="control-help">Simulated stream (replay of recorded windows). Condition is unconfirmed.</p>
        </div>
      </div>
    </section>
  )
}
