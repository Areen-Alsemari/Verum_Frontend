import { Component, Suspense, useMemo, useState, type ReactNode } from 'react'
import { Facility3D } from '../three/lazy'
import type { SensorSample } from '../state/runState'
import { hasWebGL, usePrefersReducedMotion } from '../lib/env'
import { Facility2D } from './Facility2D'
import { FacilityLegend } from './FacilityLegend'
import { AssetListPanel, FacilitySearch } from './FacilityPanels'
import type { Facility, FlagInfo } from './index'


export class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

export interface FacilityViewProps {
  facility: Facility
  flagged: Map<string, FlagInfo>
  readings: Record<string, SensorSample>
  selectedId: string | null
  onSelect: (id: string | null) => void
  focusId: string | null
  twoD: boolean
  onTwoD: (v: boolean) => void
  lowDetail: boolean
  onLowDetail: (v: boolean) => void
  agentName?: (role: string) => string
  /** returns the camera to the overview and drops any zoom */
  onResetView?: () => void
}

/** 3D facility (lazy) with search, legend, asset list, 2D toggle and low-detail switch. Falls back to 2D without WebGL. */
export function FacilityView(p: FacilityViewProps) {
  const reduced = usePrefersReducedMotion()
  const webgl = useMemo(() => hasWebGL(), [])
  const [listOpen, setListOpen] = useState(false)
  const use2D = p.twoD || !webgl
  const twoD = <Facility2D facility={p.facility} flagged={p.flagged} selectedId={p.selectedId} onSelect={p.onSelect} />
  return (
    <div className="facility-view">
      <div className="facility-canvas-wrap">
        {use2D ? twoD : (
          <Boundary fallback={<>{twoD}<p className="state-msg facility-note" role="status">The 3D view failed to start; showing the 2D diagram.</p></>}>
            <Suspense fallback={<p className="state-msg facility-note" role="status">Loading the 3D view…</p>}>
              <Facility3D facility={p.facility} flagged={p.flagged} readings={p.readings} selectedId={p.selectedId}
                onSelect={p.onSelect} focusId={p.focusId} lowDetail={p.lowDetail} reducedMotion={reduced} agentName={p.agentName} />
            </Suspense>
          </Boundary>
        )}
      </div>
      <div className="facility-tools glass">
        <FacilitySearch facility={p.facility} onPick={(id) => p.onSelect(id)} />
        <label className="tool-toggle">
          <input type="checkbox" checked={use2D} disabled={!webgl} onChange={(e) => p.onTwoD(e.target.checked)} /> 2D view
        </label>
        <label className="tool-toggle">
          <input type="checkbox" checked={p.lowDetail} disabled={use2D} onChange={(e) => p.onLowDetail(e.target.checked)} /> Low detail
        </label>
        <button type="button" className="btn btn-ghost tool-btn" onClick={p.onResetView} disabled={!p.onResetView || !p.focusId}>Reset view</button>
        <button type="button" className="btn btn-ghost tool-btn" aria-expanded={listOpen} aria-controls="asset-list" onClick={() => setListOpen((o) => !o)}>
          Assets and sensors
        </button>
      </div>
      {!webgl && <p className="state-msg facility-note" role="status">WebGL is not available here, so the 2D diagram is shown.</p>}
      <FacilityLegend facility={p.facility} />
      {listOpen && (
        <AssetListPanel id="asset-list" facility={p.facility} flagged={p.flagged} readings={p.readings} selectedId={p.selectedId}
          onPick={(id) => p.onSelect(id)} onClose={() => setListOpen(false)} />
      )}
    </div>
  )
}
