import { DEFAULT_INCREMENT_KG } from '../catalog/muscles.ts'
import { slugify } from '../catalog/seed.ts'
import type { TrainingDB } from '../db/db.ts'
import { alive, newId, nowIso, putRows } from '../db/mutate.ts'
import type { Exercise, ExerciseAlias, Plan } from '../db/types.ts'
import { normalizeName } from '../lib/text.ts'
import { applyExerciseIds, type Decision, type ExerciseRef } from './match.ts'
import type { PlanData } from './schema.ts'

export const userAliasId = (exerciseId: string, aliasNorm: string) => `user:${exerciseId}:${aliasNorm}`

export interface ImportInput {
  plan: PlanData
  refs: ExerciseRef[]
  /** Refs that resolved without asking: ref key -> exercise id. */
  resolved: Map<string, string>
  /** User answers for the rest. */
  decisions: Map<string, Decision>
  activate: boolean
}

/**
 * Stores an imported plan: creates new exercises, remembers confirmed name mappings as aliases,
 * assigns the next version for the same name+type and optionally makes it the active plan.
 * Never touches sessions or set logs.
 */
export async function commitImport(db: TrainingDB, input: ImportInput): Promise<Plan> {
  const { plan, refs, resolved, decisions, activate } = input
  return db.transaction('rw', [db.exercises, db.exercise_aliases, db.plans, db.sync_queue], async () => {
    const allExercises = await db.exercises.toArray()
    const takenIds = new Set(allExercises.map((e) => e.id))
    const idByKey = new Map(resolved)
    const newExercises: Exercise[] = []
    const createdByNorm = new Map<string, string>()
    const aliases: ExerciseAlias[] = []
    const ts = nowIso()

    for (const ref of refs) {
      const decision = decisions.get(ref.key)
      if (!decision || idByKey.has(ref.key)) continue
      if (decision.kind === 'existing') {
        idByKey.set(ref.key, decision.exercise_id)
        const target = allExercises.find((e) => e.id === decision.exercise_id)
        const label = ref.exercise ?? ref.exercise_id
        if (label && target && normalizeName(label) !== normalizeName(target.name)) {
          const alias_norm = normalizeName(label)
          aliases.push({
            id: userAliasId(target.id, alias_norm),
            alias: label,
            alias_norm,
            exercise_id: target.id,
            source: 'user',
            created_at: ts,
            updated_at: ts,
            deleted_at: null,
          })
        }
      } else {
        const def = decision.definition
        const norm = normalizeName(def.name)
        let id = createdByNorm.get(norm)
        if (!id) {
          id = slugify(def.name) || newId()
          if (takenIds.has(id)) id = `${id}-${newId().slice(0, 6)}`
          takenIds.add(id)
          createdByNorm.set(norm, id)
          newExercises.push({
            id,
            name: def.name,
            equipment: def.equipment,
            mechanic: def.mechanic,
            primary_muscles: def.primary_muscles,
            secondary_muscles: def.secondary_muscles,
            load_increment_kg: def.load_increment_kg ?? DEFAULT_INCREMENT_KG[def.equipment],
            kind: plan.type === 'rehab' ? 'rehab' : 'strength',
            assisted: def.assisted,
            notes: def.notes,
            is_custom: true,
            created_at: ts,
            updated_at: ts,
            deleted_at: null,
          })
        }
        idByKey.set(ref.key, id)
      }
    }

    await putRows(db, 'exercises', newExercises)
    await putRows(db, 'exercise_aliases', aliases)

    const nameById = new Map([...allExercises, ...newExercises].map((e) => [e.id, e.name]))
    const data = applyExerciseIds(plan, idByKey, nameById)

    const plans = alive(await db.plans.where('type').equals(plan.type).toArray())
    const sameName = plans.filter((p) => p.name.trim().toLowerCase() === plan.name.trim().toLowerCase())
    const version = sameName.reduce((v, p) => Math.max(v, p.version), 0) + 1

    if (activate) {
      await putRows(
        db,
        'plans',
        plans.filter((p) => p.is_active).map((p) => ({ ...p, is_active: false })),
      )
    }

    const row: Plan = {
      id: newId(),
      type: plan.type,
      name: plan.name,
      version,
      is_active: activate,
      imported_at: ts,
      source: 'import',
      current_week: 1,
      data,
      created_at: ts,
      updated_at: ts,
      deleted_at: null,
    }
    await putRows(db, 'plans', [row])
    return row
  })
}

export async function activatePlan(db: TrainingDB, plan: Plan) {
  const others = alive(await db.plans.where('type').equals(plan.type).toArray()).filter(
    (p) => p.is_active && p.id !== plan.id,
  )
  await putRows(db, 'plans', [...others.map((p) => ({ ...p, is_active: false })), { ...plan, is_active: true }])
}
