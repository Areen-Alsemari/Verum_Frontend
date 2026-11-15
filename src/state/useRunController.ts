import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { createRun, getReport, getTruth, openStream, type RunStream } from '../api/client'
import type { CreateRunRequest } from '../api/serviceTypes'
import { describeError } from '../lib/service'
import { initialRunState, runReducer } from './runState'
import { nextEnd, prevEnd, projectRun, windowAt, windowEnds } from './playback'

/** Owns the active run: creates it, feeds the stream into the reducer, and loads the report and truth after `done`. */
export function useRunController() {
  const [state, dispatch] = useReducer(runReducer, undefined, initialRunState)
  const streamRef = useRef<RunStream | null>(null)
  const fetchedFor = useRef<string | null>(null)
  /** events shown: null = the latest received (follows the stream); a number holds the view at that many events */
  const [cursor, setCursor] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)

  const close = useCallback(() => {
    streamRef.current?.close()
    streamRef.current = null
  }, [])
  useEffect(() => close, [close])

  const start = useCallback(async (req: CreateRunRequest) => {
    close()
    fetchedFor.current = null
    setCursor(null)
    setPlaying(false)
    dispatch({ type: 'starting' })
    let run
    try {
      run = await createRun(req)
    } catch (e) {
      dispatch({ type: 'failed', error: `The run could not be created. ${describeError(e)}` })
      return
    }
    dispatch({ type: 'created', run })
    streamRef.current = openStream(run.run_id, {
      onEvent: (event) => dispatch({ type: 'event', event }),
      onConnection: (s) => {
        dispatch({ type: 'connection', state: s })
        if (s === 'lost') dispatch({ type: 'failed', error: 'The connection to the service was lost and could not be restored.' })
      },
      onMalformed: () => dispatch({ type: 'malformed' }),
    })
  }, [close])

  const stop = useCallback(() => {
    close()
    setPlaying(false)
    dispatch({ type: 'stopped' })
  }, [close])

  const loadReport = useCallback(async (runId: string, window?: number) => {
    dispatch({ type: 'report', report: { state: 'loading' } })
    try {
      const r = await getReport(runId, window)
      if (r.state === 'pending') dispatch({ type: 'report', report: { state: 'pending' } })
      else dispatch({ type: 'report', report: { state: 'ok', window: r.data.window_index, windowsAvailable: r.data.windows_available ?? [], report: r.data.report } })
    } catch (e) {
      dispatch({ type: 'report', report: { state: 'error', message: describeError(e) } })
    }
  }, [])

  // after the run is done: the report (default: last window) and, only if asked for, the simulation truth
  const runId = state.run?.run_id ?? null
  const finished = state.done?.status === 'completed'
  const revealTruth = state.run?.reveal_truth === true
  useEffect(() => {
    if (!runId || !finished || fetchedFor.current === runId) return
    fetchedFor.current = runId
    void loadReport(runId)
    if (revealTruth) {
      dispatch({ type: 'truth', truth: { state: 'loading' } })
      getTruth(runId).then(
        (t) => dispatch({ type: 'truth', truth: t.state === 'ok' ? { state: 'ok', truth: t.data } : { state: 'unavailable', message: t.message } }),
        (e) => dispatch({ type: 'truth', truth: { state: 'error', message: describeError(e) } }),
      )
    }
  }, [runId, finished, revealTruth, loadReport])

  // ---- playback of the windows already received ----
  const ends = useMemo(() => windowEnds(state.events), [state.events])
  const shown = cursor === null ? state.events.length : Math.min(cursor, state.events.length)
  const view = useMemo(() => projectRun(state, shown), [state, shown])
  const current = windowAt(ends, shown)
  const atLiveEdge = cursor === null

  const pause = useCallback(() => { setCursor((c) => c ?? state.events.length); setPlaying(false) }, [state.events.length])
  /** play on from the held position, one window at a time, until the latest window is reached */
  const resume = useCallback(() => { if (cursor !== null) setPlaying(true) }, [cursor])
  const step = useCallback((dir: 1 | -1) => {
    setPlaying(false)
    const n = cursor ?? state.events.length
    if (dir === 1) {
      const nx = nextEnd(ends, n)
      // the last received window is the live edge: follow the stream again
      setCursor(!nx || nx.end >= (ends[ends.length - 1]?.end ?? 0) ? null : nx.end)
    } else {
      // back to the last complete window before the one on show (the live edge may hold a partial window)
      const w = windowAt(ends, n)
      if (!w) return
      const partial = state.events.slice(w.end, n).some((e) => e.type !== 'done')
      const target = partial ? w : prevEnd(ends, w.end)
      if (target) setCursor(target.end)
    }
  }, [cursor, ends, state.events])

  /** back to the newest window and follow the stream again */
  const live = useCallback(() => { setPlaying(false); setCursor(null) }, [])
  /** hold the view at the n-th window received (1-based); the newest window means follow the stream */
  const seek = useCallback((n: number) => {
    setPlaying(false)
    const w = ends[n - 1]
    setCursor(!w || n >= ends.length ? null : w.end)
  }, [ends])

  const paceMs = useRef(1000)
  const setPace = useCallback((ms: number) => { paceMs.current = ms }, [])
  useEffect(() => {
    if (!playing || cursor === null) return
    const id = setInterval(() => {
      const nx = nextEnd(ends, cursor)
      if (!nx || nx.end >= (ends[ends.length - 1]?.end ?? 0)) { setCursor(null); setPlaying(false) } else setCursor(nx.end)
    }, paceMs.current)
    return () => clearInterval(id)
  }, [playing, cursor, ends])

  // a report of the window on show, when the service lists one (reports exist only after the run is done)
  const rep = state.report
  const shownWindow = view.windowIndex
  useEffect(() => {
    if (!runId || !finished || rep.state !== 'ok' || shownWindow === null) return
    if (rep.window !== shownWindow && rep.windowsAvailable.includes(shownWindow)) void loadReport(runId, shownWindow)
  }, [runId, finished, rep, shownWindow, loadReport])

  const playback = { cursor, playing, atLiveEdge, windows: ends.length, window: current?.window ?? null, index: current ? ends.indexOf(current) + 1 : 0, setPace }
  return { state, view, playback, pause, resume, step, live, seek, start, stop, loadReport }
}
