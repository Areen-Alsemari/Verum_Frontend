import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flagText, kindLabel, type Facility, type FlagInfo } from './index'
import { bounds, junctions, nodePositions, pipeEnds, type Vec3 } from './geometry'

interface Props {
  facility: Facility
  flagged: Map<string, FlagInfo>
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** draw only these asset ids (focus close-up); null = all */
  only?: Set<string> | null
  /** false for static use (report): no focus, no click */
  interactive?: boolean
}

const PAD = 6
/** vertical stretch: the layered layout is wide and shallow */
const ZS = 1.7

/**
 * The same real graph as a 2D diagram (accessible fallback, also used when WebGL is unavailable).
 * Pipes are the declared edges with flow arrows; equipment and transmitters are focusable buttons.
 */
export function Facility2D({ facility: f, flagged, selectedId, onSelect, only = null, interactive = true }: Props) {
  const act = (id: string, label: string) => interactive ? {
    role: 'button', tabIndex: 0, 'aria-label': label,
    onClick: () => onSelect(id),
    onKeyDown: (ev: React.KeyboardEvent) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onSelect(id) } },
  } : {}
  const pos = useMemo(() => nodePositions(f), [f])
  const vis = (id: string) => !only || only.has(id)
  const P = (p: Vec3) => ({ x: p[0], y: p[2] * ZS })
  const assets = f.assets.filter((a) => vis(a.asset_id))
  // fit the view to what is drawn (the whole plant, or the close-up subset), centred
  const fit = useMemo(() => {
    const b = bounds(f)
    if (!only) return { x: b.min[0] - PAD, y: b.min[2] * ZS - PAD - 4, w: b.max[0] - b.min[0] + PAD * 2, h: (b.max[2] - b.min[2]) * ZS + PAD * 2 + 6 }
    const pts: Vec3[] = []
    for (const a of f.assets) {
      if (!only.has(a.asset_id)) continue
      if (a.kind === 'pipe') { const e = pipeEnds(a, pos); if (e) pts.push(e[0], e[1]) }
      else { const p = pos.get(a.asset_id); if (p) pts.push(p) }
    }
    if (!pts.length) return { x: b.min[0], y: b.min[2] * ZS, w: b.size, h: b.size / 2 }
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[2] * ZS)
    const x0 = Math.min(...xs) - 5, x1 = Math.max(...xs) + 5, y0 = Math.min(...ys) - 6, y1 = Math.max(...ys) + 5
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  }, [f, only, pos])
  const [vb, setVb] = useState(fit)
  const fitKey = `${fit.x},${fit.y},${fit.w},${fit.h}`
  useEffect(() => { setVb(fit) }, [fitKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ x: number; y: number; vb: typeof fit; moved: boolean } | null>(null)
  const zoomed = Math.abs(vb.w - fit.w) > 0.01 || Math.abs(vb.x - fit.x) > 0.01 || Math.abs(vb.y - fit.y) > 0.01

  /** zoom by `k` (<1 zooms in) around a point in diagram units (default: the view centre) */
  const zoom = useCallback((k: number, cx?: number, cy?: number) => {
    setVb((v) => {
      const w = Math.min(fit.w * 1.6, Math.max(fit.w / 10, v.w * k))
      const r = w / v.w
      const px = cx ?? v.x + v.w / 2, py = cy ?? v.y + v.h / 2
      return { x: px - (px - v.x) * r, y: py - (py - v.y) * r, w, h: v.h * r }
    })
  }, [fit.w])

  const toDiagram = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    const m = svg?.getScreenCTM?.()
    if (!svg || !m) return null
    const pt = svg.createSVGPoint()
    pt.x = clientX; pt.y = clientY
    const r = pt.matrixTransform(m.inverse())
    return { x: r.x, y: r.y }
  }

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || !interactive) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = toDiagram(e.clientX, e.clientY)
      zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, p?.x, p?.y)
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [interactive, zoom])

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive || e.button !== 0) return
    drag.current = { x: e.clientX, y: e.clientY, vb, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    const svg = svgRef.current
    if (!d || !svg) return
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < 4) return
    if (!d.moved) { d.moved = true; svg.setPointerCapture?.(e.pointerId) }
    const scale = Math.max(d.vb.w / Math.max(1, svg.clientWidth), d.vb.h / Math.max(1, svg.clientHeight))
    setVb({ ...d.vb, x: d.vb.x - dx * scale, y: d.vb.y - dy * scale })
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (d?.moved) {
      svgRef.current?.releasePointerCapture?.(e.pointerId)
      // swallow the click that ends a drag
      const stop = (ev: Event) => { ev.stopPropagation(); ev.preventDefault() }
      window.addEventListener('click', stop, { capture: true, once: true })
      setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0)
    }
  }
  const desc = `Diagram of the simulated terminal: ${f.assets.length} assets, ${f.sensors.length} sensors. Schematic, not to scale. Flow runs left to right.`
  return (
    <figure className="facility-2d">
      <svg ref={svgRef} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} role={interactive ? 'group' : 'img'} aria-label={desc}
        className={interactive ? 'is-pannable' : undefined}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { drag.current = null }}>
        <defs>
          <marker id="flow-arrow" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0 0L6 3L0 6z" className="d2-arrow" />
          </marker>
        </defs>
        {assets.filter((a) => a.kind === 'pipe').map((a) => {
          const e = pipeEnds(a, pos)
          if (!e) return null
          const p1 = P(e[0]), p2 = P(e[1])
          const fl = flagged.get(a.asset_id)
          const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
          return (
            <g key={a.asset_id} className={`d2-pipe${fl ? ' is-flagged' : ''}${fl?.severity === 'critical' ? ' is-critical' : ''}${selectedId === a.asset_id ? ' is-selected' : ''}`}
              {...act(a.asset_id, `Pipe segment ${a.asset_id}${fl ? `, ${flagText(fl)}` : ''}`)}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />
              <line x1={p1.x} y1={p1.y} x2={mid.x} y2={mid.y} className="d2-flow" markerEnd="url(#flow-arrow)" />
              <title>{a.asset_id} · pipe segment{fl ? ` · ${flagText(fl)}` : ''}</title>
            </g>
          )
        })}
        {junctions(f).filter((j) => !only || assets.some((a) => a.connects_to.includes(j.id))).map((j) => (
          <g key={j.id} className="d2-junction"><circle cx={j.pos[0]} cy={j.pos[2] * ZS} r={0.7} /><title>{j.id} (graph node, not an asset)</title></g>
        ))}
        {assets.filter((a) => a.kind !== 'pipe').map((a) => {
          const p = pos.get(a.asset_id)
          if (!p) return null
          const fl = flagged.get(a.asset_id)
          const r = a.kind === 'tank' ? 4.6 : a.kind === 'pump' ? 1.6 : a.kind === 'pressure_transmitter' ? 0.75 : 1
          const main = a.kind === 'tank' || a.kind === 'pump' || !!fl || selectedId === a.asset_id || !!only
          return (
            <g key={a.asset_id} transform={`translate(${p[0]} ${p[2] * ZS})`}
              className={`d2-asset k-${a.kind}${fl ? ' is-flagged' : ''}${fl?.severity === 'critical' ? ' is-critical' : ''}${selectedId === a.asset_id ? ' is-selected' : ''}`}
              {...act(a.asset_id, `${kindLabel(a.kind)} ${a.asset_id}${fl ? `, ${flagText(fl)}` : ''}`)}>
              {fl && <circle r={r + 1.4} className="d2-ring" />}
              {a.kind === 'isolation_valve' ? <path d={`M${-r} ${-r * 0.7}L${r} ${r * 0.7}V${-r * 0.7}L${-r} ${r * 0.7}Z`} />
                : a.kind === 'pressure_transmitter' ? <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={0.2} />
                : a.kind === 'tank' || a.kind === 'pump' ? <circle r={r} />
                : <rect x={-r} y={-r} width={r * 2} height={r * 2} />}
              {main && <text y={a.kind === 'tank' ? 0.6 : a.kind === 'pressure_transmitter' ? r + 1.9 : -r - 0.8} textAnchor="middle" className="d2-label">{a.asset_id}</text>}
              <title>{a.asset_id} · {kindLabel(a.kind)}{fl ? ` · ${flagText(fl)}` : ''}</title>
            </g>
          )
        })}
      </svg>
      {interactive && (
        <div className="d2-zoom glass" role="group" aria-label="Zoom the diagram">
          <button type="button" className="btn btn-ghost" aria-label="Zoom in" onClick={() => zoom(1 / 1.3)}>+</button>
          <button type="button" className="btn btn-ghost" aria-label="Zoom out" onClick={() => zoom(1.3)}>−</button>
          <button type="button" className="btn btn-ghost d2-reset" disabled={!zoomed} onClick={() => setVb(fit)}>Reset</button>
        </div>
      )}
      <figcaption className="control-help">2D diagram of the declared graph. Schematic, not to scale. Flow runs left to right.{interactive ? ' Scroll or use + and − to zoom; drag to pan.' : ''}</figcaption>
    </figure>
  )
}
