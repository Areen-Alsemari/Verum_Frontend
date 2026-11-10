import type {
  AgentFinishedEvent, AgentStatus, AssetId, ControlValues, EvidenceVerification, ExpectedVsObserved,
  FlaggedAsset, Hypothesis, InspectionOption, Issue, RoleKey, RunBundle, RunEvent, Severity,
} from '../types'
import { AGENTS, DEFAULT_FAULT_ASSET, SCENARIOS } from './data'
import { STATIC_FACILITY as F, assetById, downstreamPipes, firstOfKind } from '../../facility'

export interface TimedEvent {
  /** milliseconds since the run started (virtual time) */
  at: number
  event: RunEvent
}

export interface MockRun {
  events: TimedEvent[]
  bundle: RunBundle
}

interface Outcome {
  status: AgentStatus
  issues: Issue[]
  report: string | null
  duration: number
}

const ORDER = AGENTS.map((a) => a.role_key)
const orderOf = (r: RoleKey) => ORDER.indexOf(r) + 1
const reportId = (r: RoleKey) => `rpt-${orderOf(r)}`
const nameOf = (r: RoleKey) => AGENTS.find((a) => a.role_key === r)?.name ?? r

/** Hypothesis family per facility kind. Kinds without a family use the generic one. */
type Category = 'pump' | 'valve' | 'pipeline' | 'sensor' | 'tank' | 'equipment'
const CATEGORY: Record<string, Category> = {
  pump: 'pump', isolation_valve: 'valve', pipe: 'pipeline', pressure_transmitter: 'sensor', tank: 'tank',
}
const CATEGORY_NOUN: Record<Category, string> = {
  pump: 'pump', valve: 'valve', pipeline: 'pipe segment', sensor: 'pressure transmitter', tank: 'tank', equipment: 'asset',
}
const categoryOf = (id: string): Category => CATEGORY[assetById(F, id)?.kind ?? ''] ?? 'equipment'
const locLabelOf = (id: string) => `${CATEGORY_NOUN[categoryOf(id)]} ${id}`

/** Asset where the fault sits for each scenario (null = no fault). Ids come from the facility snapshot. */
function faultAssetFor(scenarioId: string, c: ControlValues): string | null {
  if (scenarioId === 'quiet_window') return null
  if (scenarioId === 'developing_fault') return str(c, 'fault_location', DEFAULT_FAULT_ASSET)
  return DEFAULT_FAULT_ASSET
}

/** A pressure transmitter next to the asset: on a pipe or node feeding it, else the first one. */
function transmitterNear(id: string): string {
  const pts = F.assets.filter((a) => a.kind === 'pressure_transmitter')
  const into = F.assets.filter((p) => p.graph_role === 'edge' && (p.to_node === id || p.to_node?.startsWith(`${id}:`)))
  const near = [...into.map((p) => p.asset_id), ...into.map((p) => p.from_node ?? ''), ...downstreamPipes(F, id).map((p) => p.asset_id)]
  return pts.find((p) => near.includes(p.mounted_on?.element_id ?? ''))?.asset_id ?? pts[0]?.asset_id ?? id
}

/** The pump the asset feeds, else the first pump. */
function pumpNear(id: string): string {
  const next = downstreamPipes(F, id).map((p) => p.to_node).find((n) => n && assetById(F, n)?.kind === 'pump')
  return next ?? firstOfKind(F, 'pump')?.asset_id ?? id
}

function num(c: ControlValues, k: string, d: number): number {
  const v = c[k]
  return typeof v === 'number' ? v : d
}
function bool(c: ControlValues, k: string, d: boolean): boolean {
  const v = c[k]
  return typeof v === 'boolean' ? v : d
}
function str(c: ControlValues, k: string, d: string): string {
  const v = c[k]
  return typeof v === 'string' ? v : d
}

