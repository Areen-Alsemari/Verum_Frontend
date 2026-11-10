import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TabBar } from '../src/shell/TabBar'
import { TABS, parseHash } from '../src/shell/routes'

describe('hash routing', () => {
  it('parses known tabs and falls back to the command center', () => {
    expect(parseHash('#/report')).toBe('report')
    expect(parseHash('#report')).toBe('report')
    expect(parseHash('')).toBe('command')
    expect(parseHash('#/nope')).toBe('command')
  })
})

describe('tab bar', () => {
  it('is a tablist with one selected, focusable tab', () => {
    render(<TabBar active="agents" onSelect={() => {}} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(TABS.length)
    expect(screen.getByRole('tab', { name: 'Agents' })).toHaveAttribute('aria-selected', 'true')
    expect(tabs.filter((t) => t.tabIndex === 0)).toHaveLength(1)
  })

  it('moves with arrow keys, Home and End', () => {
    const seen: string[] = []
    render(<TabBar active="command" onSelect={(t) => seen.push(t)} />)
    const first = screen.getByRole('tab', { name: 'Command center' })
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    fireEvent.keyDown(first, { key: 'ArrowLeft' })
    fireEvent.keyDown(first, { key: 'End' })
    fireEvent.keyDown(first, { key: 'Home' })
    expect(seen).toEqual(['scenarios', 'report', 'report', 'command'])
  })
})
