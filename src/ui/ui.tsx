import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'wouter'
import { IconAlert, IconBack, IconChevron } from './icons.tsx'
import { cx } from './style.ts'

export function Page({
  title,
  eyebrow,
  subtitle,
  back,
  actions,
  children,
}: {
  title: string
  /** Small line above the title (date, section). */
  eyebrow?: string
  subtitle?: string
  back?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="pt-safe px-5">
        {back && (
          <div className="pt-3">
            <Link
              href={back}
              className="-ml-1 inline-grid size-11 place-items-center rounded-full bg-surface text-fg"
              aria-label="Zurück"
            >
              <IconBack size={20} />
            </Link>
          </div>
        )}
        <div className={cx('flex items-end gap-3 pb-1', back ? 'pt-3' : 'pt-8 md:pt-10')}>
          <div className="min-w-0 flex-1">
            {eyebrow && <p className="truncate text-sm font-semibold text-muted">{eyebrow}</p>}
            <h1 className="truncate text-[30px] leading-tight font-extrabold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-0.5 truncate text-sm font-medium text-muted">{subtitle}</p>}
          </div>
          {actions}
        </div>
      </header>
      <div className="px-4 pt-4 pb-36 md:pb-12">{children}</div>
    </div>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** 'plain' sets no colors, for buttons tinted by the caller (e.g. per plan type). */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'plain'
  size?: 'md' | 'lg' | 'sm'
}

export function Button({ variant = 'secondary', size = 'md', className, ...rest }: ButtonProps) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full font-bold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40',
        size === 'lg' && 'min-h-14 px-6 text-base',
        size === 'md' && 'min-h-11 px-5 text-[15px]',
        size === 'sm' && 'min-h-9 px-4 text-sm',
        variant === 'primary' && 'bg-accent text-accent-fg',
        variant === 'secondary' && 'bg-surface-2 text-fg',
        variant === 'ghost' && 'text-fg hover:bg-surface-2',
        variant === 'danger' && 'bg-danger-soft text-danger',
        className,
      )}
      {...rest}
    />
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-[22px] bg-surface', className)}>{children}</div>
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-7 mb-3 flex items-baseline justify-between px-1">
      <h2 className="text-base font-extrabold">{children}</h2>
      {action}
    </div>
  )
}

export function Notice({ tone, title, children }: { tone: 'error' | 'warn' | 'info'; title?: string; children: ReactNode }) {
  return (
    <div
      className={cx(
        'rounded-[20px] p-4 text-[15px]',
        tone === 'error' && 'bg-danger-soft',
        tone === 'warn' && 'bg-warn-soft',
        tone === 'info' && 'bg-surface',
      )}
    >
      {title && (
        <div
          className={cx(
            'mb-1 flex items-center gap-2 font-bold',
            tone === 'error' && 'text-danger',
            tone === 'warn' && 'text-warn',
          )}
        >
          {tone !== 'info' && <IconAlert size={18} />}
          {title}
        </div>
      )}
      {children}
    </div>
  )
}

export function MenuLink({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string
  icon: ReactNode
  title: string
  subtitle?: string
}) {
  return (
    <Link href={href} className="flex min-h-16 items-center gap-3 rounded-[20px] bg-surface px-3.5 py-3 transition active:scale-[0.99]">
      <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-surface-2 text-fg">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{title}</span>
        {subtitle && <span className="block truncate text-sm font-medium text-muted">{subtitle}</span>}
      </span>
      <IconChevron size={18} className="text-muted" />
    </Link>
  )
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold',
        className ?? 'bg-surface-2 text-muted',
      )}
    >
      {children}
    </span>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-full bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-10 flex-1 rounded-full px-3 text-sm font-bold transition',
            o.value === value ? 'shadow-soft bg-surface text-fg' : 'text-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Small rounded square with initials or a label, used to mark exercises and days. */
export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'grid size-10 shrink-0 place-items-center rounded-[14px] text-[13px] font-extrabold',
        className ?? 'bg-surface-2 text-fg',
      )}
    >
      {children}
    </span>
  )
}

/** Circular progress, e.g. trained days of the current week. */
export function ProgressRing({
  value,
  max,
  size = 56,
  className,
  label,
}: {
  value: number
  max: number
  size?: number
  className?: string
  label: string
}) {
  const stroke = 6
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const share = max > 0 ? Math.min(value / max, 1) : 0
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        {share > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * share} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className={className}
          />
        )}
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[13px] font-extrabold tabular">
        {value}/{max}
      </span>
    </div>
  )
}

/** Shared look for text inputs and textareas. */
export const fieldClass =
  'w-full rounded-[18px] bg-surface px-4 text-[15px] font-medium outline-none ring-accent/60 placeholder:text-muted/70 focus:ring-2'
