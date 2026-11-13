/**
 * Report model builder (pure). Turns the service's maintenance report into the report sections.
 * Rules: no number that is not in the data; anything missing is null (shown as "not available");
 * hypotheses are unconfirmed; inspection items are options; the flags are copied as given.
 */
import type { MaintenanceReport } from '../api'
import { statusText } from '../lib/agentState'
import { label } from '../lib/labels'
import type { RunState } from '../state/runState'

export interface ReportModel {
  header: {
    reportId: string | null
    analysisId: string | null
    run: string | null
    mode: string | null
    window: number | null
    asOfS: number | null
    asOfUtc: string | null
    dataRelease: string | null
    assessmentState: string | null
    reviewStatus: string | null
    banner: string
  }
  summary: string[]
  observations: { statement: string; source: string | null; evidence: string[] }[]
  hypotheses: { statement: string; source: string | null; evidence: string[] }[]
  options: { actionId: string; target: string; feasibility: string | null; costUsd: number | null; durationMin: number | null; source: string | null; evidence: string[] }[]
  nextSteps: string[]
  unknowns: { text: string; code: string | null; severity: 'fail' | 'warn' | 'info' }[]
  flags: { advisory_only: boolean | null; human_decision_required: boolean | null; automatic_action_authorized: boolean | null; equipment_condition_confirmed: boolean | null }
  decisionState: string | null
  trace: { reportIds: { id: string; agent: string; hash: string | null }[]; evidenceIds: string[]; referenceSha: string | null }
  limitations: string[]
}

export const BANNER = 'Synthetic data, advisory only'

export function buildReportModel(run: RunState, r: MaintenanceReport, window: number): ReportModel {
  const d = run.decision
  const pick = (a: boolean | null | undefined, b: boolean | null | undefined) => (typeof a === 'boolean' ? a : typeof b === 'boolean' ? b : null)
  const findings = r.findings ?? []
  const summary: string[] = []
  if (r.narrative?.text) summary.push(r.narrative.text)
  summary.push(`Assessment state: ${r.assessment_state ? label(r.assessment_state) : 'not available'}. A human decides what happens next.`)

  const unknowns: ReportModel['unknowns'] = []
  for (const a of Object.values(run.agents)) {
    if (a.state === 'complete' || a.state === 'idle') continue
    const sev = a.state === 'degraded' ? 'warn' : a.state === 'insufficient_evidence' || a.state === 'other' ? 'info' : 'fail'
    const text = `${label(a.role_key)}: ${statusText(a.state, a.status)} in the latest window${a.state === 'nostatus' || a.state === 'error' ? ', no report' : ''}`
    if (a.issueCodes.length === 0) unknowns.push({ text, code: null, severity: sev })
    for (const c of a.issueCodes) unknowns.push({ text, code: c, severity: sev })
  }
  for (const m of r.missing_information ?? []) unknowns.push({ text: m, code: null, severity: 'info' })

  const evidenceIds = [...new Set([
    ...findings.flatMap((f) => f.evidence_ids ?? []),
    ...(r.inspection_options ?? []).flatMap((o) => o.evidence_ids ?? []),
  ])]
  return {
    header: {
      reportId: r.report_id ?? null,
      analysisId: r.context?.analysis_id ?? null,
      run: run.run?.run_id ?? null,
      mode: run.mode,
      window,
      asOfS: typeof r.context?.as_of_s === 'number' ? r.context.as_of_s : null,
      asOfUtc: r.context?.as_of_utc ?? null,
      dataRelease: r.context?.data_release ?? null,
      assessmentState: r.assessment_state ?? null,
      reviewStatus: r.review_status ?? null,
      banner: BANNER,
    },
    summary,
    observations: findings.filter((f) => f.kind !== 'hypothesis').map((f) => ({ statement: f.statement, source: f.source_report_id ?? null, evidence: f.evidence_ids ?? [] })),
    hypotheses: findings.filter((f) => f.kind === 'hypothesis').map((f) => ({ statement: f.statement, source: f.source_report_id ?? null, evidence: f.evidence_ids ?? [] })),
    options: (r.inspection_options ?? []).map((o) => ({
      actionId: o.action_id, target: o.target_asset, feasibility: o.feasibility ?? null,
      costUsd: typeof o.cost_usd === 'number' ? o.cost_usd : null, durationMin: typeof o.duration_min === 'number' ? o.duration_min : null,
      source: o.source_report_id ?? null, evidence: o.evidence_ids ?? [],
    })),
    nextSteps: (r.next_steps ?? []).map((n) => n.description),
    unknowns,
    flags: {
      advisory_only: pick(r.advisory_only, d?.advisory_only),
      human_decision_required: pick(r.human_decision_required, d?.human_decision_required),
      automatic_action_authorized: pick(r.automatic_action_authorized, d?.automatic_action_authorized),
      equipment_condition_confirmed: pick(r.equipment_condition_confirmed, d?.equipment_condition_confirmed),
    },
    decisionState: d?.decision_state ?? null,
    trace: {
      reportIds: (r.source_reports ?? []).map((s) => ({ id: s.report_id, agent: label(s.agent), hash: s.content_sha256 ?? null })),
      evidenceIds,
      referenceSha: r.context?.reference_snapshot_sha256 ?? null,
    },
    limitations: r.limitations ?? [],
  }
}
