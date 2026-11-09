import type { RoleKey } from '../api'

/** Monoline 24x24 icons in the champagne-on-dark style. Decorative: the agent name is always written next to them. */
const PATHS: Record<RoleKey, React.ReactNode> = {
  predictive_health: <path d="M2 12h4l2.5-6 4 12 2.5-6H22" />,
  anomaly_detection: (<><path d="M3 17l5-6 4 3 4-7 5 5" /><circle cx="16" cy="7" r="2.2" /></>),
  topology_dependency: (<><circle cx="5" cy="6" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><path d="M7 6h10M6 8l5 8M18 8l-5 8" /></>),
  historical_asset_intelligence: (<><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3.5 2" /></>),
  diagnostic_reasoning: (<><circle cx="12" cy="4.5" r="1.8" /><circle cx="5.5" cy="18" r="1.8" /><circle cx="18.5" cy="18" r="1.8" /><path d="M12 6.3v5M12 11.3l-6 5M12 11.3l6 5" /></>),
  inspection_planning: (<><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M8.5 10l1.5 1.5 2.5-3M8.5 16h7" /></>),
  inspection_quality_documentation: (<><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>),
  evidence_verification_decision: (<><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>),
}

export function AgentIcon({ role, size = 22 }: { role: RoleKey; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[role]}
    </svg>
  )
}
