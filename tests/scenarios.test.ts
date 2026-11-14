import { describe, expect, it } from 'vitest'
import { SCENARIOS, availability, scenarioName } from '../src/lib/scenarios'

const eps = SCENARIOS.map((s) => ({ episode_id: s.episode_id, split: 'validation', windows: 1 }))

describe('scenario manifest', () => {
  it('has the four episodes, each with a title and a description', () => {
    expect(SCENARIOS.map((s) => s.episode_id)).toEqual(['EP-4F6063766113', 'EP-099E6BB5B00A', 'EP-877BF141CA51', 'EP-81C608D7A4C8'])
    for (const s of SCENARIOS) expect(s.title && s.description).toBeTruthy()
  })

  it('titles name the scenarios and no episode id (EP-...) appears in any title, description or unavailable reason', () => {
    expect(SCENARIOS.map((s) => s.title)).toEqual(['Clear pump fault', 'Detector and classifier disagree', 'Degraded agents, two faults', 'Fault-free reference'])
    for (const s of SCENARIOS) {
      expect(s.title).not.toMatch(/EP-/)
      expect(s.description).not.toMatch(/EP-/)
      expect(availability(s, [], true, true).reason).not.toMatch(/EP-/)
      expect(scenarioName(s.episode_id)).toBe(s.title)
    }
    expect(scenarioName('EP-OTHER')).toBe('EP-OTHER')
  })

  it('does not hardcode window counts', () => {
    const text = SCENARIOS.map((s) => `${s.title} ${s.description}`).join(' ')
    expect(text).not.toMatch(/\b\d+ windows?\b/i)
  })

  it('is available only when the service lists the episode, and says why otherwise', () => {
    expect(availability(SCENARIOS[0]!, eps, true, true)).toEqual({ available: true })
    const missing = availability(SCENARIOS[1]!, eps.filter((e) => e.episode_id !== SCENARIOS[1]!.episode_id), true, true)
    expect(missing.available).toBe(false)
    expect(missing.reason).toMatch(/not in this service/)
    expect(availability(SCENARIOS[0]!, null, true, true).available).toBe(false)
    expect(availability(SCENARIOS[0]!, eps, false, true).reason).toMatch(/not reachable/)
    expect(availability(SCENARIOS[0]!, eps, true, false).reason).toMatch(/Replay is not enabled/)
  })
})
