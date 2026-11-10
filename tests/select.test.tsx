import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Select } from '../src/components/Select'
import { CommandCenter } from '../src/command/CommandCenter'
import { AGENTS } from '../src/api/mock/data'
import { initialRunState } from '../src/state/runState'

const opts = [
  { value: 'a', label: 'Quiet window', badge: { text: 'Normal', color: 'blue' } },
  { value: 'b', label: 'Developing fault' },
  { value: 'c', label: 'Agent failure' },
]

describe('Verum select', () => {
  it('is a combobox with a listbox, operable by keyboard', () => {
    const seen: string[] = []
    render(<Select label="Scenario" value="a" options={opts} onChange={(v) => seen.push(v)} />)
    const btn = screen.getByRole('combobox')
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    fireEvent.keyDown(btn, { key: 'ArrowDown' })
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('option')).toHaveLength(3)
    expect(screen.getByRole('option', { name: /Quiet window/ })).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(btn, { key: 'ArrowDown' })
    fireEvent.keyDown(btn, { key: 'Enter' })
    expect(seen).toEqual(['b'])
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    fireEvent.keyDown(btn, { key: 'Enter' })
    fireEvent.keyDown(btn, { key: 'End' })
    fireEvent.keyDown(btn, { key: ' ' })
    expect(seen).toEqual(['b', 'c'])
    fireEvent.keyDown(btn, { key: 'Enter' })
    fireEvent.keyDown(btn, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('jumps by typing and selects with the mouse', () => {
    const seen: string[] = []
    render(<Select label="Scenario" value="a" options={opts} onChange={(v) => seen.push(v)} />)
    const btn = screen.getByRole('combobox')
    fireEvent.click(btn)
    fireEvent.keyDown(btn, { key: 'a' })
    fireEvent.keyDown(btn, { key: 'Enter' })
    fireEvent.click(btn)
    fireEvent.mouseDown(screen.getByRole('option', { name: /Developing fault/ }))
    expect(seen).toEqual(['c', 'b'])
  })

  it('does not open when disabled', () => {
    render(<Select label="Scenario" value="a" options={opts} onChange={() => {}} disabled />)
    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})

describe('command center before a run', () => {
  it('does not show an empty operations briefing', () => {
    render(<CommandCenter agents={AGENTS} run={initialRunState(AGENTS)} scenario={undefined} simulated selectedAgent={null} onSelectAgent={() => {}} onGo={() => {}} stage={null} />)
    expect(screen.queryByText('Operations briefing')).toBeNull()
  })
})
