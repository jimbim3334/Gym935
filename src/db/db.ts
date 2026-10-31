import Dexie, { type EntityTable } from 'dexie'
import type {
  Exercise,
  ExerciseAlias,
  MetaEntry,
  Plan,
  Session,
  SessionItem,
  SetLog,
  SyncQueueEntry,
} from './types.ts'

export class TrainingDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  exercise_aliases!: EntityTable<ExerciseAlias, 'id'>
  plans!: EntityTable<Plan, 'id'>
  sessions!: EntityTable<Session, 'id'>
  session_items!: EntityTable<SessionItem, 'id'>
  set_logs!: EntityTable<SetLog, 'id'>
  sync_queue!: EntityTable<SyncQueueEntry, 'seq'>
  meta!: EntityTable<MetaEntry, 'key'>

  constructor(name = 'training') {
    super(name)
    // Only indexed fields are listed; booleans are not indexable in IndexedDB and get filtered in JS.
    this.version(1).stores({
      exercises: 'id, name, updated_at',
      exercise_aliases: 'id, alias_norm, exercise_id, updated_at',
      plans: 'id, type, updated_at',
      sessions: 'id, plan_id, date, started_at, updated_at',
      session_items: 'id, session_id, exercise_id, updated_at',
      set_logs: 'id, session_id, session_item_id, exercise_id, completed_at, updated_at',
      sync_queue: '++seq, table, row_id',
      meta: 'key',
    })
  }
}

export const db = new TrainingDB()
