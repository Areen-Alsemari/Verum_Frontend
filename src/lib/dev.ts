import { useCallback, useState } from 'react'

/** The developer view is off by default. `?dev=1` turns it on at load; the footer link toggles it. */
export function useDevView(): [boolean, () => void] {
  const [dev, setDev] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('dev') === '1' } catch { return false }
  })
  const toggle = useCallback(() => setDev((d) => !d), [])
  return [dev, toggle]
}
