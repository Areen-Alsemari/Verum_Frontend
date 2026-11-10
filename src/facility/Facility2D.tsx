import { useMemo } from 'react'
import { kindLabel, type Facility } from './index'
import { bounds, junctions, nodePositions, pipeEnds, type Vec3 } from './geometry'

interface Props {
  facility: Facility
  flagged: Map<string, { by: string[]; severity?: string }>
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
  const b = useMemo(() => bounds(f), [f])
  const vis = (id: string) => !only || only.has(id)
  const minX = b.min[0] - PAD, minZ = b.min[2] * ZS - PAD - 4
  const w = b.max[0] - b.min[0] + PAD * 2, h = (b.max[2] - b.min[2]) * ZS + PAD * 2 + 6
  const P = (p: Vec3) => ({ x: p[0], y: p[2] * ZS })
  const assets = f.assets.filter((a) => vis(a.asset_id))
  const desc = `Diagram of the simulated terminal: ${f.assets.length} assets, ${f.sensors.length} sensors. Schematic, not to scale. Flow runs left to right.`
  return (
    <figure className="facility-2d">
      <svg viewBox={`${minX} ${minZ} ${w} ${h}`} role={interactive ? 'group' : 'img'} aria-label={desc}>
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
              {...act(a.asset_id, `Pipe segment ${a.asset_id}${fl ? `, flagged by ${fl.by.length} agents` : ''}`)}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />
              <line x1={p1.x} y1={p1.y} x2={mid.x} y2={mid.y} className="d2-flow" markerEnd="url(#flow-arrow)" />
              <title>{a.asset_id} · pipe segment{fl ? ` · flagged by ${fl.by.length} agents` : ''}</title>
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
              {...act(a.asset_id, `${kindLabel(a.kind)} ${a.asset_id}${fl ? `, flagged by ${fl.by.length} agents` : ''}`)}>
              {fl && <circle r={r + 1.4} className="d2-ring" />}
              {a.kind === 'isolation_valve' ? <path d={`M${-r} ${-r * 0.7}L${r} ${r * 0.7}V${-r * 0.7}L${-r} ${r * 0.7}Z`} />
                : a.kind === 'pressure_transmitter' ? <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={0.2} />
                : a.kind === 'tank' || a.kind === 'pump' ? <circle r={r} />
                : <rect x={-r} y={-r} width={r * 2} height={r * 2} />}
              {main && <text y={a.kind === 'tank' ? 0.6 : a.kind === 'pressure_transmitter' ? r + 1.9 : -r - 0.8} textAnchor="middle" className="d2-label">{a.asset_id}</text>}
              <title>{a.asset_id} · {kindLabel(a.kind)}{fl ? ` · flagged by ${fl.by.length} agents` : ''}</title>
            </g>
          )
        })}
      </svg>
      <figcaption className="control-help">2D diagram of the declared graph. Schematic, not to scale. Flow runs left to right.</figcaption>
    </figure>
  )
}
