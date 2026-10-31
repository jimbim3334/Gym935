import type { PlanType } from '../plan/schema.ts'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

interface TypeStyle {
  label: string
  path: string
  /** Full-color hero card and its text. */
  hero: string
  heroMuted: string
  heroChip: string
  heroButton: string
  /** Tinted background for badges and pills on normal surfaces. */
  soft: string
  /** Text color that is readable on normal surfaces. */
  text: string
  /** Progress ring stroke. */
  stroke: string
}

/** Colors per training tab: Strength rgb(28 33 36), Cardio #0093E7, Mobility #00F19F (tokens in index.css). */
export const TYPE_STYLES: Record<PlanType, TypeStyle> = {
  strength: {
    label: 'Strength',
    path: '/strength',
    hero: 'bg-strength-hero text-strength-hero-fg dark:ring-1 dark:ring-white/10',
    heroMuted: 'text-strength-hero-muted',
    heroChip: 'bg-strength-chip',
    heroButton: 'bg-strength-btn text-strength-btn-fg',
    soft: 'bg-strength-soft',
    text: 'text-strength-ink',
    stroke: 'text-strength-ring',
  },
  cardio: {
    label: 'Cardio',
    path: '/cardio',
    hero: 'bg-cardio-hero text-cardio-hero-fg',
    heroMuted: 'text-cardio-hero-muted',
    heroChip: 'bg-cardio-chip',
    heroButton: 'bg-cardio-btn text-cardio-btn-fg',
    soft: 'bg-cardio-soft',
    text: 'text-cardio-ink',
    stroke: 'text-cardio-ring',
  },
  rehab: {
    label: 'Mobility',
    path: '/mobility',
    hero: 'bg-mobility-hero text-mobility-hero-fg',
    heroMuted: 'text-mobility-hero-muted',
    heroChip: 'bg-mobility-chip',
    heroButton: 'bg-mobility-btn text-mobility-btn-fg',
    soft: 'bg-mobility-soft',
    text: 'text-mobility-ink',
    stroke: 'text-mobility-ring',
  },
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })

export const formatToday = () =>
  new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
