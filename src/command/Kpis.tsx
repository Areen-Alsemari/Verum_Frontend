import type { Kpis } from '../lib/briefing'
import { agentBreakdown } from '../lib/briefing'
import { noteText } from '../lib/plain'

function Card({ label, value, sub, tone, title }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string; title?: string }) {
  return (
    <div className={`kpi glass${tone ? ` tone-${tone}` : ''}`} title={title}>
      <span className="label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  )
}

const dash = <span className="kpi-none" aria-label="nothing yet">–</span>

/** What an operator uses: windows analysed, alerts raised, equipment flagged, and how many agents responded. */
export function KpiRow({ k, dev = false }: { k: Kpis; dev?: boolean }) {
  const detail = k.agentsResponded === null ? undefined : agentBreakdown(k, ', ')
  return (
    <div className="kpi-row" role="group" aria-label="Key figures">
      <Card label="Windows analysed" value={k.windowsAnalysed ?? dash} sub="windows of the run so far" />
      <Card label="Alerts raised" tone={k.alerts ? 'accent' : undefined} value={k.alerts ?? dash} sub="when the readings stay above normal" />
      <Card label="Equipment flagged" tone={k.equipmentFlagged ? 'accent' : undefined} value={k.equipmentFlagged ?? dash} sub="suspected, unconfirmed" />
      <Card label="Agents responded" title={detail} value={k.agentsResponded === null ? dash : <>{k.agentsResponded}<small> of {k.agentsTotal}</small></>} sub="hover for the detail" />
      {dev && (
        <Card label="Developer detail" value={k.issueCodes ?? dash}
          sub={<>runner issue codes in the latest window{k.runnerNotes.length > 0 && <ul className="plain">{k.runnerNotes.map((c) => <li key={c}>{c} · {noteText(c)}</li>)}</ul>}</>} />
      )}
    </div>
  )
}
