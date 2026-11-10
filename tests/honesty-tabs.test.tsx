import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../src/App'
import { AGENTS, SCENARIOS } from '../src/api/mock/data'
import { buildMockRun } from '../src/api/mock/engine'
import { buildMockReport } from '../src/api/mock/report'
import { AgentBoard } from '../src/components/AgentBoard'
import { MessageLog } from '../src/components/MessageLog'
import { CommandCenter } from '../src/command/CommandCenter'
import { STATIC_FACILITY as F } from '../src/facility'
import { buildReportModel } from '../src/report/model'
import { ReportCard } from '../src/report/ReportCard'
import { InspectionTab } from '../src/tabs/InspectionTab'
import { InvestigationTab } from '../src/tabs/InvestigationTab'
import { initialRunState, runReducer, type RunState } from '../src/state/runState'

function finished(id: string, controls = {}): RunState {
  const m = buildMockRun('t', id, controls)
  let s = initialRunState(AGENTS)
  for (const e of m.events) s = runReducer(s, { type: 'event', event: e.event })
  s = runReducer(s, { type: 'bundle', bundle: m.bundle })
  return runReducer(s, { type: 'report', report: buildMockReport('t', m) })
}

/** Every tab body for a finished run, rendered together. */
function allTabs(run: RunState) {
  return (
    <div>
      <CommandCenter agents={AGENTS} run={run} scenario={SCENARIOS.find((s) => s.id === run.scenarioId)} simulated selectedAgent={null} onSelectAgent={() => {}} onGo={() => {}} stage={null} />
      <AgentBoard agents={AGENTS} run={run} selected={null} onSelect={() => {}} />
      <MessageLog messages={run.messages} agents={AGENTS} />
      <InvestigationTab run={run} agents={AGENTS} focus={null} />
      <InspectionTab run={run} />
      <ReportCard model={buildReportModel({ run, agents: AGENTS, scenario: undefined, facility: F, snapshots: {}, source: 'mock' })} facility={F} />
    </div>
  )
}

const ACTION = /\b(approve|execute|dispatch|authori[sz]e|schedule|send work order)\b/i

describe('honesty across all tabs', () => {
  it('no control on any tab approves, executes or dispatches work', () => {
    for (const s of SCENARIOS) {
      const { unmount } = render(allTabs(finished(s.id)))
      for (const b of screen.queryAllByRole('button')) expect(b.textContent ?? '').not.toMatch(ACTION)
      unmount()
    }
  })

  it('no UI text claims that something was approved, executed or dispatched', () => {
    const { container } = render(allTabs(finished('developing_fault')))
    expect(container.textContent).not.toMatch(/\b(approved|executed|dispatched|work order (created|sent))\b/i)
  })

  it('an agent error or runner rejection is red with its issue code on the board, in the log, on Investigation and in the report', () => {
    const run = finished('agent_failure', { failing_agent: 'historical_asset_intelligence', failure_mode: 'AGENT_ERROR' })
    const { container } = render(allTabs(run))
    // board + strip
    expect(container.querySelectorAll('.st-error').length).toBeGreaterThanOrEqual(2)
    // log
    const logFail = [...container.querySelectorAll('.log-row')].filter((r) => r.textContent?.includes('Agent error'))
    expect(logFail.length).toBeGreaterThan(0)
    expect(logFail.some((r) => r.className.includes('is-fail'))).toBe(true)
    // investigation
    const row = [...container.querySelectorAll('.outcomes tr.is-fail')].find((r) => r.textContent?.includes('Historical Asset Intelligence'))!
    expect(row).toHaveTextContent('Agent error')
    expect(row.querySelector('.issue-code.is-fail')).toHaveAttribute('title', 'AGENT_ERROR')
    expect(row).not.toHaveTextContent('Complete')
    // report
    expect(container.querySelector('.rp-unknowns .sev-fail')).toHaveTextContent('AGENT_ERROR')
  })

  it('a failed agent never shows as complete anywhere', () => {
    const run = finished('agent_failure')
    render(allTabs(run))
    for (const el of screen.getAllByText(/Topology & Dependency/)) {
      const card = el.closest('button, tr, li')
      if (card) expect(card.textContent).not.toMatch(/\bComplete\b/)
    }
  })

  it('labels simulated content as simulated', () => {
    const { container } = render(allTabs(finished('developing_fault')))
    expect(container.textContent).toMatch(/Simulated stream \(replay of recorded windows\)/)
    expect(container.textContent).toMatch(/Simulated data, advisory only/)
    expect(container.textContent).toMatch(/schematic, not to scale/i)
    expect(container.textContent).not.toMatch(/\blive plant data\b(?! )/i)
  })

  it('shows the three flags exactly as given on Inspection and Command center', () => {
    render(allTabs(finished('developing_fault')))
    for (const [k, v] of [['Human decision required', 'Yes'], ['Automatic action authorised', 'No'], ['Equipment condition confirmed', 'No']] as const) {
      for (const el of screen.getAllByText(k)) expect(el.closest('div')).toHaveTextContent(new RegExp(`${k}\\s*${v}`))
    }
  })

  it('never shows a percentage, and the UI itself never states a probability or confidence value', () => {
    for (const s of SCENARIOS) {
      const { container, unmount } = render(allTabs(finished(s.id)))
      expect(container.textContent).not.toMatch(/\d\s*%/)
      const ui = container.cloneNode(true) as HTMLElement
      ui.querySelectorAll('[data-api]').forEach((n) => n.remove())
      expect(ui.textContent).not.toMatch(/probability/i)
      unmount()
    }
  })
})

describe('readable wording', () => {
  it('shows no raw snake_case field names or codes in the UI text (ids in code chips and the small "code" notes excepted)', () => {
    for (const sc of SCENARIOS) {
      const { container, unmount } = render(allTabs(finished(sc.id)))
      const c = container.cloneNode(true) as HTMLElement
      c.querySelectorAll('code, title, .issue-raw, .rp-raw').forEach((n) => n.remove())
      const parts: string[] = []
      const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT)
      while (w.nextNode()) parts.push(w.currentNode.textContent ?? '')
      const raw = parts.join(' ').match(/\b[a-z][a-z0-9]*_[a-z0-9_]+\b|\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/g)
      expect(raw).toBeNull()
      unmount()
    }
  })
})

describe('app shell accessibility', () => {
  it('has a skip link, landmarks and the permanent footer on first render', () => {
    render(<App />)
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
    expect(screen.getByRole('tablist', { name: 'Sections' })).toBeInTheDocument()
    expect(within(screen.getByRole('note')).getByText(/Advisory only/)).toBeInTheDocument()
  })
})
