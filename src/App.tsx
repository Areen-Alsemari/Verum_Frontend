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
import { ControlPanel, DEFAULT_SPEED, OTHER } from './components/ControlPanel'
import { ServiceMessage, type ServiceStatus } from './components/ServiceMessage'
import { useRunController } from './state/useRunController'
import { TabBar } from './shell/TabBar'
import { TABS, useHashRoute, visibleTabs, type TabId } from './shell/routes'
import { AboutTab } from './tabs/AboutTab'
import { useDevView } from './lib/dev'
import { CommandCenter } from './command/CommandCenter'
import { FacilityView } from './facility/FacilityView'
import { agentList } from './state/runState'
import { usePref } from './lib/env'
import { describeError } from './lib/service'
import { SCENARIOS } from './lib/scenarios'
import { STATIC_FACILITY, serviceMismatch, unknownIds } from './facility'
import { cameraFocus, candidateFromReport, flaggedFor, highlightId } from './lib/candidate'

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
  const [dev, toggleDev] = useDevView()
  const [service, setService] = useState<ServiceStatus>({ state: 'checking' })
  const [modes, setModes] = useState<Health['modes'] | null>(null)
  const [mode, setMode] = useState<RunMode>('replay')
  const [episodes, setEpisodes] = useState<Episode[] | null>(null)
  const [episodesError, setEpisodesError] = useState<string | null>(null)
  const [episodeId, setEpisodeId] = useState('')
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0]!.episode_id)
  const [speed, setSpeed] = useState(DEFAULT_SPEED)
  const [revealTruth, setRevealTruth] = useState(false)
  const [serviceIds, setServiceIds] = useState<string[] | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null)
  /** the candidate the camera has been taken away from with Reset view */
  const [resetFor, setResetFor] = useState<string | null>(null)
  const [drawerRole, setDrawerRole] = useState<string | null>(null)
  const [twoD, setTwoD] = usePref('view2d', false)
  const [lowDetail, setLowDetail] = usePref('lowDetail', false)
  const ctl = useRunController()
  // what the screens show: the latest window, or the window the playback controls hold
  const run = ctl.view
  const setPace = ctl.playback.setPace
  useEffect(() => { setPace(Math.max(250, Math.min(5000, 300000 / speed))) }, [setPace, speed])

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
  const runEpisode = episodeId || (scenarioId !== OTHER ? scenarioId : '')
  const agents = agentList(run)
  const agentsByKey = Object.fromEntries(agents.map((a) => [a.role_key, a]))
  const running = run.status === 'running' || run.status === 'starting'

  const runIds = Object.keys(run.sensors)
  const mismatch = [...new Set([...unknownIds(STATIC_FACILITY, runIds), ...(serviceIds ?? [])])]
  const mismatchBadge = dev && mismatch.length > 0 && (
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
    </>
  )

  // the one highlighted asset is Agent 5's top hypothesis asset from the report; never the simulation truth
  const { candidate } = candidateFromReport(run.report, run.windowIndex)
  const candidateId = highlightId(candidate, STATIC_FACILITY)
  const flagged = flaggedFor(candidate, STATIC_FACILITY)

  // the camera goes to the candidate asset by itself; a chosen asset or Reset view takes over
  const zoomId = cameraFocus(null, candidateId, resetFor)
  const resetView = () => { setSelectedAsset(null); setResetFor(candidateId) }
  const runKey = run.run?.run_id ?? null
  useEffect(() => { setResetFor(null); setSelectedAsset(null) }, [runKey])

  const facilityView = (
    <FacilityView facility={STATIC_FACILITY} flagged={flagged} readings={run.sensors} selectedId={selectedAsset} onSelect={setSelectedAsset}
      focusId={selectedAsset ?? zoomId} onResetView={resetView} twoD={twoD} onTwoD={setTwoD} lowDetail={lowDetail} onLowDetail={setLowDetail} agentName={(r) => agentsByKey[r]?.name ?? r} />
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
        <TabBar active={tab} onSelect={setTab} badges={badges} tabs={visibleTabs(dev)} />
      </Header>
      {dev && <ModeBar run={run} />}
      <main id="main" tabIndex={-1}>
        <TabPanel id="command" active={tab} sub="What is happening on the plant, which equipment is affected and what to do next.">
          <ServiceMessage status={service} onRetry={checkService} />
          <ControlPanel mode={mode} onMode={setMode} modes={modes} episodes={episodes} episodesError={episodesError} scenarioId={scenarioId}
            onScenario={(id) => { setScenarioId(id); setEpisodeId('') }} episodeId={episodeId} onEpisode={(id) => { setEpisodeId(id); if (id) setScenarioId(OTHER) }}
            speed={speed} onSpeed={setSpeed} revealTruth={revealTruth} onRevealTruth={setRevealTruth} status={run.status} serviceUp={serviceUp}
            onRun={() => void ctl.start({ mode, speed, ...(runEpisode ? { episode_id: runEpisode } : {}), reveal_truth: revealTruth })} onStop={ctl.stop}
            onReset={() => { setScenarioId(SCENARIOS[0]!.episode_id); setEpisodeId(''); setMode(modes && !modes.replay && modes.live ? 'live' : 'replay'); setSpeed(DEFAULT_SPEED); setRevealTruth(false); ctl.live() }}
            run={run} playback={ctl.playback} onPause={ctl.pause} onResume={ctl.resume} onPrev={() => ctl.step(-1)} onNext={() => ctl.step(1)} onLive={ctl.live} onSeek={ctl.seek}
            onRestart={() => { if (run.run) void ctl.start({ mode: run.run.mode, speed: run.run.speed, episode_id: run.run.episode_id, reveal_truth: run.run.reveal_truth }) }} />
          {messages}
          <CommandCenter run={run} selectedAgent={drawerRole} onSelectAgent={(r) => setDrawerRole((cur) => (cur === r ? null : r))} onGo={setTab} stage={facilityView} highlighted={candidateId} dev={dev} />
        </TabPanel>
        <TabPanel id="agents" active={tab} sub="The eight agents and what each one is doing.">
          {messages}<AgentBoard agents={agents} run={run} selected={drawerRole} onSelect={(r) => setDrawerRole((cur) => (cur === r ? null : r))} />
        </TabPanel>
        <TabPanel id="log" active={tab} sub="Every event received from the stream, in arrival order.">
          <MessageLog events={run.events} malformed={run.malformed} />
        </TabPanel>
        <TabPanel id="investigation" active={tab} sub="What was found, how the readings are trending and, if asked for, the simulated truth.">
          {messages}<InvestigationTab run={run} onRetryReport={retryReport} dev={dev} />
        </TabPanel>
        <TabPanel id="inspection" active={tab} sub="What to check on site. A person decides.">
          {messages}<InspectionTab run={run} onRetryReport={retryReport} />
        </TabPanel>
        <TabPanel id="about" active={tab} sub="Simulated plant data, advisory only.">
          <AboutTab run={run} />
        </TabPanel>
        <TabPanel id="report" active={tab} sub="A one-page summary for the maintenance team.">
          {messages}<ReportTab run={run} onPickWindow={(w) => run.run && void ctl.loadReport(run.run.run_id, w)} onRetry={retryReport} />
        </TabPanel>
      </main>
      {drawerRole && agentsByKey[drawerRole] && (
        <AgentDrawer info={agentsByKey[drawerRole]!} run={run} dev={dev} onClose={() => setDrawerRole(null)} />
      )}
      <footer className="app-footer">
        <a href="#/about">About</a>
        <button type="button" className="link-btn" onClick={toggleDev} aria-pressed={dev}>Developer view{dev ? ': on' : ''}</button>
      </footer>
    </div>
  )
}
