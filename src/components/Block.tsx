import type { ReactNode } from 'react'
import type { ReportState } from '../state/runState'

export function Block({ title, tag, children, className }: { title: string; tag?: string; children: ReactNode; className?: string }) {
  const id = `blk-${title.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <section className={`panel result-block${className ? ` ${className}` : ''}`} aria-labelledby={id}>
      <h3 id={id} className="label panel-title">{title}{tag && <span className="tag-advisory">{tag}</span>}</h3>
      {children}
    </section>
  )
}

export function Ids({ ids }: { ids: string[] }) {
  return ids.length ? <span className="chips">{ids.map((i) => <code key={i} className="chip">{i}</code>)}</span> : <span className="control-help">none</span>
}

/** Message for every report state except "ok"; null when the report is available. */
export function reportNotice(r: ReportState, onRetry?: () => void): ReactNode {
  switch (r.state) {
    case 'ok': return null
    case 'idle': return <p className="state-msg" role="status">No run yet. The report is requested after a run is done.</p>
    case 'waiting': return <p className="state-msg" role="status">The report is requested once the run is done.</p>
    case 'loading': return <p className="state-msg" role="status">Loading the report…</p>
    case 'pending':
      return <p className="state-msg" role="status">The service says the run has not finished yet, so there is no report. {onRetry && <button type="button" className="btn btn-ghost" onClick={onRetry}>Try again</button>}</p>
    case 'error':
      return <p className="state-msg state-error" role="alert">The report could not be loaded. {r.message} {onRetry && <button type="button" className="btn btn-ghost" onClick={onRetry}>Try again</button>}</p>
  }
}