/** Decide what each of the eight agents does for a scenario + control values. */
function planOutcomes(scenarioId: string, c: ControlValues): Record<RoleKey, Outcome> {
  const o = {} as Record<RoleKey, Outcome>
  const ok = (_role: RoleKey, report: string, duration: number): Outcome => ({ status: 'complete', issues: [], report, duration })

  const faultLoc = faultAssetFor(scenarioId, c)
  const dropRate = scenarioId === 'developing_fault' ? num(c, 'pressure_drop_rate', 12) : scenarioId === 'quiet_window' ? 0 : 14
  const hasAnomaly = faultLoc !== null && dropRate >= 3
  const locLabel = faultLoc ? locLabelOf(faultLoc) : ''
  const faultAsset = faultLoc ? assetById(F, faultLoc) : undefined
  const downstream = faultLoc ? downstreamPipes(F, faultLoc).map((p) => p.asset_id) : []

  // 1 predictive_health
  if (scenarioId === 'quiet_window' && bool(c, 'sensor_dropout', false)) {
    o.predictive_health = {
      status: 'insufficient_evidence', duration: 900, report: 'Pressure channel missing for part of the window; trend not computed for it.',
      issues: [{ code: 'SENSOR_CHANNEL_MISSING', message: 'Pressure sensor stopped reporting during the window.', severity: 'warning' }],
    }
  } else {
    o.predictive_health = ok('predictive_health',
      hasAnomaly ? `Health trend for the ${locLabel} is worsening over the window.` : 'No worsening health trend on any asset in the window.', 1100)
  }

  // 2 anomaly_detection
  if (scenarioId === 'quiet_window' && num(c, 'noise_level', 0.1) > 0.6) {
    o.anomaly_detection = {
      status: 'degraded', duration: 1500, report: 'Anomaly search ran, but noise limits what can be concluded.',
      issues: [{ code: 'NOISE_HIGH', message: 'Noise level above the range the detector was tuned for.', severity: 'warning' }],
    }
  } else if (scenarioId === 'quiet_window' && bool(c, 'sensor_dropout', false)) {
    o.anomaly_detection = {
      status: 'degraded', duration: 1300, report: 'Anomaly search ran on the channels that were available.',
      issues: [{ code: 'SENSOR_CHANNEL_MISSING', message: 'Missing pressure channel excluded.', severity: 'warning' }],
    }
  } else {
    o.anomaly_detection = ok('anomaly_detection',
      hasAnomaly ? `Pressure drop of ${dropRate} kPa/h observed near the ${locLabel}.` : 'No reading departs from the expected pattern.', 1400)
  }

  // 3 topology_dependency
  o.topology_dependency = ok('topology_dependency',
    hasAnomaly
      ? `The ${locLabel} is in the ${(faultAsset?.area ?? 'unassigned area').toLowerCase()} and connects to ${faultAsset?.connects_to.join(', ') || 'no declared element'}.${downstream.length ? ` Downstream: ${downstream.join(', ')}.` : ''}`
      : 'No dependency path needs attention.', 1000)

  // 4 historical_asset_intelligence
  if (scenarioId === 'developing_fault' && !bool(c, 'history_available', true)) {
    o.historical_asset_intelligence = {
      status: 'insufficient_evidence', duration: 800, report: null,
      issues: [{ code: 'HISTORY_UNAVAILABLE', message: 'No maintenance history was provided.', severity: 'warning' }],
    }
    o.historical_asset_intelligence.report = 'No history records were available to compare against.'
  } else if (scenarioId === 'agent_conflict') {
    o.historical_asset_intelligence = ok('historical_asset_intelligence',
      `Past records for ${str(c, 'disagreeing_pair', 'valve_vs_sensor') === 'valve_vs_sensor' ? transmitterNear(DEFAULT_FAULT_ASSET) : pumpNear(DEFAULT_FAULT_ASSET)} point to a different explanation than the readings near ${DEFAULT_FAULT_ASSET}.`, 1200)
  } else {
    o.historical_asset_intelligence = ok('historical_asset_intelligence',
      hasAnomaly ? `Records for the ${locLabel} include earlier maintenance entries relevant to this pattern.` : 'No relevant past events found.', 1200)
  }

  // 5 diagnostic_reasoning
  if (scenarioId === 'agent_conflict' && !bool(c, 'extra_evidence', false)) {
    o.diagnostic_reasoning = {
      status: 'degraded', duration: 1700,
      report: 'Two explanations remain open and the evidence does not separate them.',
      issues: [{ code: 'EVIDENCE_CONFLICT', message: 'Anomaly agent and historical agent point to different explanations.', severity: 'warning' }],
    }
  } else if (!hasAnomaly) {
    o.diagnostic_reasoning = ok('diagnostic_reasoning', 'No fault hypothesis is supported by the evidence.', 1200)
  } else {
    o.diagnostic_reasoning = ok('diagnostic_reasoning',
      `Leading hypothesis concerns the ${locLabel}. Alternatives are still open.`, 1800)
  }

  // 6 inspection_planning
  o.inspection_planning = hasAnomaly
    ? ok('inspection_planning', 'Inspection options listed for the open hypotheses.', 1300)
    : ok('inspection_planning', 'No inspection options needed for this window.', 700)

  // 7 inspection_quality_documentation
  o.inspection_quality_documentation = ok('inspection_quality_documentation',
    hasAnomaly ? 'Report drafted; every statement is linked to evidence ids.' : 'Short report drafted: nothing to flag in this window.', 1100)

  // 8 evidence_verification_decision
  if (scenarioId === 'agent_conflict' && !bool(c, 'extra_evidence', false)) {
    o.evidence_verification_decision = {
      status: 'degraded', duration: 1200, report: 'Claims checked. The conflict between the two explanations is not resolved.',
      issues: [{ code: 'EVIDENCE_CONFLICT', message: 'Conflicting evidence carried into the decision state.', severity: 'warning' }],
    }
  } else {
    o.evidence_verification_decision = ok('evidence_verification_decision', 'Claims checked against the cited evidence.', 1000)
  }

  // ---- injected failure --------------------------------------------------
  if (scenarioId === 'agent_failure') {
    const failing = str(c, 'failing_agent', 'topology_dependency') as RoleKey
    const mode = str(c, 'failure_mode', 'AGENT_INVALID_RESPONSE')
    if (ORDER.includes(failing)) {
      const rejected = mode === 'AGENT_INVALID_RESPONSE'
      o[failing] = {
        status: rejected ? 'rejected_by_runner' : 'error',
        report: null,
        duration: 600,
        issues: [{
          code: mode, severity: 'error',
          message: rejected ? 'Response did not match the required schema and was rejected by the runner.' : 'The agent raised an error while working.',
        }],
      }
    }
  }

  // ---- downstream effects of a missing upstream report -------------------
  const missing = (r: RoleKey[]) => r.filter((x) => o[x].report === null)
  const marks: [RoleKey, RoleKey[], AgentStatus][] = [
    ['diagnostic_reasoning', ['predictive_health', 'anomaly_detection', 'topology_dependency', 'historical_asset_intelligence'], 'degraded'],
    ['inspection_planning', ['diagnostic_reasoning'], 'insufficient_evidence'],
    ['inspection_quality_documentation', ['diagnostic_reasoning', 'inspection_planning'], 'degraded'],
    ['evidence_verification_decision', ['diagnostic_reasoning', 'inspection_planning', 'inspection_quality_documentation'], 'degraded'],
  ]
  for (const [role, ups, status] of marks) {
    const m = missing(ups)
    if (m.length === 0 || o[role].report === null) continue
    o[role] = {
      ...o[role],
      status: o[role].status === 'complete' ? status : o[role].status,
      issues: [...o[role].issues, {
        code: 'UPSTREAM_REPORT_MISSING', severity: 'warning',
        message: `No report from ${m.map(nameOf).join(', ')}.`,
      }],
    }
  }
  return o
}

