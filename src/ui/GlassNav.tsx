import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { useLocation } from 'wouter'
import { IconBottle, IconHistory, IconKettlebell, IconMobility, IconMore } from './icons.tsx'
import { cx } from './style.ts'

const TABS: { href: string; label: string; icon: ReactNode }[] = [
  { href: '/strength', label: 'Strength', icon: <IconKettlebell size={24} /> },
  { href: '/cardio', label: 'Cardio', icon: <IconBottle size={24} /> },
  { href: '/mobility', label: 'Mobility', icon: <IconMobility size={24} /> },
]

const DRAG_THRESHOLD = 6

/**
 * Liquid-glass tab bar: a frosted pill with a glass lens that slides to the active tab.
 * Tap a tab, or drag the lens across the bar and let go to switch.
 */
export function GlassNav() {
  const [location, navigate] = useLocation()
  const active = TABS.findIndex((t) => location === t.href || location.startsWith(`${t.href}/`))
  const trackRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ startX: number; dragging: boolean } | null>(null)
  const suppressClick = useRef(false)
  /** Lens position in tab units (0 = first tab) while dragging. */
  const [dragPos, setDragPos] = useState<number | null>(null)

  const posFromPointer = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect()
    const seg = rect.width / TABS.length
    return Math.min(Math.max((clientX - rect.left) / seg - 0.5, 0), TABS.length - 1)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    gesture.current = { startX: e.clientX, dragging: false }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) return
    if (!g.dragging && Math.abs(e.clientX - g.startX) > DRAG_THRESHOLD) {
      g.dragging = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    if (g.dragging) setDragPos(posFromPointer(e.clientX))
  }

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    gesture.current = null
    if (!g?.dragging) return
    const target = Math.round(posFromPointer(e.clientX))
    setDragPos(null)
    suppressClick.current = true
    if (target !== active) navigate(TABS[target].href)
  }

  const lensPos = dragPos ?? (active >= 0 ? active : null)
  const hovered = dragPos !== null ? Math.round(dragPos) : active

  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-[max(14px,env(safe-area-inset-bottom))] z-30 flex justify-center gap-2 px-3"
    >
      <div
        ref={trackRef}
        role="tablist"
        className="glass relative grid h-16 w-full max-w-[340px] touch-pan-y grid-cols-3 rounded-full p-1.5 select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {lensPos !== null && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-1.5 left-1.5"
            style={{
              width: 'calc((100% - 12px) / 3)',
              transform: `translateX(${lensPos * 100}%)`,
              transition: dragPos !== null ? 'none' : 'transform 0.45s cubic-bezier(0.34, 1.4, 0.5, 1)',
            }}
          >
            <div
              key={dragPos !== null ? 'drag' : active}
              className={cx('glass-lens h-full rounded-full transition-transform duration-200', dragPos === null && 'lens-squish')}
              style={dragPos !== null ? { transform: 'scale(1.1, 1.06)' } : undefined}
            />
          </div>
        )}
        {TABS.map((t, i) => (
          <button
            key={t.href}
            role="tab"
            aria-selected={i === active}
            onClick={() => {
              if (suppressClick.current) {
                suppressClick.current = false
                return
              }
              navigate(t.href)
            }}
            className={cx(
              'relative z-10 flex flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-bold transition-colors',
              i === hovered ? 'text-fg' : 'text-muted',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="glass flex h-16 shrink-0 items-center gap-1 rounded-full p-1.5">
        <SideButton href="/verlauf" label="Verlauf" active={location.startsWith('/verlauf')} onNavigate={navigate}>
          <IconHistory size={22} />
        </SideButton>
        <SideButton href="/mehr" label="Mehr" active={location.startsWith('/mehr')} onNavigate={navigate}>
          <IconMore size={22} />
        </SideButton>
      </div>
    </nav>
  )
}

function SideButton({
  href,
  label,
  active,
  onNavigate,
  children,
}: {
  href: string
  label: string
  active: boolean
  onNavigate: (href: string) => void
  children: ReactNode
}) {
  return (
    <button
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      onClick={() => onNavigate(href)}
      className={cx(
        'grid size-[52px] place-items-center rounded-full transition',
        active ? 'glass-lens text-fg' : 'text-muted hover:text-fg',
      )}
    >
      {children}
    </button>
  )
}
