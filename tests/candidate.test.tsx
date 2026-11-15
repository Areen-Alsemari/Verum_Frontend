import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MaintenanceReport, TruthResponse } from '../src/api'
import { CommandCenter } from '../src/command/CommandCenter'
import { Facility2D } from '../src/facility/Facility2D'
import { FacilityView } from '../src/facility/FacilityView'
import { STATIC_FACILITY as F } from '../src/facility'
import { cameraFocus, candidateFromReport, candidateOf, flaggedFor, highlightId } from '../src/lib/candidate'
import { initialRunState, type RunState } from '../src/state/runState'

// statements exactly as the service writes them
const PUMP = 'Unconfirmed hypothesis: pump (asset=P-101A, tag=None); score: decision_score=0.999648, method=ovr_hist_gradient_boosting_v1, calibration=None'
const BIAS = 'Unconfirmed hypothesis: bias (asset=None, tag=None); score: decision_score=0.372133, method=ovr_hist_gradient_boosting_v1_low_support_uncalibrated, calibration=None'
const RESTRICTION = 'Unconfirmed hypothesis: restriction_position_visible (asset=None, tag=None); score: decision_score=0.595718, method=ovr_hist_gradient_boosting_v1, calibration=None'
const TAG = 'Unconfirmed hypothesis: bias (asset=None, tag=PT-101); score: decision_score=0.41, method=m, calibration=None'

const finding = (id: string, statement: string, kind = 'hypothesis') =>
  ({ finding_id: id, kind, statement, source_report_id: 'diagnostic_reasoning-x', evidence_ids: [] })
const report = (...findings: ReturnType<typeof finding>[]): MaintenanceReport =>
  ({ report_id: 'r', source_reports: [], findings, inspection_options: [], missing_information: [], limitations: [] })

const runWith = (rep: MaintenanceReport, truth: RunState['truth'] = { state: 'off' }): RunState =>
  ({ ...initialRunState(), status: 'finished', windowIndex: 10, report: { state: 'ok', window: 10, windowsAvailable: [10], report: rep }, truth })
const truthFor = (asset: string, mech: string): TruthResponse =>
  ({ label: 'simulation truth', run_id: 'R', mode: 'replay', episode_id: 'E', windows: [{ window_index: 10, as_of_s: 3000, fault: true, asset_ids: [asset], fault_types: ['x'], mechanisms: [mech] }] })

const cc = (run: RunState) => {
  const { candidate } = candidateFromReport(run.report, run.windowIndex)
  return render(<CommandCenter run={run} selectedAgent={null} onSelectAgent={() => {}} onGo={() => {}} stage={null} highlighted={highlightId(candidate, F)} />)
}
const LINE = 'Agent 5 did not localise an asset in this window.'

describe('no candidate card on the command center', () => {
  it('has no Candidate asset card and no "No report yet" text, with or without a report', () => {
    for (const run of [initialRunState(), runWith(report(finding('a', PUMP)))]) {
      const { unmount } = cc(run)
      expect(screen.queryByRole('region', { name: /Candidate asset/ })).toBeNull()
      expect(document.body).not.toHaveTextContent(/No report yet/)
      unmount()
    }
  })
})

describe('zoom on a named asset', () => {
  const rep = report(finding('hypothesis-HYP-02-bias-unlocalised', BIAS), finding('hypothesis-HYP-01-pump-P-101A', PUMP))
  it('takes the asset, mechanism and score of the top hypothesis', () => {
    const c = candidateOf(rep)
    expect(c.kind === 'asset' && c.hypothesis).toMatchObject({ assetId: 'P-101A', mechanism: 'pump', score: 0.999648 })
  })
  it('sends the camera to that asset', () => {
    expect(cameraFocus(null, highlightId(candidateOf(rep), F), null)).toBe('P-101A')
  })
  it('highlights exactly that asset, with one label: candidate, asset, kind, score', () => {
    const flagged = flaggedFor(candidateOf(rep), F)
    expect([...flagged.keys()]).toEqual(['P-101A'])
    expect(flagged.get('P-101A')!.note).toBe('Candidate, unconfirmed · P-101A pump · score 0.9996')
    render(<Facility2D facility={F} flagged={flagged} selectedId={null} onSelect={() => {}} />)
    const el = screen.getByRole('button', { name: /Pump P-101A, Candidate, unconfirmed · P-101A pump · score 0\.9996/ })
    expect(el.getAttribute('class')).toContain('is-flagged')
    expect(document.querySelectorAll('.is-flagged')).toHaveLength(1)
  })
  it('puts the uncalibrated note in a footnote under the view, and shows no "did not localise" line', () => {
    cc(runWith(rep))
    expect(document.querySelector('.facility-source')).toHaveTextContent(/uncalibrated and are not probabilities.*not confirmed/)
    expect(screen.queryByText(LINE)).toBeNull()
  })
  it('does not highlight or zoom to an asset the layout does not contain', () => {
    const c = candidateOf(report(finding('h', PUMP.replace('P-101A', 'ZZ-999'))))
    expect(highlightId(c, F)).toBeNull()
    expect(flaggedFor(c, F).size).toBe(0)
    expect(cameraFocus(null, highlightId(c, F), null)).toBeNull()
  })
})

