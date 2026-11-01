import type { Mechanic } from '../catalog/muscles.ts'
import type { SetType } from '../db/types.ts'
import { num, parseRange, type Range } from '../plan/format.ts'
import type { LoadData, SetGroupData } from '../plan/schema.ts'

/**
 * Load recommendations (hybrid model):
 * - Compounds: add load once every working set reached the top of the rep range at (or above) target RIR.
 * - Isolations: double progression, add reps first, then the smallest load step.
 * - Rep target changed since last time: estimate the load from e1RM instead.
 * - Decreases need two sessions in a row below the range, so one bad day is not an outlier trigger.
 * - Within a session, the next set is adjusted from the RIR of the set just logged.
 */

/** A completed set from an earlier session. */
export interface PastSet {
  weight_kg: number | null
  reps: number | null
  rir: number | null
  set_type: SetType
  /** The planned set group it was logged against, if any. */
  target: SetGroupData | null
}

/** One earlier session's sets for a single exercise, newest session first in arrays of these. */
export interface PastSession {
  session_id: string
  date: string
  plan_id: string | null
  week: number | null
  sets: PastSet[]
}

export interface ExerciseInfo {
  mechanic: Mechanic
  /** Smallest practical load jump. 0 = no load (bodyweight, band). */
  increment: number
  /** Weight is assistance (assisted pull-up): less weight = harder. */
  assisted?: boolean
}

export type RecommendationKind = 'plan' | 'increase' | 'hold' | 'decrease' | 'adjust' | 'new' | 'none'

export interface Recommendation {
  kind: RecommendationKind
  weight: number | null
  /** Rep goal for this session (null = use the plan's range). */
  reps: number | null
  /** Short German explanation for the card. */
  reason: string
}

/** Target RIR as a range; RPE is converted (RIR ≈ 10 − RPE). */
export function targetRir(group: Pick<SetGroupData, 'rir' | 'rpe'>): Range | null {
  const rir = parseRange(group.rir)
  if (rir) return rir
  const rpe = parseRange(group.rpe)
  return rpe ? { min: 10 - rpe.max, max: 10 - rpe.min } : null
}

export const repRange = (group: Pick<SetGroupData, 'reps'>) => parseRange(group.reps)

const mid = (r: Range) => (r.min + r.max) / 2

/** Epley with reps in reserve: the set counts as if taken to failure. Unreliable past ~15 reps, so capped. */
export function e1rm(weight: number, reps: number, rir = 0): number {
  const effective = Math.min(reps + Math.max(rir, 0), 15)
  return weight * (1 + effective / 30)
}

/** Load for a given rep and RIR goal from an e1RM. */
export const loadFor = (oneRm: number, reps: number, rir: number) => oneRm / (1 + Math.min(reps + rir, 15) / 30)

export function roundTo(value: number, step: number, mode: 'nearest' | 'down' = 'nearest') {
  if (step <= 0) return Math.round(value * 10) / 10
  const n = value / step
  const r = mode === 'down' ? Math.floor(n + 1e-9) : Math.round(n)
  return Math.round(r * step * 100) / 100
}

/** Sets from a past session that are comparable to the planned group (same set type; any non-warmup as fallback). */
export function comparableSets(session: PastSession, type: SetType): PastSet[] {
  const done = session.sets.filter((s) => s.reps !== null)
  if (type === 'warmup') return done.filter((s) => s.set_type === 'warmup')
  const same = done.filter((s) => s.set_type === type)
  if (same.length) return same
  return done.filter((s) => s.set_type !== 'warmup')
}

/** Most used weight; ties go to the heavier one. */
function workingWeight(sets: PastSet[]): number | null {
  const counts = new Map<number, number>()
  for (const s of sets) if (s.weight_kg !== null) counts.set(s.weight_kg, (counts.get(s.weight_kg) ?? 0) + 1)
  let best: number | null = null
  for (const [w, c] of counts) if (best === null || c > counts.get(best)! || (c === counts.get(best)! && w > best)) best = w
  return best
}

export function bestE1rm(sessions: PastSession[], take = 3): number | null {
  let best: number | null = null
  for (const s of sessions.slice(0, take)) {
    for (const set of s.sets) {
      if (set.set_type === 'warmup' || !set.weight_kg || !set.reps) continue
      const v = e1rm(set.weight_kg, set.reps, set.rir ?? 0)
      if (best === null || v > best) best = v
    }
  }
  return best
}

const sameRange = (a: Range | null, b: Range | null) => (a && b ? a.min === b.min && a.max === b.max : a === b)

const kg = (w: number) => `${num(w)} kg`

function describeSets(sets: PastSet[]): string {
  const w = workingWeight(sets)
  const reps = sets.map((s) => s.reps).join('/')
  const rirs = sets.map((s) => s.rir).filter((r): r is number => r !== null)
  const rir = rirs.length ? ` · RIR ${num(Math.min(...rirs))}` : ''
  return `${w !== null && w > 0 ? `${kg(w)} × ` : ''}${reps}${rir}`
}

