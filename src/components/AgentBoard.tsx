import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ARCHITECTURE, layersOf } from '../lib/architecture'
import { STATE_COLOR, isFailure, statusText } from '../lib/agentState'
import { label } from '../lib/labels'
import type { AgentInfo, AgentRunState, RunState } from '../state/runState'
import { AgentIcon } from './AgentIcon'
import { QuietNote } from './QuietNote'
import { Unknown } from './Unknown'

interface Props {
  agents: AgentInfo[]
  run: RunState
  selected: string | null
  onSelect: (role: string) => void
}

interface Edge { from: string; to: string; d: string }

/**
 * Static architecture diagram of the agent chain. The edges are the documented design, not data from the run:
 * they never change with the run. Each node shows the agent's status in the latest window, exactly as received.
 */
export function AgentBoard({ agents, run, selected, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [edges, setEdges] = useState<Edge[]>([])
  const [size, setSize] = useState({ w: 0, h: 0 })
  const roles = useMemo(() => agents.map((a) => a.role_key), [agents])
  const layers = useMemo(() => layersOf(roles), [roles])
  const columns = useMemo(() => {
    const n = Math.max(0, ...Object.values(layers)) + 1
    return Array.from({ length: n }, (_, i) => agents.filter((a) => layers[a.role_key] === i))
  }, [agents, layers])

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const compute = () => {
      const base = wrap.getBoundingClientRect()
      const next: Edge[] = []
      for (const a of agents) {
        for (const up of (ARCHITECTURE[a.role_key] ?? []).filter((x) => roles.includes(x))) {
          const f = cardRefs.current[up]?.getBoundingClientRect()
          const t = cardRefs.current[a.role_key]?.getBoundingClientRect()
          if (!f || !t) continue
          const x1 = f.right - base.left, y1 = f.top + f.height / 2 - base.top
          const x2 = t.left - base.left - 3, y2 = t.top + t.height / 2 - base.top
          const dx = Math.max(24, (x2 - x1) / 2)
          next.push({ from: up, to: a.role_key, d: `M${x1} ${y1} C${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}` })
        }
      }
      setSize((s) => (s.w === base.width && s.h === base.height ? s : { w: base.width, h: base.height }))
      setEdges((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(wrap)
    return () => ro.disconnect()
  })

  return (
    <section className="panel board" aria-labelledby="board-h">
      <div className="panel-head">
        <h2 id="board-h" className="label panel-title">Agent pipeline{run.windowIndex !== null && <span className="control-help"> · status from window {run.windowIndex}</span>}</h2>
        <span className="pill" title="The arrows are the documented design, not data from this run">architecture</span>
      </div>
      <QuietNote run={run} />
      <div className="board-wrap" ref={wrapRef}>
        <svg className="board-edges" width={size.w} height={size.h} aria-hidden="true">
          <defs>
            <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0L8 4L0 8z" fill="context-stroke" />
            </marker>
          </defs>
          {edges.map((e) => <path key={`${e.from}-${e.to}`} d={e.d} className="edge" markerEnd="url(#arrow)" />)}
        </svg>
        <ol className="board-grid" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
          {columns.map((col, i) => (
            <li key={i} className="board-col">
              <ol className="board-col-list">
                {col.map((a) => (
                  <li key={a.role_key}>
                    <AgentCard info={a} st={run.agents[a.role_key]} selected={selected === a.role_key}
                      refCb={(el) => { cardRefs.current[a.role_key] = el }} onClick={() => onSelect(a.role_key)} />
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      </div>
      <p className="control-help">Arrows show the documented chain (which agent reads which reports). They do not show what was exchanged in this run. Timing and per-agent report text are not available from the service.</p>
    </section>
  )
}

function AgentCard({ info, st, selected, refCb, onClick }: { info: AgentInfo; st: AgentRunState | undefined; selected: boolean; refCb: (el: HTMLButtonElement | null) => void; onClick: () => void }) {
  const state = st?.state ?? 'idle'
  const text = statusText(state, st?.status)
  const fail = isFailure(state)
  return (
    <button
      type="button" ref={refCb} onClick={onClick}
      className={`agent-card st-${state}${selected ? ' is-selected' : ''}`}
      style={{ ['--st' as string]: STATE_COLOR[state] }}
      aria-label={`${info.order}. ${info.name}: ${text}${st?.issueCodes[0] ? `, issue: ${label(st.issueCodes[0])}` : ''}. Open details.`}
      aria-pressed={selected}
    >
      <span className="agent-head">
        <span className="agent-ico"><AgentIcon role={info.role_key} /></span>
        <span className="agent-name"><span className="agent-order">{info.order}</span> {info.name}</span>
      </span>
      <span className="agent-state"><span className="state-dot" aria-hidden="true" />{text}</span>
      <dl className="agent-facts">
        <div><dt>Issue codes</dt><dd>{st && st.state !== 'idle' ? st.issueCodes.length : '—'}</dd></div>
        <div><dt>Report id</dt><dd>{st?.reportId ? <code title={st.reportId}>{st.reportId}</code> : st && st.state !== 'idle' ? <Unknown what="report id" /> : '—'}</dd></div>
      </dl>
      {st?.issueCodes[0] && <span className={`issue-code${fail ? ' is-fail' : ''}`} title={st.issueCodes[0]}>{label(st.issueCodes[0])}</span>}
      {fail && <span className="agent-null">No report</span>}
    </button>
  )
}
