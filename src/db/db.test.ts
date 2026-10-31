import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { exportBackup, importBackup } from '../backup/backup.ts'
import { commitImport } from '../plan/importPlan.ts'
import { buildIndex, collectRefs, resolveRef } from '../plan/match.ts'
import type { ExercisePlanData } from '../plan/schema.ts'
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
