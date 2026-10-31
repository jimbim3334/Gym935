import { z } from 'zod'
import de from 'zod/v4/locales/de.js'
import { planSchema, type ExercisePlanData, type PlanData } from './schema.ts'
import { parseRange } from './format.ts'

z.config(de())

export interface PlanMessage {
  /** Human readable location, e.g. "Woche 2 › Tag „Oberkörper A“ › Übung 3 „Bench Press“". */
  where: string
  message: string
}

export type ValidationResult =
  | { ok: true; plan: PlanData; warnings: PlanMessage[] }
  | { ok: false; errors: PlanMessage[]; warnings: PlanMessage[] }

/** Removes markdown code fences and BOM that AI chat output usually comes wrapped in. */
export function cleanJsonText(input: string): string {
  let t = input.replace(/^﻿/, '').trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) t = fence[1].trim()
  // Typographic quotes from chat apps or notes break JSON.
  t = t.replace(/[“”„]/g, '"')
  return t
}

function jsonError(text: string, err: unknown): PlanMessage {
  const msg = err instanceof Error ? err.message : String(err)
  const pos = msg.match(/position (\d+)/)
  if (pos) {
    const index = Number(pos[1])
    const before = text.slice(0, index)
    const line = before.split('\n').length
    const col = index - before.lastIndexOf('\n')
    return { where: `Zeile ${line}, Spalte ${col}`, message: 'Ungültiges JSON. Oft fehlt hier ein Komma oder eine Klammer.' }
  }
  return { where: 'JSON', message: `Ungültiges JSON: ${msg}` }
}

const ITEM_LABEL: Record<string, string> = {
  strength: 'Übung',
  rehab: 'Übung',
  cardio: 'Einheit',
}

/** Turns a zod path into a readable German location by peeking into the raw input for names. */
export function describePath(raw: unknown, path: PropertyKey[]): string {
  const parts: string[] = []
  let node: unknown = raw
  const planType = (raw as { type?: string } | null)?.type ?? 'strength'
  for (let i = 0; i < path.length; i++) {
    const key = path[i]
    const parent = path[i - 1]
    const next = (node as Record<PropertyKey, unknown> | undefined)?.[key as never]
    if (typeof key === 'number') {
      const obj = (next ?? {}) as Record<string, unknown>
      if (parent === 'weeks') parts.push(`Woche ${typeof obj.week === 'number' ? obj.week : key + 1}`)
      else if (parent === 'days') parts.push(`Tag ${obj.name ? `„${obj.name}“` : key + 1}`)
      else if (parent === 'items') {
        const name = obj.exercise ?? obj.exercise_id ?? obj.name ?? obj.modality
        parts.push(`${ITEM_LABEL[planType] ?? 'Eintrag'} ${key + 1}${name ? ` „${name}“` : ''}`)
      } else if (parent === 'sets') parts.push(`Satzgruppe ${key + 1}`)
      else if (parent === 'intervals') parts.push(`Intervallblock ${key + 1}`)
      else if (parent === 'exercise_definitions') parts.push(`Übungsdefinition ${obj.name ? `„${obj.name}“` : key + 1}`)
      else parts.push(`[${key + 1}]`)
    } else if (!['weeks', 'days', 'items', 'sets', 'intervals', 'exercise_definitions'].includes(String(key))) {
      parts.push(String(key))
    }
    node = next
  }
  return parts.length ? parts.join(' › ') : 'Plan'
}

function unsetPath(obj: unknown, path: PropertyKey[], key: string) {
  let node = obj as Record<PropertyKey, unknown> | undefined
  for (const p of path) node = node?.[p] as Record<PropertyKey, unknown> | undefined
  if (node && typeof node === 'object') delete node[key]
}

/**
 * Structural validation. Unknown keys (e.g. an AI adding "rationale") are not fatal:
 * they are removed and reported as warnings, everything else is an error.
 */
function parseStructure(raw: unknown): { plan?: PlanData; errors: PlanMessage[]; warnings: PlanMessage[] } {
  const warnings: PlanMessage[] = []
  let input = raw
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = planSchema.safeParse(input)
    if (res.success) return { plan: res.data, errors: [], warnings }
    const unknown = res.error.issues.filter((i) => i.code === 'unrecognized_keys')
    const other = res.error.issues.filter((i) => i.code !== 'unrecognized_keys')
    if (other.length > 0 || unknown.length === 0) {
      return {
        errors: other.map((i) => ({ where: describePath(raw, i.path), message: i.message })),
        warnings: [
          ...warnings,
          ...unknown.map((i) => ({
            where: describePath(raw, i.path),
            message: `Unbekannte Felder werden ignoriert: ${(i as { keys: string[] }).keys.join(', ')}`,
          })),
        ],
      }
    }
    if (attempt === 0) input = structuredClone(raw)
    for (const i of unknown) {
      const keys = (i as { keys: string[] }).keys
      warnings.push({ where: describePath(raw, i.path), message: `Unbekannte Felder werden ignoriert: ${keys.join(', ')}` })
      for (const k of keys) unsetPath(input, i.path, k)
    }
  }
  return { errors: [{ where: 'Plan', message: 'Plan konnte nicht gelesen werden.' }], warnings }
}

