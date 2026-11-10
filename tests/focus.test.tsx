import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FocusView } from '../src/command/FocusView'
import { STATIC_FACILITY as F } from '../src/facility'
import { neighbours } from '../src/facility/geometry'

const flagged = [
  { asset: 'XV-PAI', by: ['anomaly_detection', 'topology_dependency', 'diagnostic_reasoning'], severity: 'warning', note: 'Pressure drop' },
  { asset: 'E-PA1', by: ['topology_dependency'] },
]

describe('focus view', () => {
  it('includes the asset, its pipes and the equipment beyond them', () => {
    const n = neighbours(F, 'XV-PAI')
    for (const id of ['XV-PAI', 'E-PA0', 'E-PA1', 'P-101A', 'PUMP_SUCTION_TEE', 'PT-201']) expect(n.has(id)).toBe(true)
    expect(n.has('TK-101')).toBe(false)
  })

  it('shows the flagging agents from the data and chips to switch assets', () => {
    const seen: string[] = []
    render(<FocusView facility={F} flagged={flagged} readings={{}} focusId="XV-PAI" onFocus={(id) => seen.push(id)}
      agentName={(r) => r} twoD={false} lowDetail={false} />)
    expect(screen.getByText('3 agents')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'XV-PAI' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'E-PA1' }))
    expect(seen).toEqual(['E-PA1'])
  })

  it('shows sensor values as unknown before readings arrive, and missing severity as unknown', () => {
    render(<FocusView facility={F} flagged={[flagged[1]!]} readings={{}} focusId="E-PA1" onFocus={() => {}} agentName={(r) => r} twoD lowDetail={false} />)
    expect(screen.getByText('severity').parentElement).toHaveTextContent('unknown')
    expect(screen.queryByRole('group', { name: 'Flagged assets' })).toBeNull()
  })

  it('renders nothing when no asset is flagged', () => {
    const { container } = render(<FocusView facility={F} flagged={[]} readings={{}} focusId={null} onFocus={() => {}} agentName={(r) => r} twoD lowDetail={false} />)
    expect(container).toBeEmptyDOMElement()
  })
})
