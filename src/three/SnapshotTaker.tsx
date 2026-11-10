import { Suspense, useEffect, useRef } from 'react'
import type { Facility } from '../facility'
import type { SensorSample } from '../state/runState'
import { Facility3D } from './lazy'

interface Props {
  facility: Facility
  assetId: string
  flagged: Map<string, { by: string[]; severity?: string }>
  readings: Record<string, SensorSample>
  onDone: (assetId: string, dataUrl: string | null) => void
}

/**
 * Renders the focus close-up of one asset off-screen (preserveDrawingBuffer on), waits for it to settle,
 * then captures a PNG with the asset and sensor labels composited. Used for the report snapshot.
 */
export function SnapshotTaker({ facility, assetId, flagged, readings, onDone }: Props) {
  const capture = useRef<(() => string | null) | null>(null)
  const done = useRef(false)
  useEffect(() => {
    done.current = false
    const started = Date.now()
    const t = setInterval(() => {
      if (done.current) return
      const elapsed = Date.now() - started
      // wait for the scene to settle, then capture; a failed or empty capture is retried until the time limit
      if (capture.current && elapsed > 900) {
        const url = capture.current()
        if (url && url.length > 2000) {
          done.current = true
          clearInterval(t)
          onDone(assetId, url)
          return
        }
      }
      if (elapsed > 20000) {
        done.current = true
        clearInterval(t)
        onDone(assetId, null)
      }
    }, 250)
    return () => clearInterval(t)
  }, [assetId, onDone])
  return (
    <div className="snapshot-stage" aria-hidden="true">
      <Suspense fallback={null}>
        <Facility3D facility={facility} flagged={flagged} readings={readings} selectedId={null} onSelect={() => {}}
          focusId={assetId} lowDetail={false} reducedMotion variant="focus" captureRef={capture} />
      </Suspense>
    </div>
  )
}
