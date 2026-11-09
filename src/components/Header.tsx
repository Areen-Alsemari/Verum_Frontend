import type { RunStatus } from '../state/runState'

interface Props {
  demoReason: string | null
  status: RunStatus
}

const STATUS_TEXT: Record<RunStatus, string> = {
  idle: 'Ready', running: 'Running', finished: 'Run finished', stopped: 'Stopped', failed: 'Run failed',
}

export function Header({ demoReason, status }: Props) {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="brand">
          <img className="brand-mark" src="/brand/logo-mark.png" alt="" width={56} height={56} />
          <div>
            <h1 className="wordmark">VERUM</h1>
            <p className="tagline">Industrial diagnostic intelligence</p>
          </div>
        </div>
        <div className="header-right">
          <span className={`run-pill run-pill-${status}`} role="status" aria-live="polite">
            <span className="dot" aria-hidden="true" />
            {STATUS_TEXT[status]}
          </span>
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
