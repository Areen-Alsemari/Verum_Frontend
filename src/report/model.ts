/**
 * Report model builder (pure). Turns the run data into the report sections, in order.
 * Rules: no number that is not in the data; missing values are null (shown as "unknown");
 * hypotheses are unconfirmed; inspection items are options; the three flags are copied as given.
 */
import type { AgentInfo, Check, DecisionFlags, MaintenanceReport, RunBundle, Scenario } from '../api'
import { STATE_LABEL } from '../lib/agentState'
import { assetById, kindLabel, sensorsForAsset, type Facility } from '../facility'
import { readingDisplay, type RunState } from '../state/runState'

export interface ReportInput {
  run: RunState
  agents: AgentInfo[]
  scenario: Scenario | undefined
  facility: Facility
  /** asset id -> PNG data URL captured from the focus view (null = capture failed / unavailable) */
  snapshots: Record<string, string | null>
  /** "api" when the report came from the backend, "mock" for demo data */
  source: 'api' | 'mock'
}

export interface ReportModel {
  available: boolean
  header: {
    reportId: string | null
    analysisId: string | null
    scenario: string | null
    asOfS: number | null
    asOfUtc: string | null
    dataRelease: string | null
    assessmentState: string | null
    reviewStatus: string | null
    banner: string
    source: 'api' | 'mock'
  }
  summary: string[]
  affected: {
    assetId: string
    kind: string | null
    area: string | null
    flaggedBy: string[]
    severity: string | null
    note: string | null
    snapshot: string | null
    sensors: { tag: string; unit: string; value: string; quality: string | null }[]
  }[]
  observations: { statement: string; source: string | null; evidence: string[] }[]
  hypotheses: { title: string; description: string; support: string | null; confidence: number | null; supporting: string[]; conflicting: string[] }[]
  options: {
    title: string
    actionId: string | null
    targets: string[]
    feasibility: string | null
    preconditions: { description: string; status: 'met' | 'unmet' | 'unknown' }[] | null
    costUsd: number | null
    durationMin: number | null
    source: string | null
    evidence: string[]
  }[]
  unknowns: { text: string; code: string | null; severity: 'fail' | 'warn' | 'info' }[]
  decision: { flags: DecisionFlags; decisionState: string | null }
  trace: { reportIds: { id: string; agent: string; hash: string | null }[]; evidenceIds: string[]; referenceSha: string | null }
  limitations: string[] | null
}

export const BANNER = 'Simulated data, advisory only'

const STATUS: Record<Check['outcome'], 'met' | 'unmet' | 'unknown'> = { pass: 'met', fail: 'unmet', unknown: 'unknown' }

/** Words the report never uses on its own account (they may appear only inside API-provided text). */
export const FORBIDDEN = /\b(recommended|approved|healthy|no action needed)\b|(?<!un|not |_)\bconfirmed\b/i

