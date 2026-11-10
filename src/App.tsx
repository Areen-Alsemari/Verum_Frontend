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
import { TabBar } from './shell/TabBar'
import { TABS, useHashRoute, type TabId } from './shell/routes'
import { CommandCenter } from './command/CommandCenter'
import { FacilityView } from './facility/FacilityView'
import { flaggedAssets } from './state/runState'
import { usePref } from './lib/env'
import { RunBar } from './components/RunBar'
import { STATIC_FACILITY, facilityFromDto, snapshotMismatch, unknownIds, type Facility } from './facility'

function TabPanel({ id, active, actions, sub, children }: { id: TabId; active: TabId; actions?: React.ReactNode; sub?: string; children: React.ReactNode }) {
  if (id !== active) return null
  const label = TABS.find((t) => t.id === id)!.label
  return (
    <section id={`panel-${id}`} role="tabpanel" aria-labelledby={`tab-${id}`} className="page" tabIndex={-1}>
      <div className="page-head">
        <div><h2 className="page-title">{label}</h2>{sub && <p className="page-sub">{sub}</p>}</div>
        {actions}
      </div>
      {children}
    </section>
  )
}

export default function App() {
  const [client, setClient] = useState<ApiClient | null>(null)
  const [demoReason, setDemoReason] = useState<string | null>(null)
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useHashRoute()
  const [facility, setFacility] = useState<Facility>(STATIC_FACILITY)
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null)
  const [twoD, setTwoD] = usePref('view2d', false)
  const [lowDetail, setLowDetail] = usePref('lowDetail', false)

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
        const dto = await api.client.getFacility().catch(() => null)
        if (!cancelled && dto && api.client.mode === 'real') setFacility(facilityFromDto(dto))
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

  const runMessages = (
    <>
      {loadError && <p className="state-msg state-error" role="alert">Could not load data: {loadError}. <button type="button" className="btn btn-ghost" onClick={() => window.location.reload()}>Retry</button></p>}
      {!client && !loadError && <p className="state-msg" role="status">Loading scenarios…</p>}
      {run.status === 'failed' && <p className="state-msg state-error" role="alert">{run.error ?? 'The run failed.'} Nothing was concluded from this run.</p>}
      {run.status === 'stopped' && <p className="state-msg" role="status">Run stopped before it finished. Partial results are shown as they were.</p>}
    </>
  )
  const runBar = (
    <RunBar scenarios={scenarios} selectedId={selectedId} status={run.status} onSelect={setSelectedId}
      onRun={() => scenario && void ctl.run(scenario, values)} onStop={ctl.stop} onMore={() => setTab('scenarios')} />
  )
  // ids from the run (or the API facility) that the snapshot does not contain
  const runIds = [
    ...(run.bundle?.flagged_assets.map((f) => f.asset) ?? []), ...(run.flaggedAssetIds ?? []),
    ...Object.keys(run.sensors), ...(run.bundle?.inspection_options.flatMap((o) => o.targets) ?? []),
  ]
  const mismatch = [...new Set([...unknownIds(facility, runIds), ...(facility.origin === 'api' ? snapshotMismatch(facility) : [])])]
  const mismatchBadge = mismatch.length > 0 && (
    <span className="badge-warn" tabIndex={0} title={`Ids not in the facility snapshot: ${mismatch.join(', ')}`} aria-label={`Facility mismatch: ${mismatch.length} ids not in the facility snapshot: ${mismatch.join(', ')}`}>
      Facility mismatch · {mismatch.length}
    </span>
  )
  const flaggedMap = new Map(flaggedAssets(run).map((f) => [f.asset, { by: f.by as string[], severity: f.severity }]))
  const agentName = (r: string) => agentsByKey[r]?.name ?? r
  const facilityView = (
    <FacilityView facility={facility} flagged={flaggedMap} readings={run.sensors} selectedId={selectedAsset} onSelect={setSelectedAsset}
      focusId={selectedAsset} twoD={twoD} onTwoD={setTwoD} lowDetail={lowDetail} onLowDetail={setLowDetail} agentName={agentName} />
  )
  const failedAgents = Object.values(run.agents).filter((a) => a.state === 'error' || a.state === 'rejected').length
  const badges: Partial<Record<TabId, { text: string; tone?: 'fail' | 'warn' | 'info' }>> = {}
  if (failedAgents) badges.agents = { text: String(failedAgents), tone: 'fail' }
  if (run.messages.length) badges.log = { text: String(run.messages.length) }
  const board = <AgentBoard agents={agents} run={run} selected={drawerRole} onSelect={(r) => setDrawerRole((cur) => (cur === r ? null : r))} />

  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true" />
      <Header demoReason={demoReason} status={run.status} extra={mismatchBadge}>
        <TabBar active={tab} onSelect={setTab} badges={badges} />
      </Header>
      <main>
        <TabPanel id="command" active={tab} actions={runBar} sub="Simulated gasoline terminal. Simulated stream (replay of recorded windows), not live plant data.">
          {runMessages}
          <CommandCenter agents={agents} run={run} scenario={scenario ?? undefined} simulated={client?.mode === 'mock'}
            selectedAgent={drawerRole} onSelectAgent={(r) => setDrawerRole((cur) => (cur === r ? null : r))} onGo={setTab} readings={run.status === 'idle' ? null : run.readingCount}
            stage={facilityView} />
        </TabPanel>
        <TabPanel id="scenarios" active={tab}>
          {runMessages}
          <div className="grid-side">
            <div className="stack">
              <ScenarioPicker scenarios={scenarios} selectedId={selectedId} disabled={running} onSelect={setSelectedId} />
            </div>
            <div className="stack">
              <ControlPanel
                scenario={scenario} values={values} running={running} stepMode={ctl.stepMode} queued={ctl.queued}
                runAll={ctl.runAll} isMock={client?.mode === 'mock'}
                onChange={setValue}
                onReset={() => scenario && setControlValues((c) => ({ ...c, [scenario.id]: defaultControls(scenario) }))}
                onRun={() => scenario && void ctl.run(scenario, values)}
                onRunStep={() => scenario && void ctl.runStepwise(scenario, values)}
                onNext={ctl.next} onRunAll={() => void ctl.runEvery()} onStop={ctl.stop}
              />
              <ScenarioChecks scenarios={scenarios} results={ctl.results} activeId={ctl.activeScenarioId} />
            </div>
          </div>
        </TabPanel>
        <TabPanel id="agents" active={tab} actions={runBar}>{runMessages}{board}</TabPanel>
        <TabPanel id="log" active={tab} actions={runBar}><MessageLog messages={run.messages} agents={agents} /></TabPanel>
        <TabPanel id="investigation" active={tab} actions={runBar}>{runMessages}<ResultView run={run} agents={agents} /></TabPanel>
        <TabPanel id="inspection" active={tab} actions={runBar}>{runMessages}<ResultView run={run} agents={agents} /></TabPanel>
        <TabPanel id="report" active={tab} actions={runBar}>{runMessages}<ResultView run={run} agents={agents} /></TabPanel>
      </main>
      {drawerRole && agentsByKey[drawerRole] && (
        <AgentDrawer info={agentsByKey[drawerRole]!} st={run.agents[drawerRole]} lastTs={run.lastTs} agentsByKey={agentsByKey} onClose={() => setDrawerRole(null)} />
      )}
      <footer className="honesty-bar" role="note">
        <strong>Advisory only.</strong> A human decides. No automatic action is authorised.
      </footer>
    </div>
  )
}
