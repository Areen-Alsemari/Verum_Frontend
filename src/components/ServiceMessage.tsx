import { START_COMMAND } from '../lib/service'

export type ServiceStatus =
  | { state: 'checking' }
  | { state: 'up' }
  | { state: 'down'; message: string }

/** Shown when the service cannot be reached: what happened and the exact command to start it. */
export function ServiceMessage({ status, onRetry }: { status: ServiceStatus; onRetry: () => void }) {
  if (status.state === 'up') return null
  if (status.state === 'checking') return <p className="state-msg" role="status">Checking the run service…</p>
  return (
    <div className="state-msg state-error service-down" role="alert">
      <p><strong>The run service is not running.</strong> {status.message}</p>
      <p>Start it from the backend repository root, in a separate terminal:</p>
      <pre className="cmd"><code>{START_COMMAND}</code></pre>
      <p>The dev server must stay on port 5173; the service only allows that origin.</p>
      <button type="button" className="btn" onClick={onRetry}>Try again</button>
    </div>
  )
}
