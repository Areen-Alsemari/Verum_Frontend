import { useRef, type KeyboardEvent } from 'react'
import { visibleTabs, type TabId } from './routes'

type Tab = { id: TabId; label: string }

interface Props {
  active: TabId
  onSelect: (t: TabId) => void
  /** the tabs to show (default: all) */
  tabs?: readonly Tab[]
  /** small count badges per tab, only when there is something to show */
  badges?: Partial<Record<TabId, { text: string; tone?: 'fail' | 'warn' | 'info' }>>
}

/** Pill-shaped tab bar. Arrow keys, Home and End move between tabs (roving tabindex). */
export function TabBar({ active, onSelect, badges = {}, tabs = visibleTabs(false) }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let n = -1
    if (e.key === 'ArrowRight') n = (i + 1) % tabs.length
    else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') n = 0
    else if (e.key === 'End') n = tabs.length - 1
    if (n < 0) return
    e.preventDefault()
    onSelect(tabs[n]!.id)
    refs.current[n]?.focus()
  }
  return (
    <nav className="tabbar glass" aria-label="Sections">
      <div role="tablist" aria-label="Sections" className="tabbar-list">
        {tabs.map((t, i) => {
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
