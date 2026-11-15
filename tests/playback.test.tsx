import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ServiceEvent } from '../src/api'
import { PlaybackBar } from '../src/components/PlaybackBar'
import { nextEnd, prevEnd, projectRun, windowAt, windowEnds } from '../src/state/playback'
import { initialRunState, runReducer, type RunState } from '../src/state/runState'

const base = { run_id: 'R-1', mode: 'replay', time_compression: { factor: 60, note: 'n' }, data: 'synthetic' }
const reading = (seq: number, w: number) => ({ ...base, type: 'sensor_reading', seq, window_index: w, as_of_s: w * 300, readings: [] }) as unknown as ServiceEvent
const result = (seq: number, w: number, status: string) =>
  ({ ...base, type: 'window_result', seq, window_index: w, as_of_s: w * 300, agents: { anomaly_detection: { status, report_id: `a${w}`, runner_issue_codes: [] } }, decision: null, persistence: null, runner_note_codes: [] }) as unknown as ServiceEvent
const done = (seq: number) => ({ ...base, type: 'done', seq, status: 'completed', windows: 3, error_type: null }) as unknown as ServiceEvent
const feed = (...events: ServiceEvent[]): RunState => events.reduce((s, event) => runReducer(s, { type: 'event', event }), initialRunState())

const events = [reading(0, 5), result(1, 5, 'complete'), reading(2, 6), result(3, 6, 'degraded'), reading(4, 7), result(5, 7, 'complete'), done(6)]

describe('playback of received windows', () => {
  it('finds window boundaries and ignores the done event', () => {
    expect(windowEnds(events)).toEqual([{ window: 5, end: 2 }, { window: 6, end: 4 }, { window: 7, end: 6 }])
  })
  it('steps to the next and previous boundary', () => {
    const ends = windowEnds(events)
    expect(nextEnd(ends, 2)?.window).toBe(6)
    expect(nextEnd(ends, 6)).toBeNull()
    expect(prevEnd(ends, 4)?.window).toBe(5)
    expect(prevEnd(ends, 2)).toBeNull()
    expect(windowAt(ends, 5)?.window).toBe(6)
  })
  it('shows an earlier window exactly as the service reported it, without changing any status', () => {
    const live = feed(...events)
    const held = projectRun(live, 4)
    expect(held.windowIndex).toBe(6)
    expect(held.agents.anomaly_detection!.status).toBe('degraded')
    expect(held.agents.anomaly_detection!.reportId).toBe('a6')
    expect(projectRun(live, 2).agents.anomaly_detection!.status).toBe('complete')
    expect(projectRun(live, live.events.length)).toBe(live)
    // run-level facts are kept
    expect(held.status).toBe('finished')
    expect(held.viewing).toEqual({ index: 2, total: 3 })
    expect(projectRun(live, 6).viewing).toBeNull()
  })
})

describe('playback bar', () => {
  const live = { ...feed(...events), run: { run_id: 'R-1', mode: 'replay', speed: 60, episode_id: 'E', split: 'v', reveal_truth: false, status: 'completed', events: 7, links: {} } } as unknown as RunState
  const p = { cursor: null, playing: false, atLiveEdge: true, windows: 3, window: 7, index: 3 }
  it('pauses when following, and steps back', () => {
    const onPause = vi.fn(); const onPrev = vi.fn()
    render(<PlaybackBar run={live} playback={p} onPause={onPause} onResume={() => {}} onPrev={onPrev} onNext={() => {}} onRestart={() => {}} onLive={() => {}} onSeek={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pause' })); fireEvent.click(screen.getByRole('button', { name: 'Previous window' }))
    expect(onPause).toHaveBeenCalled(); expect(onPrev).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Next window' })).toBeDisabled()
  })
  it('resumes and steps forward when held, and restarts', () => {
    const onResume = vi.fn(); const onNext = vi.fn(); const onRestart = vi.fn()
    render(<PlaybackBar run={live} playback={{ ...p, cursor: 2, atLiveEdge: false, window: 5, index: 1 }} onPause={() => {}} onResume={onResume} onPrev={() => {}} onNext={onNext} onRestart={onRestart} onLive={() => {}} onSeek={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Resume' })); fireEvent.click(screen.getByRole('button', { name: 'Next window' })); fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
    expect(onResume).toHaveBeenCalled(); expect(onNext).toHaveBeenCalled(); expect(onRestart).toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('Viewing window 1 of 3')
  })
  it('shows Back to live only when the view is held, and scrubs to a window', () => {
    const onLive = vi.fn(); const onSeek = vi.fn()
    const { rerender } = render(<PlaybackBar run={live} playback={p} onPause={() => {}} onResume={() => {}} onPrev={() => {}} onNext={() => {}} onRestart={() => {}} onLive={onLive} onSeek={onSeek} />)
    expect(screen.queryByRole('button', { name: 'Back to live' })).toBeNull()
    rerender(<PlaybackBar run={live} playback={{ ...p, cursor: 2, atLiveEdge: false, window: 5, index: 1 }} onPause={() => {}} onResume={() => {}} onPrev={() => {}} onNext={() => {}} onRestart={() => {}} onLive={onLive} onSeek={onSeek} />)
    fireEvent.click(screen.getByRole('button', { name: 'Back to live' }))
    expect(onLive).toHaveBeenCalled()
    fireEvent.change(screen.getByRole('slider', { name: 'Window scrubber' }), { target: { value: '2' } })
    expect(onSeek).toHaveBeenCalledWith(2)
  })
  it('is not shown before a run', () => {
    const { container } = render(<PlaybackBar run={initialRunState()} playback={p} onPause={() => {}} onResume={() => {}} onPrev={() => {}} onNext={() => {}} onRestart={() => {}} onLive={() => {}} onSeek={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
