/**
 * Human-readable labels for the codes and field names that come from the API.
 * The UI shows these instead of raw names like `more_evidence_required`; the raw code is kept
 * as a tooltip (and in the report's traceability) so nothing is lost.
 */

export const ROLE_NAMES: Record<string, string> = {
  predictive_health: 'Predictive Health',
  anomaly_detection: 'Anomaly Detection',
  topology_dependency: 'Topology & Dependency',
  historical_asset_intelligence: 'Historical Asset Intelligence',
  diagnostic_reasoning: 'Diagnostic Reasoning',
  inspection_planning: 'Inspection Planning',
  inspection_quality_documentation: 'Inspection Quality & Documentation',
  evidence_verification_decision: 'Evidence Verification & Decision',
  runner: 'Runner',
}

/** Fixed agent numbers, independent of the order the service sends them in. */
export const ROLE_NUMBER: Record<string, number> = {
  predictive_health: 1,
  anomaly_detection: 2,
  topology_dependency: 3,
  historical_asset_intelligence: 4,
  diagnostic_reasoning: 5,
  inspection_planning: 6,
  inspection_quality_documentation: 7,
  evidence_verification_decision: 8,
}

const CODES: Record<string, string> = {
  // decision and assessment states
  more_evidence_required: 'More evidence required',
  inspection_options_available: 'Inspection options available',
  no_action: 'No action proposed',
  assessment_available: 'Assessment available',
  review_required: 'Review required',
  inconclusive: 'Inconclusive',
  human_review_required: 'Human review required',
  maintenance_assessment: 'Maintenance assessment',
  // evidence verification
  partially_verified: 'Partially verified',
  conflict_unresolved: 'Conflict unresolved',
  incomplete: 'Incomplete',
  no_findings_to_verify: 'No findings to verify',
  // feasibility
  eligible_for_human_review: 'Eligible for human review',
  blocked: 'Blocked',
  // hypothesis support
  leading: 'Leading',
  alternative: 'Alternative',
  not_excluded: 'Not excluded',
  // severity
  info: 'Info',
  warning: 'Warning',
  critical: 'Critical',
  // signal quality
  good: 'Good',
  suspect: 'Suspect',
  stale: 'Stale',
  missing: 'Missing',
  // agent status
  complete: 'Complete',
  degraded: 'Degraded',
  insufficient_evidence: 'Insufficient evidence',
  error: 'Error',
  rejected_by_runner: 'Rejected by runner',
  // issue codes
  AGENT_INVALID_RESPONSE: 'Invalid response',
  AGENT_ERROR: 'Agent error',
  UPSTREAM_REPORT_MISSING: 'Upstream report missing',
  EVIDENCE_CONFLICT: 'Evidence conflict',
  SENSOR_CHANNEL_MISSING: 'Sensor channel missing',
  NOISE_HIGH: 'Noise too high',
  HISTORY_UNAVAILABLE: 'History unavailable',
  // decision flags (API field names)
  advisory_only: 'Advisory only',
  human_decision_required: 'Human decision required',
  automatic_action_authorized: 'Automatic action authorised',
  equipment_condition_confirmed: 'Equipment condition confirmed',
  // data release / scope
  verum_reference_v2: 'Verum reference v2',
  verum_supported_reference_v2: 'Verum supported reference v2',
}

/** Readable label for one code or field name. Unknown codes are turned into plain words. */
export function label(code: string | null | undefined): string {
  if (code === null || code === undefined || code === '') return 'not available'
  if (CODES[code]) return CODES[code]!
  if (ROLE_NAMES[code]) return ROLE_NAMES[code]!
  if (!/[_]/.test(code)) return code
  const words = code.toLowerCase().split('_').filter(Boolean).join(' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const SNAKE = /\b(?:[a-z][a-z0-9]*(?:_[a-z0-9]+)+|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b/g

/** Free text from the API with any snake_case code or role key replaced by its readable label. */
export function humanText(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(SNAKE, (m) => {
    const l = label(m)
    return l
  })
}

/** Yes / No for a boolean flag (the exact value stays in the tooltip). */
export function yesNo(v: boolean): string {
  return v ? 'Yes' : 'No'
}
