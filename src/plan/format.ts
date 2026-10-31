import type {
  CardioItemData,
  ExerciseItemData,
  IntensityData,
  LoadData,
  SegmentData,
  SetGroupData,
} from './schema.ts'

export interface Range {
  min: number
  max: number
}

/** "6-8" -> {6, 8}; "8" -> {8, 8}; 2 -> {2, 2}; "AMRAP" -> null. */
export function parseRange(v: number | string | undefined): Range | null {
  if (v === undefined) return null
  if (typeof v === 'number') return { min: v, max: v }
  const m = v.trim().match(/^(\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+(?:\.\d+)?))?$/)
  if (!m) return null
  const min = Number(m[1])
  return { min, max: m[2] !== undefined ? Number(m[2]) : min }
}

const nf = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })
export const num = (n: number) => nf.format(n)

const rangeText = (v: number | string) => {
  if (typeof v === 'string' && v.toLowerCase() === 'amrap') return 'AMRAP'
  const r = parseRange(v)
  if (!r) return String(v)
  return r.min === r.max ? num(r.min) : `${num(r.min)}–${num(r.max)}`
}

export function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s} s`
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')} min`
}

export function formatLoad(load: LoadData): string {
  switch (load.type) {
    case 'kg':
      return `${num(load.kg)} kg`
    case 'percent_1rm':
      return `${num(load.percent)} % 1RM`
    case 'percent_top_set':
      return `${num(load.percent)} % vom Top-Satz`
    case 'relative': {
      const ref = load.reference === 'last_session' ? 'letzte Einheit' : 'Vorwoche'
      const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±')
      if (load.change_kg !== undefined) return `${ref} ${sign(load.change_kg)}${num(Math.abs(load.change_kg))} kg`
      return `${ref} ${sign(load.change_percent ?? 0)}${num(Math.abs(load.change_percent ?? 0))} %`
    }
  }
}

export const SET_TYPE_LABELS: Record<SetGroupData['type'], string> = {
  warmup: 'Aufwärmen',
  working: 'Arbeitssatz',
  top: 'Top-Satz',
  backoff: 'Back-off',
}

/** "3 × 6–8 Wdh. · RIR 2 · 100 kg" */
export function formatSetGroup(s: SetGroupData, perSide = false): string {
  const parts: string[] = []
  const volume = s.reps !== undefined ? `${rangeText(s.reps)} Wdh.` : `${s.hold_seconds} s halten`
  parts.push(`${s.count} × ${volume}${perSide ? ' je Seite' : ''}`)
  if (s.rir !== undefined) parts.push(`RIR ${rangeText(s.rir)}`)
  if (s.rpe !== undefined) parts.push(`RPE ${rangeText(s.rpe)}`)
  if (s.load) parts.push(formatLoad(s.load))
  return parts.join(' · ')
}

export const workingSetCount = (item: ExerciseItemData) =>
  item.sets.filter((s) => s.type !== 'warmup').reduce((n, s) => n + s.count, 0)

export const CARDIO_LABELS: Record<CardioItemData['modality'], string> = {
  run: 'Laufen',
  bike: 'Rad',
  row: 'Rudern',
  elliptical: 'Crosstrainer',
  swim: 'Schwimmen',
  walk: 'Gehen',
  stairs: 'Stepper',
  ski_erg: 'SkiErg',
  other: 'Sonstiges',
}

export function formatIntensity(i: IntensityData): string {
  const parts: string[] = []
  if (i.hr_zone !== undefined) parts.push(`Zone ${i.hr_zone}`)
  if (i.hr_min !== undefined || i.hr_max !== undefined) parts.push(`${i.hr_min ?? '…'}–${i.hr_max ?? '…'} bpm`)
  if (i.rpe !== undefined) parts.push(`RPE ${rangeText(i.rpe)}`)
  if (i.pace_per_km) parts.push(`${i.pace_per_km.replace('-', '–')} /km`)
  if (i.watts !== undefined) parts.push(`${i.watts} W`)
  if (i.description) parts.push(i.description)
  return parts.join(' · ')
}

function formatSegment(s: SegmentData): string {
  const amount =
    s.duration_sec !== undefined
      ? s.duration_sec % 60 === 0
        ? `${s.duration_sec / 60} min`
        : formatRest(s.duration_sec)
      : `${num(s.distance_m ?? 0)} m`
  return s.intensity ? `${amount} (${formatIntensity(s.intensity)})` : amount
}

export function formatCardio(c: CardioItemData): string[] {
  const lines: string[] = []
  const main: string[] = []
  if (c.duration_min !== undefined) main.push(`${num(c.duration_min)} min`)
  if (c.distance_km !== undefined) main.push(`${num(c.distance_km)} km`)
  if (c.intensity) main.push(formatIntensity(c.intensity))
  if (main.length) lines.push(main.join(' · '))
  if (c.warmup_min) lines.push(`Einlaufen ${num(c.warmup_min)} min`)
  for (const b of c.intervals ?? []) {
    lines.push(`${b.repeats} × ${formatSegment(b.work)}${b.recover ? ` / ${formatSegment(b.recover)} Pause` : ''}`)
  }
  if (c.cooldown_min) lines.push(`Auslaufen ${num(c.cooldown_min)} min`)
  return lines
}

/** Words skipped when building initials, so "Barbell Bench Press" becomes "BP". */
const INITIALS_SKIP = new Set([
  'barbell', 'dumbbell', 'cable', 'machine', 'smith', 'seated', 'standing', 'lying', 'single', 'arm', 'leg',
  'pin-loaded', 'plate-loaded', 'neutral', 'grip', 'overhand', 'close', 'ez-bar', 'trap', 'bar', 'incline', 'the',
])

export function exerciseInitials(name: string): string {
  const words = name.split(/[\s/]+/).filter(Boolean)
  const keep = words.map((w) => !INITIALS_SKIP.has(w.toLowerCase()))
  let idx = words.map((_, i) => i).filter((i) => keep[i])
  if (idx.length === 0) idx = words.map((_, i) => i)
  // One meaningful word ("Single Arm Dumbbell Row"): add the word before it -> "DR".
  if (idx.length === 1 && idx[0] > 0) idx = [idx[0] - 1, idx[0]]
  return idx
    .slice(0, 2)
    .map((i) => words[i][0]?.toUpperCase() ?? '')
    .join('')
}

/** One-line summary of an exercise's sets: "3 × 8–12 · RIR 1" or "Top 5–6 + 2 × Back-off 8–10 · RIR 1". */
export function summarizeSets(item: ExerciseItemData): string {
  const work = item.sets.filter((s) => s.type !== 'warmup')
  const volume = (s: SetGroupData) => (s.reps !== undefined ? rangeText(s.reps) : `${s.hold_seconds} s`)
  const parts =
    work.length === 1
      ? [`${work[0].count} × ${volume(work[0])}`]
      : work.map((s) => {
          const label = s.type === 'top' ? 'Top' : s.type === 'backoff' ? 'Back-off' : ''
          return `${s.count > 1 ? `${s.count} × ` : ''}${label ? `${label} ` : ''}${volume(s)}`
        })
  const rirs = [...new Set(work.filter((s) => s.rir !== undefined).map((s) => rangeText(s.rir!)))]
  let text = parts.join(' + ')
  if (item.per_side) text += ' je Seite'
  if (rirs.length === 1) text += ` · RIR ${rirs[0]}`
  return text
}
