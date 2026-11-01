import type { SetType } from '../db/types.ts'
import { num, parseRange } from '../plan/format.ts'
import type { ExerciseItemData, SetGroupData } from '../plan/schema.ts'

/** One loggable row: a planned set group expanded to single sets, plus sets added during the workout. */
export interface SetRow {
  /** Position within the exercise, stored as SetLog.set_index. */
  index: number
  groupIndex: number
  group: SetGroupData
  type: SetType
  /** "W" for warm-ups, otherwise the working set number. */
  label: string
  extra: boolean
}

export const DEFAULT_REST_SECONDS = 120

export function expandRows(item: ExerciseItemData, extraSets = 0): SetRow[] {
  const rows: SetRow[] = []
  let working = 0
  item.sets.forEach((group, groupIndex) => {
    for (let i = 0; i < group.count; i++) {
      const warmup = group.type === 'warmup'
      if (!warmup) working++
      rows.push({ index: rows.length, groupIndex, group, type: group.type, label: warmup ? 'W' : String(working), extra: false })
    }
  })
  // Extra sets repeat the last non-warm-up prescription.
  const lastGroupIndex = item.sets.findLastIndex((g) => g.type !== 'warmup')
  const base = lastGroupIndex >= 0 ? lastGroupIndex : item.sets.length - 1
  for (let i = 0; i < extraSets; i++) {
    working++
    const group = item.sets[base]
    rows.push({ index: rows.length, groupIndex: base, group, type: group.type === 'warmup' ? 'working' : group.type, label: String(working), extra: true })
  }
  return rows
}

const rangeText = (v: number | string) => {
  if (typeof v === 'string' && v.toLowerCase() === 'amrap') return 'AMRAP'
  const r = parseRange(v)
  if (!r) return String(v)
  return r.min === r.max ? num(r.min) : `${num(r.min)}–${num(r.max)}`
}

const TYPE_PREFIX: Record<SetType, string> = { warmup: 'Aufwärmen', top: 'Top', backoff: 'Back-off', working: '' }

/** "Top 5–6 · RIR 1", "Back-off 8–10 · RIR 2", "30 s · RIR 2", "Aufwärmen 5". */
export function rowTarget(row: SetRow, perSide = false): string {
  const g = row.group
  const amount = g.reps !== undefined ? rangeText(g.reps) : g.hold_seconds !== undefined ? `${g.hold_seconds} s` : ''
  const parts = [[TYPE_PREFIX[row.type], amount].filter(Boolean).join(' ')]
  if (perSide) parts[0] += ' je Seite'
  if (row.type !== 'warmup') {
    if (g.rir !== undefined) parts.push(`RIR ${rangeText(g.rir)}`)
    else if (g.rpe !== undefined) parts.push(`RPE ${rangeText(g.rpe)}`)
  }
  return parts.join(' · ')
}

export const restFor = (row: SetRow, item: ExerciseItemData) => row.group.rest_seconds ?? item.rest_seconds ?? DEFAULT_REST_SECONDS

export const isHoldRow = (row: SetRow) => row.group.reps === undefined && row.group.hold_seconds !== undefined