function consumedFor(role: RoleKey, o: Record<RoleKey, Outcome>): string[] {
  const ups = AGENTS.find((a) => a.role_key === role)?.depends_on ?? []
  return ups.filter((u) => o[u].report !== null).map(reportId)
}

function sevFor(rate: number): Severity {
  return rate >= 25 ? 'critical' : rate >= 8 ? 'warning' : 'info'
}

function buildBundle(runId: string, scenarioId: string, c: ControlValues, o: Record<RoleKey, Outcome>): RunBundle {
  const conflict = scenarioId === 'agent_conflict' && !bool(c, 'extra_evidence', false)
  const faultLoc = faultAssetFor(scenarioId, c)
  const rate = scenarioId === 'developing_fault' ? num(c, 'pressure_drop_rate', 12) : scenarioId === 'quiet_window' ? 0 : 14
  const hasAnomaly = faultLoc !== null && rate >= 3
  const anyFailed = ORDER.some((r) => o[r].status === 'error' || o[r].status === 'rejected_by_runner')
  const allComplete = ORDER.every((r) => o[r].status === 'complete')

  const flagged: FlaggedAsset[] = []
  if (hasAnomaly && faultLoc) {
    const sev = sevFor(rate)
    const by = (['anomaly_detection', 'topology_dependency', 'diagnostic_reasoning'] as RoleKey[]).filter((r) => o[r].report !== null)
    flagged.push({ asset: faultLoc, flagged_by: by, severity: sev, note: `Pressure drop of ${rate} kPa/h reported near this asset.` })
    const down = downstreamPipes(F, faultLoc).find((p) => p.asset_id !== faultLoc)
    if (down && categoryOf(faultLoc) !== 'pipeline' && o.topology_dependency.report !== null) {
      flagged.push({ asset: down.asset_id, flagged_by: ['topology_dependency'], severity: 'info', note: 'Downstream segment affected by the finding.' })
    }
    if (conflict) {
      const pair = str(c, 'disagreeing_pair', 'valve_vs_sensor')
      const other: AssetId = pair === 'valve_vs_sensor' ? transmitterNear(faultLoc) : pumpNear(faultLoc)
      if (!flagged.some((f) => f.asset === other)) {
        flagged.push({ asset: other, flagged_by: ['historical_asset_intelligence'], severity: 'info', note: 'Raised from history records only.' })
      }
    }
  }

  const hyps: Hypothesis[] = []
  if (o.diagnostic_reasoning.report !== null && (hasAnomaly || conflict)) {
    const pair = str(c, 'disagreeing_pair', 'valve_vs_sensor')
    const mk = (id: string, title: string, description: string, support: string, sup: RoleKey[], con: RoleKey[]): Hypothesis => ({
      id, title, description, support_level: support, confidence: null,
      supporting_evidence_ids: sup.filter((r) => o[r].report !== null).map(reportId),
      conflicting_evidence_ids: con.filter((r) => o[r].report !== null).map(reportId),
    })
    if (conflict) {
      const second = pair === 'valve_vs_sensor'
        ? mk('h-sensor', 'Transmitter drift', `${transmitterNear(DEFAULT_FAULT_ASSET)} reads low without a physical pressure drop.`, 'alternative',
          ['historical_asset_intelligence'], ['anomaly_detection'])
        : mk('h-pump', 'Pump degradation', `Reduced output of ${pumpNear(DEFAULT_FAULT_ASSET)} lowers downstream pressure.`, 'alternative',
          ['historical_asset_intelligence'], ['anomaly_detection'])
      hyps.push(mk('h-valve', 'Valve obstruction', `Increased pressure drop across ${DEFAULT_FAULT_ASSET}.`, 'alternative',
        ['anomaly_detection', 'topology_dependency'], ['historical_asset_intelligence']), second)
    } else {
      const titles: Record<string, [string, string]> = {
        pump: ['Pump degradation', 'Reduced flow and pressure increase at the pump.'],
        valve: ['Valve obstruction', 'Increased pressure drop across the valve.'],
        pipeline: ['Pipe segment leak', 'Loss of pressure and mass imbalance along the segment.'],
        sensor: ['Transmitter drift', 'Incorrect measurement reading at the pressure transmitter.'],
        tank: ['Tank outlet restriction', 'Reduced outflow at the tank outlet nozzle.'],
        equipment: ['Equipment fault', 'A fault at the selected asset.'],
      }
      const lead = categoryOf(faultLoc as string)
      hyps.push(mk(`h-${lead}`, titles[lead]![0], `${titles[lead]![1]} (${faultLoc})`, 'leading',
        ['anomaly_detection', 'predictive_health', 'topology_dependency', 'historical_asset_intelligence'], []))
      for (const k of ['pump', 'valve', 'pipeline', 'sensor'].filter((x) => x !== lead)) {
        hyps.push(mk(`h-${k}`, titles[k]![0], titles[k]![1], k === 'sensor' ? 'not_excluded' : 'alternative',
          ['topology_dependency'], ['anomaly_detection']))
      }
    }
  }

  const opts: InspectionOption[] = []
  if (o.inspection_planning.report !== null && hyps.length > 0) {
    const lead = faultLoc as AssetId
    const cat = categoryOf(lead)
    const byLoc: Record<string, [string, string]> = {
      pump: ['Check pump flow and vibration at the bearings', 'Separates pump degradation from downstream causes.'],
      valve: ['Measure pressure difference across the valve', 'Helps tell valve obstruction and a pipe leak apart.'],
      pipeline: ['Acoustic leak survey along the affected segment', 'Separates a leak from a restriction.'],
      sensor: ['Compare the transmitter against a reference gauge', 'Separates transmitter drift from a real pressure change.'],
      tank: ['Check the tank outlet and level against a manual sounding', 'Separates an outlet restriction from a level measurement problem.'],
      equipment: ['Inspect the selected asset', 'Gathers direct evidence about the asset.'],
    }
    const [t, r] = byLoc[cat]!
    opts.push({ id: 'opt-1', title: t, rationale: r, targets: [lead], distinguishes: hyps.slice(0, 2).map((h) => h.id) })
    if (cat !== 'sensor') {
      opts.push({ id: 'opt-2', title: `Compare ${transmitterNear(lead)} against a reference gauge`, rationale: 'Rules a measurement fault in or out.',
        targets: [transmitterNear(lead)], distinguishes: hyps.filter((h) => h.id === 'h-sensor' || h.support_level === 'leading').map((h) => h.id) })
    }
  }

  let evState: string | null
  if (o.evidence_verification_decision.report === null) evState = null
  else if (conflict) evState = 'conflict_unresolved'
  else if (anyFailed || o.evidence_verification_decision.issues.length > 0) evState = 'incomplete'
  else if (!hasAnomaly) evState = 'no_findings_to_verify'
  else evState = 'partially_verified'
  const evidence: EvidenceVerification | null = o.evidence_verification_decision.report === null ? null : {
    state: evState,
    checked_evidence_ids: consumedFor('evidence_verification_decision', o),
    unresolved: conflict ? ['Disagreement between the anomaly agent and the historical agent']
      : hasAnomaly ? ['Physical condition of the equipment has not been inspected'] : [],
    notes: null,
  }

  let decision: string
  if (anyFailed || conflict) decision = 'more_evidence_required'
  else if (hasAnomaly && opts.length > 0) decision = 'inspection_options_available'
  else if (!allComplete) decision = 'more_evidence_required'
  else decision = 'no_action'

  const verified = allComplete && !conflict && evState !== null && evState !== 'incomplete'

  // observed vs expected
  const sc = SCENARIOS.find((s) => s.id === scenarioId)!
  const checks = sc.expected.checks
  const evo: ExpectedVsObserved[] = []
  const push = (i: number, observed: string, passed: boolean) => evo.push({ check: checks[i]!, expected: checks[i]!, observed, passed })
  if (scenarioId === 'quiet_window') {
    const notComplete = ORDER.filter((r) => o[r].status !== 'complete')
    push(0, notComplete.length === 0 ? 'All eight complete' : `Not complete: ${notComplete.map(nameOf).join(', ')}`, notComplete.length === 0)
    push(1, flagged.length === 0 ? 'No asset flagged' : `Flagged: ${flagged.map((f) => f.asset).join(', ')}`, flagged.length === 0)
    push(2, decision, decision === 'no_action' || decision === 'more_evidence_required')
    push(3, 'false', true)
  } else if (scenarioId === 'developing_fault') {
    const hit = flagged.some((f) => f.asset === faultLoc)
    push(0, flagged.length ? `Flagged: ${flagged.map((f) => f.asset).join(', ')}` : 'No asset flagged', hit)
    const lead = hyps.find((h) => h.support_level === 'leading')
    push(1, lead ? lead.title : 'No leading hypothesis', !!lead)
    push(2, `${opts.length} option(s) listed`, opts.length > 0)
    push(3, 'true', true)
  } else if (scenarioId === 'agent_conflict') {
    const has = ORDER.some((r) => o[r].issues.some((i) => i.code === 'EVIDENCE_CONFLICT'))
    push(0, has ? 'EVIDENCE_CONFLICT raised' : 'No conflict issue raised', has)
    push(1, `${hyps.length} hypothesis(es) listed`, hyps.length >= 2)
    push(2, evState ?? 'unknown', evState === 'conflict_unresolved')
    push(3, decision, decision === 'more_evidence_required')
  } else {
    const failing = str(c, 'failing_agent', 'topology_dependency') as RoleKey
    const mode = str(c, 'failure_mode', 'AGENT_INVALID_RESPONSE')
    const f = o[failing]
    push(0, f.report === null ? 'Report is null' : 'Report present', f.report === null)
    const seen = f.issues.some((i) => i.code === mode)
    push(1, seen ? mode : 'Code not seen', seen)
    const others = ORDER.filter((r) => r !== failing)
    const ran = others.every((r) => o[r].status !== 'error' && o[r].status !== 'rejected_by_runner')
    push(2, ran ? 'All other agents ran' : 'Another agent failed too', ran)
    push(3, decision, decision === 'more_evidence_required')
  }

  const summaries = Object.fromEntries(ORDER.map((r) => [r, o[r].report])) as Record<RoleKey, string | null>
  return {
    run_id: runId,
    scenario_id: scenarioId,
    controls: c,
    final_decision_state: decision,
    verified,
    flags: { human_decision_required: true, automatic_action_authorized: false, equipment_condition_confirmed: false },
    flagged_assets: flagged,
    hypotheses: hyps,
    inspection_options: opts,
    evidence_verification: evidence,
    report_summary: o.inspection_quality_documentation.report,
    agent_reports: summaries,
    expected_vs_observed: evo,
  }
}

