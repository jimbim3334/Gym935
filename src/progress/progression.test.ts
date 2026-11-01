import { describe, expect, it } from 'vitest'
import type { SetGroupData } from '../plan/schema.ts'
import { adviseNextSet, e1rm, recommend, roundTo, type PastSession, type PastSet } from './progression.ts'

const compound = { mechanic: 'compound' as const, increment: 2.5 }
const isolation = { mechanic: 'isolation' as const, increment: 2 }

const group = (g: Partial<SetGroupData>): SetGroupData => ({ count: 3, type: 'working', ...g }) as SetGroupData

const session = (id: string, sets: [number | null, number, number | null][], target?: Partial<SetGroupData>): PastSession => ({
  session_id: id,
  date: '2026-10-01',
  plan_id: 'p',
  week: 1,
  sets: sets.map(
    ([weight_kg, reps, rir]): PastSet => ({ weight_kg, reps, rir, set_type: 'working', target: target ? group(target) : null }),
  ),
})

describe('progression', () => {
  it('rounds to the load step', () => {
    expect(roundTo(83.7, 2.5)).toBe(82.5)
    expect(roundTo(84.9, 2.5, 'down')).toBe(82.5)
    expect(roundTo(13.1, 2)).toBe(14)
  })

  it('estimates e1RM with reps in reserve', () => {
    expect(e1rm(100, 5, 0)).toBeCloseTo(116.67, 1)
    expect(e1rm(100, 5, 2)).toBeCloseTo(123.33, 1)
  })

  it('increases a compound once every set hit the top of the range at target RIR', () => {
    const g = group({ reps: '6-8', rir: 2 })
    const r = recommend({ group: g, exercise: compound, history: [session('a', [[100, 8, 2], [100, 8, 2], [100, 8, 3]], { reps: '6-8' })] })
    expect(r).toMatchObject({ kind: 'increase', weight: 102.5, reps: 6 })
  })

  it('does not increase when the top was only reached below target RIR', () => {
    const g = group({ reps: '6-8', rir: 2 })
    const r = recommend({ group: g, exercise: compound, history: [session('a', [[100, 8, 0], [100, 8, 1], [100, 8, 1]])] })
    expect(r.kind).toBe('hold')
    expect(r.weight).toBe(100)
  })

  it('uses double progression for isolations: one more rep first', () => {
    const g = group({ reps: '10-15', rir: 1 })
    const r = recommend({ group: g, exercise: isolation, history: [session('a', [[12, 12, 1], [12, 11, 1], [12, 10, 1]])] })
    expect(r).toMatchObject({ kind: 'hold', weight: 12, reps: 11 })
  })

  it('needs two weak sessions before lowering the load', () => {
    const g = group({ reps: '8-10', rir: 2 })
    const weak = session('a', [[80, 6, 0], [80, 6, 0], [80, 7, 0]])
    expect(recommend({ group: g, exercise: compound, history: [weak] }).kind).toBe('hold')
    const r = recommend({ group: g, exercise: compound, history: [weak, session('b', [[80, 7, 0], [80, 6, 0], [80, 6, 0]])] })
    expect(r.kind).toBe('decrease')
    expect(r.weight).toBe(75)
  })

  it('ignores a single outlier set', () => {
    const g = group({ reps: '8-10', rir: 2 })
    const r = recommend({ group: g, exercise: compound, history: [session('a', [[80, 9, 2], [80, 9, 2], [80, 5, 0]])] })
    expect(r).toMatchObject({ kind: 'hold', weight: 80 })
  })

  it('converts via e1RM when the rep target changed', () => {
    const g = group({ reps: '3-5', rir: 2 })
    const r = recommend({ group: g, exercise: compound, history: [session('a', [[100, 10, 2], [100, 10, 2]], { reps: '8-10' })] })
    expect(r.kind).toBe('adjust')
    // e1RM 100 × (1 + 12/30) = 140; 4 reps + 2 RIR -> 140 / 1.2 = 116.7 -> 115.
    expect(r.weight).toBe(115)
  })

  it('follows plan loads, incl. percent of the top set and relative to last week', () => {
    expect(recommend({ group: group({ reps: 5, load: { type: 'kg', kg: 90 } }), exercise: compound, history: [] }).weight).toBe(90)
    const backoff = group({ type: 'backoff', reps: '8-10', load: { type: 'percent_top_set', percent: 85 } })
    expect(recommend({ group: backoff, exercise: compound, history: [], topSetWeight: 100 }).weight).toBe(85)
    const rel = group({ reps: '6-8', load: { type: 'relative', change_kg: 2.5, reference: 'last_week' } })
    expect(recommend({ group: rel, exercise: compound, history: [session('a', [[100, 7, 2]])], planId: 'p', week: 2 }).weight).toBe(102.5)
  })

  it('asks for a first weight when there is no history', () => {
    expect(recommend({ group: group({ reps: '8-10', rir: 2 }), exercise: compound, history: [] })).toMatchObject({ kind: 'new', weight: null })
  })

  it('holds instead of increasing in a deload week', () => {
    const g = group({ reps: '6-8', rir: 2 })
    const r = recommend({ group: g, exercise: compound, history: [session('a', [[100, 8, 2], [100, 8, 2]])], deload: true })
    expect(r).toMatchObject({ kind: 'hold', weight: 100 })
  })

  it('adjusts the next set from RIR', () => {
    const g = group({ reps: '8-10', rir: 2 })
    expect(adviseNextSet({ weight_kg: 80, reps: 9, rir: 2 }, g, compound)).toMatchObject({ tone: 'ok', weight: 80 })
    expect(adviseNextSet({ weight_kg: 80, reps: 10, rir: 5 }, g, compound)).toMatchObject({ tone: 'up' })
    const down = adviseNextSet({ weight_kg: 80, reps: 7, rir: 0 }, g, compound)!
    expect(down.tone).toBe('down')
    expect(down.weight).toBeGreaterThanOrEqual(72)
  })
})
