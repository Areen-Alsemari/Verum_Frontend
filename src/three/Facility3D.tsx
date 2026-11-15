/**
 * 3D facility view (lazy-loaded chunk). Procedural geometry from facility.json positions.
 * No network at runtime: no environment maps, no remote fonts, models or textures; labels are DOM (drei Html).
 */
import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { flagText, kindLabel, type Facility, type FacilityAsset, type FlagInfo } from '../facility'
import { PIPE_Y, TANK_H, TANK_R, bounds, junctions, neighbours, nodePositions, pipeEnds, type Vec3 } from '../facility/geometry'
import { readingDisplay, type SensorSample } from '../state/runState'
import { COLORS, GenericBlock, Junction, PipeSegment, Pump, Tank, Transmitter, Valve, useMaterials, type Materials } from './parts'
import { label } from '../lib/labels'

export type { FlagInfo }

export interface Facility3DProps {
  facility: Facility
  flagged: Map<string, FlagInfo>
  readings: Record<string, SensorSample>
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** asset the camera eases to (null = overview) */
  focusId: string | null
  lowDetail: boolean
  reducedMotion: boolean
  variant?: 'overview' | 'focus'
  /** keep the drawing buffer so the view can be taken as an image; also centres the view (no offset for the briefing card) */
  preserve?: boolean
  /** set to a function that renders a frame and returns a PNG data URL (focus variant) */
  captureRef?: MutableRefObject<(() => string | null) | null>
  /** agent names for the "flagged by" tooltip */
  agentName?: (role: string) => string
}

const MAIN_KINDS = new Set(['tank', 'pump'])

function heightOf(kind: string): number {
  return kind === 'tank' ? TANK_H + 1.4 : kind === 'pump' ? 1.8 : kind === 'pressure_transmitter' ? 2.1 : kind === 'pipe' ? PIPE_Y + 0.9 : 2
}

function ringRadius(kind: string): number {
  return kind === 'tank' ? TANK_R + 1.1 : kind === 'pump' ? 2.1 : kind === 'pipe' ? 1.6 : 1.3
}

function assetCenter(a: FacilityAsset, pos: Map<string, Vec3>): Vec3 | null {
  if (a.kind === 'pipe') {
    const e = pipeEnds(a, pos)
    if (e) return [(e[0][0] + e[1][0]) / 2, 0, (e[0][2] + e[1][2]) / 2]
  }
  return pos.get(a.asset_id) ?? null
}

/** Where each sensor marker sits: on or above its asset. Tags without an asset are not drawn. */
function sensorPositions(f: Facility, pos: Map<string, Vec3>): Map<string, Vec3> {
  const out = new Map<string, Vec3>()
  const byAsset = new Map<string, string[]>()
  for (const s of f.sensors) if (s.asset_id) byAsset.set(s.asset_id, [...(byAsset.get(s.asset_id) ?? []), s.tag_id])
  for (const [assetId, tags] of byAsset) {
    const a = f.assets.find((x) => x.asset_id === assetId)
    if (!a) continue
    const c = assetCenter(a, pos)
    if (!c) continue
    tags.forEach((t, i) => {
      if (a.kind === 'tank') {
        const ang = -Math.PI / 2 + i * 0.5
        out.set(t, [c[0] + Math.cos(ang) * (TANK_R + 0.25), 3.2 + i * 0.9, c[2] + Math.sin(ang) * (TANK_R + 0.25)])
      } else {
        out.set(t, [c[0] + (i - (tags.length - 1) / 2) * 0.6, heightOf(a.kind) + 0.2, c[2]])
      }
    })
  }
  return out
}

