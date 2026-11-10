import { useCallback, useEffect, useState } from 'react'

export const TABS = [
  { id: 'command', label: 'Command center' },
  { id: 'agents', label: 'Agents' },
  { id: 'log', label: 'Message log' },
  { id: 'investigation', label: 'Investigation' },
  { id: 'inspection', label: 'Inspection plan' },
  { id: 'report', label: 'Report' },
] as const

export type TabId = (typeof TABS)[number]['id']
export const DEFAULT_TAB: TabId = 'command'

/** "#/report" -> "report"; anything unknown falls back to the command center. */
export function parseHash(hash: string): TabId {
  const id = hash.replace(/^#\/?/, '').split(/[/?]/)[0] ?? ''
  return (TABS.find((t) => t.id === id)?.id ?? DEFAULT_TAB) as TabId
}

/** Hash routing without a router dependency. */
export function useHashRoute(): [TabId, (t: TabId) => void] {
  const [tab, setTab] = useState<TabId>(() => parseHash(window.location.hash))
  useEffect(() => {
    const on = () => setTab(parseHash(window.location.hash))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const go = useCallback((t: TabId) => {
    if (parseHash(window.location.hash) !== t || !window.location.hash) window.location.hash = `#/${t}`
    setTab(t)
  }, [])
  return [tab, go]
}
