import { DEFAULT_INCREMENT_KG } from '../catalog/muscles.ts'
import { SEED_EXERCISES, SEED_VERSION } from '../catalog/seed.ts'
import { normalizeName } from '../lib/text.ts'
import type { TrainingDB } from './db.ts'
import type { Exercise, ExerciseAlias } from './types.ts'

/** Fixed old timestamp for seed rows: any edit by the user wins last-write-wins. */
const SEED_TS = '2026-01-01T00:00:00.000Z'

export const seedAliasId = (exerciseId: string, aliasNorm: string) => `seed:${exerciseId}:${aliasNorm}`

/**
 * Adds starter-catalog exercises and aliases that are missing locally.
 * Never overwrites rows the user changed. Seed rows use deterministic ids,
 * so two devices seeding independently converge after sync.
 */
export async function ensureSeed(db: TrainingDB) {
  const meta = await db.meta.get('seed_version')
  if (typeof meta?.value === 'number' && meta.value >= SEED_VERSION) return

  await db.transaction('rw', db.exercises, db.exercise_aliases, db.meta, async () => {
    const existing = new Set(await db.exercises.toCollection().primaryKeys())
    const exercises: Exercise[] = []
    const aliases = new Map<string, ExerciseAlias>()
    for (const s of SEED_EXERCISES) {
      if (!existing.has(s.id)) {
        exercises.push({
          id: s.id,
          name: s.name,
          equipment: s.equipment,
          mechanic: s.mechanic,
          primary_muscles: s.primary_muscles,
          secondary_muscles: s.secondary_muscles,
          load_increment_kg: DEFAULT_INCREMENT_KG[s.equipment],
          kind: s.kind,
          assisted: s.assisted,
          is_custom: false,
          created_at: SEED_TS,
          updated_at: SEED_TS,
          deleted_at: null,
        })
      }
      for (const alias of s.aliases) {
        const alias_norm = normalizeName(alias)
        const id = seedAliasId(s.id, alias_norm)
        aliases.set(id, {
          id,
          alias,
          alias_norm,
          exercise_id: s.id,
          source: 'seed',
          created_at: SEED_TS,
          updated_at: SEED_TS,
          deleted_at: null,
        })
      }
    }
    await db.exercises.bulkAdd(exercises)
    const existingAliases = new Set(await db.exercise_aliases.toCollection().primaryKeys())
    await db.exercise_aliases.bulkAdd([...aliases.values()].filter((a) => !existingAliases.has(a.id)))
    await db.meta.put({ key: 'seed_version', value: SEED_VERSION })
  })
}
