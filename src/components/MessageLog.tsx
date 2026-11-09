import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentInfo, MessageKind } from '../api'
import { formatTs } from '../lib/format'
import type { LoggedMessage } from '../state/runState'

const KINDS: MessageKind[] = ['request', 'response', 'attachment', 'issue']
const KIND_COLOR: Record<MessageKind, string> = {
  request: 'var(--blue)', response: 'var(--amber-hi)', attachment: 'var(--champagne)', issue: 'var(--orange)',
}

interface Props { messages: LoggedMessage[]; agents: AgentInfo[] }

export function MessageLog({ messages, agents }: Props) {
  const [agentFilter, setAgentFilter] = useState('all')
  const [kinds, setKinds] = useState<Set<MessageKind>>(new Set(KINDS))
  const [autoScroll, setAutoScroll] = useState(true)
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle')
  const listRef = useRef<HTMLOListElement>(null)

  const nameOf = useMemo(() => {
    const m: Record<string, string> = { runner: 'Runner' }
    for (const a of agents) m[a.role_key] = `${a.order}. ${a.name}`
    return m
  }, [agents])

  const shown = useMemo(
    () => messages.filter((m) => kinds.has(m.kind) && (agentFilter === 'all' || m.from === agentFilter || m.to === agentFilter)),
    [messages, kinds, agentFilter],
  )

  useEffect(() => {
    if (autoScroll && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [shown.length, autoScroll])

  const toggleKind = (k: MessageKind) =>
    setKinds((cur) => { const n = new Set(cur); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const toggleOpen = (seq: number) =>
    setOpen((cur) => { const n = new Set(cur); if (n.has(seq)) n.delete(seq); else n.add(seq); return n })

  const copy = async () => {
    const text = JSON.stringify(shown.map((m) => ({ ts: m.ts, from: m.from, to: m.to, kind: m.kind, summary: m.summary, payload: m.payload })), null, 2)
    try {
      await navigator.clipboard.writeText(text)
      setCopied('done')
    } catch {
      setCopied('failed')
    }
    setTimeout(() => setCopied('idle'), 1800)
  }

  return (
    <section className="panel log" aria-labelledby="log-h">
      <div className="log-top">
        <h2 id="log-h" className="label">Message log</h2>
        <span className="control-help" role="status">{shown.length} of {messages.length} shown</span>
      </div>
      <div className="log-tools">
        <label className="log-field">
          <span className="sr-only">Filter by agent</span>
          <select className="select" value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} aria-label="Filter by agent">
            <option value="all">All agents and runner</option>
            <option value="runner">Runner</option>
            {agents.map((a) => <option key={a.role_key} value={a.role_key}>{a.order}. {a.name}</option>)}
          </select>
        </label>
        <div className="kind-filters" role="group" aria-label="Filter by message kind">
          {KINDS.map((k) => (
            <button key={k} type="button" aria-pressed={kinds.has(k)} className={`kind-filter${kinds.has(k) ? ' is-on' : ''}`}
              style={{ ['--k' as string]: KIND_COLOR[k] }} onClick={() => toggleKind(k)}>{k}</button>
          ))}
        </div>
        <button type="button" className="btn btn-ghost" aria-pressed={!autoScroll} onClick={() => setAutoScroll((a) => !a)}>
          {autoScroll ? 'Pause scroll' : 'Resume scroll'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={copy} disabled={shown.length === 0}>
          {copied === 'done' ? 'Copied' : copied === 'failed' ? 'Copy failed' : 'Copy as JSON'}
        </button>
      </div>
      {messages.length === 0 ? (
        <p className="state-msg">No messages yet. Start a run to see the runner and agents talk.</p>
      ) : shown.length === 0 ? (
        <p className="state-msg">No messages match the current filters.</p>
      ) : (
        <ol className="log-list" ref={listRef} aria-label="Messages in arrival order">
          {shown.map((m) => {
            const isOpen = open.has(m.seq)
            const failIssue = m.kind === 'issue' && (m.payload as { severity?: string } | null)?.severity === 'error'
            return (
              <li key={m.seq} className={`log-row${failIssue ? ' is-fail' : ''}`} style={{ ['--k' as string]: failIssue ? 'var(--red)' : KIND_COLOR[m.kind] }}>
                <div className="log-line">
                  <span className="log-ts">{formatTs(m.ts)}</span>
                  <span className="log-kind">{m.kind}</span>
                  <span className="log-route">{nameOf[m.from] ?? m.from} <span aria-label="to">→</span> {nameOf[m.to] ?? m.to}</span>
                </div>
                <p className="log-summary">{m.summary}</p>
                <button type="button" className="log-more" aria-expanded={isOpen} onClick={() => toggleOpen(m.seq)}>
                  {isOpen ? 'Hide payload' : 'Show payload'}
                </button>
                {isOpen && <pre className="log-json">{m.payload === undefined ? 'undefined' : JSON.stringify(m.payload, null, 2)}</pre>}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
