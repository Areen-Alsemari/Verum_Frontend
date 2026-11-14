import type { Episode } from '../api'

/**
 * The scenario manifest: titles and one-line descriptions keyed by episode_id. The episode_id is internal: it is
 * never shown for these four scenarios (titles are "Scenario 1" to "Scenario 4"). Each entry starts a real replay run
 * of that episode on the service. The texts say nothing about what happens in the episode (no fault names, no
 * expected result); the simulation truth is shown only through the reveal-truth control. Window counts are not
 * written here: they come from the run.
 */
export interface Scenario {
  episode_id: string
  title: string
  description: string
}

export const SCENARIOS: Scenario[] = [
  {
    episode_id: 'EP-4F6063766113',
    title: 'Scenario 1',
    description: 'Replays the windows stored for this scenario, in order. Follow the agent statuses and any alert window by window.',
  },
  {
    episode_id: 'EP-099E6BB5B00A',
    title: 'Scenario 2',
    description: 'Replays the windows stored for this scenario, in order. Compare what each agent reports for the window.',
  },
  {
    episode_id: 'EP-877BF141CA51',
    title: 'Scenario 3',
    description: 'Replays the windows stored for this scenario, in order. Watch how statuses and the decision state change between windows.',
  },
  {
    episode_id: 'EP-81C608D7A4C8',
    title: 'Scenario 4',
    description: 'Replays the windows stored for this scenario, in order. Follow the persistence rule and any alert window by window.',
  },
]

export interface Availability {
  available: boolean
  /** why the entry cannot be run; set only when it is not available */
  reason?: string
}

/** An entry can run only if the service's own episode list contains its episode_id. There is no fallback. */
export function availability(s: Scenario, episodes: Episode[] | null, serviceUp: boolean, replayEnabled: boolean): Availability {
  if (!serviceUp) return { available: false, reason: 'The service is not reachable.' }
  if (!replayEnabled) return { available: false, reason: 'Replay is not enabled on this service.' }
  if (episodes === null) return { available: false, reason: 'The episode list has not loaded.' }
  if (!episodes.some((e) => e.episode_id === s.episode_id)) {
    return { available: false, reason: "Unavailable: this scenario's episode is not in this service's replay episode list." }
  }
  return { available: true }
}

/** What the UI calls an episode: "Scenario N" for the four manifest entries, the episode id for any other episode. */
export function scenarioName(episodeId: string | null | undefined): string {
  if (!episodeId) return 'not available'
  const i = SCENARIOS.findIndex((s) => s.episode_id === episodeId)
  return i >= 0 ? SCENARIOS[i]!.title : episodeId
}
