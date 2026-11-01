import { useEffect, useState, useSyncExternalStore } from 'react'

/**
 * Rest timer based on timestamps, so it stays correct when the phone sleeps or the app reloads.
 * State lives in localStorage (this device only, never synced). The end sound is scheduled in
 * Web Audio ahead of time; iOS mutes it while the phone is locked, which was accepted.
 */

export interface RestState {
  sessionId: string
  startedAt: number
  endsAt: number
}

const KEY = 'rest-timer'
const listeners = new Set<() => void>()
let state: RestState | null = read()

function read(): RestState | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as RestState) : null
  } catch {
    return null
  }
}

function write(next: RestState | null) {
  state = next
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next))
    else localStorage.removeItem(KEY)
  } catch {
    // Private mode: the timer still works for this page view.
  }
  scheduleSound()
  for (const l of listeners) l()
}

export const restTimer = {
  start(sessionId: string, seconds: number) {
    unlockAudio()
    if (seconds <= 0) return write(null)
    const now = Date.now()
    write({ sessionId, startedAt: now, endsAt: now + seconds * 1000 })
  },
  /** Adds (or with a negative value, removes) time; never ends before now. */
  extend(seconds: number) {
    if (!state) return
    const now = Date.now()
    write({ ...state, endsAt: Math.max(now, Math.max(now, state.endsAt) + seconds * 1000) })
  },
  stop() {
    write(null)
  },
}

export function useRestTimer(): RestState | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}

/** Current time, re-rendering every `ms` while `active`. */
export function useNow(active: boolean, ms = 250) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [active, ms])
  return now
}

/* ---- Sound ---- */

let ctx: AudioContext | null = null
let scheduled: OscillatorNode[] = []

/** Audio may only start from a user gesture on iOS; every set check is one, so we unlock there. */
function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

function scheduleSound() {
  for (const osc of scheduled) {
    try {
      osc.stop()
    } catch {
      // Already stopped.
    }
  }
  scheduled = []
  if (!ctx || !state) return
  const delay = (state.endsAt - Date.now()) / 1000
  if (delay <= 0) return
  const start = ctx.currentTime + delay
  // Three short rising beeps.
  ;[0, 0.22, 0.44].forEach((offset, i) => {
    const osc = ctx!.createOscillator()
    const gain = ctx!.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880 + i * 220
    const t = start + offset
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    osc.connect(gain).connect(ctx!.destination)
    osc.start(t)
    osc.stop(t + 0.2)
    scheduled.push(osc)
  })
}

// When the app comes back to the foreground the audio clock may have been paused; re-schedule.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx) {
      void ctx.resume().then(scheduleSound)
    }
  })
}

export function formatClock(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