function FlagRing({ at, radius, color, reducedMotion }: { at: Vec3; radius: number; color: string; reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current || reducedMotion) return
    const s = 1 + Math.sin(clock.elapsedTime * 2.4) * 0.06
    ref.current.scale.set(s, s, 1)
  })
  return (
    <mesh ref={ref} position={[at[0], 0.06, at[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.18, radius, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0.9} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

function SelectRing({ at, radius }: { at: Vec3; radius: number }) {
  return (
    <mesh position={[at[0], 0.04, at[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius + 0.2, radius + 0.32, 48]} />
      <meshBasicMaterial color={COLORS.select} transparent opacity={0.55} toneMapped={false} />
    </mesh>
  )
}

function AssetBody({ a, m }: { a: FacilityAsset; m: Materials }) {
  switch (a.kind) {
    case 'tank': return <Tank m={m} />
    case 'pump': return <Pump m={m} />
    case 'isolation_valve': return <Valve m={m} />
    case 'pressure_transmitter': return <Transmitter m={m} />
    default: return <GenericBlock m={m} />
  }
}

/** Eases the orbit target and camera to the focus asset; instant under reduced motion. */
function CameraRig({ target, distance, reducedMotion, controls, autoRotate }: {
  target: Vec3; distance: number; reducedMotion: boolean; controls: MutableRefObject<OrbitControlsImpl | null>; autoRotate: boolean
}) {
  const { camera } = useThree()
  const goal = useRef<{ t: THREE.Vector3; c: THREE.Vector3 } | null>(null)
  const key = `${target.join(',')}|${distance}`
  useEffect(() => {
    const t = new THREE.Vector3(...target)
    const c = t.clone().add(new THREE.Vector3(0, distance * 0.62, distance * 0.78))
    if (reducedMotion) {
      camera.position.copy(c)
      controls.current?.target.copy(t)
      controls.current?.update()
      goal.current = null
    } else goal.current = { t, c }
    // key covers target and distance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reducedMotion])
  useFrame((_, dt) => {
    const ctl = controls.current
    if (ctl) ctl.autoRotate = autoRotate && !reducedMotion && goal.current === null
    const g = goal.current
    if (!g || !ctl) return
    const k = 1 - Math.exp(-dt * 3.2)
    ctl.target.lerp(g.t, k)
    camera.position.lerp(g.c, k)
    ctl.update()
    if (camera.position.distanceTo(g.c) < 0.05 && ctl.target.distanceTo(g.t) < 0.05) goal.current = null
  })
  return null
}

/** Reports whether the camera is at "medium zoom" (main-equipment labels shown). */
function ZoomWatch({ onChange, threshold }: { onChange: (near: boolean) => void; threshold: number }) {
  const last = useRef<boolean | null>(null)
  useFrame(({ camera, controls }) => {
    const t = (controls as unknown as OrbitControlsImpl | null)?.target ?? new THREE.Vector3()
    const near = camera.position.distanceTo(t) < threshold
    if (near !== last.current) { last.current = near; onChange(near) }
  })
  return null
}

/** Renders one frame and composites the DOM labels on top, so the snapshot keeps asset and sensor labels. */
function Capture({ captureRef, labelEls }: { captureRef?: MutableRefObject<(() => string | null) | null>; labelEls: MutableRefObject<Map<string, HTMLElement>> }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    if (!captureRef) return
    captureRef.current = () => {
      try {
        gl.render(scene, camera)
        const src = gl.domElement
        const out = document.createElement('canvas')
        out.width = src.width
        out.height = src.height
        const ctx = out.getContext('2d')
        if (!ctx) return src.toDataURL('image/png')
        ctx.drawImage(src, 0, 0)
        const box = src.getBoundingClientRect()
        const k = src.width / Math.max(1, box.width)
        ctx.textBaseline = 'middle'
        for (const el of labelEls.current.values()) {
          if (el.style.visibility === 'hidden') continue
          const r = el.getBoundingClientRect()
          if (r.width === 0) continue
          // labels are drawn larger than on screen so they stay legible in a printed snapshot
          const S = 1.7
          const cx = (r.left - box.left + r.width / 2) * k, cy = (r.top - box.top + r.height / 2) * k
          const w = r.width * k * S, h = r.height * k * S
          const x = Math.max(2, Math.min(out.width - w - 2, cx - w / 2)), y = Math.max(2, Math.min(out.height - h - 2, cy - h / 2))
          ctx.fillStyle = 'rgba(12,11,9,0.88)'
          ctx.strokeStyle = el.classList.contains('is-flag') ? '#d6a45a' : 'rgba(243,236,224,0.35)'
          ctx.lineWidth = 1.5 * k * S
          ctx.beginPath(); ctx.roundRect(x, y, w, h, 6 * k * S); ctx.fill(); ctx.stroke()
          const lines = (el.dataset.text ?? el.textContent ?? '').split('\n')
          lines.forEach((ln, i) => {
            ctx.font = `${i === 0 ? 600 : 400} ${(i === 0 ? 11 : 9.5) * k * S}px ui-monospace, Menlo, monospace`
            ctx.fillStyle = i === 0 ? (el.classList.contains('is-flag') ? '#d6a45a' : '#f3ece0') : '#a8a193'
            ctx.fillText(ln, x + 7 * k * S, y + h * ((i + 0.5) / lines.length), w - 12 * k * S)
          })
        }
        return out.toDataURL('image/png')
      } catch {
        return null
      }
    }
    return () => { captureRef.current = null }
  }, [captureRef, gl, scene, camera, labelEls])
  return null
}

interface LabelSpec { id: string; pos: Vec3; className: string; content: ReactNode; text: string[] }

/** Projects label anchor points to screen each frame and moves the DOM labels (no nested React roots). */
function LabelProjector({ specs, els }: { specs: MutableRefObject<LabelSpec[]>; els: MutableRefObject<Map<string, HTMLElement>> }) {
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size }) => {
    // project, then nudge overlapping labels upward (greedy, top-most anchor first)
    const placed: { x: number; y: number; w: number; h: number }[] = []
    const items: { el: HTMLElement; x: number; y: number; hidden: boolean }[] = []
    for (const l of specs.current) {
      const el = els.current.get(l.id)
      if (!el) continue
      v.set(l.pos[0], l.pos[1], l.pos[2]).project(camera)
      items.push({ el, x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height, hidden: v.z > 1 || v.z < -1 })
    }
    items.sort((a, b) => b.y - a.y)
    for (const it of items) {
      const w = it.el.offsetWidth, h = it.el.offsetHeight
      let y = it.y
      for (let guard = 0; guard < 12; guard++) {
        const hit = placed.find((p) => Math.abs(p.x - it.x) < (p.w + w) / 2 + 4 && Math.abs(p.y - y) < (p.h + h) / 2 + 2)
        if (!hit) break
        y = hit.y - (hit.h + h) / 2 - 3
      }
      placed.push({ x: it.x, y, w, h })
      it.el.style.visibility = it.hidden ? 'hidden' : 'visible'
      it.el.style.transform = `translate(${it.x}px, ${y}px) translate(-50%, -100%)`
    }
  })
  return null
}

interface UiState {
  hover: string | null; setHover: React.Dispatch<React.SetStateAction<string | null>>
  hoverTag: string | null; setHoverTag: React.Dispatch<React.SetStateAction<string | null>>
  pinTag: string | null; setPinTag: React.Dispatch<React.SetStateAction<string | null>>
  near: boolean; setNear: (n: boolean) => void
  labelSpecs: MutableRefObject<LabelSpec[]>
  labelEls: MutableRefObject<Map<string, HTMLElement>>
}

function Scene(p: Facility3DProps & { ui: UiState }) {
  const { hover, setHover, hoverTag, setHoverTag, setPinTag, setNear } = p.ui
  const variant = p.variant ?? 'overview'
  const m = useMaterials(p.lowDetail)
  const pos = useMemo(() => nodePositions(p.facility), [p.facility])
  const sPos = useMemo(() => sensorPositions(p.facility, pos), [p.facility, pos])
  const junc = useMemo(() => junctions(p.facility), [p.facility])
  const b = useMemo(() => bounds(p.facility), [p.facility])
  const controls = useRef<OrbitControlsImpl | null>(null)

  const subset = useMemo(() => (variant === 'focus' && p.focusId ? neighbours(p.facility, p.focusId) : null), [variant, p.focusId, p.facility])
  const visible = (id: string) => !subset || subset.has(id)
  const assets = p.facility.assets.filter((a) => visible(a.asset_id))

  const focusAsset = p.focusId ? p.facility.assets.find((a) => a.asset_id === p.focusId) : undefined
  const focusCenter = focusAsset ? assetCenter(focusAsset, pos) : null
  // overview target sits slightly left of centre: the briefing card covers the left of the stage
  const distance = focusAsset ? (focusAsset.kind === 'tank' ? 26 : variant === 'focus' ? 11 : 16) : b.size * 0.62
  // in the overview variant the focused asset sits right of centre, clear of the briefing card on the left
  const target: Vec3 = focusCenter ? (variant === 'overview' && !p.preserve ? [focusCenter[0] - distance * 0.2, focusCenter[1], focusCenter[2]] : focusCenter) : [b.center[0] - b.size * 0.07, 0, b.center[2]]

  useEffect(() => { document.body.style.cursor = hover || hoverTag ? 'pointer' : '' }, [hover, hoverTag])
  useEffect(() => () => { document.body.style.cursor = '' }, [])

  const handlers = (id: string) => ({
    onPointerOver: (e: { stopPropagation: () => void }) => { e.stopPropagation(); setHover(id) },
    onPointerOut: () => setHover((h) => (h === id ? null : h)),
    onClick: (e: { stopPropagation: () => void }) => { e.stopPropagation(); p.onSelect(id === p.selectedId ? null : id) },
  })

  return (
    <>
      <color attach="background" args={['#0a0908']} />
      <fog attach="fog" args={['#0a0908', b.size * 0.9, b.size * 2.6]} />
      <hemisphereLight args={['#d8c6a6', '#1a1612', 1.25]} />
      <directionalLight position={[b.center[0] + 30, 60, b.center[2] + 40]} intensity={2.2} color="#f1dcb8"
        castShadow={!p.lowDetail} shadow-mapSize={[1024, 1024]} shadow-camera-left={-70} shadow-camera-right={70} shadow-camera-top={50} shadow-camera-bottom={-50} />
      <pointLight position={[b.center[0] - 20, 9, b.center[2]]} color={COLORS.amber} intensity={60} distance={45} decay={1.6} />
      <pointLight position={[b.center[0] + 25, 6, b.center[2]]} color={COLORS.amber} intensity={40} distance={35} decay={1.6} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[b.center[0], 0, b.center[2]]} receiveShadow onClick={() => setPinTag(null)}>
        <planeGeometry args={[b.size * 3, b.size * 2]} />
        <meshStandardMaterial color={COLORS.ground} roughness={0.95} metalness={0.05} />
      </mesh>
      {!p.lowDetail && <gridHelper args={[Math.ceil(b.size * 1.6), 40, '#2a251f', '#16140f']} position={[b.center[0], 0.01, b.center[2]]} />}

      {/* pipes along the graph edges */}
      {assets.filter((a) => a.kind === 'pipe').map((a) => {
        const e = pipeEnds(a, pos)
        if (!e) return null
        return (
          <group key={a.asset_id} {...handlers(a.asset_id)}>
            <PipeSegment a={e[0]} b={e[1]} m={m} ticks={!p.lowDetail || variant === 'focus'} radius={p.flagged.has(a.asset_id) ? 0.24 : 0.18} />
          </group>
        )
      })}

      {/* equipment */}
      {assets.filter((a) => a.kind !== 'pipe').map((a) => {
        const at = pos.get(a.asset_id)
        if (!at) return null
        return (
          <group key={a.asset_id} position={[at[0], 0, at[2]]} {...handlers(a.asset_id)}>
            <AssetBody a={a} m={m} />
          </group>
        )
      })}

      {/* junctions (graph nodes that are not assets) */}
      {junc.filter((j) => !subset || subset.has(j.id) || assets.some((a) => a.connects_to.includes(j.id))).map((j) => (
        <group key={j.id} position={[j.pos[0], 0, j.pos[2]]}
          onPointerOver={(e) => { e.stopPropagation(); setHover(j.id) }} onPointerOut={() => setHover((h) => (h === j.id ? null : h))}>
          <Junction m={m} />
        </group>
      ))}

      {/* flag rings, selection ring and labels */}
      {assets.map((a) => {
        const c = assetCenter(a, pos)
        if (!c) return null
        const fl = p.flagged.get(a.asset_id)
        return (
          <group key={`ov-${a.asset_id}`}>
            {fl && <FlagRing at={c} radius={ringRadius(a.kind)} color={fl.severity === 'critical' ? COLORS.red : COLORS.amber} reducedMotion={p.reducedMotion} />}
            {a.asset_id === p.selectedId && <SelectRing at={c} radius={ringRadius(a.kind)} />}
          </group>
        )
      })}

      {/* sensor markers */}
      {p.facility.sensors.filter((s) => s.asset_id && visible(s.asset_id)).map((s) => {
        const at = sPos.get(s.tag_id)
        if (!at) return null
        const r = p.readings[s.tag_id]
        const d = readingDisplay(r)
        const color = !r ? '#6f6a60' : d.tone === 'ok' ? COLORS.trim : d.tone === 'warn' ? COLORS.yellow : '#8a857a'
        return (
          <group key={s.tag_id} position={at}>
            <mesh
              onPointerOver={(e) => { e.stopPropagation(); setHoverTag(s.tag_id) }}
              onPointerOut={() => setHoverTag((h) => (h === s.tag_id ? null : h))}
              onClick={(e) => { e.stopPropagation(); setPinTag((t) => (t === s.tag_id ? null : s.tag_id)) }}
            >
              <sphereGeometry args={[variant === 'focus' ? 0.2 : 0.26, 10, 10]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={r ? 0.9 : 0.15} toneMapped={false} />
            </mesh>
          </group>
        )
      })}

      <OrbitControls ref={controls} makeDefault enableDamping={!p.reducedMotion} dampingFactor={0.08} maxPolarAngle={Math.PI * 0.47}
        minDistance={4} maxDistance={b.size * 1.6} autoRotateSpeed={0.35} />
      <CameraRig target={target} distance={distance} reducedMotion={p.reducedMotion} controls={controls}
        autoRotate={variant === 'overview' && !p.focusId && !p.selectedId} />
      <ZoomWatch onChange={setNear} threshold={b.size * 0.5} />
      <LabelProjector specs={p.ui.labelSpecs} els={p.ui.labelEls} />
      <Capture captureRef={p.captureRef} labelEls={p.ui.labelEls} />
    </>
  )
}

export default function Facility3D(p: Facility3DProps) {
  const b = bounds(p.facility)
  const variant = p.variant ?? 'overview'
  const [hover, setHover] = useState<string | null>(null)
  const [hoverTag, setHoverTag] = useState<string | null>(null)
  const [pinTag, setPinTag] = useState<string | null>(null)
  const [near, setNear] = useState(false)
  const labelSpecs = useRef<LabelSpec[]>([])
  const labelEls = useRef(new Map<string, HTMLElement>())
  const pos = useMemo(() => nodePositions(p.facility), [p.facility])
  const sPos = useMemo(() => sensorPositions(p.facility, pos), [p.facility, pos])
  const subset = useMemo(() => (variant === 'focus' && p.focusId ? neighbours(p.facility, p.focusId) : null), [variant, p.focusId, p.facility])

  // which labels to show: hover, selection, flagged, main equipment at medium zoom; everything in the focus close-up
  const specs: LabelSpec[] = []
  let flagIndex = 0
  for (const a of p.facility.assets) {
    if (subset && !subset.has(a.asset_id)) continue
    const fl = p.flagged.get(a.asset_id)
    const show = fl || a.asset_id === hover || a.asset_id === p.selectedId
      || (variant === 'focus' && a.kind !== 'pipe') || (variant === 'focus' && a.asset_id === p.focusId)
      || (near && MAIN_KINDS.has(a.kind))
    if (!show) continue
    const c = assetCenter(a, pos)
    if (!c) continue
    const sub = `${kindLabel(a.kind)}${fl ? ` · ${flagText(fl)}` : ''}`
    const lift = fl ? 1.1 + (flagIndex++ % 2) * 1.6 : 0.5
    specs.push({
      id: `a:${a.asset_id}`, pos: [c[0], heightOf(a.kind) + lift, c[2]],
      className: `scene-label${fl ? (fl.severity === 'critical' ? ' is-flag is-critical' : ' is-flag') : ''}`,
      content: fl?.note ? <>{fl.note}</> : <>{a.label}<span>{sub}</span></>, text: fl?.note ? [fl.note] : [a.label, sub],
    })
  }
  for (const j of junctions(p.facility)) {
    if (j.id !== hover) continue
    specs.push({ id: `j:${j.id}`, pos: [j.pos[0], 2.2, j.pos[2]], className: 'scene-label is-junction', content: <>{j.id}<span>graph node, not an asset</span></>, text: [j.id, 'graph node, not an asset'] })
  }
  const shownTag = hoverTag ?? pinTag
  for (const s of p.facility.sensors) {
    if (!s.asset_id || (subset && !subset.has(s.asset_id))) continue
    if (shownTag !== s.tag_id && variant !== 'focus') continue
    const at = sPos.get(s.tag_id)
    if (!at) continue
    const r = p.readings[s.tag_id]
    const d = readingDisplay(r)
    const open = shownTag === s.tag_id
    const meta = `unit ${s.unit} · quality ${r ? label(String(r.quality)).toLowerCase() : 'not available'} · asset ${s.asset_id}`
    specs.push({
      id: `t:${s.tag_id}`, pos: [at[0], at[1] + 0.45, at[2]], className: `sensor-tip${open ? ' is-open' : ''}`,
      content: <><strong>{s.tag_id}</strong><span className={`tip-val tone-${d.tone}`}>{d.text}</span>{open && <span className="tip-meta">{meta}</span>}</>,
      text: open ? [`${s.tag_id}  ${d.text}`, meta] : [`${s.tag_id}  ${d.text}`],
    })
  }
  labelSpecs.current = specs
  const register = useCallback((id: string) => (el: HTMLElement | null) => {
    if (el) labelEls.current.set(id, el)
    else labelEls.current.delete(id)
  }, [])

  const ui: UiState = { hover, setHover, hoverTag, setHoverTag, pinTag, setPinTag, near, setNear, labelSpecs, labelEls }
  return (
    <div className="f3d">
      <Canvas
        className="facility-canvas"
        shadows={!p.lowDetail}
        dpr={p.lowDetail ? 1 : [1, 1.75]}
        gl={{ antialias: !p.lowDetail, preserveDrawingBuffer: variant === 'focus' || !!p.preserve, powerPreference: 'high-performance' }}
        camera={{ fov: 38, near: 0.5, far: 800, position: [b.center[0], b.size * 0.4, b.center[2] + b.size * 0.5] }}
        onPointerMissed={() => p.onSelect(null)}
        aria-label="3D view of the simulated terminal (schematic, not to scale)"
      >
        <Scene {...p} ui={ui} />
      </Canvas>
      <div className="label-layer" aria-hidden="true">
        {specs.map((l) => (
          <div key={l.id} ref={register(l.id)} className={l.className} data-text={l.text.join('\n')} style={{ visibility: 'hidden' }}>{l.content}</div>
        ))}
      </div>
    </div>
  )
}
