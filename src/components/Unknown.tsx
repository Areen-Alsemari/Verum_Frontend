import type { ReactNode } from 'react'

export function isMissing(v: unknown): boolean {
  return v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v))
}

/** The hatched "not available" marker. Used for every missing value; never 0, 0%, "healthy" or blank. */
export function Unknown({ what }: { what?: string }) {
  return (
    <span className="unknown" title={what ? `${what}: not provided` : 'not provided'}>
      not available
    </span>
  )
}

/** Renders `value` as given, or the unknown marker when it is missing. */
export function Value({ value, what, children }: { value: unknown; what?: string; children?: ReactNode }) {
  if (isMissing(value)) return <Unknown what={what} />
  return <>{children ?? String(value)}</>
}
