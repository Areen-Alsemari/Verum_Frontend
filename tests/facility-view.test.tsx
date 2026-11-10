import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Facility2D } from '../src/facility/Facility2D'
import { FacilityView } from '../src/facility/FacilityView'
import { searchFacility } from '../src/facility/FacilityPanels'
import { STATIC_FACILITY as F } from '../src/facility'
import { bounds, nodePositions, pipeEnds } from '../src/facility/geometry'

describe('schematic geometry', () => {
  it('places every graph node and both ends of every pipe', () => {
    const pos = nodePositions(F)
    for (const n of F.nodes ?? []) expect(pos.has(n.node_id)).toBe(true)
    for (const a of F.assets.filter((x) => x.kind === 'pipe')) expect(pipeEnds(a, pos)).not.toBeNull()
    expect(bounds(F).size).toBeGreaterThan(0)
  })
})

describe('2D diagram', () => {
  it('draws the real graph: every asset is a focusable element, none dropped', () => {
    const { container } = render(<Facility2D facility={F} flagged={new Map()} selectedId={null} onSelect={() => {}} />)
    expect(container.querySelectorAll('svg [role="button"]')).toHaveLength(F.assets.length)
    expect(screen.getByRole('button', { name: 'Pipe segment E-PA2' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /Schematic, not to scale/ })).toBeInTheDocument()
  })

  it('highlights only flagged assets, with the agent count from the data', () => {
    render(<Facility2D facility={F} flagged={new Map([['XV-PAI', { by: ['a', 'b', 'c'] }]])} selectedId={null} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: 'Isolation valve XV-PAI, flagged by 3 agents' }).getAttribute('class')).toContain('is-flagged')
    expect(document.querySelectorAll('.is-flagged')).toHaveLength(1)
  })

  it('selects with the keyboard', () => {
    const picked: (string | null)[] = []
    render(<Facility2D facility={F} flagged={new Map()} selectedId={null} onSelect={(id) => picked.push(id)} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Tank TK-101' }), { key: 'Enter' })
    expect(picked).toEqual(['TK-101'])
  })
})

describe('2D zoom', () => {
  it('zooms in and out with the buttons and resets to the centred fit', () => {
    const { container } = render(<Facility2D facility={F} flagged={new Map()} selectedId={null} onSelect={() => {}} />)
    const svg = container.querySelector('svg')!
    const fit = svg.getAttribute('viewBox')!
    const width = () => Number(svg.getAttribute('viewBox')!.split(' ')[2])
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(width()).toBeLessThan(Number(fit.split(' ')[2]))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    expect(width()).toBeGreaterThan(Number(fit.split(' ')[2]))
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(svg.getAttribute('viewBox')).toBe(fit)
  })

  it('has no zoom controls in the static report version', () => {
    render(<Facility2D facility={F} flagged={new Map()} selectedId={null} onSelect={() => {}} interactive={false} />)
    expect(screen.queryByRole('button', { name: 'Zoom in' })).toBeNull()
  })
})

describe('facility view', () => {
  it('falls back to the 2D diagram when WebGL is unavailable (jsdom) and says so', () => {
    render(<FacilityView facility={F} flagged={new Map()} readings={{}} selectedId={null} onSelect={() => {}} focusId={null}
      twoD={false} onTwoD={() => {}} lowDetail={false} onLowDetail={() => {}} />)
    expect(screen.getByText(/WebGL is not available/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Tank TK-10/ })).toHaveLength(3)
    expect(screen.getByLabelText('Legend')).toHaveTextContent('Schematic, not to scale')
  })

  it('search finds assets and tags; a tag without an asset says so', () => {
    expect(searchFacility(F, 'pt-201')[0]).toMatchObject({ id: 'PT-201', assetId: 'PT-201' })
    expect(searchFacility(F, 'LT-102')[0]).toMatchObject({ kind: 'tag', assetId: 'TK-102' })
    expect(searchFacility(F, 'LSHH-101')[0]).toMatchObject({ kind: 'tag', assetId: null })
    expect(searchFacility(F, '')).toEqual([])
  })

  it('lists all assets and sensors grouped by kind', () => {
    render(<FacilityView facility={F} flagged={new Map()} readings={{}} selectedId={null} onSelect={() => {}} focusId={null}
      twoD onTwoD={() => {}} lowDetail={false} onLowDetail={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Assets and sensors' }))
    const list = screen.getByRole('complementary', { name: 'Assets and sensors' })
    expect(list.querySelectorAll('.asset-row')).toHaveLength(49)
    expect(list.querySelectorAll('.tag-rows li')).toHaveLength(30)
    expect(list).toHaveTextContent('Sensors without an asset in the source')
  })
})
