/** "more_evidence_required" -> "more evidence required". The raw code is always kept alongside by callers. */
export function humanize(code: string): string {
  return code.replace(/_/g, ' ')
}

export function formatFactor(f: number | null | undefined): string {
  if (typeof f !== 'number' || !Number.isFinite(f)) return 'not available'
  return `×${new Intl.NumberFormat('en-US').format(f)}`
}