/** Build the whole scripted run (events with virtual timestamps + final bundle). Pure and deterministic. */
export function buildMockRun(runId: string, scenarioId: string, controls: ControlValues): MockRun {
  const sc = SCENARIOS.find((s) => s.id === scenarioId)
  if (!sc) throw new Error(`Unknown scenario: ${scenarioId}`)
  // fill in defaults for any control the caller left out
  const c: ControlValues = {}
  for (const spec of sc.controls) c[spec.id] = controls[spec.id] ?? spec.default
  const o = planOutcomes(scenarioId, c)
  const ev: TimedEvent[] = []
  const add = (at: number, event: RunEvent) => ev.push({ at, event })

  add(0, { type: 'run_started', ts: 0, run_id: runId, scenario_id: scenarioId })

  const runAgent = (role: RoleKey, start: number, attachedFrom: RoleKey[]): number => {
    const out = o[role]
    let t = start
    add(t, { type: 'agent_started', ts: t, role_key: role })
    add(t + 20, { type: 'message', ts: t + 20, from: 'runner', to: role, kind: 'request',
      summary: `Run ${nameOf(role)}`, payload: { scenario_id: scenarioId, role_key: role, controls: c } })
    if (attachedFrom.length) {
      const ids = attachedFrom.filter((u) => o[u].report !== null)
      add(t + 40, { type: 'message', ts: t + 40, from: 'runner', to: role, kind: 'attachment',
        summary: `Attached ${ids.length} upstream report(s)`, payload: { report_ids: ids.map(reportId), from: ids } })
    }
    t += out.duration
    for (const issue of out.issues) {
      add(t - 30, { type: 'message', ts: t - 30, from: role, to: 'runner', kind: 'issue',
        summary: `${issue.code}${issue.message ? `: ${issue.message}` : ''}`, payload: issue })
    }
    add(t - 10, { type: 'message', ts: t - 10, from: role, to: 'runner', kind: 'response',
      summary: out.report === null ? 'No usable report returned' : out.report,
      payload: out.report === null ? null : { report_id: reportId(role), summary: out.report } })
    const fin: AgentFinishedEvent = {
      type: 'agent_finished', ts: t, role_key: role, status: out.status, issues: out.issues,
      consumed_evidence_ids: consumedFor(role, o), report_summary: out.report,
    }
    add(t, fin)
    return t
  }

  // agents 1-4 run side by side, then 5..8 in order
  const firstEnds = (['predictive_health', 'anomaly_detection', 'topology_dependency', 'historical_asset_intelligence'] as RoleKey[])
    .map((r, i) => runAgent(r, 150 + i * 60, []))
  let t = Math.max(...firstEnds) + 120
  t = runAgent('diagnostic_reasoning', t, ['predictive_health', 'anomaly_detection', 'topology_dependency', 'historical_asset_intelligence']) + 100
  t = runAgent('inspection_planning', t, ['diagnostic_reasoning']) + 100
  t = runAgent('inspection_quality_documentation', t, ['diagnostic_reasoning', 'inspection_planning']) + 100
  t = runAgent('evidence_verification_decision', t, ['diagnostic_reasoning', 'inspection_planning', 'inspection_quality_documentation']) + 150

  const bundle = buildBundle(runId, scenarioId, c, o)
  add(t, {
    type: 'run_finished', ts: t, final_decision_state: bundle.final_decision_state, verified: bundle.verified,
    expected_vs_observed: bundle.expected_vs_observed,
  })
  ev.sort((a, b) => a.at - b.at)
  return { events: ev, bundle }
}
