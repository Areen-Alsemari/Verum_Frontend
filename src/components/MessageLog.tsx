import { useEffect, useMemo, useRef, useState } from 'react'
import { EVENT_TYPES, type ServiceEvent } from '../api'
import { label } from '../lib/labels'

const TYPE_COLOR: Record<string, string> = {
  sensor_reading: 'var(--blue)', window_result: 'var(--amber-hi)', alert: 'var(--orange)', done: 'var(--champagne)',
}

/** One line per event, from the event itself. */
export function eventSummary(e: ServiceEvent): string {
  switch (e.type) {
    case 'sensor_reading': return `Window ${e.window_index}: ${e.readings?.length ?? 0} readings (as of ${e.as_of_s} s)`
    case 'window_result': {
      const n = Object.keys(e.agents ?? {}).length
      return `Window ${e.window_index}: ${n} agent statuses, decision ${e.decision?.decision_state ? label(e.decision.decision_state) : 'not available'}`
    }
    case 'alert': return `Window ${e.window_index}: ${e.message}`
    case 'done': return `Run ${e.status} after ${e.windows} windows${e.error_type ? ` (${e.error_type})` : ''}`
  }
}

interface Props { events: ServiceEvent[]; malformed: number }

/** Every event received from the stream, in arrival order. The service sends no agent-to-agent messages. */
export function MessageLog({ events, malformed }: Props) {
  const [types, setTypes] = useState<Set<string>>(new Set(EVENT_TYPES))
  const [autoScroll, setAutoScroll] = useState(true)
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle')
  const listRef = useRef<HTMLOListElement>(null)

  const shown = useMemo(() => events.filter((e) => types.has(e.type)), [events, types])
  useEffect(() => {
    if (autoScroll && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [shown.length, autoScroll])

  const toggleType = (t: string) => setTypes((cur) => { const n = new Set(cur); if (n.has(t)) n.delete(t); else n.add(t); return n })
  const toggleOpen = (seq: number) => setOpen((cur) => { const n = new Set(cur); if (n.has(seq)) n.delete(seq); else n.add(seq); return n })
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(shown, null, 2))
      setCopied('done')
    } catch {
      setCopied('failed')
    }
    setTimeout(() => setCopied('idle'), 1800)
  }

  return (
    <section className="panel log" aria-labelledby="log-h">
      <div className="log-top">
        <h2 id="log-h" className="label">Event log</h2>
        <span className="control-help" role="status">{shown.length} of {events.length} shown{malformed > 0 ? ` · ${malformed} unreadable event${malformed === 1 ? '' : 's'} skipped` : ''}</span>
      </div>
      <div className="log-tools">
        <div className="kind-filters" role="group" aria-label="Filter by event type">
          {EVENT_TYPES.map((t) => (
            <button key={t} type="button" aria-pressed={types.has(t)} className={`kind-filter${types.has(t) ? ' is-on' : ''}`}
              style={{ ['--k' as string]: TYPE_COLOR[t] }} onClick={() => toggleType(t)}>{t}</button>
          ))}
        </div>
        <button type="button" className="btn btn-ghost" aria-pressed={!autoScroll} onClick={() => setAutoScroll((a) => !a)}>{autoScroll ? 'Pause scroll' : 'Resume scroll'}</button>
        <button type="button" className="btn btn-ghost" onClick={copy} disabled={shown.length === 0}>
          {copied === 'done' ? 'Copied' : copied === 'failed' ? 'Copy failed' : 'Copy as JSON'}
        </button>
      </div>
      {events.length === 0 ? (
        <p className="state-msg">No events yet. Start a run to see its events arrive.</p>
      ) : shown.length === 0 ? (
        <p className="state-msg">No events match the current filter.</p>
      ) : (
        <ol className="log-list" ref={listRef} aria-label="Events in arrival order">
          {shown.map((e) => {
            const isOpen = open.has(e.seq)
            return (
              <li key={e.seq} className="log-row" style={{ ['--k' as string]: TYPE_COLOR[e.type] }}>
                <div className="log-line">
                  <span className="log-ts">#{e.seq}</span>
                  <span className="log-kind">{e.type}</span>
                  <span className="log-route">{e.mode}</span>
                </div>
                <p className="log-summary">{eventSummary(e)}</p>
                <button type="button" className="log-more" aria-expanded={isOpen} onClick={() => toggleOpen(e.seq)}>{isOpen ? 'Hide event' : 'Show event'}</button>
                {isOpen && <pre className="log-json">{JSON.stringify(e, null, 2)}</pre>}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
