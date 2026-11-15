import type { ReactNode } from 'react'
import { REPORT_LIMITATION, type ReportModel } from './model'
import { ReportPicture } from './ReportPicture'

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rp-section${className ? ` ${className}` : ''}`}>
      <h3 className="rp-h">{title}</h3>
      {children}
    </section>
  )
}

/**
 * The maintenance report for an engineer: header, what was found, a picture of the facility, what changed, what to
 * check and a sign-off box. Sections with nothing to say are left out. The same markup is used on screen and for print.
 */
export function ReportCard({ model: m }: { model: ReportModel }) {
  const h = m.header
  return (
    <article className="report-card" aria-label="Maintenance report">
      <header className="rp-header">
        <div className="rp-brand">
          <img src="/brand/logo-mark.png" alt="" className="rp-logo" />
          <div>
            <p className="rp-wordmark">VERUM</p>
            <p className="rp-tagline">Industrial diagnostic intelligence</p>
          </div>
        </div>
        <div className="rp-title-wrap">
          <h2 className="rp-title">Maintenance report</h2>
          <p className="rp-sub">{[h.facility, h.scenario, h.time, `Window ${h.window}`].filter(Boolean).join(' · ')}</p>
          {h.status && <p className="rp-status-line">{h.status}</p>}
        </div>
      </header>

      {m.found && (
        <Section title="What was found">
          <p className="rp-found">{m.found}</p>
        </Section>
      )}

      <Section title="Where">
        <ReportPicture assetId={m.assetId} caption={m.pictureCaption} label={m.pictureLabel} />
      </Section>

      {m.changes.length > 0 && (
        <Section title="What changed">
          <ul className="rp-list">{m.changes.map((c) => <li key={c}>{c}</li>)}</ul>
        </Section>
      )}

      {m.checks.length > 0 && (
        <Section title="What to check">
          <ul className="rp-checks">
            {m.checks.map((c) => (
              <li key={c.key}>
                <span className="rp-box" aria-hidden="true" />
                <span><strong>{c.text}</strong>{c.where && <> · {c.where}</>}{c.facts.length > 0 && <span className="rp-muted"> · {c.facts.join(' · ')}</span>}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Sign-off" className="rp-decision">
        <div className="rp-signoff">
          <div className="rp-fields">
            {['Reviewed by', 'Decision', 'Date'].map((x) => <div key={x} className="rp-field"><span>{x}</span><span className="rp-line" /></div>)}
          </div>
        </div>
      </Section>

      <footer className="rp-footer">{REPORT_LIMITATION}</footer>
    </article>
  )
}
