import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../src/App'
import type { RunBundle } from '../src/api'
import { AGENTS } from '../src/api/mock/data'
import { buildMockRun } from '../src/api/mock/engine'
import { AgentBoard } from '../src/components/AgentBoard'
import { ResultView } from '../src/components/ResultView'
import { Unknown, Value } from '../src/components/Unknown'
import { initialRunState, runReducer, type RunState } from '../src/state/runState'

function finishedState(scenario: string, controls = {}): RunState {
  const mock = buildMockRun('t', scenario, controls)
  let s = initialRunState(AGENTS)
  for (const t of mock.events) s = runReducer(s, { type: 'event', event: t.event })
  return runReducer(s, { type: 'bundle', bundle: mock.bundle })
}

const SCENARIOS = ['quiet_window', 'developing_fault', 'agent_conflict', 'agent_failure']

describe('honesty rules', () => {
  it('shows the advisory banner permanently, even before data loads', () => {
    render(<App />)
    expect(screen.getByRole('note')).toHaveTextContent('Advisory only. A human decides. No automatic action is authorised.')
  })

  it('shows missing values as the word "unknown", never 0 or blank', () => {
    const { container } = render(<div><Value value={null} /><Value value={undefined} /><Value value="" /><Value value={NaN} /></div>)
    expect(within(container).getAllByText('unknown')).toHaveLength(4)
    expect(container.textContent).not.toMatch(/0|healthy/)
    expect(container.querySelector('.unknown')).not.toBeNull()
  })

  it('keeps a real zero as 0 (it is data, not missing)', () => {
    render(<Value value={0} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('shows null confidence as unknown and never invents a percentage', () => {
    for (const id of SCENARIOS) {
      const { container, unmount } = render(<ResultView run={finishedState(id)} agents={AGENTS} />)
      expect(container.textContent).not.toMatch(/%/)
      unmount()
    }
    const { container } = render(<ResultView run={finishedState('developing_fault')} agents={AGENTS} />)
    expect(within(container).getAllByText('unknown').length).toBeGreaterThan(0)
  })

  it('shows a confidence number only when the API provides one, as given', () => {
    const run = finishedState('developing_fault')
    const bundle: RunBundle = { ...run.bundle!, hypotheses: run.bundle!.hypotheses.map((h, i) => (i === 0 ? { ...h, confidence: 0.62 } : h)) }
    render(<ResultView run={{ ...run, bundle }} agents={AGENTS} />)
    expect(screen.getByText('0.62')).toBeInTheDocument()
  })

  it('does not use "recommended" or "approved" unless the API says so', () => {
    for (const id of SCENARIOS) {
      const { container, unmount } = render(<ResultView run={finishedState(id)} agents={AGENTS} />)
      expect(container.textContent).not.toMatch(/recommend|approv/i)
      unmount()
    }
    const run = finishedState('developing_fault')
    const bundle: RunBundle = { ...run.bundle!, inspection_options: run.bundle!.inspection_options.map((o) => ({ ...o, recommended: true })) }
    render(<ResultView run={{ ...run, bundle }} agents={AGENTS} />)
    expect(screen.getAllByText(/marked recommended by the API/).length).toBeGreaterThan(0)
  })

  it('labels inspection options as advisory', () => {
    render(<ResultView run={finishedState('developing_fault')} agents={AGENTS} />)
    expect(screen.getByRole('heading', { name: /inspection options/i })).toHaveTextContent(/advisory/i)
  })

  it('displays the three decision flags exactly as given', () => {
    render(<ResultView run={finishedState('developing_fault')} agents={AGENTS} />)
    const row = (n: string) => screen.getByText(n).parentElement!
    expect(row('human_decision_required')).toHaveTextContent('true')
    expect(row('automatic_action_authorized')).toHaveTextContent('false')
    expect(row('equipment_condition_confirmed')).toHaveTextContent('false')
  })

  it('shows unknown for flags that are missing', () => {
    render(<ResultView run={initialRunState(AGENTS)} agents={AGENTS} />)
    const row = screen.getByText('equipment_condition_confirmed').parentElement!
    expect(row).toHaveTextContent('unknown')
    expect(row).not.toHaveTextContent(/true|false/)
  })

  it('shows an unknown decision state instead of a default', () => {
    render(<ResultView run={initialRunState(AGENTS)} agents={AGENTS} />)
    expect(screen.getByText('Decision state').parentElement).toHaveTextContent('unknown')
  })

  it('shows an agent error or runner rejection in red with its issue code', () => {
    const run = finishedState('agent_failure', { failing_agent: 'topology_dependency', failure_mode: 'AGENT_INVALID_RESPONSE' })
    const { container } = render(<AgentBoard agents={AGENTS} run={run} selected={null} onSelect={() => {}} />)
    const card = screen.getByRole('button', { name: /Topology & Dependency/ })
    expect(card).toHaveTextContent('Rejected by runner')
    expect(card).toHaveTextContent('AGENT_INVALID_RESPONSE')
    expect(card).toHaveTextContent('report: null')
    expect(card.className).toContain('st-rejected')
    expect(container.querySelector('.issue-code.is-fail')).not.toBeNull()
  })

  it('shows an agent that raised an error as Error with its code', () => {
    const run = finishedState('agent_failure', { failing_agent: 'anomaly_detection', failure_mode: 'AGENT_ERROR' })
    render(<AgentBoard agents={AGENTS} run={run} selected={null} onSelect={() => {}} />)
    const card = screen.getByRole('button', { name: /Anomaly Detection/ })
    expect(card).toHaveTextContent('Error')
    expect(card).toHaveTextContent('AGENT_ERROR')
  })

  it('renders the unknown marker as hatched, labelled text', () => {
    render(<Unknown what="confidence" />)
    expect(screen.getByText('unknown')).toHaveAttribute('title', 'confidence: not provided')
  })
})