export interface RecommendInput {
  group: SetGroupData
  exercise: ExerciseInfo
  /** Earlier sessions with this exercise, newest first. */
  history: PastSession[]
  /** Plan context, for relative loads. */
  planId?: string | null
  week?: number | null
  deload?: boolean
  /** Weight of the top set in this session (actual if logged, else recommended). */
  topSetWeight?: number | null
}

function fromPlanLoad(load: LoadData, input: RecommendInput): Recommendation {
  const { exercise, history } = input
  const step = exercise.increment
  switch (load.type) {
    case 'kg':
      return { kind: 'plan', weight: load.kg, reps: null, reason: `Plan: ${kg(load.kg)}` }
    case 'percent_1rm': {
      const oneRm = bestE1rm(history)
      if (oneRm === null) return { kind: 'none', weight: null, reps: null, reason: `Plan: ${num(load.percent)} % vom 1RM · noch kein 1RM bekannt` }
      const w = roundTo((oneRm * load.percent) / 100, step)
      return { kind: 'plan', weight: w, reps: null, reason: `Plan: ${num(load.percent)} % von ca. ${kg(roundTo(oneRm, 0.5))} (geschätztes 1RM)` }
    }
    case 'percent_top_set': {
      const top = input.topSetWeight
      if (!top) return { kind: 'none', weight: null, reps: null, reason: `Plan: ${num(load.percent)} % vom Top-Satz` }
      const w = roundTo((top * load.percent) / 100, step)
      return { kind: 'plan', weight: w, reps: null, reason: `${num(load.percent)} % vom Top-Satz (${kg(top)})` }
    }
    case 'relative': {
      const ref =
        load.reference === 'last_week'
          ? (history.find((s) => input.week != null && s.plan_id === input.planId && s.week !== null && s.week < input.week) ?? history[0])
          : history[0]
      const base = ref ? workingWeight(comparableSets(ref, input.group.type)) : null
      if (base === null) return { kind: 'none', weight: null, reps: null, reason: 'Plan: relativ zur Vorwoche · noch keine Werte' }
      const w = load.change_kg !== undefined ? base + load.change_kg : base * (1 + (load.change_percent ?? 0) / 100)
      const change =
        load.change_kg !== undefined ? `${load.change_kg >= 0 ? '+' : '−'}${kg(Math.abs(load.change_kg))}` : `${(load.change_percent ?? 0) >= 0 ? '+' : '−'}${num(Math.abs(load.change_percent ?? 0))} %`
      return { kind: 'plan', weight: roundTo(w, step), reps: null, reason: `Plan: ${change} auf ${kg(base)}` }
    }
  }
}

