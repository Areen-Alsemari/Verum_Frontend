import { useEffect, useState } from 'react'
import { resolveApi, type AgentInfo, type ApiClient, type Scenario } from './api'
import { Header } from './components/Header'
import { ScenarioPicker } from './components/ScenarioPicker'
import { AgentBoard } from './components/AgentBoard'
import { AgentDrawer } from './components/AgentDrawer'
import { ResultView } from './components/ResultView'
import { ScenarioChecks } from './components/ScenarioChecks'
import { MessageLog } from './components/MessageLog'
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
  const [drawerRole, setDrawerRole] = useState<string | null>(null)
  const agentsByKey = Object.fromEntries(agents.map((a) => [a.role_key, a]))
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
          {loadError && <p className="state-msg state-error" role="alert">Could not load data: {loadError}. <button type="button" className="btn btn-ghost" onClick={() => window.location.reload()}>Retry</button></p>}
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
        <main className="main">
          {run.status === 'failed' && <p className="state-msg state-error" role="alert">{run.error ?? 'The run failed.'} Nothing was concluded from this run.</p>}
          {run.status === 'stopped' && <p className="state-msg" role="status">Run stopped before it finished. Partial results are shown as they were.</p>}
          <AgentBoard agents={agents} run={run} selected={drawerRole} onSelect={(r) => setDrawerRole((cur) => (cur === r ? null : r))} />
          <div className="lower">
            <MessageLog messages={run.messages} agents={agents} />
            <ResultView run={run} agents={agents} />
          </div>
          <ScenarioChecks scenarios={scenarios} results={ctl.results} activeId={ctl.activeScenarioId} />
        </main>
      </div>
      {drawerRole && agentsByKey[drawerRole] && (
        <AgentDrawer info={agentsByKey[drawerRole]!} st={run.agents[drawerRole]} lastTs={run.lastTs} agentsByKey={agentsByKey} onClose={() => setDrawerRole(null)} />
      )}
      <footer className="honesty-bar" role="note">
        <strong>Advisory only.</strong> A human decides. No automatic action is authorised.
      </footer>
    </div>
  )
}
