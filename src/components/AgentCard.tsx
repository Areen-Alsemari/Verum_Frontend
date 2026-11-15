import { useState } from 'react'
import { AGENT_DESCRIPTION, agentDisplay, agentImage, contributionFor } from '../lib/agents'
import type { AgentInfo, RunState } from '../state/runState'
import { AgentIcon } from './AgentIcon'

interface Props {
  info: AgentInfo
  run: RunState
  size?: 'small' | 'large'
  selected?: boolean
  onClick?: () => void
  refCb?: (el: HTMLButtonElement | null) => void
}

/** The agent character. Falls back to the line icon when there is no image or it does not load. */
export function AgentFigure({ order, role, size }: { order: number; role: string; size: number }) {
  const src = agentImage(order)
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <span className="agent-figure is-icon" style={{ width: size, height: size }}><AgentIcon role={role} size={Math.round(size * 0.55)} /></span>
  return <img className="agent-figure" src={src} alt="" width={size} height={size} onError={() => setFailed(true)} />
}

/** One agent: character, full name, one-line description, state and, when the report has one, what it contributed. */
export function AgentCard({ info, run, size = 'small', selected = false, onClick, refCb }: Props) {
  const st = run.agents[info.role_key]
  const d = agentDisplay(st, run)
  const win = run.windowIndex
  const note = contributionFor(info.role_key, run.report, win)
  return (
    <button
      type="button" ref={refCb} onClick={onClick} title={d.reason ?? undefined}
      className={`agent-card2 is-${size}${selected ? ' is-selected' : ''} st2-${d.state}`}
      style={{ ['--st' as string]: d.color }}
      aria-label={`${info.order}. ${info.name}: ${d.text}`}
      aria-pressed={onClick ? selected : undefined}
    >
      <span className="agent-card2-top">
        <AgentFigure order={info.order} role={info.role_key} size={size === 'large' ? 120 : 64} />
        <span className="agent-card2-id">
          <span className="agent-card2-name">{info.name}</span>
          <span className="agent-card2-state"><span className="state-dot" aria-hidden="true" />{d.text}</span>
        </span>
      </span>
      <span className="agent-card2-desc">{AGENT_DESCRIPTION[info.role_key] ?? ''}</span>
      {note && <span className="agent-card2-note">{note}</span>}
    </button>
  )
}
