import { describe, expect, it } from 'vitest'
import { AGENTS } from '../src/api/mock/data'
import { buildMockRun } from '../src/api/mock/engine'
import type { RunEvent } from '../src/api/types'
import { elapsedMs, initialRunState, runReducer, topIssue } from '../src/state/runState'

const replay = (events: RunEvent[]) =>
  events.reduce((s, event) => runReducer(s, { type: 'event', event }), initialRunState(AGENTS))

describe('runReducer', () => {
  it('starts idle with every agent idle', () => {
    const s = initialRunState(AGENTS)
    expect(s.status).toBe('idle')
    expect(Object.keys(s.agents)).toHaveLength(8)
    expect(Object.values(s.agents).every((a) => a.state === 'idle')).toBe(true)
  })

  it('moves an agent from idle to running to complete', () => {
    const run = buildMockRun('r1', 'quiet_window', {})
    const events = run.events.map((t) => t.event)
    const startedIdx = events.findIndex((e) => e.type === 'agent_started')
    let s = replay(events.slice(0, startedIdx + 1))
    expect(s.status).toBe('running')
    expect(Object.values(s.agents).filter((a) => a.state === 'running')).toHaveLength(1)
    s = replay(events)
    expect(s.status).toBe('finished')
    expect(Object.values(s.agents).every((a) => a.state === 'complete')).toBe(true)
    expect(s.finalDecisionState).toBeDefined()
  })

  it('records messages in arrival order', () => {
    const events = buildMockRun('r2', 'developing_fault', {}).events.map((t) => t.event)
    const s = replay(events)
    expect(s.messages.length).toBeGreaterThan(8)
    expect(s.messages.map((m) => m.seq)).toEqual(s.messages.map((_, i) => i))
  })

  it('keeps a failing agent visible with a null report and its issue code', () => {
    const events = buildMockRun('r3', 'agent_failure', { failing_agent: 'topology_dependency', failure_mode: 'AGENT_INVALID_RESPONSE' }).events.map((t) => t.event)
    const s = replay(events)
    const a = s.agents['topology_dependency']!
    expect(a.state).toBe('rejected')
    expect(a.report).toBeNull()
    expect(a.issues[0]?.code).toBe('AGENT_INVALID_RESPONSE')
    // the pipeline carried on
    expect(s.agents['evidence_verification_decision']!.state).not.toBe('idle')
    expect(s.status).toBe('finished')
  })

  it('does not list a missing report among consumed ids', () => {
    const events = buildMockRun('r4', 'agent_failure', { failing_agent: 'anomaly_detection', failure_mode: 'AGENT_ERROR' }).events.map((t) => t.event)
    const s = replay(events)
    expect(s.agents['anomaly_detection']!.state).toBe('error')
    expect(s.agents['diagnostic_reasoning']!.consumed).not.toContain('rpt-2')
    expect(s.agents['diagnostic_reasoning']!.consumed).toHaveLength(3)
  })

  it('computes elapsed time from event timestamps only', () => {
    const s = replay(buildMockRun('r5', 'quiet_window', {}).events.map((t) => t.event))
    const a = s.agents['predictive_health']!
    expect(elapsedMs(a, s.lastTs)).toBe((a.finishedAt as number) - (a.startedAt as number))
    expect(elapsedMs(initialRunState(AGENTS).agents['predictive_health']!, 0)).toBeNull()
  })

  it('stop only affects a running run, and failure is recorded', () => {
    expect(runReducer(initialRunState(AGENTS), { type: 'stopped' }).status).toBe('idle')
    expect(runReducer(initialRunState(AGENTS), { type: 'failed', error: 'x' })).toMatchObject({ status: 'failed', error: 'x' })
  })

  it('picks the most severe issue as the top issue', () => {
    expect(topIssue([])).toBeNull()
    expect(topIssue([{ code: 'A', severity: 'info' }, { code: 'B', severity: 'error' }])?.code).toBe('B')
  })
})

describe('mock engine', () => {
  it('is deterministic and ends with run_finished', () => {
    const a = buildMockRun('x', 'developing_fault', {})
    const b = buildMockRun('x', 'developing_fault', {})
    expect(a).toEqual(b)
    expect(a.events.at(-1)?.event.type).toBe('run_finished')
    const ts = a.events.map((t) => t.at)
    expect([...ts].sort((p, q) => p - q)).toEqual(ts)
  })

  it('flags only the selected asset (plus affected downstream) in the fault scenario', () => {
    const { bundle } = buildMockRun('x', 'developing_fault', { fault_location: 'pump' })
    expect(bundle.flagged_assets.map((f) => f.asset)).toContain('pump')
    expect(bundle.flagged_assets.map((f) => f.asset)).not.toContain('terminal')
  })

  it('flags nothing in the quiet scenario and passes its checks by default', () => {
    const { bundle } = buildMockRun('x', 'quiet_window', {})
    expect(bundle.flagged_assets).toHaveLength(0)
    expect(bundle.expected_vs_observed.every((c) => c.passed)).toBe(true)
  })

  it('shows a failing check when controls move away from the expected result', () => {
    const { bundle } = buildMockRun('x', 'quiet_window', { sensor_dropout: true })
    expect(bundle.expected_vs_observed.some((c) => c.passed === false)).toBe(true)
  })

  it('keeps the conflict visible', () => {
    const { bundle } = buildMockRun('x', 'agent_conflict', {})
    expect(bundle.evidence_verification?.state).toBe('conflict_unresolved')
    expect(bundle.hypotheses.length).toBeGreaterThanOrEqual(2)
    expect(bundle.final_decision_state).toBe('more_evidence_required')
  })

  it('never authorises action or confirms equipment condition', () => {
    for (const id of ['quiet_window', 'developing_fault', 'agent_conflict', 'agent_failure']) {
      const { bundle } = buildMockRun('x', id, {})
      expect(bundle.flags.automatic_action_authorized).toBe(false)
      expect(bundle.flags.equipment_condition_confirmed).toBe(false)
      expect(bundle.flags.human_decision_required).toBe(true)
    }
  })
})

describe('begin', () => {
  it('marks the run as running before any event arrives (needed for step mode)', () => {
    const s = runReducer(initialRunState(AGENTS), { type: 'begin', scenarioId: 'quiet_window' })
    expect(s.status).toBe('running')
    expect(Object.keys(s.agents)).toHaveLength(8)
    expect(runReducer(s, { type: 'stopped' }).status).toBe('stopped')
  })
})
