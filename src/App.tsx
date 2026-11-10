import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveApi, type AgentInfo, type ApiClient, type Scenario } from './api'
import { Header } from './components/Header'
import { ScenarioPicker } from './components/ScenarioPicker'
import { AgentBoard } from './components/AgentBoard'
import { AgentDrawer } from './components/AgentDrawer'
import { InvestigationTab } from './tabs/InvestigationTab'
import { InspectionTab } from './tabs/InspectionTab'
import { ReportTab } from './report/ReportTab'
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
import { hasWebGL, usePref } from './lib/env'
import { FocusView } from './command/FocusView'
import { SnapshotTaker } from './three/SnapshotTaker'
import { RunBar } from './components/RunBar'
import { ControlsDialog } from './components/ControlsDialog'
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
  // the old "#/scenarios" link opens the controls card over the command center
  const [controlsOpen, setControlsOpen] = useState(() => /^#\/?scenarios/.test(window.location.hash))
  const [facility, setFacility] = useState<Facility>(STATIC_FACILITY)
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null)
  const [focusFlag, setFocusFlag] = useState<string | null>(null)
  const [snapshots, setSnapshots] = useState<Record<string, string | null>>({})
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
  // when an agent flags an asset, ease the main camera to it (first newly flagged id wins)
  const seenFlags = useRef<{ runId: string | null; ids: string[] }>({ runId: null, ids: [] })
  const flagIds = (run.bundle?.flagged_assets.map((f) => f.asset) ?? run.flaggedAssetIds ?? []).join('|')
  useEffect(() => {
    const ids = flagIds ? flagIds.split('|') : []
    const seen = seenFlags.current
    if (seen.runId !== run.runId) {
      seenFlags.current = { runId: run.runId, ids: [] }
      setFocusFlag(null)
      setSelectedAsset(null)
    }
    const fresh = ids.filter((i) => !seenFlags.current.ids.includes(i))
    if (fresh.length) {
      seenFlags.current.ids = [...seenFlags.current.ids, ...fresh]
      setFocusFlag((cur) => cur ?? fresh[0]!)
      setSelectedAsset(null)
    }
  }, [flagIds, run.runId])
  const onSnapshot = useCallback((asset: string, url: string | null) => {
    setSnapshots((s) => ({ ...s, [`${ctl.state.runId}:${asset}`]: url }))
  }, [ctl.state.runId])
  const running = run.status === 'running'
  const scenario = scenarios.find((s) => s.id === selectedId) ?? null
  /** the scenario of the current run (may differ from the selected one) */
  const runScenario = scenarios.find((s) => s.id === run.scenarioId)
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
      onRun={() => scenario && void ctl.run(scenario, values)} onStop={ctl.stop} onMore={() => setControlsOpen(true)}
      stepMode={ctl.stepMode} queued={ctl.queued} onNext={ctl.next} />
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
  const flaggedList = flaggedAssets(run).map((f) => ({ ...f, by: f.by as string[] }))
  const flaggedMap = new Map(flaggedList.map((f) => [f.asset, { by: f.by, severity: f.severity }]))
  const agentName = (r: string) => agentsByKey[r]?.name ?? r
  const cameraFocus = selectedAsset ?? focusFlag
  const facilityView = (
    <FacilityView facility={facility} flagged={flaggedMap} readings={run.sensors} selectedId={selectedAsset} onSelect={setSelectedAsset}
      focusId={cameraFocus} twoD={twoD} onTwoD={setTwoD} lowDetail={lowDetail} onLowDetail={setLowDetail} agentName={agentName} />
  )
  const focusView = (title?: string) => flaggedList.length > 0 && (
    <FocusView facility={facility} flagged={flaggedList} readings={run.sensors} focusId={focusFlag} title={title}
      onFocus={(id) => { setFocusFlag(id); setSelectedAsset(null) }} agentName={agentName} twoD={twoD} lowDetail={lowDetail} />
  )
  // report snapshots: one per flagged asset, rendered off-screen once the report has arrived
  const pendingSnapshot = run.report !== undefined && run.runId && hasWebGL()
    ? flaggedList.find((f) => !(`${run.runId}:${f.asset}` in snapshots))?.asset ?? null : null
  const failedAgents = Object.values(run.agents).filter((a) => a.state === 'error' || a.state === 'rejected').length
  const badges: Partial<Record<TabId, { text: string; tone?: 'fail' | 'warn' | 'info' }>> = {}
  if (failedAgents) badges.agents = { text: String(failedAgents), tone: 'fail' }
  if (run.messages.length) badges.log = { text: String(run.messages.length) }
  const board = <AgentBoard agents={agents} run={run} selected={drawerRole} onSelect={(r) => setDrawerRole((cur) => (cur === r ? null : r))} />

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="backdrop" aria-hidden="true" />
      <Header demoReason={demoReason} status={run.status} extra={mismatchBadge}>
        <TabBar active={tab} onSelect={setTab} badges={badges} />
      </Header>
      <main id="main" tabIndex={-1}>
        <TabPanel id="command" active={tab} actions={runBar} sub="Simulated gasoline terminal. Simulated stream (replay of recorded windows), not live plant data.">
          {runMessages}
          <CommandCenter agents={agents} run={run} scenario={runScenario} simulated={client?.mode === 'mock'}
            selectedAgent={drawerRole} onSelectAgent={(r) => setDrawerRole((cur) => (cur === r ? null : r))} onGo={setTab} readings={run.status === 'idle' ? null : run.readingCount}
            stage={facilityView} focus={focusView()} />
        </TabPanel>
        <TabPanel id="agents" active={tab} sub="Live status of the eight agents. Select a card for its timing, issues and consumed reports.">
          {runMessages}{board}
        </TabPanel>
        <TabPanel id="log" active={tab} sub="Runner and agent requests, responses, attachments and issues.">
          <MessageLog messages={run.messages} agents={agents} />
        </TabPanel>
        <TabPanel id="investigation" active={tab} sub="Unconfirmed hypotheses, evidence and report ids, and a close-up of the flagged assets.">
          {runMessages}<InvestigationTab run={run} agents={agents} focus={focusView('Flagged assets, close-up')} />
        </TabPanel>
        <TabPanel id="inspection" active={tab} sub="Advisory options for an inspector to consider. A human decides.">
          {runMessages}<InspectionTab run={run} />
        </TabPanel>
        <TabPanel id="report" active={tab} sub="Maintenance report built from the run data. Save it as PDF for the maintenance team.">
          {runMessages}
          <ReportTab run={run} agents={agents} scenario={runScenario} facility={facility} source={client?.mode === 'real' ? 'api' : 'mock'}
            snapshots={Object.fromEntries(flaggedList.map((f) => [f.asset, snapshots[`${run.runId}:${f.asset}`] ?? null]))}
            pending={run.report === undefined || !!pendingSnapshot} />
        </TabPanel>
      </main>
      {drawerRole && agentsByKey[drawerRole] && (
        <AgentDrawer info={agentsByKey[drawerRole]!} st={run.agents[drawerRole]} lastTs={run.lastTs} agentsByKey={agentsByKey} onClose={() => setDrawerRole(null)} />
      )}
      <ControlsDialog open={controlsOpen} onClose={() => setControlsOpen(false)}>
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
              onRun={() => { if (scenario) { setControlsOpen(false); void ctl.run(scenario, values) } }}
              onRunStep={() => { if (scenario) { setControlsOpen(false); void ctl.runStepwise(scenario, values) } }}
              onNext={ctl.next} onRunAll={() => { setControlsOpen(false); void ctl.runEvery() }} onStop={ctl.stop}
            />
            <ScenarioChecks scenarios={scenarios} results={ctl.results} activeId={ctl.activeScenarioId} />
          </div>
        </div>
      </ControlsDialog>
      {pendingSnapshot && (
        <SnapshotTaker key={`${run.runId}:${pendingSnapshot}`} facility={facility} assetId={pendingSnapshot} flagged={flaggedMap} readings={run.sensors} onDone={onSnapshot} />
      )}
      <footer className="honesty-bar" role="note">
        <strong>Advisory only.</strong> A human decides. No automatic action is authorised.
      </footer>
    </div>
  )
}
