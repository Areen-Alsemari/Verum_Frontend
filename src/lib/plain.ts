import { kindLabel, type Facility } from '../facility'
import { label } from './labels'
import { scoreText, type Candidate, type Hypothesis } from './candidate'

/**
 * Plain-language wording for what the agents report. Names come from the facility layout (kind and equipment tag);
 * nothing here adds a fact the service did not give.
 */

const MECHANISMS: Record<string, string> = {
  pump: 'pump fault',
  leak: 'leak',
  bias: 'sensor bias',
  drift: 'sensor drift',
  stuck: 'stuck reading',
  restriction: 'restriction',
  restriction_position_visible: 'restriction with the valve position visible',
  restriction_obstruction: 'restriction by an obstruction',
  misroute_a: 'misrouted flow',
  multi_component: 'fault in more than one component',
  'multi-component': 'fault in more than one component',
}

/** A mechanism code as plain words ("pump" is "pump fault"). Unknown codes become plain words, never raw names. */
export function mechanismName(code: string | null | undefined): string {
  if (!code) return 'not available'
  const k = code.trim()
  return MECHANISMS[k] ?? MECHANISMS[k.toLowerCase()] ?? k.replace(/[_-]+/g, ' ').toLowerCase()
}

/** "pump P-101A": the kind from the facility layout, then the equipment tag. A tag the layout does not know stays as it is. */
export function assetPhrase(f: Facility, id: string): string {
  const a = f.assets.find((x) => x.asset_id === id)
  return a ? `${kindLabel(a.kind).toLowerCase()} ${id}` : id
}

/** The area of an asset in the layout, when it has one. */
export function assetArea(f: Facility, id: string): string | null {
  return f.assets.find((x) => x.asset_id === id)?.area ?? null
}

/** One hypothesis as a phrase, without the lead-in. */
export function hypothesisPhrase(h: Hypothesis, f: Facility): string {
  const m = mechanismName(h.mechanism)
  if (h.assetId) return `${assetPhrase(f, h.assetId)} (${m})`
  if (h.tagId) return `${m}, seen on sensor ${h.tagId}, with no asset named`
  return `${m}, with no asset named`
}

export const SCORE_SENTENCE = 'This is a ranking score, not a probability.'

/** "Agent 5's top candidate: pump P-101A (pump fault). Ranking score 0.9996. This is a ranking score, not a probability." */
export function candidateSentence(c: Candidate, f: Facility): string | null {
  if (c.kind === 'asset' || c.kind === 'tag' || c.kind === 'unlocalised') {
    return `Agent 5's top candidate: ${hypothesisPhrase(c.hypothesis, f)}. Ranking score ${scoreText(c.hypothesis.score)}. ${SCORE_SENTENCE}`
  }
  if (c.kind === 'unreadable') return "Agent 5 listed a candidate that this screen could not read."
  if (c.kind === 'none') return 'Agent 5 listed no candidate.'
  return null
}

const NOTES: Record<string, string> = {
  ASSETS_NOT_IN_DECLARED_GRAPH: 'Some asset ids are not in the declared layout',
  NO_BUDGET: 'No inspection budget was supplied',
  NO_CONSTRAINT_CHECKS: 'No constraint checks were supplied',
  NO_EVIDENCE_PROPOSALS: 'No evidence proposals were supplied',
  NO_HISTORY_SUPPLIED: 'No earlier history was supplied',
  NO_INSPECTION_RESULTS: 'No inspection results were supplied',
  SOURCE_ROWS_NOT_SUPPLIED: 'The source rows were not supplied',
  UNIT_NOT_DECLARED: 'A unit was not declared',
}

/** A runner note code as a plain sentence. Unknown codes go through the general labeller. */
export function noteText(code: string): string {
  return NOTES[code] ?? label(code)
}

/** The persistence rule as plain sentences, e.g. "No alert so far. 1 of the last 3 windows was above normal; an alert is raised when 2 are." */
export function persistenceSentence(p: { rule: { k: number; n: number }; windows_held: number; windows_exceeding: number; alarming: boolean | null } | null | undefined): string | null {
  if (!p || typeof p.rule?.k !== 'number' || typeof p.windows_held !== 'number') return null
  const held = p.windows_held
  const exc = p.windows_exceeding
  const last = held === 1 ? 'the last window' : `the last ${held} windows`
  const was = exc === 1 ? 'was' : 'were'
  if (p.alarming === true) return `Alert raised: ${exc} of ${last} ${was} above normal (an alert is raised when ${p.rule.k} are).`
  return `${p.alarming === false ? 'No alert so far.' : 'Too early to call.'} ${exc} of ${last} ${was} above normal; an alert is raised when ${p.rule.k} are.`
}
