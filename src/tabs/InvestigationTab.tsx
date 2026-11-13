import { AgentOutcomes } from '../components/AgentOutcomes'
import { Block, Ids, reportNotice } from '../components/Block'
import { Unknown } from '../components/Unknown'
import { label } from '../lib/labels'
import { agentList, type RunState } from '../state/runState'
import { TruthPanel } from './TruthPanel'

export function InvestigationTab({ run, onRetryReport }: { run: RunState; onRetryReport: () => void }) {
  const agents = agentList(run)
  const p = run.persistence
  const r = run.report
  return (
    <div className="stack">
      <Block title="Agent outcomes"><AgentOutcomes agents={agents} run={run} /></Block>
      <div className="grid-2">
        <div className="stack">
          <Block title="Persistence rule and alerts">
            {!p ? <p><Unknown what="persistence" /></p> : (
              <>
                <p className="kv"><span>rule</span> {p.rule.k} of the last {p.rule.n} windows above the threshold {p.rule.threshold ?? <Unknown what="threshold" />}</p>
                <p className="kv"><span>windows held</span> {p.windows_held}</p>
                <p className="kv"><span>windows exceeding</span> {p.windows_exceeding}</p>
                <p className="kv"><span>windows with no data</span> {p.windows_unknown}</p>
                <p className="kv"><span>alarming</span> {typeof p.alarming === 'boolean' ? (p.alarming ? 'Yes' : 'No') : <Unknown what="alarming" />}</p>
              </>
            )}
            {run.alerts.length === 0 ? <p className="control-help">No alert so far.</p> : (
              <ul className="cards">
                {run.alerts.map((a) => (
                  <li key={a.seq} className="mini-card"><strong>Window {a.window_index} · {label(a.source)}</strong><p className="control-help">{a.message}</p></li>
                ))}
              </ul>
            )}
            <p className="kv"><span>runner notes</span> <Ids ids={run.runnerNotes} /></p>
          </Block>
        </div>
        <div className="stack">
          <Block title="Hypotheses and findings" tag="Unconfirmed">
            {r.state !== 'ok' ? reportNotice(r, onRetryReport) : (
              <>
                <p className="control-help block-intro">Report findings of window {r.window}, as written by the agents. Support level, confidence and flagged assets are not available from the service.</p>
                {r.report.findings.length === 0 ? <p className="control-help">The report lists no findings.</p> : (
                  <ul className="cards">
                    {r.report.findings.map((f) => (
                      <li key={f.finding_id} className="mini-card">
                        <div className="mini-head"><strong>{label(f.kind)}</strong>{f.kind === 'hypothesis' && <span className="pill">unconfirmed</span>}</div>
                        <p className="control-help">{f.statement}</p>
                        <p className="kv"><span>source report</span> <code>{f.source_report_id}</code></p>
                        <p className="kv"><span>evidence</span> <Ids ids={f.evidence_ids} /></p>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Block>
          <Block title="Report and evidence ids">
            {r.state !== 'ok' ? reportNotice(r, onRetryReport) : (
              <>
                <p className="kv"><span>report id</span> <code>{r.report.report_id}</code></p>
                <p className="kv"><span>analysis id</span> {r.report.context?.analysis_id ? <code>{r.report.context.analysis_id}</code> : <Unknown what="analysis id" />}</p>
                <table className="outcomes">
                  <thead><tr><th>Source report</th><th>Agent</th><th>Content hash (SHA-256)</th></tr></thead>
                  <tbody>
                    {r.report.source_reports.map((s) => (
                      <tr key={s.report_id}><td><code>{s.report_id}</code></td><td>{label(s.agent)}</td><td>{s.content_sha256 ? <code className="hash">{s.content_sha256}</code> : <Unknown what="hash" />}</td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </Block>
        </div>
      </div>
      <TruthPanel truth={run.truth} />
    </div>
  )
}
