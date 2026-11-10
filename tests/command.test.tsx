import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AGENTS, SCENARIOS } from '../src/api/mock/data'
import { buildMockRun } from '../src/api/mock/engine'
import { CommandCenter } from '../src/command/CommandCenter'
import { attentionItems, briefing, kpis } from '../src/lib/briefing'
import { initialRunState, runReducer, type RunState } from '../src/state/runState'

function finished(id: string, controls = {}): RunState {
  const m = buildMockRun('t', id, controls)
  let s = initialRunState(AGENTS)
  for (const e of m.events) s = runReducer(s, { type: 'event', event: e.event })
  return runReducer(s, { type: 'bundle', bundle: m.bundle })
}
const cc = (run: RunState) => (
  <CommandCenter agents={AGENTS} run={run} scenario={SCENARIOS.find((s) => s.id === run.scenarioId)} simulated
    selectedAgent={null} onSelectAgent={() => {}} onGo={() => {}} stage={null} />
)

describe('command center', () => {
  it('shows unknown KPIs before any run, never 0', () => {
    const k = kpis(initialRunState(AGENTS))
    expect(k).toMatchObject({ agentsComplete: null, openIssues: null, flaggedAssets: null, decisionState: null })
    render(cc(initialRunState(AGENTS)))
    const group = screen.getByRole('group', { name: /key figures/i })
    expect(group.textContent).not.toMatch(/\b0\b/)
    expect(group.querySelectorAll('.unknown')).toHaveLength(4)
  })

  it('counts only API items for KPIs', () => {
    const run = finished('developing_fault')
    expect(kpis(run)).toMatchObject({ agentsComplete: 8, agentsTotal: 8, flaggedAssets: run.bundle!.flagged_assets.length })
  })

  it('lists a failed agent first, in red, with its issue code', () => {
    const run = finished('agent_failure')
    const items = attentionItems(run, AGENTS)
    expect(items[0]).toMatchObject({ tone: 'fail', code: 'AGENT_INVALID_RESPONSE' })
    render(cc(run))
    const btns = screen.getAllByRole('button', { name: /Topology & Dependency: Rejected by runner/ })
    expect(btns).toHaveLength(2) // workflow strip card + needs-attention item
    for (const b of btns) expect(b).toHaveTextContent('AGENT_INVALID_RESPONSE')
    expect(btns[0]!.className).toContain('st-rejected')
  })

  it('writes the briefing from run data without overclaiming', () => {
    for (const s of SCENARIOS) {
      const text = briefing(finished(s.id), AGENTS, s).join(' ')
      expect(text).not.toMatch(/recommend|approv|(?<!un)confirmed|healthy|no action needed/i)
      expect(text).toMatch(/Decision state:/)
    }
  })

  it('has no approve, execute or dispatch control', () => {
    render(cc(finished('developing_fault')))
    expect(screen.queryByRole('button', { name: /approve|execute|dispatch|authori/i })).toBeNull()
  })
})
