import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RunBar } from '../src/components/RunBar'
import { SCENARIOS } from '../src/lib/scenarios'

const base = {
  mode: 'replay' as const, episodes: SCENARIOS.map((s) => ({ episode_id: s.episode_id, split: 'validation', windows: 1 })), episodesError: null,
  scenarioId: SCENARIOS[0]!.episode_id, onScenario: () => {}, episodeId: '', onEpisode: () => {}, speed: 60, onSpeed: () => {},
  revealTruth: false, onRevealTruth: () => {}, status: 'idle' as const, serviceUp: true, onRun: () => {}, onStop: () => {}, onMode: () => {},
}

describe('run bar', () => {
  it('disables Live with a visible reason when the service reports live is off, and cannot select it', () => {
    const onMode = vi.fn()
    render(<RunBar {...base} modes={{ replay: true, live: false }} onMode={onMode} />)
    expect(screen.getByRole('status')).toHaveTextContent(/Live is off.*--release/)
    fireEvent.click(screen.getByRole('combobox', { name: /Mode/ }))
    const live = screen.getByRole('option', { name: /Live/ })
    expect(live).toHaveAttribute('aria-disabled', 'true')
    fireEvent.mouseDown(live)
    expect(onMode).not.toHaveBeenCalled()
  })

  it('allows Live and shows no note when the service reports it on', () => {
    const onMode = vi.fn()
    render(<RunBar {...base} modes={{ replay: true, live: true }} onMode={onMode} />)
    expect(screen.queryByRole('status')).toBeNull()
    fireEvent.click(screen.getByRole('combobox', { name: /Mode/ }))
    fireEvent.mouseDown(screen.getByRole('option', { name: /Live/ }))
    expect(onMode).toHaveBeenCalledWith('live')
  })

  it('disables a scenario whose episode the service does not list, with the reason', () => {
    const onScenario = vi.fn()
    render(<RunBar {...base} modes={{ replay: true, live: false }} episodes={base.episodes.slice(1)} onScenario={onScenario} />)
    fireEvent.click(screen.getByRole('combobox', { name: /Scenario/ }))
    const first = screen.getByRole('option', { name: /Scenario 1/ })
    expect(first).toHaveAttribute('aria-disabled', 'true')
    expect(first).toHaveTextContent(/episode is not in this service/)
    expect(first.textContent).not.toMatch(/EP-/)
    fireEvent.mouseDown(first)
    expect(onScenario).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled()
  })
})
