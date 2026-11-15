import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { MaintenanceReport, ServiceEvent } from '../src/api'
import { AboutTab } from '../src/tabs/AboutTab'
import { REPORT_LIMITATION, buildReportModel, readingChanges } from '../src/report/model'
import { ReportCard } from '../src/report/ReportCard'
import { initialRunState, runReducer, type RunState } from '../src/state/runState'

const PUMP = 'Unconfirmed hypothesis: pump (asset=P-101A, tag=None); score: decision_score=0.999648, method=m, calibration=None'
const base = { run_id: 'R-1', mode: 'replay', time_compression: { factor: 60, note: 'n' }, data: 'synthetic' }
const reading = (seq: number, w: number, v: number) => ({ ...base, type: 'sensor_reading', seq, window_index: w, as_of_s: w * 300, readings: [{ tag_id: 'FT-201', unit: 'm3/h', value: v, quality: 'good', availability: 'measured' }, { tag_id: 'PT-203', unit: 'barg', value: 3, quality: 'good', availability: 'measured' }] }) as unknown as ServiceEvent
const feed = (...e: ServiceEvent[]): RunState => e.reduce((s, event) => runReducer(s, { type: 'event', event }), initialRunState())

const full: MaintenanceReport = {
  report_id: 'maintenance-AN-1', source_reports: [], missing_information: ['Forecast values do not confirm the candidate.'], limitations: ['Method topology_residual_v1: four residuals from the declared layout.'],
  assessment_state: 'review_required',
  findings: [{ finding_id: 'h', kind: 'hypothesis', statement: PUMP, source_report_id: 'x', evidence_ids: ['features-summary'] }],
  inspection_options: [{ action_id: 'ACT-INSP-03', target_asset: 'P-101A', feasibility: 'unknown', cost_usd: 140, duration_min: 60, source_report_id: 'x', evidence_ids: [] }],
}
const empty: MaintenanceReport = { report_id: 'r', source_reports: [], findings: [], inspection_options: [], missing_information: [], limitations: ['A long limitation.'] }
const run = feed(reading(0, 7, 255), reading(1, 10, 220))

describe('report', () => {
  it('has the sections in order: found, where, changed, check, sign-off, and one limitation line', () => {
    const { container } = render(<ReportCard model={buildReportModel(run, full, 10)} />)
    const heads = [...container.querySelectorAll('.rp-h')].map((h) => h.textContent)
    expect(heads).toEqual(['What was found', 'Where', 'What changed', 'What to check', 'Sign-off'])
    expect(container.textContent).toContain('Suspected: pump P-101A (pump fault). Suspected, confirm on site.')
    expect(container.textContent).toContain('The suspected equipment is highlighted')
    expect(container.textContent).toContain('Flow (FT-201) fell from 255 to 220 m3/h (14%)')
    expect(container.textContent).toContain('Inspect pump P-101A · Pump skid · about 60 min · estimated cost 140 USD')
    for (const f of ['Reviewed by', 'Decision', 'Date']) expect(screen.getByText(f)).toBeInTheDocument()
    expect(container.querySelector('.rp-footer')).toHaveTextContent(REPORT_LIMITATION)
  })
  it('never prints field names, ids that are not equipment tags, "unknown" or "not supplied"', () => {
    const { container } = render(<ReportCard model={buildReportModel(run, full, 10)} />)
    const t = container.textContent ?? ''
    for (const bad of ['decision_score', 'asset=', 'tag=', 'None', 'unknown', 'not supplied', 'not available', 'ACT-INSP', 'maintenance-AN', 'features-summary', 'Agent ', 'see code', '/src/']) expect(t).not.toContain(bad)
    expect(t).not.toMatch(/\b[a-z]+_[a-z_]+\b/)
  })
  it('leaves out every section that has no data, and says the equipment could not be narrowed down', () => {
    const { container } = render(<ReportCard model={buildReportModel(initialRunState(), empty, 3)} />)
    const heads = [...container.querySelectorAll('.rp-h')].map((h) => h.textContent)
    expect(heads).toEqual(['Where', 'Sign-off'])
    expect(container.textContent).toContain('The affected equipment could not be narrowed down. Check the area around the readings below.')
  })
  it('shows no limitation list on screen or in print; the limitations are in About, collapsed, and in the data file', () => {
    const { container } = render(<ReportCard model={buildReportModel(run, full, 10)} />)
    expect(container.textContent).not.toContain('Method topology_residual_v1')
    expect(container.textContent).not.toContain('Forecast values do not confirm')
    const about = render(<AboutTab run={{ ...run, report: { state: 'ok', window: 10, windowsAvailable: [10], report: full } }} />)
    const details = about.container.querySelector('details')!
    expect(details.open).toBe(false)
    expect(details.textContent).toContain('Method topology_residual_v1')
  })
  it('lists the readings that moved most, in plain words, and none when only one window was seen', () => {
    expect(readingChanges(run)).toHaveLength(1)
    expect(readingChanges(feed(reading(0, 7, 255)))).toEqual([])
  })
})
