import { z } from 'zod'
import { EQUIPMENT, MECHANICS, MUSCLES } from '../catalog/muscles.ts'

/**
 * The plan exchange format (see docs/PLAN_FORMAT.md). This file is the single source of truth:
 * docs/plan-schema.json is generated from it via `npm run docs`.
 */

export const FORMAT_VERSION = 1

export const PLAN_TYPES = ['strength', 'cardio', 'rehab'] as const
export type PlanType = (typeof PLAN_TYPES)[number]

export const SET_TYPES = ['warmup', 'working', 'top', 'backoff'] as const

export const CARDIO_MODALITIES = [
  'run',
  'bike',
  'row',
  'elliptical',
  'swim',
  'walk',
  'stairs',
  'ski_erg',
  'other',
] as const

const text = z.string().trim().min(1)
const optionalText = z.string().trim().optional()

const restSeconds = z
  .number()
  .int()
  .min(0)
  .max(1800)
  .meta({ description: 'Pause nach dem Satz in Sekunden.' })

const REPS_ERROR = 'Wiederholungen als Zahl (8), Bereich ("6-8") oder "AMRAP" angeben'

export const REPS_PATTERN = /^(\d{1,3})(\s*[-–]\s*(\d{1,3}))?$|^amrap$/i

const reps = z
  .union(
    [
      z.number({ error: REPS_ERROR }).int().min(1).max(100),
      z.string().trim().regex(REPS_PATTERN, { error: REPS_ERROR }),
    ],
    { error: REPS_ERROR },
  )
  .meta({ id: 'Reps', description: 'Wiederholungen: Zahl (8), Bereich ("6-8") oder "AMRAP".' })

export const EFFORT_RANGE_PATTERN = /^\d{1,2}(\.\d)?\s*[-–]\s*\d{1,2}(\.\d)?$/

const effort = (min: number, max: number, label: string) => {
  const error = `${label} als Zahl (2) oder Bereich ("1-2") angeben, erlaubt ${min} bis ${max}`
  return z.union([z.number({ error }).min(min).max(max), z.string().trim().regex(EFFORT_RANGE_PATTERN, { error })], {
    error,
  })
}

const load = z
  .discriminatedUnion(
    'type',
    [
      z
        .strictObject({ type: z.literal('kg'), kg: z.number().min(0).max(1000) })
        .meta({ description: 'Absolutes Gewicht in kg.' }),
      z
        .strictObject({ type: z.literal('percent_1rm'), percent: z.number().min(1).max(120) })
        .meta({ description: 'Prozent vom geschätzten 1RM (aus der Historie).' }),
      z
        .strictObject({
          type: z.literal('relative'),
          change_kg: z.number().min(-200).max(200).optional(),
          change_percent: z.number().min(-50).max(50).optional(),
          reference: z.enum(['last_week', 'last_session']).default('last_week'),
        })
        .refine((l) => l.change_kg !== undefined || l.change_percent !== undefined, {
          error: 'Bei type "relative" change_kg oder change_percent angeben',
        })
        .meta({ description: 'Relativ zur tatsächlich gehobenen Last der Vorwoche bzw. letzten Einheit.' }),
      z
        .strictObject({ type: z.literal('percent_top_set'), percent: z.number().min(1).max(100) })
        .meta({ description: 'Prozent vom Top-Satz derselben Übung (für Back-off-Sätze).' }),
    ],
    { error: 'load.type muss "kg", "percent_1rm", "relative" oder "percent_top_set" sein' },
  )
  .meta({ id: 'Load', description: 'Optionale Lastvorgabe. Ohne Angabe schlägt die App ein Gewicht vor.' })

const setGroup = z
  .strictObject({
    count: z.number().int().min(1).max(20).default(1).meta({ description: 'Anzahl gleicher Sätze.' }),
    type: z.enum(SET_TYPES).default('working'),
    reps: reps.optional(),
    hold_seconds: z.number().int().min(1).max(900).optional().meta({ description: 'Haltezeit statt Wiederholungen.' }),
    rir: effort(0, 10, 'RIR').optional(),
    rpe: effort(1, 10, 'RPE').optional(),
    load: load.optional(),
    rest_seconds: restSeconds.optional(),
    notes: optionalText,
  })
  .refine((s) => s.reps !== undefined || s.hold_seconds !== undefined, {
    error: 'reps oder hold_seconds angeben',
    path: ['reps'],
  })
  .meta({ id: 'SetGroup' })

const exerciseItem = z
  .strictObject({
    exercise: text.optional().meta({ description: 'Übungsname, wird beim Import mit dem Katalog abgeglichen.' }),
    exercise_id: text.optional().meta({ description: 'Katalog-ID, falls bekannt.' }),
    superset: text.optional().meta({ description: 'Gleiches Label = Supersatz (z. B. "A").' }),
    per_side: z.boolean().optional().meta({ description: 'Pro Seite (links/rechts) getrennt.' }),
    rest_seconds: restSeconds.optional(),
    tempo: optionalText.meta({ description: 'z. B. "3-1-1-0".' }),
    notes: optionalText,
    sets: z.array(setGroup).min(1),
  })
  .refine((i) => i.exercise !== undefined || i.exercise_id !== undefined, {
    error: 'exercise (Name) oder exercise_id angeben',
    path: ['exercise'],
  })
  .meta({ id: 'ExerciseItem' })

