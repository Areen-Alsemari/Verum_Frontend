import type { RunState } from '../state/runState'
import { DecisionPanel } from '../components/DecisionPanel'
import { Block, Evidence, InspectionOptions } from '../components/ResultBlocks'
import { waitingText } from '../components/ResultView'

/** Agent 6 options (advisory) and Agent 8 verification state. There is no approve, execute or dispatch control. */
export function InspectionTab({ run }: { run: RunState }) {
  const b = run.bundle
  const hypTitle = (id: string) => b?.hypotheses.find((h) => h.id === id)?.title ?? id
  return (
    <div className="grid-main-side">
      <div className="stack">
        {!b ? <p className="state-msg" role="status">{waitingText(run)}</p> : (
          <>
            <Block title="Inspection options" tag="Advisory">
              <p className="control-help block-intro">Options for the inspector to consider, from Agent 6 (Inspection Planning). They are not instructions and nothing is scheduled.</p>
              <InspectionOptions options={b.inspection_options} hypTitle={hypTitle} />
            </Block>
            <Block title="Evidence verification (Agent 8)"><Evidence ev={b.evidence_verification} /></Block>
          </>
        )}
      </div>
      <section className="panel" aria-labelledby="await-h">
        <h3 id="await-h" className="label panel-title">Awaiting human decision</h3>
        <DecisionPanel decision={b?.final_decision_state ?? run.finalDecisionState} verified={b ? b.verified : run.verified} flags={b?.flags} />
        <p className="advisory-note" role="note"><strong>Advisory only.</strong> A human decides. No automatic action is authorised.</p>
      </section>
    </div>
  )
}
