import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_INCREMENT_KG } from '../catalog/muscles.ts'
import { SEED_EXERCISES } from '../catalog/seed.ts'
import type { Exercise, ExerciseAlias } from '../db/types.ts'
import { normalizeName } from '../lib/text.ts'
import { formatSetGroup, parseRange } from './format.ts'
import { applyExerciseIds, buildIndex, collectRefs, refKey, resolveRef } from './match.ts'
import type { ExercisePlanData } from './schema.ts'
import { cleanJsonText, validatePlanObject, validatePlanText } from './validate.ts'

const example = (name: string) => readFileSync(new URL(`../../docs/examples/${name}.json`, import.meta.url), 'utf8')

const TS = '2026-01-01T00:00:00.000Z'
const exercises: Exercise[] = SEED_EXERCISES.map((s) => ({
  ...s,
  load_increment_kg: DEFAULT_INCREMENT_KG[s.equipment],
  is_custom: false,
  created_at: TS,
  updated_at: TS,
  deleted_at: null,
}))
const aliases: ExerciseAlias[] = SEED_EXERCISES.flatMap((s) =>
  s.aliases.map((alias) => ({
    id: `${s.id}:${alias}`,
    alias,
    alias_norm: normalizeName(alias),
    exercise_id: s.id,
    source: 'seed' as const,
    created_at: TS,
    updated_at: TS,
    deleted_at: null,
  })),
)
const index = buildIndex(exercises, aliases)

describe('seed catalog', () => {
  it('has unique ids', () => {
    const ids = SEED_EXERCISES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('example plans', () => {
  for (const name of ['strength', 'cardio', 'rehab']) {
    it(`${name}.json is valid`, () => {
      const res = validatePlanText(example(name))
      if (!res.ok) throw new Error(JSON.stringify(res.errors, null, 2))
      expect(res.ok).toBe(true)
    })
  }

  it('strength example only needs a decision for the custom exercise', () => {
    const res = validatePlanText(example('strength'))
    if (!res.ok) throw new Error('invalid')
    const plan = res.plan as ExercisePlanData
    const asks = collectRefs(plan)
      .map((r) => [r, resolveRef(r, index, plan.exercise_definitions)] as const)
      .filter(([, r]) => r.status === 'ask')
    expect(asks.map(([ref]) => ref.label)).toEqual(['Landmine Press'])
    const [, resolution] = asks[0]
    expect(resolution.status === 'ask' && resolution.definition?.name).toBe('Landmine Press')
  })

  it('rehab example resolves fully against the catalog', () => {
    const res = validatePlanText(example('rehab'))
    if (!res.ok) throw new Error('invalid')
    const unresolved = collectRefs(res.plan as ExercisePlanData).filter((r) => resolveRef(r, index).status !== 'resolved')
    expect(unresolved).toEqual([])
  })
})

describe('validation messages', () => {
  it('reports JSON syntax errors with a line number', () => {
    const res = validatePlanText('{\n  "format_version": 1,\n  "type": "strength"\n  "name": "x"\n}')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.errors[0].where).toMatch(/^Zeile 4/)
  })

  it('strips markdown fences', () => {
    expect(cleanJsonText('Hier dein Plan:\n```json\n{"a":1}\n```\nViel Erfolg!')).toBe('{"a":1}')
  })

  it('locates structural errors by week, day and exercise name', () => {
    const plan = JSON.parse(example('strength'))
    plan.weeks[1].days[0].items[1].sets[0].reps = 'viele'
    const res = validatePlanObject(plan)
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.errors[0].where).toBe('Woche 2 › Tag „Oberkörper“ › Übung 2 „Single Arm Dumbbell Row“ › Satzgruppe 1 › reps')
      expect(res.errors[0].message).toMatch(/Bereich/)
    }
  })

  it('turns unknown keys into warnings instead of errors', () => {
    const plan = JSON.parse(example('cardio'))
    plan.rationale = 'weil'
    plan.weeks[0].days[0].items[0].tempo = 'egal'
    const res = validatePlanObject(plan)
    expect(res.ok).toBe(true)
    expect(res.warnings.map((w) => w.message).join()).toMatch(/rationale/)
  })

  it('checks week count and numbering', () => {
    const plan = JSON.parse(example('cardio'))
    plan.duration_weeks = 3
    plan.weeks[1].week = 3
    const res = validatePlanObject(plan)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.errors.length).toBe(2)
  })

  it('requires a top set before percent_top_set', () => {
    const plan = JSON.parse(example('strength'))
    plan.weeks[0].days[0].items[0].sets[1].type = 'working'
    const res = validatePlanObject(plan)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.errors[0].message).toMatch(/top/)
  })

  it('rejects other format versions clearly', () => {
    const res = validatePlanObject({ format_version: 2 })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.errors[0].message).toMatch(/Formatversion 2/)
  })
})

describe('exercise matching', () => {
  const ref = (exercise: string) => ({ key: refKey({ exercise }), label: exercise, exercise, occurrences: 1 })

  it('resolves German aliases and abbreviations', () => {
    expect(resolveRef(ref('Bankdrücken'), index)).toMatchObject({ status: 'resolved', exercise_id: 'barbell-bench-press' })
    expect(resolveRef(ref('Kniebeugen'), index)).toMatchObject({ status: 'resolved', exercise_id: 'barbell-back-squat' })
    expect(resolveRef(ref('DB RDL'), index)).toMatchObject({ status: 'resolved', exercise_id: 'dumbbell-romanian-deadlift' })
  })

  it('asks for near matches and ranks the right one first', () => {
    const r = resolveRef(ref('Incline DB Chest Press'), index)
    expect(r.status).toBe('ask')
    if (r.status === 'ask') expect(r.candidates[0].id).toBe('incline-dumbbell-bench-press')
    const cases: [string, string][] = [
      ['Seated Leg Curl Machine', 'seated-hamstring-curl'],
      ['Quad Extension Machine', 'leg-extension'],
      ['Machine Chest Fly', 'pec-deck'],
      ['Cable Lat Pulldown Wide Grip', 'lat-pulldown'],
      ['Seated DB Lateral Raise', 'dumbbell-lateral-raise'],
    ]
    for (const [name, id] of cases) {
      const r2 = resolveRef(ref(name), index)
      expect(r2.status === 'ask' ? r2.candidates[0]?.id : r2.exercise_id, name).toBe(id)
    }
  })

  it('writes ids and canonical names into the plan', () => {
    const res = validatePlanText(example('rehab'))
    if (!res.ok) throw new Error('invalid')
    const refs = collectRefs(res.plan as ExercisePlanData)
    const idByKey = new Map(refs.map((r) => [r.key, (resolveRef(r, index) as { exercise_id: string }).exercise_id]))
    const out = applyExerciseIds(res.plan, idByKey, new Map(exercises.map((e) => [e.id, e.name])))
    const item = (out as ExercisePlanData).weeks[0].days[0].items[0]
    expect(item.exercise_id).toBe('spanish-squat')
  })
})

describe('formatting', () => {
  it('formats set groups', () => {
    expect(parseRange('6-8')).toEqual({ min: 6, max: 8 })
    expect(
      formatSetGroup({ count: 3, type: 'working', reps: '6-8', rir: 2, load: { type: 'kg', kg: 102.5 } }),
    ).toBe('3 × 6–8 Wdh. · RIR 2 · 102,5 kg')
  })
})
