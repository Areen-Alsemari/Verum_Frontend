/**
 * Procedural low-poly equipment, built from primitives in code (no models, textures or fonts).
 * Verum look: matte dark metal, thin champagne trim, warm amber emissive accents.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { TANK_H, TANK_R, type Vec3 } from '../facility/geometry'

export const COLORS = {
  metal: '#4a443c',
  metalDark: '#2c2924',
  trim: '#d9c8a9',
  amber: '#d6a45a',
  red: '#f4645c',
  yellow: '#f2c94c',
  ground: '#0c0b0a',
  pipe: '#5a5146',
  select: '#f3ece0',
}

export function useMaterials(lowDetail: boolean) {
  return useMemo(() => ({
    metal: new THREE.MeshStandardMaterial({ color: COLORS.metal, metalness: 0.55, roughness: 0.62 }),
    dark: new THREE.MeshStandardMaterial({ color: COLORS.metalDark, metalness: 0.5, roughness: 0.7 }),
    pipe: new THREE.MeshStandardMaterial({ color: COLORS.pipe, metalness: 0.6, roughness: 0.5 }),
    trim: new THREE.MeshStandardMaterial({ color: COLORS.trim, metalness: 0.8, roughness: 0.35, emissive: '#3a3020', emissiveIntensity: 0.4 }),
    amber: new THREE.MeshStandardMaterial({ color: COLORS.amber, emissive: COLORS.amber, emissiveIntensity: 1.6, roughness: 0.4 }),
    tick: new THREE.MeshStandardMaterial({ color: '#8c7a5c', emissive: '#4a3a22', emissiveIntensity: 0.5, roughness: 0.6 }),
    segments: lowDetail ? 12 : 28,
  }), [lowDetail])
}
export type Materials = ReturnType<typeof useMaterials>

export function Tank({ m }: { m: Materials }) {
  const seg = m.segments
  const rungs = Array.from({ length: 9 }, (_, i) => 0.5 + i * 0.6)
  return (
    <group>
      <mesh material={m.metal} position={[0, TANK_H / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[TANK_R, TANK_R, TANK_H, seg, 1]} />
      </mesh>
      {/* floating roof: shallow cone and a champagne trim ring at the rim */}
      <mesh material={m.dark} position={[0, TANK_H + 0.35, 0]} castShadow>
        <coneGeometry args={[TANK_R * 1.01, 0.7, seg]} />
      </mesh>
      <mesh material={m.trim} position={[0, TANK_H, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[TANK_R + 0.02, 0.06, 6, seg]} />
      </mesh>
      <mesh material={m.trim} position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[TANK_R + 0.02, 0.035, 6, seg]} />
      </mesh>
      {/* ladder on the shell */}
      <group position={[0, 0, TANK_R + 0.12]}>
        <mesh material={m.trim} position={[-0.25, TANK_H / 2, 0]}><boxGeometry args={[0.05, TANK_H, 0.05]} /></mesh>
        <mesh material={m.trim} position={[0.25, TANK_H / 2, 0]}><boxGeometry args={[0.05, TANK_H, 0.05]} /></mesh>
        {rungs.map((y) => <mesh key={y} material={m.trim} position={[0, y, 0]}><boxGeometry args={[0.5, 0.04, 0.04]} /></mesh>)}
      </group>
      {/* warm light on the roof */}
      <mesh material={m.amber} position={[0, TANK_H + 0.75, 0]}><sphereGeometry args={[0.16, 8, 8]} /></mesh>
    </group>
  )
}

export function Pump({ m }: { m: Materials }) {
  return (
    <group>
      <mesh material={m.dark} position={[0, 0.15, 0]} receiveShadow><boxGeometry args={[3.2, 0.3, 1.4]} /></mesh>
      {/* pump casing */}
      <mesh material={m.metal} position={[-0.6, 0.8, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.6, 0.6, 1.1, m.segments]} />
      </mesh>
      {/* motor */}
      <mesh material={m.metal} position={[0.75, 0.8, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 1.4, m.segments]} />
      </mesh>
      <mesh material={m.trim} position={[0.05, 0.8, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.32, 0.32, 0.18, 12]} />
      </mesh>
      <mesh material={m.amber} position={[0.75, 1.36, 0]}><sphereGeometry args={[0.08, 8, 8]} /></mesh>
    </group>
  )
}

export function Valve({ m }: { m: Materials }) {
  return (
    <group position={[0, 0.8, 0]}>
      <mesh material={m.metal} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.8, 10]} />
      </mesh>
      <mesh material={m.dark} position={[0, 0.55, 0]}><cylinderGeometry args={[0.07, 0.07, 0.7, 6]} /></mesh>
      <mesh material={m.trim} position={[0, 0.92, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.38, 0.05, 6, 16]} />
      </mesh>
    </group>
  )
}

export function Transmitter({ m }: { m: Materials }) {
  return (
    <group>
      <mesh material={m.dark} position={[0, 0.7, 0]}><cylinderGeometry args={[0.06, 0.06, 1.4, 6]} /></mesh>
      <mesh material={m.metal} position={[0, 1.5, 0]} castShadow><boxGeometry args={[0.5, 0.45, 0.4]} /></mesh>
      <mesh material={m.trim} position={[0, 1.5, 0.21]}><circleGeometry args={[0.13, 12]} /></mesh>
    </group>
  )
}

/** Any asset kind without a dedicated model: a labelled generic block (never dropped). */
export function GenericBlock({ m }: { m: Materials }) {
  return (
    <mesh material={m.metal} position={[0, 0.7, 0]} castShadow><boxGeometry args={[1.4, 1.4, 1.4]} /></mesh>
  )
}

/** Small junction marker for a graph node that is not an asset (header, meter, boundary, check valve). */
export function Junction({ m }: { m: Materials }) {
  return (
    <group position={[0, 0.8, 0]}>
      <mesh material={m.dark}><cylinderGeometry args={[0.3, 0.3, 0.5, 8]} /></mesh>
      <mesh material={m.trim} position={[0, 0.27, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.3, 0.03, 4, 12]} /></mesh>
    </group>
  )
}

/** A pipe segment as a tube between two points, with flow-direction ticks. */
export function PipeSegment({ a, b, m, ticks = true, radius = 0.18 }: { a: Vec3; b: Vec3; m: Materials; ticks?: boolean; radius?: number }) {
  const { mid, len, quat, dir } = useMemo(() => {
    const va = new THREE.Vector3(...a)
    const vb = new THREE.Vector3(...b)
    const d = vb.clone().sub(va)
    const l = d.length()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize())
    return { mid: va.clone().add(vb).multiplyScalar(0.5), len: l, quat: q, dir: d.normalize() }
  }, [a, b])
  if (len < 0.01) return null
  const tickAt = len > 3 ? [0.35, 0.65] : len > 1.2 ? [0.5] : []
  return (
    <group>
      <mesh material={m.pipe} position={mid} quaternion={quat} castShadow>
        <cylinderGeometry args={[radius, radius, len, 8, 1]} />
      </mesh>
      {ticks && tickAt.map((t) => {
        const p = new THREE.Vector3(...a).add(dir.clone().multiplyScalar(len * t))
        return (
          <mesh key={t} material={m.tick} position={p} quaternion={quat}>
            <coneGeometry args={[radius * 1.7, radius * 2.4, 6]} />
          </mesh>
        )
      })}
    </group>
  )
}
