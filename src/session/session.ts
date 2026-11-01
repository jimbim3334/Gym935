import type { TrainingDB } from '../db/db.ts'
import { alive, newId, nowIso, putRows, softDelete } from '../db/mutate.ts'
import type { Plan, Session, SessionItem, SetLog } from '../db/types.ts'
import type { DayData } from '../plan/days.ts'
import type { ExerciseItemData, SetGroupData } from '../plan/schema.ts'
import type { PastSession } from '../progress/progression.ts'
import type { SetRow } from './rows.ts'

/** Local calendar date as YYYY-MM-DD. */
export function localDate(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export async function startSession(db: TrainingDB, plan: Plan, week: number, day: DayData): Promise<string> {
  const sessionId = newId()
  const ts = nowIso()
  await db.transaction('rw', [db.sessions, db.session_items, db.sync_queue], async () => {
    await putRows(db, 'sessions', [
      {
        id: sessionId,
        plan_id: plan.id,
        plan_type: plan.type,
        plan_version: plan.version,
        week,
        day_key: day.key,
        day_name: day.name,
        date: localDate(),
        started_at: ts,
        finished_at: null,
      },
    ])
    await putRows(
      db,
      'session_items',
      day.items.map((item, position) => {
        const ex = item as ExerciseItemData
        return {
          id: newId(),
          session_id: sessionId,
          position,
          exercise_id: plan.type === 'cardio' ? null : (ex.exercise_id ?? null),
          superset: plan.type === 'cardio' ? null : (ex.superset ?? null),
          planned: item,
          extra_sets: 0,
        }
      }),
    )
  })
  return sessionId
}

export interface SetValues {
  weight_kg: number | null
  reps: number | null
  rir: number | null
  hold_seconds?: number | null
}

/** Logs (or updates) the set for a row. */
export async function logSet(
  db: TrainingDB,
  args: { item: SessionItem; row: SetRow; values: SetValues; existing?: SetLog | null },
): Promise<string> {
  const { item, row, values, existing } = args
  const { count: _count, ...target } = row.group
  const id = existing?.id ?? newId()
  await putRows(db, 'set_logs', [
    {
      ...(existing ?? {}),
      id,
      session_id: item.session_id,
      session_item_id: item.id,
      exercise_id: item.exercise_id,
      set_index: row.index,
      set_type: row.type,
      weight_kg: values.weight_kg,
      reps: values.reps,
      rir: values.rir,
      hold_seconds: values.hold_seconds ?? null,
      target,
      completed_at: existing?.completed_at ?? nowIso(),
    },
  ])
  return id
}

export const unlogSet = (db: TrainingDB, log: SetLog) => softDelete(db, 'set_logs', log.id)

export const setExtraSets = (db: TrainingDB, item: SessionItem, extra: number) =>
  putRows(db, 'session_items', [{ ...item, extra_sets: Math.max(0, extra) }])

export async function swapExercise(db: TrainingDB, item: SessionItem, exerciseId: string) {
  if (exerciseId === item.exercise_id) return
  const planned = (item.planned as ExerciseItemData | null)?.exercise_id ?? null
  await putRows(db, 'session_items', [
    {
      ...item,
      exercise_id: exerciseId,
      // Swapping back to the planned exercise clears the marker.
      swapped_from_exercise_id: exerciseId === planned ? null : (item.swapped_from_exercise_id ?? planned),
    },
  ])
}

/** Which days of the plan's current week are done, and which one is next. */
export function weekProgress(plan: Plan, sessions: Session[]) {
  const week = plan.data.weeks.find((w) => w.week === plan.current_week) ?? plan.data.weeks[0]
  const done = new Set(
    alive(sessions)
      .filter((s) => s.plan_id === plan.id && s.week === week.week && s.finished_at && s.day_key)
      .map((s) => s.day_key!),
  )
  const nextDay = week.days.find((d) => !done.has(d.key)) ?? null
  const lastWeek = Math.max(...plan.data.weeks.map((w) => w.week))
  return { week, done, nextDay, weekComplete: nextDay === null, planComplete: nextDay === null && week.week >= lastWeek }
}

export interface FinishResult {
  /** Week the plan moved to, if the finished session completed its week. */
  advancedTo: number | null
  planComplete: boolean
}

export async function finishSession(db: TrainingDB, sessionId: string, notes?: string): Promise<FinishResult> {
  const session = await db.sessions.get(sessionId)
  if (!session) throw new Error('Training nicht gefunden')
  await putRows(db, 'sessions', [{ ...session, finished_at: nowIso(), notes: notes?.trim() || undefined }])

  const plan = session.plan_id ? await db.plans.get(session.plan_id) : undefined
  if (!plan || plan.deleted_at || session.week !== plan.current_week) return { advancedTo: null, planComplete: false }
  const progress = weekProgress(plan, await db.sessions.where('plan_id').equals(plan.id).toArray())
  if (!progress.weekComplete) return { advancedTo: null, planComplete: false }
  const nextWeek = plan.data.weeks
    .map((w) => w.week)
    .sort((a, b) => a - b)
    .find((w) => w > plan.current_week)
  if (nextWeek === undefined) return { advancedTo: null, planComplete: true }
  await putRows(db, 'plans', [{ ...plan, current_week: nextWeek }])
  return { advancedTo: nextWeek, planComplete: false }
}

/** Removes a session with everything logged in it (soft delete, so it syncs). */
export async function discardSession(db: TrainingDB, sessionId: string) {
  const session = await db.sessions.get(sessionId)
  if (!session) return
  const ts = nowIso()
  const [items, logs] = await Promise.all([
    db.session_items.where('session_id').equals(sessionId).toArray(),
    db.set_logs.where('session_id').equals(sessionId).toArray(),
  ])
  await db.transaction('rw', [db.sessions, db.session_items, db.set_logs, db.sync_queue], async () => {
    await putRows(db, 'set_logs', alive(logs).map((l) => ({ ...l, deleted_at: ts })))
    await putRows(db, 'session_items', alive(items).map((i) => ({ ...i, deleted_at: ts })))
    await putRows(db, 'sessions', [{ ...session, deleted_at: ts }])
  })
}

/** Earlier sessions per exercise, newest first, for recommendations and "last time" hints. */
export async function loadHistory(
  db: TrainingDB,
  exerciseIds: string[],
  excludeSessionId: string,
): Promise<Map<string, PastSession[]>> {
  const result = new Map<string, PastSession[]>()
  if (exerciseIds.length === 0) return result
  const logs = alive(await db.set_logs.where('exercise_id').anyOf(exerciseIds).toArray()).filter(
    (l) => l.session_id !== excludeSessionId && l.completed_at,
  )
  const sessionIds = [...new Set(logs.map((l) => l.session_id))]
  const sessions = new Map(
    alive((await db.sessions.bulkGet(sessionIds)).filter((s): s is Session => !!s)).map((s) => [s.id, s]),
  )
  const grouped = new Map<string, Map<string, SetLog[]>>()
  for (const l of logs) {
    if (!sessions.has(l.session_id)) continue
    const byExercise = grouped.get(l.exercise_id!) ?? new Map<string, SetLog[]>()
    byExercise.set(l.session_id, [...(byExercise.get(l.session_id) ?? []), l])
    grouped.set(l.exercise_id!, byExercise)
  }
  for (const [exerciseId, bySession] of grouped) {
    const list: PastSession[] = [...bySession].map(([sid, sets]) => {
      const s = sessions.get(sid)!
      return {
        session_id: sid,
        date: s.date,
        plan_id: s.plan_id,
        week: s.week,
        sets: sets
          .sort((a, b) => a.set_index - b.set_index)
          .map((l) => ({
            weight_kg: l.weight_kg ?? null,
            reps: l.reps ?? l.hold_seconds ?? null,
            rir: l.rir ?? null,
            set_type: l.set_type,
            target: (l.target as SetGroupData | null) ?? null,
          })),
      }
    })
    list.sort((a, b) => (sessions.get(b.session_id)!.started_at > sessions.get(a.session_id)!.started_at ? 1 : -1))
    result.set(exerciseId, list)
  }
  return result
}