export function buildReportModel(i: ReportInput): ReportModel {
  const { run, agents, scenario, facility } = i
  const b: RunBundle | null = run.bundle
  const r: MaintenanceReport | null = run.report ?? null
  const name = (k: string) => agents.find((a) => a.role_key === k)?.name ?? k
  const flags: DecisionFlags = {
    human_decision_required: r?.human_decision_required ?? b?.flags.human_decision_required ?? null,
    automatic_action_authorized: r?.automatic_action_authorized ?? b?.flags.automatic_action_authorized ?? null,
    equipment_condition_confirmed: r?.equipment_condition_confirmed ?? b?.flags.equipment_condition_confirmed ?? null,
  }

  // ---- affected assets -----------------------------------------------------------------
  const flagged = b?.flagged_assets ?? (run.flaggedAssetIds ?? []).map((a) => ({ asset: a, flagged_by: run.flaggedBy[a] ?? [], severity: undefined, note: undefined }))
  const affected = flagged.map((f) => {
    const a = assetById(facility, f.asset)
    return {
      assetId: f.asset,
      kind: a ? kindLabel(a.kind) : null,
      area: a?.area ?? null,
      flaggedBy: f.flagged_by.map(name),
      severity: f.severity ?? null,
      note: f.note ?? null,
      snapshot: i.snapshots[f.asset] ?? null,
      sensors: sensorsForAsset(facility, f.asset).map((s) => {
        const sample = run.sensors[s.tag_id]
        const d = readingDisplay(sample)
        return { tag: s.tag_id, unit: s.unit, value: d.text, quality: sample ? String(sample.quality) : null }
      }),
    }
  })

  // ---- observations: report findings, else the flags from the bundle -------------------
  const observations = r
    ? r.findings.filter((f) => f.kind === 'observation' || f.kind === 'assessment' || f.kind === 'inspection_check')
      .map((f) => ({ statement: f.statement, source: f.source_report_id, evidence: f.evidence_ids }))
    : flagged.flatMap((f) => f.flagged_by.map((ag) => ({ statement: `${name(ag)} flagged ${f.asset}${f.note ? `: ${f.note}` : ''}`, source: null, evidence: [] as string[] })))

  // ---- hypotheses (always unconfirmed) --------------------------------------------------
  const hypotheses = (b?.hypotheses ?? []).map((h) => ({
    title: h.title, description: h.description, support: h.support_level, confidence: h.confidence,
    supporting: h.supporting_evidence_ids, conflicting: h.conflicting_evidence_ids,
  }))

  // ---- inspection options: report entries matched to the bundle's option titles ---------
  const bundleOpts = b?.inspection_options ?? []
  const options = (r && r.inspection_options.length ? r.inspection_options.map((o) => {
    const match = bundleOpts.find((x) => x.action_id === o.action_id && x.targets.includes(o.target_asset))
    const pre = o.precondition_checks ?? match?.precondition_checks
    return {
      title: match?.title ?? o.action_id, actionId: o.action_id, targets: [o.target_asset], feasibility: o.feasibility ?? null,
      preconditions: pre ? pre.map((c) => ({ description: c.description, status: STATUS[c.outcome] ?? 'unknown' })) : null,
      costUsd: typeof o.cost_usd === 'number' ? o.cost_usd : null, durationMin: typeof o.duration_min === 'number' ? o.duration_min : null,
      source: o.source_report_id, evidence: o.evidence_ids,
    }
  }) : bundleOpts.map((o) => ({
    title: o.title, actionId: o.action_id ?? null, targets: o.targets, feasibility: o.feasibility ?? null,
    preconditions: o.precondition_checks ? o.precondition_checks.map((c) => ({ description: c.description, status: STATUS[c.outcome] ?? 'unknown' })) : null,
    costUsd: typeof o.cost_usd === 'number' ? o.cost_usd : null, durationMin: typeof o.duration_min === 'number' ? o.duration_min : null,
    source: null, evidence: [] as string[],
  })))

  // ---- what is unknown or missing ------------------------------------------------------
  const unknowns: ReportModel['unknowns'] = []
  for (const a of agents) {
    const st = run.agents[a.role_key]
    if (!st || st.state === 'idle' || st.state === 'running') {
      unknowns.push({ text: `${a.order}. ${a.name}: no result in this run`, code: null, severity: 'info' })
      continue
    }
    if (st.state === 'complete') continue
    const sev = st.state === 'error' || st.state === 'rejected' ? 'fail' : st.state === 'degraded' ? 'warn' : 'info'
    if (st.issues.length === 0) unknowns.push({ text: `${a.order}. ${a.name}: ${STATE_LABEL[st.state]}`, code: null, severity: sev })
    for (const iss of st.issues) {
      unknowns.push({ text: `${a.order}. ${a.name}: ${STATE_LABEL[st.state]}${st.report === null ? ', no report' : ''}${iss.message ? `. ${iss.message}` : ''}`, code: iss.code, severity: sev })
    }
  }
  for (const m of r?.missing_information ?? []) unknowns.push({ text: m, code: null, severity: 'info' })
  if (r === null && run.report === null) unknowns.push({ text: 'The backend did not provide a maintenance report.', code: null, severity: 'info' })

  // ---- summary: two or three sentences from API fields ---------------------------------
  const summary: string[] = []
  if (affected.length) {
    summary.push(`Agents flagged ${affected.map((a) => `${a.assetId}${a.kind ? ` (${a.kind.toLowerCase()})` : ''}`).join(', ')} in scenario ${scenario?.title ?? run.scenarioId ?? 'unknown'}. Condition is unconfirmed.`)
  } else if (b) {
    summary.push(`No asset was flagged by any agent in scenario ${scenario?.title ?? run.scenarioId ?? 'unknown'}.`)
  }
  const narrative = r?.narrative?.text ?? b?.report_summary ?? null
  if (narrative) summary.push(narrative)
  const ds = b?.final_decision_state ?? run.finalDecisionState ?? null
  summary.push(`Decision state: ${ds ?? 'unknown'}; assessment state: ${r?.assessment_state ?? 'unknown'}. A human decides what happens next.`)

  const evidenceIds = [...new Set([
    ...(r?.findings.flatMap((f) => f.evidence_ids) ?? []),
    ...(r?.inspection_options.flatMap((o) => o.evidence_ids) ?? []),
    ...(b?.evidence_verification?.checked_evidence_ids ?? []),
  ])]

  return {
    available: !!b,
    header: {
      reportId: r?.report_id ?? null,
      analysisId: r?.context?.analysis_id ?? null,
      scenario: scenario?.title ?? run.scenarioId ?? null,
      asOfS: typeof r?.context?.as_of_s === 'number' ? r.context.as_of_s : null,
      asOfUtc: r?.context?.as_of_utc ?? null,
      dataRelease: r?.context?.data_release ?? null,
      assessmentState: r?.assessment_state ?? null,
      reviewStatus: r?.review_status ?? null,
      banner: BANNER,
      source: i.source,
    },
    summary: summary.slice(0, 3),
    affected,
    observations,
    hypotheses,
    options,
    unknowns,
    decision: { flags, decisionState: ds },
    trace: {
      reportIds: (r?.source_reports ?? []).map((s) => ({ id: s.report_id, agent: name(s.agent), hash: s.content_sha256 ?? null })),
      evidenceIds,
      referenceSha: r?.context?.reference_snapshot_sha256 ?? null,
    },
    limitations: r ? r.limitations : null,
  }
}