const intensity = z
  .strictObject({
    hr_zone: z.number().int().min(1).max(5).optional(),
    hr_min: z.number().int().min(40).max(230).optional(),
    hr_max: z.number().int().min(40).max(230).optional(),
    rpe: effort(1, 10, 'RPE').optional(),
    pace_per_km: z
      .string()
      .trim()
      .regex(/^\d{1,2}:\d{2}(\s*[-–]\s*\d{1,2}:\d{2})?$/, { error: 'Pace als "5:30" oder "5:30-6:00" angeben' })
      .optional(),
    watts: z.number().int().min(1).max(2000).optional(),
    description: optionalText,
  })
  .meta({ id: 'Intensity', description: 'Intensitätsvorgabe, mindestens ein Feld.' })

const segment = z
  .strictObject({
    duration_sec: z.number().int().min(1).max(36000).optional(),
    distance_m: z.number().min(1).max(100000).optional(),
    intensity: intensity.optional(),
  })
  .refine((s) => s.duration_sec !== undefined || s.distance_m !== undefined, {
    error: 'duration_sec oder distance_m angeben',
  })
  .meta({ id: 'Segment' })

const intervalBlock = z.strictObject({
  repeats: z.number().int().min(1).max(50),
  work: segment,
  recover: segment.optional(),
  notes: optionalText,
})

const cardioItem = z
  .strictObject({
    modality: z.enum(CARDIO_MODALITIES),
    name: optionalText,
    duration_min: z.number().min(1).max(600).optional(),
    distance_km: z.number().min(0.1).max(500).optional(),
    intensity: intensity.optional(),
    warmup_min: z.number().min(0).max(120).optional(),
    cooldown_min: z.number().min(0).max(120).optional(),
    intervals: z.array(intervalBlock).min(1).optional(),
    notes: optionalText,
  })
  .refine((c) => c.duration_min !== undefined || c.distance_km !== undefined || c.intervals !== undefined, {
    error: 'duration_min, distance_km oder intervals angeben',
  })
  .meta({ id: 'CardioItem' })

const day = <T extends z.ZodType>(item: T) =>
  z.strictObject({
    key: text.max(40).meta({ description: 'Stabiler Schlüssel des Tages, in jeder Woche gleich (z. B. "upper-a").' }),
    name: text.max(60),
    notes: optionalText,
    items: z.array(item).min(1),
  })

const week = <T extends z.ZodType>(item: T) =>
  z.strictObject({
    week: z.number().int().min(1).max(52),
    label: optionalText.meta({ description: 'z. B. "Deload", "Intensität hoch".' }),
    notes: optionalText,
    deload: z.boolean().default(false),
    days: z.array(day(item)).min(1).max(7),
  })

export const exerciseDefinition = z
  .strictObject({
  name: text,
  primary_muscles: z.array(z.enum(MUSCLES)).min(1),
  secondary_muscles: z.array(z.enum(MUSCLES)).default([]),
  equipment: z.enum(EQUIPMENT),
  mechanic: z.enum(MECHANICS),
  load_increment_kg: z.number().min(0).max(20).optional(),
    assisted: z.boolean().optional(),
    notes: optionalText,
  })
  .meta({ id: 'ExerciseDefinition' })

const meta = {
  format_version: z.literal(FORMAT_VERSION),
  name: text.max(80),
  goal: optionalText,
  description: optionalText,
  duration_weeks: z.number().int().min(1).max(52),
  days_per_week: z.number().int().min(1).max(7),
  notes: optionalText,
  created_by: optionalText.meta({ description: 'z. B. Name der KI.' }),
}

const strengthPlan = z.strictObject({
  ...meta,
  type: z.literal('strength'),
  exercise_definitions: z.array(exerciseDefinition).optional(),
  weeks: z.array(week(exerciseItem)).min(1),
})

const rehabPlan = z.strictObject({
  ...meta,
  type: z.literal('rehab'),
  exercise_definitions: z.array(exerciseDefinition).optional(),
  weeks: z.array(week(exerciseItem)).min(1),
})

const cardioPlan = z.strictObject({
  ...meta,
  type: z.literal('cardio'),
  weeks: z.array(week(cardioItem)).min(1),
})

export const planSchema = z
  .discriminatedUnion('type', [strengthPlan, cardioPlan, rehabPlan], {
    error: 'type muss "strength", "cardio" oder "rehab" sein',
  })
  .meta({ title: 'Trainingsplan', description: 'Austauschformat für Trainingspläne, Version 1.' })

export type PlanData = z.output<typeof planSchema>
export type StrengthPlanData = z.output<typeof strengthPlan>
export type CardioPlanData = z.output<typeof cardioPlan>
export type ExercisePlanData = Extract<PlanData, { type: 'strength' | 'rehab' }>
export type WeekData = PlanData['weeks'][number]
export type ExerciseItemData = z.output<typeof exerciseItem>
export type SetGroupData = z.output<typeof setGroup>
export type LoadData = z.output<typeof load>
export type CardioItemData = z.output<typeof cardioItem>
export type IntensityData = z.output<typeof intensity>
export type SegmentData = z.output<typeof segment>
export type ExerciseDefinitionData = z.output<typeof exerciseDefinition>
