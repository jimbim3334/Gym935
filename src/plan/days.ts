import { workingSetCount } from './format.ts'
import type { CardioItemData, ExerciseItemData, PlanData, WeekData } from './schema.ts'

export type DayData = WeekData['days'][number]

/** Groups consecutive exercise items that share a superset label. */
export function groupSupersets(items: ExerciseItemData[]) {
  const groups: { label?: string; items: ExerciseItemData[] }[] = []
  for (const item of items) {
    const last = groups[groups.length - 1]
    if (item.superset && last?.label === item.superset) last.items.push(item)
    else groups.push({ label: item.superset, items: [item] })
  }
  return groups
}

export function daySetCount(plan: PlanData, day: DayData) {
  if (plan.type === 'cardio') return 0
  return (day.items as ExerciseItemData[]).reduce((n, i) => n + workingSetCount(i), 0)
}

export function dayMeta(plan: PlanData, day: DayData) {
  if (plan.type === 'cardio') {
    const minutes = (day.items as CardioItemData[]).reduce((n, c) => n + (c.duration_min ?? 0) + (c.warmup_min ?? 0) + (c.cooldown_min ?? 0), 0)
    return `${day.items.length} ${day.items.length === 1 ? 'Einheit' : 'Einheiten'}${minutes ? ` · ca. ${minutes} min` : ''}`
  }
  return `${day.items.length} Übungen · ${daySetCount(plan, day)} Sätze`
}

