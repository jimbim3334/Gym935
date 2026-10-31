import { z } from 'zod'
import type { TrainingDB } from '../db/db.ts'
import { mergeRows } from '../db/mutate.ts'
import { SYNC_TABLES, type RowByTable, type SyncTable } from '../db/types.ts'

export const BACKUP_FORMAT = 'training-app-backup'
export const BACKUP_VERSION = 1

const row = z.looseObject({ id: z.string().min(1), updated_at: z.string().min(1) })

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exported_at: z.string(),
  tables: z.partialRecord(z.enum(SYNC_TABLES as [SyncTable, ...SyncTable[]]), z.array(row)),
})

export type Backup = z.infer<typeof backupSchema>

/** Everything, including soft-deleted rows, so a restore is complete. */
export async function exportBackup(db: TrainingDB): Promise<Backup> {
  const tables: Backup['tables'] = {}
  for (const t of SYNC_TABLES) tables[t] = await db.table(t).toArray()
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exported_at: new Date().toISOString(), tables }
}

export type BackupImportResult = Record<SyncTable, { total: number; applied: number }>

/**
 * Merges a backup into the local database. Rows only replace local ones if they are newer
 * (same last-write-wins rule as sync), so importing an old backup never loses newer data.
 */
export async function importBackup(db: TrainingDB, json: unknown): Promise<BackupImportResult> {
  const parsed = backupSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error('Das ist keine gültige Backup-Datei dieser App.')
  }
  const result = {} as BackupImportResult
  for (const t of SYNC_TABLES) {
    const rows = (parsed.data.tables[t] ?? []) as unknown as RowByTable[typeof t][]
    const applied = await mergeRows(db, t, rows, { enqueue: true })
    result[t] = { total: rows.length, applied }
  }
  return result
}

export const backupFileName = () => `training-backup-${new Date().toISOString().slice(0, 10)}.json`
