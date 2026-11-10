import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

export interface SelectOption {
  value: string
  label: string
  /** second line, e.g. a scenario description */
  description?: string
  /** small coloured tag, e.g. the scenario kind */
  badge?: { text: string; color: string }
  /** options with the same group are listed under one heading */
  group?: string
}

interface Props {
  value: string
  options: SelectOption[]
  onChange: (v: string) => void
  /** accessible name; shown above the button unless `hideLabel` */
  label: string
  hideLabel?: boolean
  disabled?: boolean
  id?: string
  /** "hero" is the large scenario switcher on the command center */
  variant?: 'default' | 'hero' | 'compact'
  /** optional content before the selected label inside the button */
  prefix?: ReactNode
}

/**
 * Verum-styled select: a button that opens a listbox (WAI-ARIA select-only combobox pattern).
 * Keyboard: Enter / Space / Alt+Down open; Up, Down, Home, End move; Enter selects; Escape closes; typing jumps.
 */
export function Select({ value, options, onChange, label, hideLabel = false, disabled = false, id, variant = 'default', prefix }: Props) {
  const auto = useId()
  const base = id ?? `sel-${auto.replace(/:/g, '')}`
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrap = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const typed = useRef({ s: '', t: 0 })
  const selIndex = Math.max(0, options.findIndex((o) => o.value === value))
  const selected = options[selIndex]

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  useEffect(() => {
    if (!open) return
    list.current?.querySelector<HTMLElement>(`#${base}-o-${active}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [open, active, base])

  const openAt = (i: number) => { setActive(i); setOpen(true) }
  const choose = (i: number) => {
    const o = options[i]
    if (o) onChange(o.value)
    setOpen(false)
  }
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    const last = options.length - 1
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); openAt(selIndex) }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, last)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(last) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active) }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false) }
    else if (e.key === 'Tab') setOpen(false)
    else if (e.key.length === 1) {
      const now = Date.now()
      typed.current = { s: (now - typed.current.t < 700 ? typed.current.s : '') + e.key.toLowerCase(), t: now }
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.s))
      if (i >= 0) setActive(i)
    }
  }

  let lastGroup: string | undefined
  return (
    <div ref={wrap} className={`vsel vsel-${variant}${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`}>
      <span id={`${base}-l`} className={hideLabel ? 'sr-only' : 'vsel-label'}>{label}</span>
      <div className="vsel-anchor">
      <button
        id={base}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${base}-list`}
        aria-labelledby={`${base}-l ${base}`}
        aria-activedescendant={open ? `${base}-o-${active}` : undefined}
        disabled={disabled}
        className="vsel-button"
        onClick={() => (open ? setOpen(false) : openAt(selIndex))}
        onKeyDown={onKey}
      >
        {prefix}
        <span className="vsel-value">
          <span className="vsel-text">{selected?.label ?? 'unknown'}</span>
        </span>
        {selected?.badge && <span className="kind-badge" style={{ ['--kind' as string]: selected.badge.color }}>{selected.badge.text}</span>}
        <svg className="vsel-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <ul ref={list} id={`${base}-list`} role="listbox" aria-labelledby={`${base}-l`} className="vsel-list" tabIndex={-1}>
          {options.map((o, i) => {
            const head = o.group && o.group !== lastGroup ? o.group : null
            lastGroup = o.group
            return [
              head && <li key={`g-${head}`} role="presentation" className="vsel-group">{head}</li>,
              <li
                key={o.value}
                id={`${base}-o-${i}`}
                role="option"
                aria-selected={o.value === value}
                className={`vsel-opt${i === active ? ' is-active' : ''}${o.value === value ? ' is-selected' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); choose(i) }}
              >
                <span className="vsel-opt-main">
                  <span>{o.label}</span>
                  {o.badge && <span className="kind-badge" style={{ ['--kind' as string]: o.badge.color }}>{o.badge.text}</span>}
                </span>
                {o.description && <span className="vsel-opt-desc">{o.description}</span>}
              </li>,
            ]
          })}
        </ul>
      )}
      </div>
    </div>
  )
}
