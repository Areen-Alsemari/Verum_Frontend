import { useEffect, useState } from 'react'
import { resolveApi, type AgentInfo, type ApiClient, type Scenario } from './api'
import { Header } from './components/Header'
import { ScenarioPicker } from './components/ScenarioPicker'
import { ControlPanel } from './components/ControlPanel'
import { defaultControls, useRunController } from './state/useRunController'
import type { ControlValue, ControlValues } from './api'

export default function App() {
  const [client, setClient] = useState<ApiClient | null>(null)
  const [demoReason, setDemoReason] = useState<string | null>(null)
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const api = await resolveApi()
        const [a, s] = await Promise.all([api.client.listAgents(), api.client.listScenarios()])
        if (cancelled) return
        setClient(api.client)
        setDemoReason(api.client.mode === 'mock' ? api.mockReason : null)
        setAgents([...a].sort((x, y) => x.order - y.order))
        setScenarios(s)
        setSelectedId(s[0]?.id ?? null)
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => { cancelled = true }
  }, [])

  const [controlValues, setControlValues] = useState<Record<string, ControlValues>>({})
  const ctl = useRunController(client, agents, scenarios)
  const run = ctl.state
  const running = run.status === 'running'
  const scenario = scenarios.find((s) => s.id === selectedId) ?? null
  const values: ControlValues = scenario ? { ...defaultControls(scenario), ...controlValues[scenario.id] } : {}
  const setValue = (id: string, v: ControlValue) =>
    scenario && setControlValues((c) => ({ ...c, [scenario.id]: { ...values, [id]: v } }))

  return (
    <div className="app">
      <Header demoReason={demoReason} status={run.status} />
      <div className="workspace">
        <aside className="sidebar">
          {loadError && <p className="state-msg state-error" role="alert">Could not load data: {loadError}</p>}
          {!client && !loadError && <p className="state-msg" role="status">Loading scenarios…</p>}
          <ScenarioPicker scenarios={scenarios} selectedId={selectedId} disabled={running} onSelect={setSelectedId} />
          <ControlPanel
            scenario={scenario} values={values} running={running} stepMode={ctl.stepMode} queued={ctl.queued}
            runAll={ctl.runAll} isMock={client?.mode === 'mock'}
            onChange={setValue}
            onReset={() => scenario && setControlValues((c) => ({ ...c, [scenario.id]: defaultControls(scenario) }))}
            onRun={() => scenario && void ctl.run(scenario, values)}
            onRunStep={() => scenario && void ctl.runStepwise(scenario, values)}
            onNext={ctl.next} onRunAll={() => void ctl.runEvery()} onStop={ctl.stop}
          />
        </aside>
        <main className="main" />
      </div>
      <footer className="honesty-bar" role="note">
        <strong>Advisory only.</strong> A human decides. No automatic action is authorised.
      </footer>
    </div>
  )
}
