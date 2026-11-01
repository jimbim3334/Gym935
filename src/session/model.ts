import type { Exercise, SessionItem, SetLog } from '../db/types.ts'
import { num } from '../plan/format.ts'
import type { ExerciseItemData, SetGroupData } from '../plan/schema.ts'
import {
  adviseNextSet,
  comparableSets,
  recommend,
  repRange,
  targetRir,
  type ExerciseInfo,
  type NextSetAdvice,
  type PastSession,
  type PastSet,
  type Recommendation,
} from '../progress/progression.ts'
import { expandRows, isHoldRow, type SetRow } from './rows.ts'

/** What the logging screen shows for one set row. */
export interface RowModel {
  row: SetRow
  key: string
  log: SetLog | null
  hold: boolean
  /** Suggested values, shown faint in the inputs and logged when the set is checked without typing. */
  ghost: { weight: number | null; reps: number | null; rir: number | null }
  /** "92,5 kg × 6 · RIR 2" from last time. */
  last: string | null
}

export interface ItemModel {
  item: SessionItem
  planned: ExerciseItemData
  exercise: Exercise | null
  rows: RowModel[]
  /** Recommendation for the main prescription (top set if there is one, else the first working group). */
  rec: Recommendation | null
  advice: NextSetAdvice | null
  done: number
}

export const exerciseInfo = (e: Exercise | null): ExerciseInfo => ({
  mechanic: e?.mechanic ?? 'compound',
  increment: e?.load_increment_kg ?? 2.5,
  assisted: e?.assisted,
})

export function describeSet(s: Pick<PastSet, 'weight_kg' | 'reps' | 'rir'>, hold = false) {
  const amount = hold ? `${s.reps} s` : `${s.reps}`
  const w = s.weight_kg ? `${num(s.weight_kg)} kg × ` : ''
  return `${w}${amount}${s.rir !== null && s.rir !== undefined ? ` · RIR ${num(s.rir)}` : ''}`
}

const logValues = (l: SetLog) => ({ weight_kg: l.weight_kg ?? null, reps: l.reps ?? l.hold_seconds ?? null, rir: l.rir ?? null })

export function buildItemModel(args: {
  item: SessionItem
  exercise: Exercise | null
  logs: SetLog[]
  history: PastSession[]
  planId: string | null
  week: number | null
  deload: boolean
}): ItemModel {
  const { item, exercise, history } = args
  const planned = item.planned as ExerciseItemData
  const info = exerciseInfo(exercise)
  const rows = expandRows(planned, item.extra_sets ?? 0)
  const logs = new Map(args.logs.filter((l) => l.session_item_id === item.id).map((l) => [l.set_index, l]))

  // Recommendation per set group; back-off groups need the top set's weight first.
  const recs = new Map<number, Recommendation>()
  const topIndex = planned.sets.findIndex((g) => g.type === 'top')
  const topLogged = rows.find((r) => r.type === 'top' && logs.get(r.index)?.weight_kg)
  const recFor = (gi: number): Recommendation => {
    const cached = recs.get(gi)
    if (cached) return cached
    const group = planned.sets[gi]
    const topSetWeight =
      (topLogged ? logs.get(topLogged.index)!.weight_kg : null) ?? (topIndex >= 0 && topIndex !== gi ? recFor(topIndex).weight : null)
    const r = recommend({ group, exercise: info, history, planId: args.planId, week: args.week, deload: args.deload, topSetWeight })
    recs.set(gi, r)
    return r
  }

  // Last time's sets of each type, from the newest session that has that type.
  const lastByType = new Map<string, PastSet[]>()
  const lastSetsOf = (type: SetRow['type']) => {
    if (!lastByType.has(type)) {
      const s = history.find((h) => comparableSets(h, type).length > 0)
      lastByType.set(type, s ? comparableSets(s, type) : [])
    }
    return lastByType.get(type)!
  }

  const seenOfType = new Map<string, number>()
  const models: RowModel[] = rows.map((row) => {
    const nth = seenOfType.get(row.type) ?? 0
    seenOfType.set(row.type, nth + 1)
    const lastSet = lastSetsOf(row.type)[nth] ?? null
    const log = logs.get(row.index) ?? null
    const hold = isHoldRow(row)
    const rec = recFor(row.groupIndex)
    const group: SetGroupData = row.group

    // Earlier logged set of the same prescription in this session steers the weight (RIR feedback).
    const prev = rows
      .filter((r) => r.groupIndex === row.groupIndex && r.index < row.index && logs.has(r.index))
      .map((r) => logs.get(r.index)!)
      .at(-1)
    let weight: number | null
    if (row.type === 'warmup') weight = rec.kind === 'plan' ? rec.weight : (lastSet?.weight_kg ?? rec.weight)
    else if (prev) weight = adviseNextSet(logValues(prev), group, info)?.weight ?? prev.weight_kg ?? null
    else weight = rec.weight ?? lastSet?.weight_kg ?? null

    const range = repRange(group)
    const reps = hold
      ? (lastSet?.reps ?? group.hold_seconds ?? null)
      : (rec.reps ?? (lastSet && lastSet.weight_kg === weight ? lastSet.reps : null) ?? range?.min ?? null)
    const rir = row.type === 'warmup' ? null : (targetRir(group)?.min ?? null)

    return {
      row,
      key: `${item.id}:${row.index}`,
      log,
      hold,
      ghost: { weight, reps, rir },
      last: lastSet ? describeSet(lastSet, hold) : null,
    }
  })

  // Advice after the most recent working set, if the same prescription continues.
  let advice: NextSetAdvice | null = null
  const lastDone = models.filter((m) => m.log && m.row.type !== 'warmup').at(-1)
  if (lastDone) {
    const nextOpen = models.find((m) => !m.log && m.row.index > lastDone.row.index)
    if (nextOpen && nextOpen.row.groupIndex === lastDone.row.groupIndex) {
      advice = adviseNextSet(logValues(lastDone.log!), nextOpen.row.group, info)
    }
  }

  const mainIndex = topIndex >= 0 ? topIndex : planned.sets.findIndex((g) => g.type !== 'warmup')
  return {
    item,
    planned,
    exercise,
    rows: models,
    rec: mainIndex >= 0 ? recFor(mainIndex) : null,
    advice,
    done: models.filter((m) => m.log).length,
  }
}

/** Groups items into pages: one page per exercise, supersets share a page. */
export function pagesOf<T extends { item: SessionItem }>(items: T[]): T[][] {
  const pages: T[][] = []
  for (const m of items) {
    const last = pages.at(-1)
    if (m.item.superset && last && last[0].item.superset === m.item.superset) last.push(m)
    else pages.push([m])
  }
  return pages
}

/** Rows of a page in the order they are done: supersets alternate (A1, B1, A2, B2 …). */
export function pageOrder(page: ItemModel[]): RowModel[] {
  if (page.length === 1) return page[0].rows
  const out: RowModel[] = []
  const max = Math.max(...page.map((m) => m.rows.length))
  for (let i = 0; i < max; i++) for (const m of page) if (m.rows[i]) out.push(m.rows[i])
  return out
}
