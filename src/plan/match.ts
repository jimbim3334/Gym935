import type { Muscle } from '../catalog/muscles.ts'
import type { Exercise, ExerciseAlias } from '../db/types.ts'
import { nameSimilarity, normalizeName } from '../lib/text.ts'
import type { ExerciseDefinitionData, ExercisePlanData, PlanData } from './schema.ts'

export interface MatchIndex {
  byId: Map<string, Exercise>
  /** normalized name or alias -> exercise ids */
  byNorm: Map<string, Set<string>>
  entries: { id: string; norm: string }[]
}

export function buildIndex(exercises: Exercise[], aliases: ExerciseAlias[]): MatchIndex {
  const live = exercises.filter((e) => !e.deleted_at)
  const byId = new Map(live.map((e) => [e.id, e]))
  const byNorm = new Map<string, Set<string>>()
  const entries: MatchIndex['entries'] = []
  const add = (norm: string, id: string) => {
    if (!byNorm.has(norm)) byNorm.set(norm, new Set())
    byNorm.get(norm)!.add(id)
    entries.push({ id, norm })
  }
  for (const e of live) add(normalizeName(e.name), e.id)
  for (const a of aliases) if (!a.deleted_at && byId.has(a.exercise_id)) add(a.alias_norm, a.exercise_id)
  return { byId, byNorm, entries }
}

export interface ExerciseRef {
  key: string
  /** Name as written in the plan (or the id if only an id was given). */
  label: string
  exercise?: string
  exercise_id?: string
  occurrences: number
}

export const refKey = (item: { exercise?: string; exercise_id?: string }) =>
  `${item.exercise_id ?? ''}|${item.exercise ? normalizeName(item.exercise) : ''}`

/** All distinct exercise references in a plan, in order of first appearance. */
export function collectRefs(plan: ExercisePlanData): ExerciseRef[] {
  const refs = new Map<string, ExerciseRef>()
  for (const w of plan.weeks)
    for (const d of w.days)
      for (const item of d.items) {
        const key = refKey(item)
        const existing = refs.get(key)
        if (existing) existing.occurrences++
        else
          refs.set(key, {
            key,
            label: item.exercise ?? item.exercise_id ?? '?',
            exercise: item.exercise,
            exercise_id: item.exercise_id,
            occurrences: 1,
          })
      }
  return [...refs.values()]
}

export interface Candidate {
  id: string
  name: string
  score: number
}

export type Resolution =
  | { status: 'resolved'; exercise_id: string; via: 'id' | 'name' }
  | { status: 'ask'; candidates: Candidate[]; definition?: ExerciseDefinitionData }

const MIN_CANDIDATE_SCORE = 0.45

/** Muscle words in a name ("Quad Extension") hint at exercises training that muscle. */
const MUSCLE_HINTS: Record<string, Muscle[]> = {
  quad: ['quads'],
  quadrizep: ['quads'],
  hamstring: ['hamstrings'],
  beinbeuger: ['hamstrings'],
  glute: ['glutes'],
  chest: ['chest'],
  pec: ['chest'],
  brust: ['chest'],
  bicep: ['biceps'],
  bizep: ['biceps'],
  tricep: ['triceps'],
  trizep: ['triceps'],
  lat: ['lats'],
  calf: ['calves'],
  calve: ['calves'],
  wade: ['calves'],
  shoulder: ['front_delts', 'side_delts'],
  schulter: ['front_delts', 'side_delts'],
  delt: ['front_delts', 'side_delts', 'rear_delts'],
  ab: ['abs'],
  core: ['abs', 'obliques'],
  trap: ['traps'],
}

const MUSCLE_HINT_BONUS = 0.12

export function findCandidates(name: string, index: MatchIndex, limit = 4): Candidate[] {
  const norm = normalizeName(name)
  const hinted = new Set(norm.split(' ').flatMap((t) => MUSCLE_HINTS[t] ?? []))
  const best = new Map<string, number>()
  for (const e of index.entries) {
    let score = nameSimilarity(norm, e.norm)
    if (hinted.size && index.byId.get(e.id)!.primary_muscles.some((m) => hinted.has(m))) score += MUSCLE_HINT_BONUS
    score = Math.min(score, 0.99)
    if (score >= MIN_CANDIDATE_SCORE && score > (best.get(e.id) ?? 0)) best.set(e.id, score)
  }
  return [...best.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, score]) => ({ id, name: index.byId.get(id)!.name, score }))
}

/**
 * Exact id, exact name or a known alias resolve silently. Everything else becomes a question
 * for the user ("Ist 'Bench Press' = 'Barbell Bench Press'?") - fuzzy matches are never applied blindly.
 */
export function resolveRef(ref: ExerciseRef, index: MatchIndex, definitions: ExerciseDefinitionData[] = []): Resolution {
  if (ref.exercise_id && index.byId.has(ref.exercise_id)) return { status: 'resolved', exercise_id: ref.exercise_id, via: 'id' }
  const name = ref.exercise ?? ref.exercise_id ?? ''
  const norm = normalizeName(name)
  const exact = index.byNorm.get(norm)
  if (exact && exact.size === 1) return { status: 'resolved', exercise_id: [...exact][0], via: 'name' }
  const candidates = exact && exact.size > 1
    ? [...exact].map((id) => ({ id, name: index.byId.get(id)!.name, score: 1 }))
    : findCandidates(name, index)
  const definition = definitions.find((d) => normalizeName(d.name) === norm)
  return { status: 'ask', candidates, definition }
}

/** User decision for one unresolved reference. */
export type Decision = { kind: 'existing'; exercise_id: string } | { kind: 'create'; definition: ExerciseDefinitionData }

/** Writes resolved ids (and the catalog's canonical name) into every exercise item. */
export function applyExerciseIds(plan: PlanData, idByKey: Map<string, string>, nameById: Map<string, string>): PlanData {
  if (plan.type === 'cardio') return plan
  const copy = structuredClone(plan)
  for (const w of copy.weeks)
    for (const d of w.days)
      for (const item of d.items) {
        const id = idByKey.get(refKey(item))
        if (!id) throw new Error(`Übung „${item.exercise ?? item.exercise_id}“ ist nicht zugeordnet.`)
        item.exercise_id = id
        item.exercise = nameById.get(id) ?? item.exercise
      }
  // Definitions only matter for the import itself.
  delete copy.exercise_definitions
  return copy
}
