import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { exportBackup, importBackup } from '../backup/backup.ts'
import { commitImport } from '../plan/importPlan.ts'
import { buildIndex, collectRefs, resolveRef } from '../plan/match.ts'
import type { ExerciseItemData, ExercisePlanData } from '../plan/schema.ts'
import { expandRows } from '../session/rows.ts'
import { discardSession, finishSession, loadHistory, logSet, startSession, weekProgress } from '../session/session.ts'
import { validatePlanText } from '../plan/validate.ts'
import { TrainingDB } from './db.ts'
import { ensureSeed } from './seed.ts'

let db: TrainingDB

beforeEach(async () => {
  db = new TrainingDB(`test-${Math.random()}`)
  await ensureSeed(db)
})

async function importExample(name: string, activate = true) {
  const res = validatePlanText(readFileSync(new URL(`../../docs/examples/${name}.json`, import.meta.url), 'utf8'))
  if (!res.ok) throw new Error('invalid example')
  const plan = res.plan as ExercisePlanData
  const index = buildIndex(await db.exercises.toArray(), await db.exercise_aliases.toArray())
  const refs = res.plan.type === 'cardio' ? [] : collectRefs(plan)
  const resolved = new Map<string, string>()
  const decisions = new Map()
  for (const ref of refs) {
    const r = resolveRef(ref, index, plan.exercise_definitions)
    if (r.status === 'resolved') resolved.set(ref.key, r.exercise_id)
    else decisions.set(ref.key, { kind: 'create', definition: r.definition! })
  }
  return commitImport(db, { plan: res.plan, refs, resolved, decisions, activate })
}

describe('import + db', () => {
  it('seeds the catalog idempotently', async () => {
    const n = await db.exercises.count()
    await db.meta.delete('seed_version')
    await ensureSeed(db)
    expect(await db.exercises.count()).toBe(n)
    expect(n).toBeGreaterThan(100)
  })

  it('creates custom exercises, versions plans and keeps one active plan per type', async () => {
    const v1 = await importExample('strength')
    expect(await db.exercises.get('landmine-press')).toMatchObject({ is_custom: true, mechanic: 'compound' })
    const v2 = await importExample('strength')
    expect(v2.version).toBe(2)
    expect((await db.plans.get(v1.id))?.is_active).toBe(false)
    await importExample('cardio')
    const active = (await db.plans.toArray()).filter((p) => p.is_active).map((p) => p.type).sort()
    expect(active).toEqual(['cardio', 'strength'])
    // Re-import must not create a second "Landmine Press".
    expect((await db.exercises.toArray()).filter((e) => e.name === 'Landmine Press')).toHaveLength(1)
  })

  it('queues every write for sync', async () => {
    await importExample('rehab')
    const queued = await db.sync_queue.toArray()
    expect(queued.some((q) => q.table === 'plans')).toBe(true)
  })

  it('round-trips a backup with last-write-wins', async () => {
    const plan = await importExample('rehab')
    const backup = await exportBackup(db)
    const other = new TrainingDB(`test-${Math.random()}`)
    const res = await importBackup(other, JSON.parse(JSON.stringify(backup)))
    expect(res.plans.applied).toBe(1)
    expect((await other.plans.get(plan.id))?.name).toBe(plan.name)
    // Importing the same backup again changes nothing.
    const again = await importBackup(other, backup)
    expect(again.plans.applied).toBe(0)
  })

  it('rejects foreign files', async () => {
    await expect(importBackup(db, { hello: 'world' })).rejects.toThrow(/Backup/)
  })
})

describe('sessions', () => {
  it('logs sets, advances the week when all days are done and feeds history', async () => {
    const plan = await importExample('strength')
    const week = plan.data.weeks[0]
    const firstId = await startSession(db, plan, 1, week.days[0])
    const items = await db.session_items.where('session_id').equals(firstId).sortBy('position')
    expect(items).toHaveLength(week.days[0].items.length)
    const bench = items[0]
    expect(bench.exercise_id).toBe('barbell-bench-press')

    const rows = expandRows(bench.planned as ExerciseItemData)
    expect(rows.map((r) => r.label)).toEqual(['W', 'W', '1', '2', '3'])
    const logId = await logSet(db, { item: bench, row: rows[2], values: { weight_kg: 90, reps: 6, rir: 2 } })
    const log = await db.set_logs.get(logId)
    expect(log).toMatchObject({ set_type: 'top', set_index: 2, exercise_id: 'barbell-bench-press' })
    await logSet(db, { item: bench, row: rows[2], values: { weight_kg: 92.5, reps: 6, rir: 2 }, existing: log })
    expect((await db.set_logs.where('session_id').equals(firstId).toArray()).length).toBe(1)

    expect(await finishSession(db, firstId)).toEqual({ advancedTo: null, planComplete: false })
    let progress = weekProgress((await db.plans.get(plan.id))!, await db.sessions.toArray())
    expect(progress.nextDay?.key).toBe(week.days[1].key)

    const second = await startSession(db, plan, 1, week.days[1])
    expect(await finishSession(db, second)).toEqual({ advancedTo: 2, planComplete: false })
    progress = weekProgress((await db.plans.get(plan.id))!, await db.sessions.toArray())
    expect(progress.week.week).toBe(2)

    const history = await loadHistory(db, ['barbell-bench-press'], 'other')
    expect(history.get('barbell-bench-press')?.[0].sets[0]).toMatchObject({ weight_kg: 92.5, reps: 6, set_type: 'top' })
  })

  it('discards a session with its sets', async () => {
    const plan = await importExample('strength')
    const id = await startSession(db, plan, 1, plan.data.weeks[0].days[0])
    const [item] = await db.session_items.where('session_id').equals(id).sortBy('position')
    await logSet(db, { item, row: expandRows(item.planned as ExerciseItemData)[0], values: { weight_kg: 40, reps: 5, rir: null } })
    await discardSession(db, id)
    expect((await db.sessions.get(id))?.deleted_at).toBeTruthy()
    expect((await db.set_logs.toArray()).every((l) => l.deleted_at)).toBe(true)
    expect((await loadHistory(db, ['barbell-bench-press'], 'x')).size).toBe(0)
  })
})
