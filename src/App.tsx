import { useCallback, useEffect, useState } from 'react'
import { getEpisodes, getFacility, health, type Episode, type Health, type RunMode } from './api'
import { Header } from './components/Header'
import { AgentBoard } from './components/AgentBoard'
import { AgentDrawer } from './components/AgentDrawer'
import { InvestigationTab } from './tabs/InvestigationTab'
import { InspectionTab } from './tabs/InspectionTab'
import { ReportTab } from './report/ReportTab'
import { MessageLog } from './components/MessageLog'
import { ModeBar } from './components/ModeBar'
import { OTHER, RunBar, SPEEDS } from './components/RunBar'
import { ServiceMessage, type ServiceStatus } from './components/ServiceMessage'
import { useRunController } from './state/useRunController'
import { TabBar } from './shell/TabBar'
import { TABS, useHashRoute, type TabId } from './shell/routes'
import { CommandCenter } from './command/CommandCenter'
import { FacilityView } from './facility/FacilityView'
import { agentList } from './state/runState'
import { usePref } from './lib/env'
import { describeError } from './lib/service'
import { SCENARIOS } from './lib/scenarios'
import { plural } from './lib/briefing'
import { STATIC_FACILITY, serviceMismatch, unknownIds } from './facility'

function TabPanel({ id, active, sub, children }: { id: TabId; active: TabId; sub?: string; children: React.ReactNode }) {
  if (id !== active) return null
  const label = TABS.find((t) => t.id === id)!.label
  return (
    <section id={`panel-${id}`} role="tabpanel" aria-labelledby={`tab-${id}`} className="page" tabIndex={-1}>
      <div className="page-head">
        <div><h2 className="page-title">{label}</h2>{sub && <p className="page-sub">{sub}</p>}</div>
      </div>
      {children}
    </section>
  )
}

