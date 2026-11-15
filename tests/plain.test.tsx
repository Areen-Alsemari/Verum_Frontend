import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { MaintenanceReport } from '../src/api'
import { STATIC_FACILITY as F } from '../src/facility'
import { InvestigationTab } from '../src/tabs/InvestigationTab'
import { candidateOf } from '../src/lib/candidate'
import { assetPhrase, candidateSentence, mechanismName, noteText } from '../src/lib/plain'
import { initialRunState } from '../src/state/runState'

const PUMP = 'Unconfirmed hypothesis: pump (asset=P-101A, tag=None); score: decision_score=0.999648, method=ovr_hist_gradient_boosting_v1, calibration=None'
const BIAS = 'Unconfirmed hypothesis: bias (asset=None, tag=None); score: decision_score=0.372133, method=m, calibration=None'
const f = (id: string, statement: string, kind = 'hypothesis') => ({ finding_id: id, kind, statement, source_report_id: 'diagnostic_reasoning-x', evidence_ids: ['features-summary'] })
const report = (...findings: ReturnType<typeof f>[]): MaintenanceReport =>
  ({ report_id: 'r', source_reports: [], findings, inspection_options: [], missing_information: [], limitations: [] })

describe('plain wording', () => {
  it('names equipment by kind and tag, and mechanisms in words', () => {
    expect(assetPhrase(F, 'P-101A')).toBe('pump P-101A')
    expect(assetPhrase(F, 'XV-PBI')).toBe('isolation valve XV-PBI')
    expect(assetPhrase(F, 'NOPE-1')).toBe('NOPE-1')
    expect(mechanismName('pump')).toBe('pump fault')
    expect(mechanismName('some_new_mechanism')).toBe('some new mechanism')
  })
  it('writes the candidate as one sentence', () => {
    expect(candidateSentence(candidateOf(report(f('a', PUMP))), F)).toBe("Agent 5's top candidate: pump P-101A (pump fault). Ranking score 0.9996. This is a ranking score, not a probability.")
  })
  it('writes runner notes as sentences', () => {
    expect(noteText('NO_HISTORY_SUPPLIED')).toBe('No earlier history was supplied')
  })
})

describe('investigation tab has no raw attribute text', () => {
  const run = { ...initialRunState(), runnerNotes: ['NO_BUDGET'], report: { state: 'ok' as const, window: 10, windowsAvailable: [10], report: report(f('h1', PUMP), f('h2', BIAS), f('h3', 'garbled hypothesis text')) } }
  it('shows sentences, not decision_score, asset=, tag=None, runner notes or snake_case', () => {
    const { container } = render(<InvestigationTab run={run} onRetryReport={() => {}} />)
    const text = container.textContent ?? ''
    expect(text).toContain('Pump P-101A (pump fault). Ranking score 0.9996. This is a ranking score, not a probability.')
    expect(text).toContain('Sensor bias, with no asset named. Ranking score 0.3721.')
    // the only raw text is the unreadable statement, and it sits inside a Details expander
    const raw = [...container.querySelectorAll('details')].map((d) => d.textContent).join(' ')
    expect(raw).toContain('garbled hypothesis text')
    const outside = text.replace(raw, '')
    for (const bad of ['decision_score', 'asset=', 'tag=None', 'calibration', 'NO_BUDGET', 'runner notes', 'None']) expect(outside).not.toContain(bad)
    expect(screen.getAllByText('Candidate cause').length).toBe(3)
  })
  it('shows the raw runner notes and ids in the developer view', () => {
    const { container } = render(<InvestigationTab run={run} onRetryReport={() => {}} dev />)
    const text = container.textContent ?? ''
    expect(text).toContain('runner notes')
    expect(text).toContain('NO_BUDGET')
    expect(text).toContain('No inspection budget was supplied')
    expect(text).toContain('source report')
  })
  it('writes the persistence rule as a sentence', () => {
    const p = { rule: { k: 2, n: 3, threshold: 1.74 }, windows_held: 3, windows_exceeding: 1, windows_unknown: 0, alarming: false }
    const { container } = render(<InvestigationTab run={{ ...initialRunState(), persistence: p }} onRetryReport={() => {}} />)
    expect(container.textContent).toContain('No alert so far. 1 of the last 3 windows was above normal; an alert is raised when 2 are.')
    expect(container.textContent).not.toMatch(/windows held|windows exceeding|threshold|1\.74/)
  })
})
