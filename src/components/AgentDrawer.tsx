import { useEffect, useRef } from 'react'
import { STATE_COLOR, isFailure, statusText } from '../lib/agentState'
import { label } from '../lib/labels'
import type { AgentInfo, AgentRunState } from '../state/runState'
import { AgentIcon } from './AgentIcon'
import { Unknown } from './Unknown'

interface Props {
  info: AgentInfo
  st: AgentRunState | undefined
  onClose: () => void
}

export function AgentDrawer({ info, st, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const state = st?.state ?? 'idle'
  const got = state !== 'idle'
  return (
    <aside className="drawer" role="dialog" aria-modal="false" aria-labelledby="drawer-h" style={{ ['--st' as string]: STATE_COLOR[state] }}>
      <div className="drawer-head">
        <span className="agent-ico"><AgentIcon role={info.role_key} size={26} /></span>
        <div>
          <h3 id="drawer-h" className="drawer-title">{info.order}. {info.name}</h3>
          <p className="agent-state"><span className="state-dot" aria-hidden="true" />{statusText(state, st?.status)}</p>
        </div>
        <button ref={closeRef} type="button" className="btn btn-ghost drawer-close" onClick={onClose} aria-label="Close details">Close</button>
      </div>
      <dl className="drawer-list">
        <dt>Role key</dt><dd><code>{info.role_key}</code></dd>
        <dt>Window</dt><dd>{st?.windowIndex ?? <Unknown what="window" />}</dd>
        <dt>Status as received</dt><dd>{!got ? <Unknown what="status" /> : st!.status === null ? 'none (the service sent no status)' : <code>{st!.status}</code>}</dd>
        <dt>Report id</dt><dd>{st?.reportId ? <code>{st.reportId}</code> : <Unknown what="report id" />}</dd>
        <dt>Timing</dt><dd><Unknown what="timing" /></dd>
        <dt>Report text</dt><dd><Unknown what="agent report text" /></dd>
      </dl>
      <h4 className="label">Runner issue codes</h4>
      {!got && <p className="control-help">No window result yet.</p>}
      {got && st!.issueCodes.length === 0 && <p className="control-help">None reported.</p>}
      {st?.issueCodes.map((c) => (
        <div key={c} className={`issue${isFailure(state) ? ' is-fail' : ''}`}>
          <span className="issue-code">{label(c)}</span>
          <span className="issue-raw">code {c}</span>
        </div>
      ))}
      {got && isFailure(state) && <p className="null-report">No report was returned.</p>}
    </aside>
  )
}
