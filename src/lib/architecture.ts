/**
 * The documented agent chain (which agent reads the reports of which). Static: the service sends no dependency
 * data, so this describes the architecture only and says nothing about what was exchanged in a run.
 */
export const ARCHITECTURE: Record<string, string[]> = {
  predictive_health: [],
  anomaly_detection: [],
  topology_dependency: [],
  historical_asset_intelligence: [],
  diagnostic_reasoning: ['predictive_health', 'anomaly_detection', 'topology_dependency', 'historical_asset_intelligence'],
  inspection_planning: ['diagnostic_reasoning'],
  inspection_quality_documentation: ['diagnostic_reasoning', 'inspection_planning'],
  evidence_verification_decision: ['diagnostic_reasoning', 'inspection_planning', 'inspection_quality_documentation'],
}

/** Column (layer) of each role: 0 for the first stage, one more than its deepest upstream agent otherwise. */
export function layersOf(roles: string[]): Record<string, number> {
  const memo: Record<string, number> = {}
  const depth = (r: string): number => {
    if (memo[r] !== undefined) return memo[r]!
    memo[r] = 0
    const d = (ARCHITECTURE[r] ?? []).filter((x) => roles.includes(x))
    memo[r] = d.length === 0 ? 0 : 1 + Math.max(...d.map(depth))
    return memo[r]!
  }
  roles.forEach(depth)
  return memo
}
