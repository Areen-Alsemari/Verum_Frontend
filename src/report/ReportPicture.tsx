import { useEffect, useMemo, useRef, useState, Suspense, type MutableRefObject } from 'react'
import { Boundary } from '../facility/FacilityView'
import { Facility2D } from '../facility/Facility2D'
import { STATIC_FACILITY, type Facility, type FlagInfo } from '../facility'
import { hasWebGL } from '../lib/env'
import { Facility3D } from '../three/lazy'

interface Props {
  assetId: string | null
  caption: string
  /** the label drawn on the highlighted asset */
  label: string | null
  facility?: Facility
}

/**
 * A picture of the facility for the report: the 3D view, taken once as an image so it prints, with the suspected asset
 * highlighted and labelled. Without WebGL, or if the snapshot cannot be made, a 2D plan is drawn instead.
 */
export function ReportPicture({ assetId, caption, label, facility = STATIC_FACILITY }: Props) {
  const webgl = useMemo(() => hasWebGL(), [])
  const capture = useRef<(() => string | null) | null>(null)
  const [img, setImg] = useState<string | null>(null)
  const [gaveUp, setGaveUp] = useState(false)
  const flagged = useMemo(() => new Map<string, FlagInfo>(assetId && label ? [[assetId, { by: [], note: label }]] : []), [assetId, label])
  useEffect(() => {
    if (!webgl || img) return
    let n = 0
    const id = setInterval(() => {
      n += 1
      const url = n >= 7 ? capture.current?.() : null
      if (url) { setImg(url); clearInterval(id) } else if (n > 40) { setGaveUp(true); clearInterval(id) }
    }, 300)
    return () => clearInterval(id)
  }, [webgl, img])
  const plan = <div className="rp-asset-2d"><Facility2D facility={facility} flagged={flagged} selectedId={null} onSelect={() => {}} interactive={false} /></div>
  return (
    <figure className="rp-picture">
      {img ? <img src={img} alt={assetId ? `Facility with ${assetId} highlighted` : 'Facility'} />
        : !webgl || gaveUp ? plan
        : (
          <>
            <p className="control-help" role="status">Preparing the picture…</p>
            <div className="snapshot-stage" aria-hidden="true">
              <Boundary fallback={null}>
                <Suspense fallback={null}>
                  <Facility3D facility={facility} flagged={flagged} readings={{}} selectedId={null} onSelect={() => {}} focusId={assetId}
                    lowDetail={false} reducedMotion preserve captureRef={capture as MutableRefObject<(() => string | null) | null>} />
                </Suspense>
              </Boundary>
            </div>
          </>
        )}
      <figcaption className="rp-caption">{caption}</figcaption>
    </figure>
  )
}