describe('no zoom when not localised', () => {
  it('mechanism only: no highlight, no zoom, one short line in the view', () => {
    const rep = report(finding('hypothesis-HYP-01-restriction_position_visible-unlocalised', RESTRICTION), finding('hypothesis-HYP-02-bias-unlocalised', BIAS))
    const c = candidateOf(rep)
    expect(c.kind).toBe('unlocalised')
    expect(flaggedFor(c, F).size).toBe(0)
    expect(cameraFocus(null, highlightId(c, F), null)).toBeNull()
    cc(runWith(rep))
    expect(screen.getByText(LINE)).toBeInTheDocument()
  })
  it('no hypotheses: no highlight, no zoom, the same line', () => {
    const rep = report(finding('assessment-1', 'Review required', 'assessment'))
    expect(candidateOf(rep).kind).toBe('none')
    expect(candidateOf(null).kind).toBe('none')
    expect(flaggedFor(candidateOf(rep), F).size).toBe(0)
    cc(runWith(rep))
    expect(screen.getByText(LINE)).toBeInTheDocument()
  })
  it('sensor tag only: no asset highlight and no zoom; the line names the sensor', () => {
    const rep = report(finding('hypothesis-HYP-01-bias-PT-101', TAG))
    expect(candidateOf(rep).kind).toBe('tag')
    expect(flaggedFor(candidateOf(rep), F).size).toBe(0)
    expect(cameraFocus(null, null, null)).toBeNull()
    cc(runWith(rep))
    expect(screen.getByText(/did not localise an asset in this window \(it named sensor PT-101/)).toBeInTheDocument()
  })
  it('shows nothing in that place before the report exists, and for another window than the report', () => {
    cc(initialRunState())
    expect(screen.queryByText(/did not localise/)).toBeNull()
    expect(candidateFromReport({ state: 'ok', window: 10, windowsAvailable: [10], report: report() }, 7).candidate.kind).toBe('waiting')
  })
})

describe('reset view', () => {
  it('a chosen asset wins, and Reset view takes the camera back to the overview for that candidate', () => {
    expect(cameraFocus('TK-101', 'P-101A', null)).toBe('TK-101')
    expect(cameraFocus(null, 'P-101A', null)).toBe('P-101A')
    expect(cameraFocus(null, 'P-101A', 'P-101A')).toBeNull()
    // a different candidate zooms again
    expect(cameraFocus(null, 'XV-PBI', 'P-101A')).toBe('XV-PBI')
  })
  const view = (focusId: string | null, onResetView: () => void) => render(
    <FacilityView facility={F} flagged={new Map()} readings={{}} selectedId={null} onSelect={() => {}} focusId={focusId} twoD onTwoD={() => {}} lowDetail={false} onLowDetail={() => {}} onResetView={onResetView} />)
  it('has a Reset view button that is used when zoomed and disabled in the overview', () => {
    const reset = vi.fn()
    const { unmount } = view('P-101A', reset)
    fireEvent.click(screen.getByRole('button', { name: 'Reset view' }))
    expect(reset).toHaveBeenCalledTimes(1)
    unmount()
    view(null, reset)
    expect(screen.getByRole('button', { name: 'Reset view' })).toBeDisabled()
  })
})

describe('the truth is not used', () => {
  const rep = report(finding('hypothesis-HYP-01-pump-P-101A', PUMP))
  it('gives the same candidate and highlight whatever the truth says', () => {
    const a = runWith(rep, { state: 'ok', truth: truthFor('TK-101', 'leak') })
    const b = runWith(rep, { state: 'off' })
    expect(candidateFromReport(a.report, 10)).toEqual(candidateFromReport(b.report, 10))
    expect(candidateFromReport.length).toBeLessThanOrEqual(2) // report state (and the window on show) only
  })
  it('shows the truth in its own panel, apart from the 3D view', () => {
    cc(runWith(rep, { state: 'ok', truth: truthFor('TK-101', 'leak') }))
    const truth = screen.getByRole('region', { name: /Simulation truth/ })
    expect(truth).toHaveTextContent('tank TK-101')
    expect(truth).toHaveTextContent(/simulation truth, not visible to the agents/)
    expect(truth).not.toHaveTextContent('P-101A')
  })
  it('shows no truth panel when truth was not asked for', () => {
    cc(runWith(rep))
    expect(screen.queryByRole('region', { name: /Simulation truth/ })).toBeNull()
  })
  it('never zooms to the truth asset when there is no candidate', () => {
    const run = runWith(report(), { state: 'ok', truth: truthFor('TK-101', 'leak') })
    const { candidate } = candidateFromReport(run.report, 10)
    expect(flaggedFor(candidate, F).size).toBe(0)
    expect(cameraFocus(null, highlightId(candidate, F), null)).toBeNull()
  })
})
