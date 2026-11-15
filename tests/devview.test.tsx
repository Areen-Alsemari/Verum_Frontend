import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useDevView } from '../src/lib/dev'

describe('developer view', () => {
  afterEach(() => window.history.replaceState(null, '', '/'))
  it('is off by default and toggles from the footer link', () => {
    const { result } = renderHook(() => useDevView())
    expect(result.current[0]).toBe(false)
    act(() => result.current[1]())
    expect(result.current[0]).toBe(true)
  })
  it('is on with ?dev=1', () => {
    window.history.replaceState(null, '', '/?dev=1')
    const { result } = renderHook(() => useDevView())
    expect(result.current[0]).toBe(true)
  })
})
