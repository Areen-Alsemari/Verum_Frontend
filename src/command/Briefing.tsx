export function Briefing({ lines }: { lines: string[]; simulated?: boolean }) {
  return (
    <section className="briefing glass" aria-labelledby="brief-h">
      <h3 id="brief-h" className="briefing-title"><span className="briefing-ico" aria-hidden="true" />Operations briefing</h3>
      <div className="briefing-text" aria-live="polite">
        {lines.map((l) => <p key={l}>{l}</p>)}
      </div>
    </section>
  )
}
