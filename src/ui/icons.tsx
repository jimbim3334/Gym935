import { useId, type SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 24, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  )
}

export const IconStrength = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 10v4M6.5 7.5v9M17.5 7.5v9M21 10v4M6.5 12h11" />
  </Icon>
)

export const IconCardio = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />
  </Icon>
)

export const IconRehab = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="4.5" r="1.8" />
    <path d="M12 7.5v6M12 13.5l-3.5 6.5M12 13.5l3.5 6.5M5.5 10.5c2.2-1.2 4.4-1.8 6.5-1.8s4.3.6 6.5 1.8" />
  </Icon>
)

export const IconHistory = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 19V5M4 19h16M8 15l3.5-4 3 2.5L19 8" />
  </Icon>
)

export const IconMore = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="5.5" cy="12" r="1.3" fill="currentColor" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    <circle cx="18.5" cy="12" r="1.3" fill="currentColor" />
  </Icon>
)

export const IconBack = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
)

export const IconChevron = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 5l7 7-7 7" />
  </Icon>
)

export const IconImport = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14" />
  </Icon>
)

export const IconSparkle = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z" />
    <path d="M18.5 16v4M16.5 18h4" />
  </Icon>
)

export const IconList = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
  </Icon>
)

export const IconBook = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 4.5h11a3 3 0 013 3v12H8a3 3 0 01-3-3z" />
    <path d="M5 16.5a3 3 0 013-3h11" />
  </Icon>
)

export const IconSave = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3v10M8 9.5l4 3.5 4-3.5M4 14v4.5A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5V14" />
  </Icon>
)

export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
)

export const IconAlert = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4l9 16H3z" />
    <path d="M12 10v4M12 17h.01" />
  </Icon>
)

/* Filled glyphs for the three training tabs (kettlebell, bottle, stretching figure).
   Single color via currentColor; cut-outs use a mask so they work on any background. */

type GlyphProps = { size?: number; className?: string }

/** useId() contains characters that are awkward inside url(#…), so strip them. */
const useMaskId = () => `m${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

export function IconKettlebell({ size = 24, className }: GlyphProps) {
  const id = useMaskId()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <mask id={id}>
        <rect width="24" height="24" fill="#fff" />
        <rect x="9.9" y="4.1" width="4.2" height="2.4" rx="0.9" fill="#000" />
        <path d="M8.5 14.1a3.8 3.8 0 0 0 2.3 3.7" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
      </mask>
      <g mask={`url(#${id})`} fill="currentColor">
        <rect x="7.6" y="2" width="8.8" height="6.8" rx="2.4" />
        <circle cx="12" cy="14.6" r="7.4" />
      </g>
    </svg>
  )
}

export function IconBottle({ size = 24, className }: GlyphProps) {
  const id = useMaskId()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <mask id={id}>
        <rect width="24" height="24" fill="#fff" />
        <path d="M12.9 12.5 9.8 17h2.2l-.9 3.5 3.1-4.6H12z" fill="#000" />
      </mask>
      <g mask={`url(#${id})`} fill="currentColor">
        <rect x="10.6" y="1.3" width="2.8" height="2" rx="1" />
        <rect x="8.7" y="2.8" width="6.6" height="3.7" rx="1.7" />
        <rect x="8.1" y="7.4" width="7.8" height="2.4" rx="1.2" />
        <rect x="7.5" y="10.6" width="9" height="11.7" rx="3.2" />
      </g>
    </svg>
  )
}

export function IconMobility({ size = 24, className }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="4.6" r="2.5" fill="currentColor" />
      <path d="M9.6 9.2h4.8l-.4 6.4h-4z" fill="currentColor" />
      <path
        d="M3.3 10.4h17.4M11 15l-3.4 2.6.8 3.6M13 15l3.6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
