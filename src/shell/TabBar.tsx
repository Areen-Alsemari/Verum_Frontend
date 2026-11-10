import { useRef, type KeyboardEvent } from 'react'
import { TABS, type TabId } from './routes'

interface Props {
  active: TabId
  onSelect: (t: TabId) => void
  /** small count badges per tab, only when there is something to show */
  badges?: Partial<Record<TabId, { text: string; tone?: 'fail' | 'warn' | 'info' }>>
}

/** Pill-shaped tab bar. Arrow keys, Home and End move between tabs (roving tabindex). */
export function TabBar({ active, onSelect, badges = {} }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let n = -1
    if (e.key === 'ArrowRight') n = (i + 1) % TABS.length
    else if (e.key === 'ArrowLeft') n = (i - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') n = 0
    else if (e.key === 'End') n = TABS.length - 1
    if (n < 0) return
    e.preventDefault()
    onSelect(TABS[n]!.id)
    refs.current[n]?.focus()
  }
  return (
    <nav className="tabbar glass" aria-label="Sections">
      <div role="tablist" aria-label="Sections" className="tabbar-list">
        {TABS.map((t, i) => {
          const on = t.id === active
          const b = badges[t.id]
          return (
            <button
              key={t.id}
              ref={(el) => { refs.current[i] = el }}
              id={`tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={on}
              aria-controls={`panel-${t.id}`}
              tabIndex={on ? 0 : -1}
              className={`tab${on ? ' is-active' : ''}`}
              onClick={() => onSelect(t.id)}
              onKeyDown={(e) => onKey(e, i)}
            >
              {t.label}
              {b && <span className={`tab-badge tone-${b.tone ?? 'info'}`}>{b.text}</span>}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
