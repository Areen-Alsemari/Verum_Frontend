import type { ReactNode } from 'react'
import type { RunStatus } from '../state/runState'

interface Props {
  demoReason: string | null
  status: RunStatus
  /** the tab bar */
  children?: ReactNode
  /** extra badges (facility mismatch, etc.) */
  extra?: ReactNode
}

const STATUS_TEXT: Record<RunStatus, string> = {
  idle: 'Ready', running: 'Running', finished: 'Run finished', stopped: 'Stopped', failed: 'Run failed',
}

export function Header({ demoReason, status, children, extra }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <img className="brand-mark" src="/brand/logo-mark.png" alt="" width={40} height={40} />
          <div>
            <h1 className="wordmark">VERUM</h1>
            <p className="tagline">Industrial diagnostic intelligence</p>
          </div>
        </div>
        {children}
        <div className="header-right">
          <span className={`run-pill run-pill-${status}`} role="status" aria-live="polite">
            <span className="dot" aria-hidden="true" />
            {STATUS_TEXT[status]}
          </span>
          {extra}
          {demoReason !== null && (
            <span className="badge-demo" title={demoReason} tabIndex={0} aria-label={`Demo data. ${demoReason}`}>
              Demo data
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
