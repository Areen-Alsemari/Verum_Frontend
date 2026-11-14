import { describe, expect, it } from 'vitest'
import { SCENARIOS, availability } from '../src/lib/scenarios'

const eps = SCENARIOS.map((s) => ({ episode_id: s.episode_id, split: 'validation', windows: 1 }))

describe('scenario manifest', () => {
  it('has the four episodes, each with a title and a description', () => {
    expect(SCENARIOS.map((s) => s.episode_id)).toEqual(['EP-4F6063766113', 'EP-099E6BB5B00A', 'EP-877BF141CA51', 'EP-81C608D7A4C8'])
    for (const s of SCENARIOS) expect(s.title && s.description).toBeTruthy()
  })

  it('does not reveal the simulation truth or hardcode window counts', () => {
    const text = SCENARIOS.map((s) => `${s.title} ${s.description}`).join(' ')
    expect(text).not.toMatch(/fault|leak|pump|disagree|degraded|alert(s)? (is|are) expected|no alerts|reference|\b\d+ windows\b/i)
  })

  it('is available only when the service lists the episode, and says why otherwise', () => {
    expect(availability(SCENARIOS[0]!, eps, true, true)).toEqual({ available: true })
    const missing = availability(SCENARIOS[1]!, eps.filter((e) => e.episode_id !== SCENARIOS[1]!.episode_id), true, true)
    expect(missing.available).toBe(false)
    expect(missing.reason).toContain('EP-099E6BB5B00A')
    expect(availability(SCENARIOS[0]!, null, true, true).available).toBe(false)
    expect(availability(SCENARIOS[0]!, eps, false, true).reason).toMatch(/not reachable/)
    expect(availability(SCENARIOS[0]!, eps, true, false).reason).toMatch(/Replay is not enabled/)
  })
})
