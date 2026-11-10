import { useEffect, useState } from 'react'

export function usePrefersReducedMotion(): boolean {
  const q = '(prefers-reduced-motion: reduce)'
  const [v, setV] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches)
  useEffect(() => {
    const m = window.matchMedia?.(q)
    if (!m) return
    const on = () => setV(m.matches)
    m.addEventListener?.('change', on)
    return () => m.removeEventListener?.('change', on)
  }, [])
  return v
}

let webgl: boolean | null = null
/** True when a WebGL context can be created (cached). */
export function hasWebGL(): boolean {
  if (webgl !== null) return webgl
  try {
    const c = document.createElement('canvas')
    webgl = !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    webgl = false
  }
  return webgl
}

/** Small persisted UI preference (per viewer; falls back to the default when storage is unavailable). */
export function usePref(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [v, setV] = useState<boolean>(() => {
    try {
      const s = localStorage.getItem(`verum.${key}`)
      return s === null ? initial : s === '1'
    } catch {
      return initial
    }
  })
  const set = (n: boolean) => {
    setV(n)
    try { localStorage.setItem(`verum.${key}`, n ? '1' : '0') } catch { /* storage unavailable */ }
  }
  return [v, set]
}
