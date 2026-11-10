import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { AgentInfo, ApiClient, ControlValues, ExpectedVsObserved, RunEvent, RunStream, Scenario } from '../api'
import { initialRunState, runReducer } from './runState'

export interface ScenarioResult {
  runId: string
  decision: string | null
  verified: boolean | null
  checks: ExpectedVsObserved[]
}

export interface RunAllProgress { index: number; total: number }

export function defaultControls(s: Scenario): ControlValues {
  const out: ControlValues = {}
  for (const c of s.controls) out[c.id] = c.default
  return out
}

/** Owns the active run: starts it, feeds events to the reducer, supports step mode, stop and run-all. */
export function useRunController(client: ApiClient | null, agents: AgentInfo[], scenarios: Scenario[]) {
  const [state, dispatch] = useReducer(runReducer, agents, initialRunState)
  const [stepMode, setStepMode] = useState(false)
  const [queued, setQueued] = useState(0)
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, ScenarioResult>>({})
  const [runAll, setRunAll] = useState<RunAllProgress | null>(null)

  const streamRef = useRef<RunStream | null>(null)
  const queueRef = useRef<RunEvent[]>([])
  const settleRef = useRef<(() => void) | null>(null)
  const cancelAllRef = useRef(false)
  const agentsRef = useRef(agents)
  const applyRef = useRef<((ev: RunEvent) => void) | null>(null)

  useEffect(() => {
    agentsRef.current = agents
    dispatch({ type: 'reset', agents })
  }, [agents])

  const teardown = useCallback(() => {
    streamRef.current?.close()
    streamRef.current = null
    queueRef.current = []
    setQueued(0)
    settleRef.current?.()
    settleRef.current = null
  }, [])

  useEffect(() => teardown, [teardown])

  const startOne = useCallback(async (scenario: Scenario, controls: ControlValues, step: boolean): Promise<void> => {
    if (!client) return
    teardown()
    dispatch({ type: 'reset', agents: agentsRef.current })
    dispatch({ type: 'begin', scenarioId: scenario.id })
    setActiveScenarioId(scenario.id)
    setStepMode(step)
    let runId: string
    try {
      runId = (await client.startRun({ scenario_id: scenario.id, controls })).run_id
    } catch (e) {
      dispatch({ type: 'failed', error: `Could not start the run: ${e instanceof Error ? e.message : String(e)}` })
      return
    }
    await new Promise<void>((resolve) => {
      settleRef.current = resolve
      const apply = (ev: RunEvent) => {
        dispatch({ type: 'event', event: ev })
        if (ev.type === 'run_finished') {
          setResults((r) => ({
            ...r,
            [scenario.id]: { runId, decision: ev.final_decision_state, verified: ev.verified, checks: ev.expected_vs_observed },
          }))
          client.getRun(runId)
            .then((bundle) => {
              dispatch({ type: 'bundle', bundle })
              return client.getReport(runId).then((report) => dispatch({ type: 'report', report }), () => dispatch({ type: 'report', report: null }))
            })
            .catch((e) => dispatch({ type: 'failed', error: `Could not load the result bundle: ${e instanceof Error ? e.message : String(e)}` }))
            .finally(() => { settleRef.current?.(); settleRef.current = null })
        }
      }
      const onEvent = (ev: RunEvent) => {
        if (step) {
          queueRef.current.push(ev)
          setQueued(queueRef.current.length)
        } else apply(ev)
      }
      applyRef.current = apply
      streamRef.current = client.streamEvents(runId, onEvent, (err) => {
        dispatch({ type: 'failed', error: err.message })
        teardown()
      })
    })
  }, [client, teardown])


  const run = useCallback((s: Scenario, c: ControlValues) => { cancelAllRef.current = true; return startOne(s, c, false) }, [startOne])
  const runStepwise = useCallback((s: Scenario, c: ControlValues) => { cancelAllRef.current = true; return startOne(s, c, true) }, [startOne])

  const next = useCallback(() => {
    const ev = queueRef.current.shift()
    setQueued(queueRef.current.length)
    if (ev) applyRef.current?.(ev)
  }, [])

  const stop = useCallback(() => {
    cancelAllRef.current = true
    teardown()
    dispatch({ type: 'stopped' })
    setRunAll(null)
  }, [teardown])

  const runEvery = useCallback(async () => {
    cancelAllRef.current = false
    setResults({})
    for (let i = 0; i < scenarios.length; i++) {
      if (cancelAllRef.current) break
      setRunAll({ index: i, total: scenarios.length })
      const s = scenarios[i]!
      await startOne(s, defaultControls(s), false)
      if (cancelAllRef.current) break
      await new Promise((r) => setTimeout(r, 500))
    }
    setRunAll(null)
  }, [scenarios, startOne])

  return { state, stepMode, queued, activeScenarioId, results, runAll, run, runStepwise, next, stop, runEvery }
}
