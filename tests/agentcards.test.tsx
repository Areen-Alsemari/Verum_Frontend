import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { MaintenanceReport, ServiceEvent } from '../src/api'
import { AgentBoard } from '../src/components/AgentBoard'
import { AgentCard, AgentFigure } from '../src/components/AgentCard'
import { WorkflowStrip } from '../src/command/WorkflowStrip'
import { agentImage, contributionFor } from '../src/lib/agents'
import { agentList, initialRunState, runReducer, type RunState } from '../src/state/runState'

const base = { run_id: 'R-1', mode: 'replay', time_compression: { factor: 60, note: 'n' }, data: 'synthetic' }
const KEYS = ['predictive_health', 'anomaly_detection', 'topology_dependency', 'historical_asset_intelligence', 'diagnostic_reasoning', 'inspection_planning', 'inspection_quality_documentation', 'evidence_verification_decision']
const wr = (statuses: (string | null)[], codes: Record<string, string[]> = {}) =>
  ({ ...base, type: 'window_result', seq: 0, window_index: 10, as_of_s: 3000, decision: null, persistence: null, runner_note_codes: [],
    agents: Object.fromEntries(KEYS.map((k, i) => [k, { status: statuses[i], report_id: `r${i}`, runner_issue_codes: codes[k] ?? [] }])) }) as unknown as ServiceEvent
const STATUSES = ['complete', 'complete', 'complete', 'degraded', 'degraded', 'degraded', 'degraded', 'insufficient_evidence']
const run = (codes = {}): RunState => ({ ...runReducer(initialRunState(), { type: 'event', event: wr(STATUSES, codes) }), status: 'finished' })

const PUMP = 'Unconfirmed hypothesis: pump (asset=P-101A, tag=None); score: decision_score=0.999648, method=m, calibration=None'
const report: MaintenanceReport = {
  report_id: 'r', source_reports: [{ report_id: 'dx-1', agent: 'diagnostic_reasoning' }, { report_id: 'ip-1', agent: 'inspection_planning' }, { report_id: 'ev-1', agent: 'evidence_verification_decision' }],
  findings: [
    { finding_id: 'h1', kind: 'hypothesis', statement: PUMP, source_report_id: 'dx-1', evidence_ids: [] },
    { finding_id: 'a1', kind: 'assessment', statement: 'Review required: flows departed from usual relations in at least 2 of the last 3 windows; more. Equipment condition is not confirmed.', source_report_id: 'ev-1', evidence_ids: [] },
  ],
  inspection_options: [{ action_id: 'ACT-1', target_asset: 'P-101A', feasibility: 'unknown', source_report_id: 'ip-1', evidence_ids: [] }],
  missing_information: [], limitations: [],
}

describe('agent cards', () => {
  it('show the full agent name and a one-line description, never truncated', () => {
    const r = run()
    render(<WorkflowStrip agents={agentList(r)} run={r} selected={null} onSelect={() => {}} readings={4} />)
    for (const n of ['Historical Asset Intelligence', 'Inspection Quality & Documentation', 'Evidence Verification & Decision', 'Topology & Dependency']) expect(screen.getByText(n)).toBeInTheDocument()
    expect(screen.getByText('Ranks the possible causes.')).toBeInTheDocument()
    expect(screen.getByText(/Plant sensors · 4 readings received/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/Sensor stream|synthetic|sensor events/)
  })
  it('say Done, Done limited data, Needs more data, and never Complete for a limited agent; no "Reason not reported"', () => {
    const r = run()
    const { container } = render(<WorkflowStrip agents={agentList(r)} run={r} selected={null} onSelect={() => {}} />)
    const states = [...container.querySelectorAll('.agent-card2-state')].map((e) => e.textContent)
    expect(states).toEqual(['Done', 'Done', 'Done', 'Done, limited data', 'Done, limited data', 'Done, limited data', 'Done, limited data', 'Needs more data'])
    expect(container.textContent).not.toMatch(/Complete|Reason not reported|not reported/)
  })
  it('show the service reason on hover only when the service gave one', () => {
    const r = run({ historical_asset_intelligence: ['NO_HISTORY_SUPPLIED'] })
    const { container } = render(<WorkflowStrip agents={agentList(r)} run={r} selected={null} onSelect={() => {}} />)
    const cards = [...container.querySelectorAll<HTMLElement>('.agent-card2')]
    expect(cards[3]!.getAttribute('title')).toBe('No earlier history was supplied')
    expect(cards[4]!.getAttribute('title')).toBeNull()
  })
  it('show working while the run goes on and an agent has no result yet', () => {
    const r = { ...initialRunState(), status: 'running' as const }
    const { container } = render(<WorkflowStrip agents={agentList({ ...r, agentOrder: KEYS })} run={r} selected={null} onSelect={() => {}} />)
    expect(container.querySelectorAll('.st2-working').length).toBe(8)
  })
  it('use the same cards on the Agents page, with the character larger and no architecture caption', () => {
    const r = run()
    const { container } = render(<AgentBoard agents={agentList(r)} run={r} selected={null} onSelect={() => {}} />)
    expect(container.querySelectorAll('.agent-card2.is-large')).toHaveLength(8)
    expect(container.textContent).not.toMatch(/documented chain|Timing and per-agent/)
  })
  it('show what an agent contributed only when the report holds something attributable to it', () => {
    const rep = { state: 'ok' as const, window: 10, windowsAvailable: [10], report }
    expect(contributionFor('diagnostic_reasoning', rep, 10)).toBe('Ranked pump P-101A (pump fault) as the top candidate.')
    expect(contributionFor('inspection_planning', rep, 10)).toBe('Suggested 1 check: pump P-101A.')
    expect(contributionFor('evidence_verification_decision', rep, 10)).toBe('Review required: flows departed from usual relations in at least 2 of the last 3 windows.')
    expect(contributionFor('predictive_health', rep, 10)).toBeNull()
    expect(contributionFor('diagnostic_reasoning', rep, 7)).toBeNull()
    expect(contributionFor('diagnostic_reasoning', { state: 'waiting' }, 10)).toBeNull()
  })
  it('fall back to the line icon when an image is missing or does not load', () => {
    expect(agentImage(1)).toBeTruthy()
    expect(agentImage(9)).toBeNull()
    const { container, unmount } = render(<AgentFigure order={9} role="predictive_health" size={64} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
    unmount()
    const again = render(<AgentFigure order={1} role="predictive_health" size={64} />)
    const img = again.container.querySelector('img')!
    expect(img).toBeInTheDocument()
    fireEvent.error(img)
    expect(again.container.querySelector('svg')).toBeInTheDocument()
  })
  it('the card is one button with the agent number and name', () => {
    const r = run()
    render(<AgentCard info={agentList(r)[4]!} run={r} />)
    expect(screen.getByRole('button', { name: '5. Diagnostic Reasoning: Done, limited data' })).toBeInTheDocument()
  })
})
