import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ServiceEvent } from '../src/api'
import { AgentBoard } from '../src/components/AgentBoard'
import { QUIET_WINDOW_NOTE, isQuietWindow } from '../src/lib/briefing'
import { agentList, initialRunState, runReducer, type RunState } from '../src/state/runState'

const base = { run_id: 'R-1', mode: 'replay', time_compression: { factor: 60, note: 'n' }, data: 'synthetic' }
const agents = {
  anomaly_detection: { status: 'complete', report_id: 'a', runner_issue_codes: [] },
  diagnostic_reasoning: { status: 'degraded', report_id: 'd', runner_issue_codes: [] },
}
const result = (seq: number, window: number, persistence: unknown) =>
  ({ ...base, type: 'window_result', seq, window_index: window, as_of_s: window * 300, agents, decision: null, persistence, runner_note_codes: [] }) as unknown as ServiceEvent
const alert = (seq: number, window: number) =>
  ({ ...base, type: 'alert', seq, window_index: window, as_of_s: window * 300, source: 'anomaly_detection', rule: { k: 2, n: 3, threshold: 1 }, windows_exceeding: 2, windows_held: 3, message: 'm' }) as unknown as ServiceEvent
const pers = (alarming: boolean | null) => ({ rule: { k: 2, n: 3, threshold: 1 }, windows_held: 3, windows_exceeding: alarming ? 2 : 0, windows_unknown: 0, alarming })
const feed = (...events: ServiceEvent[]): RunState => events.reduce((s, event) => runReducer(s, { type: 'event', event }), initialRunState())

describe('quiet window note', () => {
  it('shows when the persistence rule is settled as not fired and no alert came', () => {
    const run = feed(result(0, 3, pers(false)))
    expect(isQuietWindow(run)).toBe(true)
    render(<AgentBoard agents={agentList(run)} run={run} selected={null} onSelect={() => {}} />)
    expect(screen.getByRole('note')).toHaveTextContent(QUIET_WINDOW_NOTE)
  })

  it('does not change any agent status', () => {
    const run = feed(result(0, 3, pers(false)))
    render(<AgentBoard agents={agentList(run)} run={run} selected={null} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: /Anomaly Detection: Complete/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Diagnostic Reasoning: Degraded/ })).toBeInTheDocument()
    expect(run.agents.diagnostic_reasoning!.status).toBe('degraded')
  })

  it('shows nothing extra when an alert is active', () => {
    const run = feed(result(0, 3, pers(true)), alert(1, 3))
    expect(isQuietWindow(run)).toBe(false)
    render(<AgentBoard agents={agentList(run)} run={run} selected={null} onSelect={() => {}} />)
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('shows nothing if an alert event exists for the window even when persistence says false', () => {
    expect(isQuietWindow(feed(result(0, 3, pers(false)), alert(1, 3)))).toBe(false)
  })

  it('shows nothing for missing or unsettled data, and does not crash', () => {
    for (const p of [null, undefined, pers(null), {}, { alarming: 'x' }]) {
      const run = feed(result(0, 1, p))
      expect(isQuietWindow(run)).toBe(false)
      const { container } = render(<AgentBoard agents={agentList(run)} run={run} selected={null} onSelect={() => {}} />)
      expect(container.querySelector('.quiet-note')).toBeNull()
    }
    const empty = initialRunState()
    expect(isQuietWindow(empty)).toBe(false)
    render(<AgentBoard agents={agentList(empty)} run={empty} selected={null} onSelect={() => {}} />)
  })

  it('follows the latest window: a later alert window removes the note', () => {
    expect(isQuietWindow(feed(result(0, 1, pers(false)), result(1, 2, pers(true)), alert(2, 2)))).toBe(false)
  })
})
