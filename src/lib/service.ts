import { ApiError, ServiceUnavailableError } from '../api/client'

/** Run from the backend repository root, in a separate terminal. */
export const START_COMMAND =
  'PYTHONPATH=src .venv/bin/python -m verum.service --port 8765 --replay-dir local/replay_sample --release data/reference_release_v2/verum_reference_v2'

export function describeError(e: unknown): string {
  if (e instanceof ServiceUnavailableError) return e.message
  if (e instanceof ApiError) return `The service answered ${e.status}: ${e.message}`
  return e instanceof Error ? e.message : String(e)
}
