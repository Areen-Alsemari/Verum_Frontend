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
        sub="agents with status Complete in the latest window" />
      <Card label="Issue codes" tone={k.issueCodes ? 'warn' : undefined} value={k.issueCodes === null ? <Unknown what="issue codes" /> : k.issueCodes}
        sub="runner issue codes in the latest window" />
      <Card label="Alerts" tone={k.alerts ? 'accent' : undefined} value={k.alerts === null ? <Unknown what="alerts" /> : k.alerts}
        sub="persistence rule alerts so far" />
      <Card label="Decision state" value={k.decisionState === null ? <Unknown what="decision state" /> : <span className="kpi-text" title={k.decisionState}>{label(k.decisionState)}</span>}
        sub="Agent 8, latest window" />
    </div>
  )
}
