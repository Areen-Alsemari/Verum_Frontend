export function Briefing({ lines, simulated }: { lines: string[]; simulated: boolean }) {
  return (
    <section className="briefing glass" aria-labelledby="brief-h">
      <h3 id="brief-h" className="briefing-title"><span className="briefing-ico" aria-hidden="true" />Operations briefing</h3>
      <div className="briefing-text" aria-live="polite">
        {lines.map((l) => <p key={l}>{l}</p>)}
      </div>
      <p className="control-help briefing-foot">Written from the run data only{simulated ? ' · simulated data' : ''}.</p>
    </section>
  )
}
