import type { TrainingDB } from './db.ts'
import type { RowByTable, SyncTable } from './types.ts'

export const nowIso = () => new Date().toISOString()

export const newId = () => crypto.randomUUID()

type NewRow<T> = Omit<T, 'created_at' | 'updated_at' | 'deleted_at'> &
  Partial<Pick<RowByTable[SyncTable], 'created_at' | 'deleted_at'>>

/**
 * All writes to synced tables go through here: stamps `updated_at` (last-write-wins key)
 * and records the row in the sync queue, inside one transaction.
 */
export async function putRows<K extends SyncTable>(db: TrainingDB, table: K, rows: NewRow<RowByTable[K]>[]) {
  if (rows.length === 0) return
  const ts = nowIso()
  const stamped = rows.map((r) => ({
    ...r,
    created_at: r.created_at ?? ts,
    deleted_at: r.deleted_at ?? null,
    updated_at: ts,
  })) as RowByTable[K][]
  await db.transaction('rw', db.table(table), db.sync_queue, async () => {
    await db.table(table).bulkPut(stamped)
    await db.sync_queue.bulkAdd(stamped.map((r) => ({ table, row_id: r.id, queued_at: ts })))
  })
}

export async function softDelete(db: TrainingDB, table: SyncTable, id: string) {
  const row = await db.table(table).get(id)
  if (!row) return
  await putRows(db, table, [{ ...row, deleted_at: nowIso() }])
}

/**
 * Writes rows that carry their own timestamps (backup import, later: sync download).
 * A row only wins if it is newer than the local one (last-write-wins).
 * Returns the number of rows applied.
 */
export async function mergeRows<K extends SyncTable>(
  db: TrainingDB,
  table: K,
  rows: RowByTable[K][],
  { enqueue }: { enqueue: boolean },
): Promise<number> {
  let applied = 0
  await db.transaction('rw', db.table(table), db.sync_queue, async () => {
    const existing = await db.table(table).bulkGet(rows.map((r) => r.id))
    const winners = rows.filter((r, i) => {
      const local = existing[i] as RowByTable[K] | undefined
      return !local || r.updated_at > local.updated_at
    })
    applied = winners.length
    await db.table(table).bulkPut(winners)
    if (enqueue && winners.length) {
      const ts = nowIso()
      await db.sync_queue.bulkAdd(winners.map((r) => ({ table, row_id: r.id, queued_at: ts })))
    }
  })
  return applied
}

/** Rows that are not soft-deleted. */
export const alive = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at)
