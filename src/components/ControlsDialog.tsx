import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  children: ReactNode
}

/**
 * "All controls" card: scenario list, generated controls, run buttons and observed vs expected,
 * shown as a modal over the current tab. Escape or the backdrop closes it; focus is trapped while open
 * and returns to the button that opened it.
 */
export function ControlsDialog({ open, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const card = ref.current
    card?.querySelector<HTMLElement>('[data-autofocus], button, select, input')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key !== 'Tab' || !card) return
      const f = [...card.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), input:not(:disabled), [tabindex="0"]')]
      if (!f.length) return
      const first = f[0]!, last = f[f.length - 1]!
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      opener?.focus?.()
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={ref} className="modal-card glass" role="dialog" aria-modal="true" aria-labelledby="controls-dlg-h">
        <div className="modal-head">
          <div>
            <h2 id="controls-dlg-h" className="page-title">Scenarios and controls</h2>
            <p className="page-sub">Choose a scenario, set its controls (generated from the scenario data) and run it. Observed results are checked against the expected ones.</p>
          </div>
          <button type="button" className="btn btn-ghost modal-close" onClick={onClose} data-autofocus>Close</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
