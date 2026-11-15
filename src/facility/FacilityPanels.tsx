import { useId, useMemo, useState } from 'react'
import { readingDisplay, type SensorSample } from '../state/runState'
import { Unknown } from '../components/Unknown'
import { flagText, kindLabel, kindRank, type Facility, type FlagInfo } from './index'

interface Hit { id: string; kind: 'asset' | 'tag'; assetId: string | null; text: string }

export function searchFacility(f: Facility, q: string, limit = 8): Hit[] {
  const s = q.trim().toLowerCase()
  if (!s) return []
  const hits: Hit[] = []
  for (const a of f.assets) if (a.asset_id.toLowerCase().includes(s)) hits.push({ id: a.asset_id, kind: 'asset', assetId: a.asset_id, text: `${a.asset_id} · ${kindLabel(a.kind)}` })
  for (const t of f.sensors) if (t.tag_id.toLowerCase().includes(s) && !hits.some((h) => h.id === t.tag_id)) {
    hits.push({ id: t.tag_id, kind: 'tag', assetId: t.asset_id, text: `${t.tag_id} · sensor${t.asset_id ? ` on ${t.asset_id}` : ', no asset in source'}` })
  }
  const exact = (h: Hit) => (h.id.toLowerCase() === s ? 0 : h.id.toLowerCase().startsWith(s) ? 1 : 2)
  return hits.sort((a, b) => exact(a) - exact(b) || a.id.localeCompare(b.id)).slice(0, limit)
}

/** Find an asset or tag by id and focus the camera on its asset. */
export function FacilitySearch({ facility, onPick }: { facility: Facility; onPick: (assetId: string) => void }) {
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const id = useId()
  const hits = useMemo(() => searchFacility(facility, q), [facility, q])
  const pick = (h: Hit | undefined) => {
    if (!h) return
    if (h.assetId) { onPick(h.assetId); setMsg(h.kind === 'tag' ? `${h.id} is on ${h.assetId}` : null) }
    else setMsg(`${h.id} has no asset in the source data`)
    setQ('')
  }
  return (
    <div className="search">
      <label htmlFor={`${id}-q`} className="sr-only">Find asset or tag by id</label>
      <input id={`${id}-q`} className="search-input" type="search" placeholder="Find asset or tag id" value={q} autoComplete="off"
        role="combobox" aria-expanded={hits.length > 0} aria-controls={`${id}-l`} aria-autocomplete="list"
        aria-activedescendant={hits[active] ? `${id}-o-${active}` : undefined}
        onChange={(e) => { setQ(e.target.value); setActive(0); setMsg(null) }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
          else if (e.key === 'Enter') { e.preventDefault(); pick(hits[active]) }
          else if (e.key === 'Escape') setQ('')
        }} />
      {hits.length > 0 && (
        <ul id={`${id}-l`} role="listbox" className="search-list glass">
          {hits.map((h, i) => (
            <li key={h.id} id={`${id}-o-${i}`} role="option" aria-selected={i === active} className={i === active ? 'is-active' : ''}
              onMouseDown={(e) => { e.preventDefault(); pick(h) }}>{h.text}</li>
          ))}
        </ul>
      )}
      {msg && <p className="search-msg" role="status">{msg}</p>}
    </div>
  )
}

interface ListProps {
  id: string
  facility: Facility
  flagged: Map<string, FlagInfo>
  readings: Record<string, SensorSample>
  selectedId: string | null
  onPick: (id: string) => void
  onClose: () => void
}

/** All assets and sensors grouped by kind. */
export function AssetListPanel({ id, facility: f, flagged, readings, selectedId, onPick, onClose }: ListProps) {
  const groups = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const a of f.assets) m.set(a.kind, [...(m.get(a.kind) ?? []), a.asset_id])
    return [...m.entries()].sort((a, b) => kindRank(a[0]) - kindRank(b[0]))
  }, [f])
  const noAsset = f.sensors.filter((s) => !s.asset_id)
  return (
    <aside id={id} className="asset-list glass" aria-label="Assets and sensors">
      <div className="panel-head">
        <h3 className="label panel-title">Assets and sensors</h3>
        <button type="button" className="btn btn-ghost tool-btn" onClick={onClose}>Close</button>
      </div>
      <div className="asset-list-scroll">
        {groups.map(([kind, ids]) => (
          <section key={kind}>
            <h4 className="asset-group">{kindLabel(kind)} <span>{ids.length}</span></h4>
            <ul>
              {ids.map((aid) => {
                const tags = f.sensors.filter((s) => s.asset_id === aid)
                return (
                  <li key={aid}>
                    <button type="button" className={`asset-row${selectedId === aid ? ' is-selected' : ''}${flagged.has(aid) ? ' is-flagged' : ''}`} onClick={() => onPick(aid)}>
                      <code>{aid}</code>
                      {flagged.has(aid) && <span className="pill pill-flag">{flagText(flagged.get(aid)!)}</span>}
                    </button>
                    {tags.length > 0 && (
                      <ul className="tag-rows">
                        {tags.map((t) => {
                          const d = readingDisplay(readings[t.tag_id])
                          return <li key={t.tag_id}><code>{t.tag_id}</code> <span className="control-help">{t.unit}</span> {d.tone === 'unknown' ? <Unknown what={t.tag_id} /> : <span className={`tip-val tone-${d.tone}`}>{d.text}</span>}</li>
                        })}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
        {noAsset.length > 0 && (
          <section>
            <h4 className="asset-group">Sensors without an asset in the source <span>{noAsset.length}</span></h4>
            <ul className="tag-rows">
              {noAsset.map((t) => {
                const d = readingDisplay(readings[t.tag_id])
                return <li key={t.tag_id}><code>{t.tag_id}</code> <span className="control-help">{t.unit}</span> {d.tone === 'unknown' ? <Unknown what={t.tag_id} /> : <span className={`tip-val tone-${d.tone}`}>{d.text}</span>}</li>
              })}
            </ul>
          </section>
        )}
      </div>
    </aside>
  )
}
