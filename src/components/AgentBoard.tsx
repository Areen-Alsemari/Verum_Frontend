import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { AgentInfo } from '../api'
import { STATE_COLOR, STATE_LABEL } from '../lib/agentState'
import { formatMs } from '../lib/format'
import { elapsedMs, topIssue, type AgentRunState, type RunState } from '../state/runState'
import { AgentIcon } from './AgentIcon'
import { label } from '../lib/labels'

interface Props {
  agents: AgentInfo[]
  run: RunState
  selected: string | null
  onSelect: (role: string) => void
}

/** Dependencies per agent. Falls back to a straight chain by `order` when the API gives none. */
export function dependenciesOf(agents: AgentInfo[]): Record<string, string[]> {
  const any = agents.some((a) => a.depends_on && a.depends_on.length)
  const out: Record<string, string[]> = {}
  agents.forEach((a, i) => {
    out[a.role_key] = any ? (a.depends_on ?? []) : i > 0 ? [agents[i - 1]!.role_key] : []
  })
  return out
}

/** Column index (pipeline layer) per agent. */
export function layersOf(agents: AgentInfo[]): Record<string, number> {
  const deps = dependenciesOf(agents)
  const memo: Record<string, number> = {}
  const depth = (r: string, seen: string[] = []): number => {
    if (memo[r] !== undefined) return memo[r]!
    if (seen.includes(r)) return 0
    const d = deps[r] ?? []
    memo[r] = d.length === 0 ? 0 : 1 + Math.max(...d.map((x) => depth(x, [...seen, r])))
    return memo[r]!
  }
  agents.forEach((a) => depth(a.role_key))
  return memo
}

interface Edge { from: string; to: string; d: string }

export function AgentBoard({ agents, run, selected, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [edges, setEdges] = useState<Edge[]>([])
  const [size, setSize] = useState({ w: 0, h: 0 })

  const deps = useMemo(() => dependenciesOf(agents), [agents])
  const layers = useMemo(() => layersOf(agents), [agents])
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
        for (const up of deps[a.role_key] ?? []) {
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

  const doneUp = (role: string) => run.agents[role]?.report !== undefined && run.agents[role]?.report !== null

  return (
    <section className="panel board" aria-labelledby="board-h">
      <h2 id="board-h" className="label panel-title">Agent pipeline</h2>
      {agents.length === 0 ? (
        <p className="state-msg">No agents loaded.</p>
      ) : (
        <div className="board-wrap" ref={wrapRef}>
          <svg className="board-edges" width={size.w} height={size.h} aria-hidden="true">
            <defs>
              <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0 0L8 4L0 8z" fill="context-stroke" />
              </marker>
            </defs>
            {edges.map((e) => (
              <path key={`${e.from}-${e.to}`} d={e.d} className={`edge${doneUp(e.from) ? ' is-live' : ''}${run.agents[e.to]?.state === 'running' ? ' is-flow' : ''}`} markerEnd="url(#arrow)" />
            ))}
          </svg>
          <ol className="board-grid" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
            {columns.map((col, i) => (
              <li key={i} className="board-col">
                <ol className="board-col-list">
                  {col.map((a) => (
                    <li key={a.role_key}>
                      <AgentCard
                        info={a} st={run.agents[a.role_key]} lastTs={run.lastTs}
                        selected={selected === a.role_key}
                        refCb={(el) => { cardRefs.current[a.role_key] = el }}
                        onClick={() => onSelect(a.role_key)}
                      />
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}

function AgentCard({ info, st, lastTs, selected, refCb, onClick }: {
  info: AgentInfo; st: AgentRunState | undefined; lastTs: number; selected: boolean
  refCb: (el: HTMLButtonElement | null) => void; onClick: () => void
}) {
  const state = st?.state ?? 'idle'
  const finished = st?.report !== undefined
  const top = st ? topIssue(st.issues) : null
  const elapsed = st ? formatMs(elapsedMs(st, lastTs)) : null
  const failed = state === 'error' || state === 'rejected'
  return (
    <button
      type="button" ref={refCb} onClick={onClick}
      className={`agent-card st-${state}${selected ? ' is-selected' : ''}`}
      style={{ ['--st' as string]: STATE_COLOR[state] }}
      aria-label={`${info.order}. ${info.name}: ${STATE_LABEL[state]}${top ? `, issue: ${label(top.code)}` : ''}. Open details.`}
      aria-pressed={selected}
    >
      <span className="agent-head">
        <span className="agent-ico"><AgentIcon role={info.role_key} /></span>
        <span className="agent-name"><span className="agent-order">{info.order}</span> {info.name}</span>
      </span>
      <span className="agent-state"><span className="state-dot" aria-hidden="true" />{STATE_LABEL[state]}</span>
      <dl className="agent-facts">
        <div><dt>Time</dt><dd>{elapsed ?? '—'}</dd></div>
        <div><dt>Issues</dt><dd>{finished ? st!.issues.length : '—'}</dd></div>
      </dl>
      {top && <span className={`issue-code${failed ? ' is-fail' : ''}`} title={top.code}>{label(top.code)}</span>}
      {finished && (
        <span className="agent-consumed">
          Consumed: {st!.consumed.length ? st!.consumed.join(', ') : 'none'}
        </span>
      )}
      {state === 'rejected' || state === 'error' ? <span className="agent-null">No report</span> : null}
    </button>
  )
}
