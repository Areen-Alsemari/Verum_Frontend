import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ControlPanel } from '../src/components/ControlPanel'
import { SCENARIOS } from '../src/lib/scenarios'
import { initialRunState } from '../src/state/runState'

const noop = () => {}
const base = {
  mode: 'replay' as const, episodes: [...SCENARIOS.map((s) => ({ episode_id: s.episode_id, split: 'validation', windows: 3 })), { episode_id: 'EP-TESTSPLIT', split: 'test', windows: 4 }], episodesError: null,
  scenarioId: SCENARIOS[0]!.episode_id, onScenario: noop, episodeId: '', onEpisode: noop, speed: 60, onSpeed: noop,
  revealTruth: false, onRevealTruth: noop, status: 'idle' as const, serviceUp: true, onRun: noop, onStop: noop, onMode: noop, onReset: noop,
  run: initialRunState(), playback: { cursor: null, playing: false, atLiveEdge: true, windows: 0, window: null, index: 0 },
  onPause: noop, onResume: noop, onPrev: noop, onNext: noop, onRestart: noop, onLive: noop, onSeek: noop, modes: { replay: true, live: true },
}

describe('control panel', () => {
  it('has three groups: Scenario, Run settings and Playback, with the run controls in them', () => {
    render(<ControlPanel {...base} />)
    const scenario = screen.getByRole('group', { name: 'Scenario' })
    const settings = screen.getByRole('group', { name: 'Run settings' })
    const playback = screen.getByRole('group', { name: 'Playback' })
    expect(within(scenario).getByRole('combobox', { name: /Scenario/ })).toBeInTheDocument()
    expect(within(scenario).getByRole('combobox', { name: /Stored episode/ })).toBeInTheDocument()
    expect(within(settings).getByRole('combobox', { name: /Mode/ })).toBeInTheDocument()
    expect(within(settings).getByRole('combobox', { name: /Playback speed/ })).toBeInTheDocument()
    expect(within(settings).getByRole('checkbox', { name: /Reveal the simulated truth/ })).toBeInTheDocument()
    expect(within(playback).getByRole('button', { name: 'Run' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset to defaults' })).toBeInTheDocument()
  })
  it('shows the playback controls once a run exists', () => {
    const run = { ...initialRunState(), status: 'running' as const, run: { run_id: 'R', mode: 'replay', speed: 60, episode_id: 'E', split: 'v', reveal_truth: false, status: 'running', events: 1, links: {} } } as never
    render(<ControlPanel {...base} status="running" run={run} playback={{ ...base.playback, windows: 3, window: 2, index: 2 }} />)
    for (const name of ['Pause', 'Restart', 'Previous window', 'Next window']) expect(screen.getByRole('button', { name })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Window scrubber' })).toBeInTheDocument()
  })
  it('never offers the test split, and has no fault-injection controls', () => {
    render(<ControlPanel {...base} />)
    fireEvent.click(screen.getByRole('combobox', { name: /Stored episode/ }))
    expect(screen.queryByText(/EP-TESTSPLIT/)).toBeNull()
    expect(document.body.textContent).not.toMatch(/noise|dropout|fault location|pressure drop|failing agent|failure mode/i)
  })
  it('disables Live with a visible reason when the service reports live is off, and cannot select it', () => {
    const onMode = vi.fn()
    render(<ControlPanel {...base} modes={{ replay: true, live: false }} onMode={onMode} />)
    expect(screen.getByRole('status')).toHaveTextContent(/Live is not available/)
    fireEvent.click(screen.getByRole('combobox', { name: /Mode/ }))
    const live = screen.getByRole('option', { name: /Live/ })
    expect(live).toHaveAttribute('aria-disabled', 'true')
    fireEvent.mouseDown(live)
    expect(onMode).not.toHaveBeenCalled()
  })
  it('allows Live when the service reports it on, and resets to defaults', () => {
    const onMode = vi.fn(); const onReset = vi.fn()
    render(<ControlPanel {...base} onMode={onMode} onReset={onReset} />)
    fireEvent.click(screen.getByRole('combobox', { name: /Mode/ }))
    fireEvent.mouseDown(screen.getByRole('option', { name: /Live/ }))
    expect(onMode).toHaveBeenCalledWith('live')
    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }))
    expect(onReset).toHaveBeenCalled()
  })
})
