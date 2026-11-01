import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '../catalog/muscles.ts'
import { db } from '../db/db.ts'
import { alive } from '../db/mutate.ts'
import type { Exercise } from '../db/types.ts'
import { normalizeName } from '../lib/text.ts'
import { cx } from '../ui/style.ts'
import { fieldClass, Sheet } from '../ui/ui.tsx'

/** Pick a replacement exercise; without a query, exercises for the same muscles come first. */
export function SwapSheet({
  current,
  plannedId,
  onPick,
  onClose,
}: {
  current: Exercise | null
  plannedId: string | null
  onPick: (exerciseId: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const data = useLiveQuery(async () => {
    const [exercises, aliases] = await Promise.all([db.exercises.toArray(), db.exercise_aliases.toArray()])
    const names = new Map<string, string[]>()
    for (const a of alive(aliases)) names.set(a.exercise_id, [...(names.get(a.exercise_id) ?? []), a.alias_norm])
    return alive(exercises)
      .filter((e) => e.kind === current?.kind || !current)
      .map((e) => ({ e, aliases: names.get(e.id) ?? [] }))
  }, [current?.kind])

  const q = normalizeName(query)
  const muscles = new Set(current?.primary_muscles ?? [])
  const overlap = (e: Exercise) => e.primary_muscles.filter((m) => muscles.has(m)).length
  const list = (data ?? [])
    .filter(({ e, aliases }) => {
      if (e.id === current?.id) return false
      if (!q) return overlap(e) > 0
      return normalizeName(e.name).includes(q) || aliases.some((a) => a.includes(q))
    })
    .sort((a, b) => overlap(b.e) - overlap(a.e) || a.e.name.localeCompare(b.e.name))
    .slice(0, 60)
  const planned = plannedId && plannedId !== current?.id ? data?.find((d) => d.e.id === plannedId)?.e : undefined

  return (
    <Sheet title="Übung tauschen" onClose={onClose}>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Übung suchen"
        className={`${fieldClass} mb-3 min-h-12`}
      />
      {!q && <p className="mb-2 px-1 text-sm font-semibold text-muted">Gleiche Muskeln wie {current?.name ?? 'bisher'}</p>}
      <div className="flex flex-col gap-1.5">
        {planned && <Option exercise={planned} hint="Laut Plan" onPick={onPick} />}
        {list.map(({ e }) => (
          <Option key={e.id} exercise={e} onPick={onPick} />
        ))}
        {list.length === 0 && <p className="px-1 py-6 text-center text-muted">Keine Treffer</p>}
      </div>
    </Sheet>
  )
}

function Option({ exercise, hint, onPick }: { exercise: Exercise; hint?: string; onPick: (id: string) => void }) {
  return (
    <button
      onClick={() => onPick(exercise.id)}
      className={cx('flex min-h-14 w-full flex-col items-start rounded-[18px] bg-surface px-4 py-2.5 text-left transition active:scale-[0.99]')}
    >
      <span className="font-bold">
        {exercise.name}
        {hint && <span className="ml-2 text-xs font-bold text-muted">{hint}</span>}
      </span>
      <span className="text-sm font-medium text-muted">
        {exercise.primary_muscles.map((m) => MUSCLE_LABELS[m]).join(', ')} · {EQUIPMENT_LABELS[exercise.equipment]}
      </span>
    </button>
  )
}
