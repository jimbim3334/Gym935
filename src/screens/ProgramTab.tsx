import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { Link } from 'wouter'
import { db } from '../db/db.ts'
import { putRows } from '../db/mutate.ts'
import { PLAN_TYPE_LABELS } from '../plan/prompt.ts'
import type { PlanType } from '../plan/schema.ts'
import { IconBottle, IconImport, IconKettlebell, IconMobility, IconSparkle } from '../ui/icons.tsx'
import { dayMeta } from '../plan/days.ts'
import { DayCard, ExerciseCards, WeekHeader, WeekPicker } from '../ui/PlanView.tsx'
import { cx, formatToday, TYPE_STYLES } from '../ui/style.ts'
import { Button, Page, ProgressRing, SectionTitle } from '../ui/ui.tsx'

const EMPTY_TEXT: Record<PlanType, string> = {
  strength: 'Noch kein Strength-Plan',
  cardio: 'Noch kein Cardio-Plan',
  rehab: 'Noch kein Mobility-Plan',
}

const TYPE_ICON: Record<PlanType, (p: { size?: number; className?: string }) => ReactNode> = {
  strength: IconKettlebell,
  cardio: IconBottle,
  rehab: IconMobility,
}

const IconPlay = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5.5v13l11-6.5z" />
  </svg>
)

export function ProgramTab({ type }: { type: PlanType }) {
  const plan = useLiveQuery(
    async () => (await db.plans.where('type').equals(type).toArray()).find((p) => p.is_active && !p.deleted_at) ?? null,
    [type],
  )
  const [selected, setSelected] = useState<{ planId: string; week: number } | null>(null)
  const style = TYPE_STYLES[type]
  const TypeIcon = TYPE_ICON[type]

  if (plan === undefined) return <Page title={style.label}>{null}</Page>

  if (plan === null) {
    return (
      <Page title={style.label} eyebrow={formatToday()}>
        <div className={cx('relative overflow-hidden rounded-[28px] p-6', style.hero)}>
          <TypeIcon size={120} className="pointer-events-none absolute -top-4 -right-6 opacity-15" />
          <p className="relative text-2xl font-extrabold tracking-tight">{EMPTY_TEXT[type]}</p>
          <p className={cx('relative mt-1 max-w-sm text-[15px] font-semibold', style.heroMuted)}>
            Lass dir von einer KI einen {PLAN_TYPE_LABELS[type]}-Plan erstellen und füge ihn hier ein.
          </p>
          <div className="relative mt-6 flex flex-col gap-2 sm:flex-row">
            <Link href="/mehr/import" className="flex-1">
              <Button variant="plain" size="lg" className={cx('w-full', style.heroButton)}>
                <IconImport size={20} /> Plan importieren
              </Button>
            </Link>
            <Link href={`/mehr/prompt?type=${type}`} className="flex-1">
              <Button variant="plain" size="lg" className={cx('w-full', style.heroChip)}>
                <IconSparkle size={20} /> KI-Prompt kopieren
              </Button>
            </Link>
          </div>
        </div>
      </Page>
    )
  }

  const weeks = plan.data.weeks
  const currentWeek = weeks.find((w) => w.week === plan.current_week) ?? weeks[0]
  const shownNumber = selected?.planId === plan.id ? selected.week : currentWeek.week
  const shownWeek = weeks.find((w) => w.week === shownNumber) ?? currentWeek
  // Until sessions exist (phase 2) the next open day is the first day of the current week.
  const doneDays = 0
  const nextDay = currentWeek.days[doneDays] ?? currentWeek.days[0]

  return (
    <Page
      title={style.label}
      eyebrow={formatToday()}
      actions={
        <ProgressRing
          value={doneDays}
          max={currentWeek.days.length}
          className={style.stroke}
          label={`Woche ${currentWeek.week}: ${doneDays} von ${currentWeek.days.length} Tagen erledigt`}
        />
      }
    >
      <section className={cx('relative overflow-hidden rounded-[28px] p-5', style.hero)}>
        <TypeIcon size={132} className="pointer-events-none absolute -top-5 -right-7 opacity-15" />
        <div className="relative flex flex-wrap gap-1.5">
          <span className={cx('rounded-full px-3 py-1 text-xs font-bold', style.heroChip)}>
            Woche {currentWeek.week} von {plan.data.duration_weeks}
          </span>
          {currentWeek.label && (
            <span className={cx('rounded-full px-3 py-1 text-xs font-bold', style.heroChip)}>{currentWeek.label}</span>
          )}
          {currentWeek.deload && !currentWeek.label?.toLowerCase().includes('deload') && (
            <span className={cx('rounded-full px-3 py-1 text-xs font-bold', style.heroChip)}>Deload</span>
          )}
        </div>
        <h2 className="relative mt-4 text-[28px] leading-tight font-extrabold tracking-tight">{nextDay.name}</h2>
        <p className={cx('relative mt-0.5 text-sm font-bold', style.heroMuted)}>{dayMeta(plan.data, nextDay)}</p>
        <Button variant="plain" size="lg" disabled className={cx('relative mt-5 w-full disabled:opacity-60', style.heroButton)}>
          <IconPlay /> Training starten
        </Button>
        <p className={cx('relative mt-2 text-center text-xs font-bold', style.heroMuted)}>Loggen kommt in Phase 2</p>
      </section>

      <SectionTitle>{type === 'cardio' ? 'Einheiten' : 'Übungen'}</SectionTitle>
      <ExerciseCards plan={plan.data} day={nextDay} />

      <SectionTitle action={<span className="text-sm font-semibold text-muted">{plan.name} · v{plan.version}</span>}>
        Wochenplan
      </SectionTitle>
      <WeekPicker
        plan={plan.data}
        value={shownWeek.week}
        current={plan.current_week}
        onChange={(w) => setSelected({ planId: plan.id, week: w })}
      />
      <div className="mt-3 mb-2 flex min-h-9 items-center justify-between gap-2 px-1 text-sm font-semibold">
        <span className="text-muted">
          {shownWeek.label ?? `Woche ${shownWeek.week}`}
          {shownWeek.week === plan.current_week && ' · aktuell'}
        </span>
        {shownWeek.week !== plan.current_week && (
          <Button size="sm" variant="ghost" onClick={() => putRows(db, 'plans', [{ ...plan, current_week: shownWeek.week }])}>
            Als aktuelle Woche setzen
          </Button>
        )}
      </div>
      <WeekHeader week={shownWeek} />
      {shownWeek.days.map((d, i) => (
        <DayCard key={`${shownWeek.week}-${d.key}`} plan={plan.data} day={d} index={i} />
      ))}
    </Page>
  )
}
