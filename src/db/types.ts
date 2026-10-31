import type { Equipment, Mechanic, Muscle } from '../catalog/muscles.ts'
import type { ExerciseKind } from '../catalog/seed.ts'
import type { PlanData, PlanType } from '../plan/schema.ts'

/** Columns every synced table carries. Timestamps are ISO-8601 UTC strings. */
export interface SyncFields {
  id: string
  created_at: string
  updated_at: string
  /** Soft delete marker, so deletions can be synced. */
  deleted_at: string | null
  /** Filled in once the user is signed in (sync phase). */
  user_id?: string | null
}

export interface Exercise extends SyncFields {
  name: string
  equipment: Equipment
  mechanic: Mechanic
  primary_muscles: Muscle[]
  secondary_muscles: Muscle[]
  /** Smallest practical load jump; overrides the equipment default. */
  load_increment_kg: number
  kind: ExerciseKind
  assisted?: boolean
  notes?: string
  /** true for exercises the user created (not from the starter catalog). */
  is_custom: boolean
}

/** Alternative names, incl. confirmed import mappings ("Bench Press" -> barbell-bench-press). */
export interface ExerciseAlias extends SyncFields {
  alias: string
  /** Normalized form, used for lookups. */
  alias_norm: string
  exercise_id: string
  source: 'seed' | 'user'
}

export interface Plan extends SyncFields {
  type: PlanType
  name: string
  /** Increments when a plan with the same name and type is imported again. */
  version: number
  is_active: boolean
  imported_at: string
  source: 'import' | 'editor'
  /** Week the user is currently in (1-based). */
  current_week: number
  /** The validated plan in the exchange format, with every exercise reference resolved to `exercise_id`. */
  data: PlanData
}

/** One workout (or cardio/rehab unit) as it actually happened. */
export interface Session extends SyncFields {
  plan_id: string | null
  plan_type: PlanType
  /** Plan version at the time, so later re-imports never change history. */
  plan_version: number | null
  week: number | null
  day_key: string | null
  day_name: string
  /** Local calendar date, YYYY-MM-DD. */
  date: string
  started_at: string
  finished_at: string | null
  notes?: string
  /** Rehab: pain / feel score 0-10. */
  pain_score?: number | null
}

/** An exercise (or cardio block) inside a session, in order. Survives swaps and additions. */
export interface SessionItem extends SyncFields {
  session_id: string
  position: number
  exercise_id: string | null
  /** Exercise the plan prescribed, if this one was swapped in. */
  swapped_from_exercise_id?: string | null
  superset?: string | null
  /** Snapshot of the planned item, so history shows target vs. actual forever. */
  planned: unknown | null
  notes?: string
}

export type SetType = 'warmup' | 'working' | 'top' | 'backoff'

/** A logged set (strength/rehab) or interval/segment (cardio). */
export interface SetLog extends SyncFields {
  session_id: string
  session_item_id: string
  exercise_id: string | null
  set_index: number
  set_type: SetType
  side?: 'L' | 'R' | null
  weight_kg?: number | null
  reps?: number | null
  rir?: number | null
  rpe?: number | null
  hold_seconds?: number | null
  duration_sec?: number | null
  distance_km?: number | null
  avg_hr?: number | null
  /** Snapshot of the planned set (reps range, RIR, load). */
  target?: unknown | null
  completed_at: string | null
}

export interface SyncQueueEntry {
  seq?: number
  table: SyncTable
  row_id: string
  queued_at: string
}

export interface MetaEntry {
  key: string
  value: unknown
}

export type SyncTable = 'exercises' | 'exercise_aliases' | 'plans' | 'sessions' | 'session_items' | 'set_logs'

export const SYNC_TABLES: SyncTable[] = ['exercises', 'exercise_aliases', 'plans', 'sessions', 'session_items', 'set_logs']

export interface RowByTable {
  exercises: Exercise
  exercise_aliases: ExerciseAlias
  plans: Plan
  sessions: Session
  session_items: SessionItem
  set_logs: SetLog
}
