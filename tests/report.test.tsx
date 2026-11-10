import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AGENTS, SCENARIOS } from '../src/api/mock/data'
import { buildMockRun } from '../src/api/mock/engine'
import { buildMockReport } from '../src/api/mock/report'
import type { MaintenanceReport } from '../src/api'
import { STATIC_FACILITY as F } from '../src/facility'
import { FORBIDDEN, buildReportModel, type ReportInput } from '../src/report/model'
import { ReportCard } from '../src/report/ReportCard'
import { initialRunState, runReducer, type RunState } from '../src/state/runState'

function runFor(id: string, controls = {}, report: 'mock' | 'none' | MaintenanceReport = 'mock'): RunState {
  const m = buildMockRun('t', id, controls)
  let s = initialRunState(AGENTS)
  for (const e of m.events) s = runReducer(s, { type: 'event', event: e.event })
  s = runReducer(s, { type: 'bundle', bundle: m.bundle })
  return runReducer(s, { type: 'report', report: report === 'mock' ? buildMockReport('t', m) : report === 'none' ? null : report })
}
const input = (run: RunState, extra: Partial<ReportInput> = {}): ReportInput =>
  ({ run, agents: AGENTS, scenario: SCENARIOS.find((s) => s.id === run.scenarioId), facility: F, snapshots: {}, source: 'mock', ...extra })

/** UI wording only: API-provided text is wrapped in [data-api] and removed before checking. */
function uiText(el: HTMLElement): string {
  const c = el.cloneNode(true) as HTMLElement
  c.querySelectorAll('[data-api], code').forEach((n) => n.remove())
  return c.textContent ?? ''
}

describe('report model builder', () => {
  it('has the sections in the required order', () => {
    render(<ReportCard model={buildReportModel(input(runFor('developing_fault')))} facility={F} />)
    const heads = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent?.replace(/^\d+/, '').replace(/Advisory|Unconfirmed/, '').trim())
    expect(heads).toEqual(['Summary', 'Affected assets', 'Observations', 'Hypotheses', 'Inspection options for the inspector to consider',
      'What is unknown or missing', 'Human decision', 'Traceability appendix', 'Limitations'])
    expect(screen.getByRole('note')).toHaveTextContent('Simulated data, advisory only')
  })

  it('never uses recommended, approved, confirmed, healthy or "no action needed" in its own wording', () => {
    for (const s of SCENARIOS) {
      const { container, unmount } = render(<ReportCard model={buildReportModel(input(runFor(s.id)))} facility={F} />)
      expect(uiText(container)).not.toMatch(FORBIDDEN)
      unmount()
    }
  })

  it('shows API text as given, even when it contains such a word', () => {
    const run = runFor('developing_fault')
    const report = { ...run.report!, limitations: ['Vendor wording: recommended interval not verified'] }
    render(<ReportCard model={buildReportModel(input({ ...run, report }))} facility={F} />)
    expect(screen.getByText(/recommended interval not verified/)).toBeInTheDocument()
  })

  it('shows unknown for everything the backend did not provide (older backend without a report)', () => {
    const m = buildReportModel(input(runFor('developing_fault', {}, 'none')))
    expect(m.header).toMatchObject({ reportId: null, analysisId: null, asOfS: null, assessmentState: null })
    expect(m.limitations).toBeNull()
    expect(m.unknowns.some((u) => /did not provide a maintenance report/.test(u.text))).toBe(true)
    const { container } = render(<ReportCard model={m} facility={F} />)
    const meta = container.querySelector('.rp-meta') as HTMLElement
    expect(within(meta).getAllByText('unknown').length).toBeGreaterThanOrEqual(5)
    expect(meta.textContent).not.toMatch(/\b0\b/)
  })

  it('keeps hypotheses unconfirmed and confidence unknown unless given', () => {
    const m = buildReportModel(input(runFor('developing_fault')))
    expect(m.hypotheses.every((h) => h.confidence === null)).toBe(true)
    const { container } = render(<ReportCard model={m} facility={F} />)
    expect(container.textContent).not.toMatch(/%/)
    expect(screen.getByText('Hypothesis (unconfirmed)')).toBeInTheDocument()
  })

  it('maps precondition outcomes to met, unmet, unknown and shows cost/duration only when given', () => {
    const run = runFor('developing_fault', { fault_location: 'P-101B' })
    const m = buildReportModel(input(run))
    const pump = m.options.find((o) => o.targets.includes('P-101B'))!
    expect(pump.preconditions?.map((p) => p.status)).toEqual(['unmet'])
    expect([pump.costUsd, pump.durationMin]).toEqual([140, 60])
    const noCost = { ...run.report!, inspection_options: run.report!.inspection_options.map((o) => ({ ...o, cost_usd: null, duration_min: null })) }
    const m2 = buildReportModel(input({ ...run, report: noCost }))
    const { container } = render(<ReportCard model={m2} facility={F} />)
    expect(container.textContent).not.toMatch(/Cost:|Duration:/)
  })

  it('lists a failed agent in red with its issue code under unknown or missing', () => {
    const m = buildReportModel(input(runFor('agent_failure', { failing_agent: 'anomaly_detection', failure_mode: 'AGENT_ERROR' })))
    const fail = m.unknowns.find((u) => u.code === 'AGENT_ERROR')!
    expect(fail).toMatchObject({ severity: 'fail' })
    expect(fail.text).toMatch(/Anomaly Detection: Error, no report/)
    const { container } = render(<ReportCard model={m} facility={F} />)
    expect(container.querySelector('.rp-unknowns .sev-fail')).toHaveTextContent('AGENT_ERROR')
    expect(container.textContent).not.toMatch(/Anomaly Detection: Complete/)
  })

  it('copies the three flags exactly as given, and unknown when absent', () => {
    const run = runFor('quiet_window')
    expect(buildReportModel(input(run)).decision.flags).toEqual({ human_decision_required: true, automatic_action_authorized: false, equipment_condition_confirmed: false })
    const bare = { ...run, report: null, bundle: { ...run.bundle!, flags: { human_decision_required: null, automatic_action_authorized: null, equipment_condition_confirmed: null } } }
    const { container } = render(<ReportCard model={buildReportModel(input(bare))} facility={F} />)
    expect(within(container.querySelector('.rp-flags') as HTMLElement).getAllByText('unknown')).toHaveLength(3)
  })

  it('has a blank paper sign-off block and no action controls', () => {
    render(<ReportCard model={buildReportModel(input(runFor('developing_fault')))} facility={F} />)
    expect(screen.getByText(/completed on paper; this is not a system action/)).toBeInTheDocument()
    for (const f of ['Name', 'Role', 'Date', 'Signature']) expect(screen.getByText(f)).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('uses the snapshot when captured and the 2D close-up otherwise', () => {
    const run = runFor('developing_fault')
    const withSnap = buildReportModel(input(run, { snapshots: { 'XV-PAI': 'data:image/png;base64,AAAA' } }))
    const { container, unmount } = render(<ReportCard model={withSnap} facility={F} />)
    expect(container.querySelector('img[alt^="3D close-up of XV-PAI"]')).not.toBeNull()
    unmount()
    const { container: c2 } = render(<ReportCard model={buildReportModel(input(run))} facility={F} />)
    expect(c2.querySelectorAll('.rp-asset-2d svg').length).toBe(2)
  })
})
