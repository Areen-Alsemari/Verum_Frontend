import { AgentOutcomes } from '../components/AgentOutcomes'
import { Block, Ids, reportNotice } from '../components/Block'
import { Unknown } from '../components/Unknown'
import { agentList, type RunState } from '../state/runState'
import { STATIC_FACILITY } from '../facility'
import { candidateOf, parseHypothesis, scoreText } from '../lib/candidate'
import { SCORE_SENTENCE, candidateSentence, hypothesisPhrase, noteText, persistenceSentence } from '../lib/plain'
import { label } from '../lib/labels'
import { TruthPanel } from './TruthPanel'

const KIND_TITLE: Record<string, string> = { hypothesis: 'Candidate cause', assessment: 'Assessment', observation: 'Observation', inspection_check: 'Inspection check' }
const cap = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`

/** What was found and how the readings are trending, in plain sentences. Technical detail is in the developer view. */
export function InvestigationTab({ run, onRetryReport, dev = false }: { run: RunState; onRetryReport: () => void; dev?: boolean }) {
  const agents = agentList(run)
  const p = run.persistence
  const r = run.report
  const rule = persistenceSentence(p)
  const top = r.state === 'ok' ? candidateOf(r.report) : null
  const topSentence = top ? candidateSentence(top, STATIC_FACILITY) : null
  return (
    <div className="stack">
      <div className="grid-2">
        <div className="stack">
          <Block title="What was found" tag="Unconfirmed">
            {r.state !== 'ok' ? reportNotice(r, onRetryReport) : (
              <>
                {topSentence && <p className="found-line">{topSentence}</p>}
                <p className="control-help block-intro">These are candidate causes, not findings. Confirm on site before acting.</p>
                {r.report.findings.length === 0 ? <p className="control-help">The report lists no findings for this window.</p> : (
                  <ul className="cards">
                    {r.report.findings.map((f) => {
                      const hyp = f.kind === 'hypothesis' ? parseHypothesis(f) : null
                      const unreadable = f.kind === 'hypothesis' && !hyp
                      return (
                        <li key={f.finding_id} className="mini-card">
                          <div className="mini-head"><strong>{KIND_TITLE[f.kind] ?? cap(label(f.kind))}</strong>{f.kind === 'hypothesis' && <span className="pill">unconfirmed</span>}</div>
                          {hyp
                            ? <p className="control-help">{`${cap(hypothesisPhrase(hyp, STATIC_FACILITY))}. Ranking score ${scoreText(hyp.score)}. ${SCORE_SENTENCE}`}</p>
                            : unreadable ? <p className="control-help">This candidate could not be read. The agent&apos;s own text is under Details.</p>
                            : <p className="control-help">{f.statement}</p>}
                          {(unreadable || dev) && (
                            <details className="details">
                              <summary>Details</summary>
                              {unreadable && <p className="control-help">{f.statement}</p>}
                              {dev && <p className="kv"><span>source report</span> <code>{f.source_report_id}</code></p>}
                              {dev && <p className="kv"><span>evidence</span> <Ids ids={f.evidence_ids} /></p>}
                            </details>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </>
            )}
          </Block>
        </div>
        <div className="stack">
          <Block title="Alerts and trend">
            {rule ? <p className="found-line">{rule}</p> : <p className="control-help">No window has been analysed yet.</p>}
            {run.alerts.length === 0 ? <p className="control-help">No alert so far.</p> : (
              <ul className="cards">
                {run.alerts.map((a) => (
                  <li key={a.seq} className="mini-card"><strong>Alert in window {a.window_index}</strong><p className="control-help">{a.message}</p></li>
                ))}
              </ul>
            )}
          </Block>
          <TruthPanel truth={run.truth} />
        </div>
      </div>
      {dev && (
        <>
          <Block title="Developer view: agent outcomes"><AgentOutcomes agents={agents} run={run} /></Block>
          <div className="grid-2">
            <Block title="Developer view: persistence rule and runner notes">
              {!p ? <p><Unknown what="persistence" /></p> : (
                <>
                  <p className="kv"><span>rule</span> {p.rule.k} of the last {p.rule.n} windows above the threshold {p.rule.threshold ?? <Unknown what="threshold" />}</p>
                  <p className="kv"><span>windows held</span> {p.windows_held}</p>
                  <p className="kv"><span>windows exceeding</span> {p.windows_exceeding}</p>
                  <p className="kv"><span>windows with no data</span> {p.windows_unknown}</p>
                  <p className="kv"><span>alarming</span> {typeof p.alarming === 'boolean' ? (p.alarming ? 'Yes' : 'No') : <Unknown what="alarming" />}</p>
                </>
              )}
              <div className="kv kv-block"><span>runner notes</span>{run.runnerNotes.length ? <ul className="plain">{run.runnerNotes.map((c) => <li key={c}><code>{c}</code> {noteText(c)}</li>)}</ul> : <span className="control-help">none</span>}</div>
            </Block>
            <Block title="Developer view: report and evidence ids">
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
        </>
      )}
    </div>
  )
}
