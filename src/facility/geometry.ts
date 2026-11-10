import type { Facility, FacilityAsset } from './index'

export type Vec3 = [number, number, number]

/** Height of pipe centre lines above the ground in the schematic. */
export const PIPE_Y = 0.8
export const TANK_R = 4.2
export const TANK_H = 6

const v = (p: number[] | null | undefined): Vec3 | null =>
  p && p.length >= 3 ? [Number(p[0]), Number(p[1]), Number(p[2])] : null

/** Schematic position of every asset, graph node and port. Ports sit on the owning tank's shell. */
export function nodePositions(f: Facility): Map<string, Vec3> {
  const m = new Map<string, Vec3>()
  for (const a of f.assets) {
    const p = v(a.position_hint)
    if (p) m.set(a.asset_id, p)
  }
  for (const n of f.nodes ?? []) {
    if (m.has(n.node_id)) continue
    if (n.port_of && m.has(n.port_of)) {
      const [x, , z] = m.get(n.port_of)!
      const dx = /outlet/i.test(n.node_id) ? TANK_R : -TANK_R
      m.set(n.node_id, [x + dx, 0, z])
      continue
    }
    const p = v(n.position_hint)
    if (p) m.set(n.node_id, p)
  }
  return m
}

/** End points of a pipe asset: from its declared nodes, else its first two connections. */
export function pipeEnds(a: FacilityAsset, pos: Map<string, Vec3>): [Vec3, Vec3] | null {
  const ids = a.from_node && a.to_node ? [a.from_node, a.to_node] : a.connects_to.slice(0, 2)
  const p1 = ids[0] ? pos.get(ids[0]) : undefined
  const p2 = ids[1] ? pos.get(ids[1]) : undefined
  if (!p1 || !p2) return null
  return [[p1[0], PIPE_Y, p1[2]], [p2[0], PIPE_Y, p2[2]]]
}

/** Graph nodes that are not assets (headers, meters, boundaries, check valves). */
export function junctions(f: Facility): { id: string; pos: Vec3 }[] {
  const pos = nodePositions(f)
  return (f.nodes ?? []).filter((n) => n.role === 'junction' && pos.has(n.node_id)).map((n) => ({ id: n.node_id, pos: pos.get(n.node_id)! }))
}

/** The asset, its connections, and the equipment at the far end of its pipes (for the focus close-up). */
export function neighbours(f: Facility, id: string): Set<string> {
  const out = new Set<string>([id])
  const byId = new Map(f.assets.map((a) => [a.asset_id, a]))
  const a = byId.get(id)
  const add1 = (x: string) => out.add(x)
  for (const c of a?.connects_to ?? []) add1(c)
  for (const x of f.assets) if (x.connects_to.includes(id)) add1(x.asset_id)
  if (a?.mounted_on?.element_id) add1(a.mounted_on.element_id)
  // second hop along pipes: what the touching pipes lead to
  for (const x of [...out]) {
    const p = byId.get(x)
    if (p?.kind === 'pipe') for (const c of p.connects_to) add1(c)
  }
  // transmitters mounted on anything already in view
  for (const x of f.assets) if (x.mounted_on?.element_id && out.has(x.mounted_on.element_id)) add1(x.asset_id)
  return out
}

/** Bounds of the drawn layout. */
export function bounds(f: Facility): { min: Vec3; max: Vec3; center: Vec3; size: number } {
  const ps = [...nodePositions(f).values()]
  const min: Vec3 = [Infinity, 0, Infinity]
  const max: Vec3 = [-Infinity, 0, -Infinity]
  for (const p of ps) {
    min[0] = Math.min(min[0], p[0]); min[2] = Math.min(min[2], p[2])
    max[0] = Math.max(max[0], p[0]); max[2] = Math.max(max[2], p[2])
  }
  if (!ps.length) return { min: [0, 0, 0], max: [0, 0, 0], center: [0, 0, 0], size: 10 }
  const center: Vec3 = [(min[0] + max[0]) / 2, 0, (min[2] + max[2]) / 2]
  return { min, max, center, size: Math.max(max[0] - min[0], max[2] - min[2]) }
}
