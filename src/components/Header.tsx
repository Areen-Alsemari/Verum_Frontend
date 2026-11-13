import { useEffect, useState, type ReactNode } from 'react'
import type { RunStatus } from '../state/runState'

interface Props {
  status: RunStatus
  /** the tab bar */
  children?: ReactNode
  /** extra badges (facility mismatch, etc.) */
  extra?: ReactNode
}

const STATUS_TEXT: Record<RunStatus, string> = {
  idle: 'Ready', starting: 'Starting', running: 'Running', finished: 'Run finished', stopped: 'Stopped', failed: 'Run failed',
}

export function Header({ status, children, extra }: Props) {
  // fully opaque once content scrolls under it, so the tabs stay readable
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <header className={`topbar${scrolled ? ' is-scrolled' : ''}`}>
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
        </div>
      </div>
    </header>
  )
}
