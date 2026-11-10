import type { ReactNode } from 'react'
import type { AgentInfo } from '../api'
import { AgentOutcomes } from '../components/AgentOutcomes'
import { AssetChain } from '../components/AssetChain'
import { Block, Evidence, Hypotheses, Ids } from '../components/ResultBlocks'
import { waitingText } from '../components/ResultView'
import { Unknown } from '../components/Unknown'
import type { RunState } from '../state/runState'
import { label } from '../lib/labels'

export function InvestigationTab({ run, agents, focus }: { run: RunState; agents: AgentInfo[]; focus: ReactNode }) {
  const b = run.bundle
  const r = run.report
  return (
    <div className="stack">
      <Block title="Agent outcomes"><AgentOutcomes agents={agents} run={run} report={r} /></Block>
      {focus}
      {!b ? <p className="state-msg" role="status">{waitingText(run)}</p> : (
        <div className="grid-2">
          <div className="stack">
            <Block title="Diagnostic hypotheses" tag="Unconfirmed"><Hypotheses hyps={b.hypotheses} /></Block>
            <Block title="Flagged assets"><AssetChain flagged={b.flagged_assets} agents={agents} /></Block>
          </div>
          <div className="stack">
            <Block title="Evidence verification"><Evidence ev={b.evidence_verification} /></Block>
            <Block title="Report and evidence ids">
              {r === undefined ? <p className="control-help">Loading the report…</p> : r === null ? (
                <p className="kv"><span>report</span> <Unknown what="report (not provided by the backend)" /></p>
              ) : (
                <>
                  <p className="kv"><span>report id</span> <code>{r.report_id}</code></p>
                  <p className="kv"><span>analysis id</span> {r.context?.analysis_id ? <code>{r.context.analysis_id}</code> : <Unknown what="analysis id" />}</p>
                  <table className="outcomes">
                    <thead><tr><th>Source report</th><th>Agent</th><th>Content hash (SHA-256)</th></tr></thead>
                    <tbody>
                      {r.source_reports.map((s) => (
                        <tr key={s.report_id}><td><code>{s.report_id}</code></td><td>{label(s.agent)}</td><td>{s.content_sha256 ? <code className="hash">{s.content_sha256}</code> : <Unknown what="hash" />}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="kv"><span>evidence ids</span> <Ids ids={[...new Set(r.findings.flatMap((f) => f.evidence_ids))]} /></p>
                </>
              )}
            </Block>
          </div>
        </div>
      )}
    </div>
  )
}
