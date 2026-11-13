import { useCallback, useEffect, useReducer, useRef } from 'react'
import { createRun, getReport, getTruth, openStream, type RunStream } from '../api/client'
import type { CreateRunRequest } from '../api/serviceTypes'
import { describeError } from '../lib/service'
import { initialRunState, runReducer } from './runState'

/** Owns the active run: creates it, feeds the stream into the reducer, and loads the report and truth after `done`. */
export function useRunController() {
  const [state, dispatch] = useReducer(runReducer, undefined, initialRunState)
  const streamRef = useRef<RunStream | null>(null)
  const fetchedFor = useRef<string | null>(null)

  const close = useCallback(() => {
    streamRef.current?.close()
    streamRef.current = null
  }, [])
  useEffect(() => close, [close])

  const start = useCallback(async (req: CreateRunRequest) => {
    close()
    fetchedFor.current = null
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

  return { state, start, stop, loadReport }
}