export default function App() {
  const [tab, setTab] = useHashRoute()
  const [service, setService] = useState<ServiceStatus>({ state: 'checking' })
  const [modes, setModes] = useState<Health['modes'] | null>(null)
  const [mode, setMode] = useState<RunMode>('replay')
  const [episodes, setEpisodes] = useState<Episode[] | null>(null)
  const [episodesError, setEpisodesError] = useState<string | null>(null)
  const [episodeId, setEpisodeId] = useState('')
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0]!.episode_id)
  const [speed, setSpeed] = useState(SPEEDS[0]!)
  const [revealTruth, setRevealTruth] = useState(false)
  const [serviceIds, setServiceIds] = useState<string[] | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null)
  const [drawerRole, setDrawerRole] = useState<string | null>(null)
  const [twoD, setTwoD] = usePref('view2d', false)
  const [lowDetail, setLowDetail] = usePref('lowDetail', false)
  const ctl = useRunController()
  const run = ctl.state

  const checkService = useCallback(() => {
    setService({ state: 'checking' })
    health().then(
      (h) => {
        setModes(h.modes)
        setMode((m) => (h.modes[m] ? m : h.modes.replay ? 'replay' : h.modes.live ? 'live' : m))
        setService({ state: 'up' })
        getFacility().then((f) => setServiceIds(serviceMismatch(f)), () => setServiceIds(null))
      },
      (e) => setService({ state: 'down', message: describeError(e) }),
    )
  }, [])
  useEffect(() => { checkService() }, [checkService])

  const serviceUp = service.state === 'up'
  useEffect(() => {
    if (!serviceUp) return
    let cancelled = false
    setEpisodes(null)
    setEpisodesError(null)
    setEpisodeId('')
    if (modes && !modes[mode]) {
      // the service says this mode is off: no request, no error text; the run bar says why
      setEpisodes([])
      return
    }
    getEpisodes(mode).then(
      (r) => {
        if (cancelled) return
        setEpisodes(r.episodes)
        if (r.episodes.length === 0) {
          setEpisodesError(mode === 'replay'
            ? 'No replay episodes: the replay directory is empty or the service was started without --replay-dir.'
            : 'No live episodes are available: the service may have been started without --release.')
        }
      },
      (e) => { if (!cancelled) { setEpisodes([]); setEpisodesError(`The episode list could not be loaded. ${describeError(e)}`) } },
    )
    return () => { cancelled = true }
  }, [serviceUp, mode, modes])

  /** replay scenarios run their own episode; anything else uses the episode picker */
  const runEpisode = mode === 'replay' && scenarioId !== OTHER ? scenarioId : episodeId
  const agents = agentList(run)
  const agentsByKey = Object.fromEntries(agents.map((a) => [a.role_key, a]))
  const running = run.status === 'running' || run.status === 'starting'

  const runIds = Object.keys(run.sensors)
  const mismatch = [...new Set([...unknownIds(STATIC_FACILITY, runIds), ...(serviceIds ?? [])])]
  const mismatchBadge = mismatch.length > 0 && (
    <span className="badge-warn" tabIndex={0} title={`Ids that differ between the service and the layout snapshot: ${mismatch.join(', ')}`}
      aria-label={`Facility mismatch: ${mismatch.length} ids differ between the service and the layout snapshot: ${mismatch.join(', ')}`}>
      Facility mismatch · {mismatch.length}
    </span>
  )

  const retryReport = () => { if (run.run) void ctl.loadReport(run.run.run_id, run.report.state === 'ok' ? run.report.window : undefined) }

  const messages = (
    <>
      {run.status === 'failed' && <p className="state-msg state-error" role="alert">{run.error ?? 'The run failed.'} Nothing was concluded from this run.</p>}
      {run.status === 'stopped' && run.done === null && <p className="state-msg" role="status">Stopped watching before the run finished. Partial results are shown as they were.</p>}
      {run.connection === 'reconnecting' && running && <p className="state-msg" role="status">The event stream dropped. Reconnecting and resuming after event {run.lastSeq}…</p>}
      {run.status === 'finished' && run.done?.windows === 0 && <p className="state-msg" role="status">The run finished with no windows. The episode has nothing to play.</p>}
      {run.status === 'finished' && <p className="state-msg" role="status">Run finished after {plural(run.done?.windows)}.</p>}
    </>
  )

  const facilityView = (
    <FacilityView facility={STATIC_FACILITY} flagged={new Map()} readings={run.sensors} selectedId={selectedAsset} onSelect={setSelectedAsset}
      focusId={selectedAsset} twoD={twoD} onTwoD={setTwoD} lowDetail={lowDetail} onLowDetail={setLowDetail} agentName={(r) => agentsByKey[r]?.name ?? r} />
  )

  const failedAgents = Object.values(run.agents).filter((a) => a.state === 'error' || a.state === 'rejected' || a.state === 'nostatus').length
  const badges: Partial<Record<TabId, { text: string; tone?: 'fail' | 'warn' | 'info' }>> = {}
  if (failedAgents) badges.agents = { text: String(failedAgents), tone: 'fail' }
  if (run.events.length) badges.log = { text: String(run.events.length) }

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="backdrop" aria-hidden="true" />
      <Header status={run.status} extra={mismatchBadge}>
        <TabBar active={tab} onSelect={setTab} badges={badges} />
      </Header>
      <ModeBar run={run} />
      <main id="main" tabIndex={-1}>
        <TabPanel id="command" active={tab} sub="Simulated gasoline terminal. Synthetic data from the simulator, not plant data.">
          <ServiceMessage status={service} onRetry={checkService} />
          <RunBar mode={mode} onMode={setMode} modes={modes} episodes={episodes} episodesError={episodesError} scenarioId={scenarioId} onScenario={setScenarioId} episodeId={episodeId} onEpisode={setEpisodeId}
            speed={speed} onSpeed={setSpeed} revealTruth={revealTruth} onRevealTruth={setRevealTruth} status={run.status} serviceUp={serviceUp}
            onRun={() => void ctl.start({ mode, speed, ...(runEpisode ? { episode_id: runEpisode } : {}), reveal_truth: revealTruth })} onStop={ctl.stop} />
          {messages}
          <CommandCenter run={run} selectedAgent={drawerRole} onSelectAgent={(r) => setDrawerRole((cur) => (cur === r ? null : r))} onGo={setTab} stage={facilityView} />
        </TabPanel>
        <TabPanel id="agents" active={tab} sub="Status of the eight agents in the latest window, exactly as the service sent it.">
          {messages}<AgentBoard agents={agents} run={run} selected={drawerRole} onSelect={(r) => setDrawerRole((cur) => (cur === r ? null : r))} />
        </TabPanel>
        <TabPanel id="log" active={tab} sub="Every event received from the stream, in arrival order.">
          <MessageLog events={run.events} malformed={run.malformed} />
        </TabPanel>
        <TabPanel id="investigation" active={tab} sub="Agent outcomes, the persistence rule, report findings (unconfirmed) and, if asked for, the simulation truth.">
          {messages}<InvestigationTab run={run} onRetryReport={retryReport} />
        </TabPanel>
        <TabPanel id="inspection" active={tab} sub="Advisory options for an inspector to consider. A human decides.">
          {messages}<InspectionTab run={run} onRetryReport={retryReport} />
        </TabPanel>
        <TabPanel id="report" active={tab} sub="Maintenance report from the service (Agent 7). Save it as PDF for the maintenance team.">
          {messages}<ReportTab run={run} onPickWindow={(w) => run.run && void ctl.loadReport(run.run.run_id, w)} onRetry={retryReport} />
        </TabPanel>
      </main>
      {drawerRole && agentsByKey[drawerRole] && (
        <AgentDrawer info={agentsByKey[drawerRole]!} st={run.agents[drawerRole]} onClose={() => setDrawerRole(null)} />
      )}
    </div>
  )
}