export function recommend(input: RecommendInput): Recommendation {
  const { group, exercise, history } = input
  if (group.load) return fromPlanLoad(group.load, input)

  const reps = repRange(group)
  const rir = targetRir(group)
  const step = exercise.increment
  const sessions = history.map((s) => comparableSets(s, group.type)).filter((sets) => sets.length > 0)
  const last = sessions[0]

  if (!last) {
    if (group.type === 'warmup') return { kind: 'none', weight: null, reps: null, reason: 'Aufwärmen' }
    const oneRm = bestE1rm(history)
    if (oneRm !== null && reps && step > 0) {
      const w = roundTo(loadFor(oneRm, mid(reps), rir ? mid(rir) : 2), step, 'down')
      return { kind: 'adjust', weight: w, reps: null, reason: `Aus geschätztem 1RM (ca. ${kg(roundTo(oneRm, 0.5))})` }
    }
    const goal = rir ? `RIR ${num(rir.min)}${rir.max !== rir.min ? `–${num(rir.max)}` : ''}` : 'die Wiederholungen'
    return { kind: 'new', weight: null, reps: null, reason: `Erstes Mal · Gewicht so wählen, dass ${goal} passt` }
  }

  const w = workingWeight(last)
  const lastText = `Zuletzt ${describeSets(last)}`

  if (group.type === 'warmup') return { kind: 'hold', weight: w, reps: null, reason: lastText }

  // Rep target changed since last time: e1RM converts the old performance to the new goal.
  const lastRange = last.find((s) => s.target)?.target
  if (reps && lastRange && !sameRange(repRange(lastRange), reps) && step > 0) {
    const oneRm = bestE1rm(history, 2)
    if (oneRm !== null) {
      const nw = roundTo(loadFor(oneRm, mid(reps), rir ? mid(rir) : 2), step, 'down')
      return { kind: 'adjust', weight: nw, reps: null, reason: `Neue Vorgabe ${num(reps.min)}–${num(reps.max)} Wdh. · aus geschätztem 1RM` }
    }
  }

  if (!reps) return { kind: 'hold', weight: w, reps: null, reason: lastText }

  const loaded = (s: PastSet) => w === null || s.weight_kg === w
  const atWeight = last.filter(loaded)
  const hitTop = atWeight.length > 0 && atWeight.every((s) => (s.reps ?? 0) >= reps.max && (rir === null || s.rir === null || s.rir >= rir.min))
  const missed = (sets: PastSet[]) => sets.filter((s) => (s.reps ?? 0) < reps.min).length > sets.length / 2

  if (hitTop) {
    if (input.deload) return { kind: 'hold', weight: w, reps: null, reason: `${lastText} · Deload: Gewicht halten` }
    if (step <= 0 || w === null) return { kind: 'hold', weight: w, reps: reps.max, reason: `${lastText} · Ziel: mehr Wdh. oder schwerere Variante` }
    const rirs = atWeight.map((s) => s.rir).filter((r): r is number => r !== null)
    const avgRir = rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null
    // Compounds may jump two steps when every set was clearly too easy.
    const steps = exercise.mechanic === 'compound' && rir && avgRir !== null && avgRir >= rir.max + 2 ? 2 : 1
    if (exercise.assisted) {
      const nw = Math.max(0, roundTo(w - step * steps, step))
      return { kind: 'increase', weight: nw, reps: reps.min, reason: `${lastText} · oberes Ende erreicht, ${kg(w - nw)} weniger Unterstützung` }
    }
    const nw = roundTo(w + step * steps, step)
    return { kind: 'increase', weight: nw, reps: reps.min, reason: `${lastText} · oberes Ende erreicht, +${kg(nw - w)}` }
  }

  if (missed(last)) {
    const prev = sessions[1]
    if (prev && missed(prev) && w !== null && step > 0) {
      if (exercise.assisted) {
        return { kind: 'decrease', weight: roundTo(w + step, step), reps: reps.min, reason: `Zweimal unter ${num(reps.min)} Wdh. · etwas mehr Unterstützung` }
      }
      const nw = Math.min(roundTo(w * 0.95, step, 'down'), roundTo(w - step, step))
      return { kind: 'decrease', weight: nw, reps: reps.min, reason: `Zweimal unter ${num(reps.min)} Wdh. · Gewicht etwas runter` }
    }
    return { kind: 'hold', weight: w, reps: reps.min, reason: `${lastText} · unter dem Ziel, Gewicht halten` }
  }

  // In range but not at the top yet: same weight, one more rep (isolations progress through reps first).
  const lastReps = Math.min(...atWeight.map((s) => s.reps ?? reps.min))
  const goal = Math.min(reps.max, Math.max(reps.min, lastReps + 1))
  return { kind: 'hold', weight: w, reps: goal, reason: `${lastText} · Gewicht halten, Ziel ${goal} Wdh.` }
}

export interface LoggedSet {
  weight_kg: number | null
  reps: number | null
  rir: number | null
}

export interface NextSetAdvice {
  weight: number | null
  tone: 'ok' | 'up' | 'down'
  message: string
}

/**
 * After a logged set: how heavy should the next set of the same prescription be?
 * Uses the set's e1RM to hit the middle of the target reps at the target RIR; changes are capped at ±10 %.
 */
export function adviseNextSet(done: LoggedSet, next: SetGroupData, exercise: ExerciseInfo): NextSetAdvice | null {
  const { weight_kg: w, reps, rir } = done
  if (w === null || reps === null) return null
  const goalRir = targetRir(next)
  const goalReps = repRange(next)
  if (rir === null || !goalRir || !goalReps) return { weight: w, tone: 'ok', message: `Nächster Satz ${kg(w)}` }
  const repsOk = reps >= goalReps.min && reps <= goalReps.max + 1
  const rirOk = rir >= goalRir.min - 0.5 && rir <= goalRir.max + 0.5
  if ((repsOk && rirOk) || exercise.increment <= 0 || w <= 0 || exercise.assisted) {
    const label = rirOk ? 'RIR passte' : rir > goalRir.max ? 'Leichter als geplant' : 'Schwerer als geplant'
    return { weight: w, tone: 'ok', message: `${label} · nächster Satz ${kg(w)}` }
  }
  const raw = loadFor(e1rm(w, reps, rir), mid(goalReps), mid(goalRir))
  const capped = Math.min(Math.max(raw, w * 0.9), w * 1.1)
  const nw = roundTo(capped, exercise.increment)
  if (nw === w) return { weight: w, tone: 'ok', message: `Fast im Ziel · nächster Satz ${kg(w)}` }
  return nw > w
    ? { weight: nw, tone: 'up', message: `Leichter als geplant · nächster Satz ${kg(nw)}` }
    : { weight: nw, tone: 'down', message: `Schwerer als geplant · nächster Satz ${kg(nw)}` }
}