/** Cross-field checks that the JSON schema can't express. */
export function checkSemantics(plan: PlanData): { errors: PlanMessage[]; warnings: PlanMessage[] } {
  const errors: PlanMessage[] = []
  const warnings: PlanMessage[] = []

  if (plan.weeks.length !== plan.duration_weeks) {
    errors.push({
      where: 'Plan',
      message: `duration_weeks ist ${plan.duration_weeks}, aber es sind ${plan.weeks.length} Wochen angegeben.`,
    })
  }
  const weekNumbers = plan.weeks.map((w) => w.week)
  const expected = Array.from({ length: plan.weeks.length }, (_, i) => i + 1)
  if ([...weekNumbers].sort((a, b) => a - b).join() !== expected.join()) {
    errors.push({
      where: 'Plan',
      message: `Wochen müssen lückenlos von 1 bis ${plan.weeks.length} nummeriert sein (gefunden: ${weekNumbers.join(', ')}).`,
    })
  }

  const firstWeekKeys = new Set(plan.weeks.find((w) => w.week === 1)?.days.map((d) => d.key) ?? [])

  for (const w of plan.weeks) {
    const W = `Woche ${w.week}`
    const keys = new Set<string>()
    for (const d of w.days) {
      if (keys.has(d.key)) errors.push({ where: W, message: `Tages-key „${d.key}“ kommt doppelt vor.` })
      keys.add(d.key)
    }
    if (!w.deload && w.days.length !== plan.days_per_week) {
      warnings.push({ where: W, message: `${w.days.length} Trainingstage, laut days_per_week sind es ${plan.days_per_week}.` })
    }
    if (w.week !== 1) {
      for (const k of firstWeekKeys) {
        if (!keys.has(k)) warnings.push({ where: W, message: `Tag „${k}“ aus Woche 1 fehlt.` })
      }
    }
    if (plan.type === 'cardio') continue

    for (const d of (w as ExercisePlanData['weeks'][number]).days) {
      const D = `${W} › Tag „${d.name}“`
      const seenSupersets: string[] = []
      d.items.forEach((item, idx) => {
        const I = `${D} › Übung ${idx + 1} „${item.exercise ?? item.exercise_id}“`
        if (item.superset) {
          const last = seenSupersets[seenSupersets.length - 1]
          if (seenSupersets.includes(item.superset) && last !== item.superset) {
            warnings.push({ where: I, message: `Supersatz „${item.superset}“ ist nicht zusammenhängend.` })
          }
          seenSupersets.push(item.superset)
        }
        let hasTop = false
        item.sets.forEach((s, si) => {
          const S = `${I} › Satzgruppe ${si + 1}`
          if (typeof s.reps === 'string' && s.reps.toLowerCase() !== 'amrap') {
            const r = parseRange(s.reps)
            if (r && r.min > r.max) errors.push({ where: S, message: `Wiederholungsbereich „${s.reps}“: Minimum größer als Maximum.` })
          }
          for (const [label, v] of [['RIR', s.rir], ['RPE', s.rpe]] as const) {
            if (typeof v === 'string') {
              const r = parseRange(v)
              if (r && r.min > r.max) errors.push({ where: S, message: `${label}-Bereich „${v}“: Minimum größer als Maximum.` })
            }
          }
          if (typeof s.rir === 'number' && typeof s.rpe === 'number' && Math.abs(10 - s.rpe - s.rir) > 0.5) {
            warnings.push({ where: S, message: `RIR ${s.rir} und RPE ${s.rpe} passen nicht zusammen (RPE ≈ 10 − RIR).` })
          }
          if (s.load?.type === 'percent_top_set' && !hasTop) {
            errors.push({ where: S, message: 'load "percent_top_set" braucht vorher einen Satz mit type "top".' })
          }
          if (s.load?.type === 'relative' && w.week === 1 && s.load.reference === 'last_week') {
            warnings.push({ where: S, message: 'Relative Last in Woche 1: Es zählt die letzte Einheit dieser Übung.' })
          }
          if (s.type === 'top') hasTop = true
        })
      })
    }
  }
  return { errors, warnings }
}

/** Full pipeline: text -> JSON -> structure -> semantics. */
export function validatePlanText(text: string): ValidationResult {
  const cleaned = cleanJsonText(text)
  if (!cleaned) return { ok: false, errors: [{ where: 'Eingabe', message: 'Kein Text eingefügt.' }], warnings: [] }
  let raw: unknown
  try {
    raw = JSON.parse(cleaned)
  } catch (e) {
    return { ok: false, errors: [jsonError(cleaned, e)], warnings: [] }
  }
  return validatePlanObject(raw)
}

export function validatePlanObject(raw: unknown): ValidationResult {
  if (raw && typeof raw === 'object' && 'format_version' in raw && (raw as { format_version: unknown }).format_version !== 1) {
    return {
      ok: false,
      errors: [{ where: 'format_version', message: `Formatversion ${String((raw as { format_version: unknown }).format_version)} wird nicht unterstützt (erwartet: 1).` }],
      warnings: [],
    }
  }
  const s = parseStructure(raw)
  if (!s.plan) return { ok: false, errors: s.errors, warnings: s.warnings }
  const sem = checkSemantics(s.plan)
  const warnings = [...s.warnings, ...sem.warnings]
  if (sem.errors.length) return { ok: false, errors: sem.errors, warnings }
  return { ok: true, plan: s.plan, warnings }
}
