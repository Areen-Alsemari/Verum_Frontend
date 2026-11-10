import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../src/App'
import { TABS } from '../src/shell/routes'

describe('All controls card', () => {
  it('replaces the scenarios tab', () => {
    expect(TABS.map((t) => t.id)).not.toContain('scenarios')
  })

  it('opens from the run bar, holds the scenario controls, closes with Escape and returns focus', async () => {
    render(<App />)
    const open = await screen.findByRole('button', { name: 'All controls' }, { timeout: 5000 })
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Scenario' })).not.toBeDisabled(), { timeout: 5000 })
    open.focus()
    fireEvent.click(open)
    const dlg = screen.getByRole('dialog', { name: 'Scenarios and controls' })
    expect(dlg).toHaveAttribute('aria-modal', 'true')
    expect(within(dlg).getByRole('radiogroup', { name: 'Scenarios' })).toBeInTheDocument()
    for (const b of ['Run', 'Run step by step', 'Run all scenarios', 'Stop', 'Reset to defaults']) {
      expect(within(dlg).getByRole("button", { name: b })).toBeInTheDocument()
    }
    expect(within(dlg).getByText('Observed vs expected', { exact: false })).toBeInTheDocument()
    expect(within(dlg).queryByRole('button', { name: /approve|execute|dispatch/i })).toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(open).toHaveFocus()
  })
})
