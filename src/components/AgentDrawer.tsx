import { useEffect, useRef } from 'react'
import type { AgentInfo } from '../api'
import { STATE_COLOR, STATE_LABEL } from '../lib/agentState'
import { formatMs } from '../lib/format'
import { elapsedMs, type AgentRunState } from '../state/runState'
import { AgentIcon } from './AgentIcon'
import { Unknown } from './Unknown'

interface Props {
  info: AgentInfo
  st: AgentRunState | undefined
  lastTs: number
  agentsByKey: Record<string, AgentInfo>
  onClose: () => void
}

export function AgentDrawer({ info, st, lastTs, agentsByKey, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const state = st?.state ?? 'idle'
  const finished = st?.report !== undefined
  return (
    <aside className="drawer" role="dialog" aria-modal="false" aria-labelledby="drawer-h" style={{ ['--st' as string]: STATE_COLOR[state] }}>
      <div className="drawer-head">
        <span className="agent-ico"><AgentIcon role={info.role_key} size={26} /></span>
        <div>
          <h3 id="drawer-h" className="drawer-title">{info.order}. {info.name}</h3>
          <p className="agent-state"><span className="state-dot" aria-hidden="true" />{STATE_LABEL[state]}</p>
        </div>
        <button ref={closeRef} type="button" className="btn btn-ghost drawer-close" onClick={onClose} aria-label="Close details">Close</button>
      </div>
      <p className="control-help">{info.description}</p>
      <dl className="drawer-list">
        <dt>Role key</dt><dd><code>{info.role_key}</code></dd>
        <dt>Time</dt><dd>{(st && formatMs(elapsedMs(st, lastTs))) ?? <Unknown what="elapsed time" />}</dd>
        <dt>Reads reports from</dt>
        <dd>{(info.depends_on ?? []).length ? info.depends_on!.map((k) => agentsByKey[k]?.name ?? k).join(', ') : 'nothing (first stage)'}</dd>
      </dl>

      <h4 className="label">Report summary</h4>
      {!finished && <p className="control-help">Not finished yet.</p>}
      {finished && st!.report === null && <p className="null-report">No report was returned (null).</p>}
      {finished && st!.report !== null && <p className="drawer-text">{st!.report}</p>}

      <h4 className="label">Flagged assets</h4>
      {!finished ? <p className="control-help">Not finished yet.</p>
        : st!.flagged === undefined ? <p><Unknown what="flagged assets" /></p>
        : st!.flagged.length === 0 ? <p className="control-help">None.</p>
        : <p className="chips">{st!.flagged.map((id) => <code key={id} className="chip">{id}</code>)}</p>}

      <h4 className="label">Issues</h4>
      {!finished && <p className="control-help">Not finished yet.</p>}
      {finished && st!.issues.length === 0 && <p className="control-help">None reported.</p>}
      {st?.issues.map((i, k) => (
        <div key={k} className={`issue${st.state === 'error' || st.state === 'rejected' ? ' is-fail' : ''}`}>
          <code className="issue-code">{i.code}</code>
          {i.severity && <span className="issue-sev">{i.severity}</span>}
          {i.message && <p>{i.message}</p>}
        </div>
      ))}

      <h4 className="label">Consumed reports</h4>
      {!finished && <p className="control-help">Not finished yet.</p>}
      {finished && (st!.consumed.length === 0
        ? <p className="control-help">None.</p>
        : <p className="chips">{st!.consumed.map((id) => <code key={id} className="chip">{id}</code>)}</p>)}
    </aside>
  )
}
