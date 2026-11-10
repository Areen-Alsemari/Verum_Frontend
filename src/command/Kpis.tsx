import type { Kpis } from '../lib/briefing'
import { Unknown } from '../components/Unknown'
import { label } from '../lib/labels'

function Card({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string }) {
  return (
    <div className={`kpi glass${tone ? ` tone-${tone}` : ''}`}>
      <span className="label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  )
}

export function KpiRow({ k }: { k: Kpis }) {
  return (
    <div className="kpi-row" role="group" aria-label="Key figures from the run data">
      <Card label="Agents complete" value={k.agentsComplete === null ? <Unknown what="agents complete" /> : <>{k.agentsComplete}<small> / {k.agentsTotal}</small></>}
        sub="agents that finished with status Complete" />
      <Card label="Open issues" tone={k.openIssues ? 'warn' : undefined} value={k.openIssues === null ? <Unknown what="open issues" /> : k.openIssues}
        sub="issue codes raised by agents" />
      <Card label="Flagged assets" tone={k.flaggedAssets ? 'accent' : undefined} value={k.flaggedAssets === null ? <Unknown what="flagged assets" /> : k.flaggedAssets}
        sub="assets flagged by agents" />
      <Card label="Decision state" value={k.decisionState === null ? <Unknown what="decision state" /> : <span className="kpi-text" title={k.decisionState}>{label(k.decisionState)}</span>}
        sub="set by Evidence Verification & Decision" />
    </div>
  )
}
