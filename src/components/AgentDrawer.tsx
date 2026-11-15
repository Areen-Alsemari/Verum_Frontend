import { useEffect, useRef } from 'react'
import { AGENT_DESCRIPTION, agentDisplay, contributionFor } from '../lib/agents'
import { label } from '../lib/labels'
import type { AgentInfo, RunState } from '../state/runState'
import { AgentFigure } from './AgentCard'
import { Unknown } from './Unknown'

interface Props {
  info: AgentInfo
  run: RunState
  onClose: () => void
  /** developer view: raw status, ids and issue codes */
  dev?: boolean
}

export function AgentDrawer({ info, run, onClose, dev = false }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const st = run.agents[info.role_key]
  const d = agentDisplay(st, run)
  const note = contributionFor(info.role_key, run.report, run.windowIndex)
  return (
    <aside className="drawer" role="dialog" aria-modal="false" aria-labelledby="drawer-h" style={{ ['--st' as string]: d.color }}>
      <div className="drawer-head">
        <AgentFigure order={info.order} role={info.role_key} size={72} />
        <div>
          <h3 id="drawer-h" className="drawer-title">{info.name}</h3>
          <p className="agent-state"><span className="state-dot" aria-hidden="true" />{d.text}</p>
        </div>
        <button ref={closeRef} type="button" className="btn btn-ghost drawer-close" onClick={onClose} aria-label="Close details">Close</button>
      </div>
      <p className="control-help">{AGENT_DESCRIPTION[info.role_key]}</p>
      {note && <p className="drawer-note">{note}</p>}
      {d.reason && <p className="control-help">{d.reason}</p>}
      {dev && (
        <>
          <h4 className="label">Developer view</h4>
          <dl className="drawer-list">
            <dt>Role key</dt><dd><code>{info.role_key}</code></dd>
            <dt>Window</dt><dd>{st?.windowIndex ?? <Unknown what="window" />}</dd>
            <dt>Status as received</dt><dd>{!st || st.state === 'idle' ? <Unknown what="status" /> : st.status === null ? 'none (the service sent no status)' : <code>{st.status}</code>}</dd>
            <dt>Report id</dt><dd>{st?.reportId ? <code>{st.reportId}</code> : <Unknown what="report id" />}</dd>
            <dt>Issue codes</dt><dd>{st?.issueCodes.length ? st.issueCodes.map((c) => <code key={c} title={label(c)}>{c} </code>) : 'none'}</dd>
          </dl>
        </>
      )}
    </aside>
  )
}
