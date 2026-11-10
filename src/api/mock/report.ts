import type { Finding, MaintenanceReport, RoleKey } from '../types'
import { STATIC_FACILITY } from '../../facility'
import { AGENTS, AGENT_LIMITATIONS } from './data'
import type { MockRun } from './engine'

const reportId = (r: RoleKey) => `rpt-${AGENTS.findIndex((a) => a.role_key === r) + 1}`
const nameOf = (r: string) => AGENTS.find((a) => a.role_key === r)?.name ?? r

/**
 * Mock of Agent 7's build_report output (same shape as contracts/reports/maintenance_report.schema.json).
 * content_sha256 is left out on purpose: the mock has no real report content to hash.
 */
export function buildMockReport(runId: string, run: MockRun): MaintenanceReport {
  const { bundle, outcomes: o } = run
  const roles = AGENTS.map((a) => a.role_key)
  const decision = o.evidence_verification_decision
  const lastReading = [...run.events].reverse().find((e) => e.event.type === 'sensor_reading')
  const asOf = lastReading && lastReading.event.type === 'sensor_reading' ? lastReading.event.t : undefined
  const src = (STATIC_FACILITY.source ?? {}) as { public_reference_sha256?: string }

  const findings: Finding[] = []
  if (decision.report !== null) {
    findings.push({ finding_id: `assessment-${reportId('evidence_verification_decision')}`, kind: 'assessment', statement: decision.report,
      measurement: null, source_report_id: reportId('evidence_verification_decision'), evidence_ids: bundle.evidence_verification?.checked_evidence_ids ?? [] })
  }
  for (const f of bundle.flagged_assets) {
    for (const r of f.flagged_by) {
      findings.push({ finding_id: `observation-${r}-${f.asset}`, kind: 'observation',
        statement: `${nameOf(r)} flagged ${f.asset}${f.note ? `: ${f.note}` : ''}`, measurement: null,
        source_report_id: reportId(r), evidence_ids: ['source-observations', reportId(r)] })
    }
  }
  for (const h of bundle.hypotheses) {
    findings.push({ finding_id: `hypothesis-${h.id}`, kind: 'hypothesis',
      statement: `Unconfirmed hypothesis: ${h.title}; support: ${h.support_level ?? 'unknown'}`, measurement: null,
      source_report_id: reportId('diagnostic_reasoning'), evidence_ids: h.supporting_evidence_ids })
  }
  for (const r of roles) {
    for (const i of o[r].issues.filter((x) => x.code === 'EVIDENCE_CONFLICT')) {
      findings.push({ finding_id: `conflict-${r}`, kind: 'assessment', statement: `Evidence conflict: ${(i.message ?? i.code).replace(/\.$/, '')}; outcome=unresolved`,
        measurement: null, source_report_id: reportId(r), evidence_ids: [] })
    }
  }

  const missing: string[] = []
  for (const r of roles) if (o[r].report === null) missing.push(`Missing agent report: ${r}`)
  for (const r of roles) {
    const st = o[r].status
    if (st === 'error' || st === 'rejected_by_runner' || st === 'insufficient_evidence' || st === 'degraded') {
      for (const i of o[r].issues) missing.push(`${r}: ${st}: ${i.code}${i.message ? `: ${i.message}` : ''}`)
    }
  }
  if (decision.report === null) missing.push('Agent 8 assessment unavailable')
  for (const u of bundle.evidence_verification?.unresolved ?? []) missing.push(u)

  const limitations = roles.filter((r) => o[r].report !== null).sort().map((r) => AGENT_LIMITATIONS[r]!).filter(Boolean)
  limitations.push('Advisory assessment only; human review is required and equipment condition is not confirmed.')

  const conflict = roles.some((r) => o[r].issues.some((i) => i.code === 'EVIDENCE_CONFLICT'))
  const assessment_state = decision.report === null ? 'more_evidence_required'
    : conflict ? 'inconclusive'
    : bundle.final_decision_state === 'more_evidence_required' ? 'more_evidence_required' : 'review_required'

  return {
    report_version: '1.0.0',
    report_id: `maintenance-AN-${runId}`,
    context: {
      case_id: bundle.scenario_id, analysis_id: `AN-${runId}`, revision: 0, as_of_s: asOf, as_of_utc: null,
      data_release: 'verum_reference_v2', reference_snapshot_sha256: src.public_reference_sha256,
      scope_id: 'verum_supported_reference_v2', execution_mode: 'contract_fixture',
    },
    report_type: 'maintenance_assessment',
    title: 'Maintenance assessment',
    review_status: 'human_review_required',
    assessment_state,
    source_reports: roles.filter((r) => o[r].report !== null).map((r) => ({ report_id: reportId(r), agent: r })),
    findings,
    inspection_options: bundle.inspection_options.filter((x) => x.action_id).map((x) => ({
      action_id: x.action_id!, target_asset: x.targets[0] ?? 'unknown', feasibility: x.feasibility ?? 'unknown',
      cost_usd: x.cost_usd ?? null, duration_min: x.duration_min ?? null, source_report_id: reportId('inspection_planning'),
      evidence_ids: [reportId('diagnostic_reasoning')], precondition_checks: x.precondition_checks,
    })),
    next_steps: [],
    missing_information: missing,
    limitations,
    narrative: decision.report === null ? null : { provider: 'template', model: null, prompt_id: null, text: decision.report, source_report_ids: [reportId('evidence_verification_decision')] },
    advisory_only: true,
    human_decision_required: true,
    automatic_action_authorized: false,
    equipment_condition_confirmed: false,
  }
}
