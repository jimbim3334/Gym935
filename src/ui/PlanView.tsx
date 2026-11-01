import {
  CARDIO_LABELS,
  exerciseInitials,
  formatCardio,
  formatRest,
  formatSetGroup,
  SET_TYPE_LABELS,
  summarizeSets,
  workingSetCount,
} from '../plan/format.ts'
import { dayMeta, groupSupersets, type DayData } from '../plan/days.ts'
import type { CardioItemData, ExerciseItemData, PlanData, WeekData } from '../plan/schema.ts'
import { IconCheck, IconChevron, IconPlay } from './icons.tsx'
import { cx, TYPE_STYLES } from './style.ts'
import { Badge, Button, Pill } from './ui.tsx'

type NameFor = (item: ExerciseItemData) => string
type Day = DayData

const defaultName: NameFor = (item) => item.exercise ?? item.exercise_id ?? '?'

export function WeekHeader({ week }: { week: WeekData }) {
  if (!week.notes) return null
  return <p className="mb-3 px-1 text-sm font-medium text-muted">{week.notes}</p>
}

/** Compact cards for a day's exercises: badge, name, one-line summary. */
export function ExerciseCards({ plan, day, nameFor = defaultName }: { plan: PlanData; day: Day; nameFor?: NameFor }) {
  const style = TYPE_STYLES[plan.type]
  if (plan.type === 'cardio') {
    return (
      <div className="flex flex-col gap-2">
        {(day.items as CardioItemData[]).map((c, i) => (
          <div key={i} className="flex items-center gap-3 rounded-[20px] bg-surface px-3.5 py-3">
            <Badge className={i === 0 ? `${style.soft} ${style.text}` : undefined}>{CARDIO_LABELS[c.modality].slice(0, 2)}</Badge>
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{c.name ?? CARDIO_LABELS[c.modality]}</div>
              <div className="truncate text-sm font-medium text-muted">{formatCardio(c).join(' · ')}</div>
            </div>
          </div>
        ))}
      </div>
    )
  }
  const groups = groupSupersets(day.items as ExerciseItemData[])
  return (
    <div className="flex flex-col gap-2">
      {groups.map((g, i) => {
        const superset = g.label && g.items.length > 1
        const name = superset ? g.items.map(nameFor).join(' + ') : nameFor(g.items[0])
        const summary = superset
          ? `Supersatz · ${g.items.map((it) => workingSetCount(it)).join(' + ')} Sätze`
          : summarizeSets(g.items[0])
        return (
          <div key={i} className="flex items-center gap-3 rounded-[20px] bg-surface px-3.5 py-3">
            <Badge className={i === 0 ? `${style.soft} ${style.text}` : undefined}>
              {superset ? g.label : exerciseInitials(name)}
            </Badge>
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{name}</div>
              <div className="truncate text-sm font-medium text-muted tabular">{summary}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ExerciseDetail({ item, name }: { item: ExerciseItemData; name: string }) {
  const rest = item.rest_seconds
  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-bold">{name}</span>
        <span className="shrink-0 text-sm font-semibold text-muted tabular">{workingSetCount(item)} Sätze</span>
      </div>
      <ul className="mt-1 space-y-0.5 text-sm font-medium text-muted">
        {item.sets.map((s, i) => (
          <li key={i} className="tabular">
            {s.type !== 'working' && <span className="mr-1.5 font-bold text-fg/80">{SET_TYPE_LABELS[s.type]}</span>}
            {formatSetGroup(s, item.per_side)}
            {s.notes && <span className="italic"> · {s.notes}</span>}
          </li>
        ))}
      </ul>
      {(rest !== undefined || item.tempo || item.notes) && (
        <p className="mt-1 text-xs font-medium text-muted">
          {[rest !== undefined && `Pause ${formatRest(rest)}`, item.tempo && `Tempo ${item.tempo}`, item.notes]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
    </div>
  )
}

function CardioDetail({ item }: { item: CardioItemData }) {
  return (
    <div className="py-3">
      <div className="font-bold">
        {item.name ?? CARDIO_LABELS[item.modality]}
        {item.name && <span className="font-medium text-muted"> · {CARDIO_LABELS[item.modality]}</span>}
      </div>
      <ul className="mt-1 space-y-0.5 text-sm font-medium text-muted tabular">
        {formatCardio(item).map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      {item.notes && <p className="mt-1 text-xs font-medium text-muted">{item.notes}</p>}
    </div>
  )
}

function DayDetails({ plan, day, nameFor }: { plan: PlanData; day: Day; nameFor: NameFor }) {
  const style = TYPE_STYLES[plan.type]
  return (
    <div className="divide-y divide-line px-4 pb-2">
      {day.notes && <p className="pb-3 text-sm font-medium text-muted">{day.notes}</p>}
      {plan.type === 'cardio'
        ? (day.items as CardioItemData[]).map((item, i) => <CardioDetail key={i} item={item} />)
        : groupSupersets(day.items as ExerciseItemData[]).map((g, gi) =>
            g.label && g.items.length > 1 ? (
              <div key={gi} className="py-2">
                <Pill className={`${style.soft} ${style.text}`}>Supersatz {g.label}</Pill>
                <div className="divide-y divide-line">
                  {g.items.map((item, i) => (
                    <ExerciseDetail key={i} item={item} name={nameFor(item)} />
                  ))}
                </div>
              </div>
            ) : (
              <ExerciseDetail key={gi} item={g.items[0]} name={nameFor(g.items[0])} />
            ),
          )}
    </div>
  )
}

/** A training day as a card that expands to the full prescription. */
export function DayCard({
  plan,
  day,
  index,
  nameFor = defaultName,
  defaultOpen = false,
  done = false,
  onStart,
}: {
  plan: PlanData
  day: Day
  index: number
  nameFor?: NameFor
  defaultOpen?: boolean
  /** Already trained in this week. */
  done?: boolean
  /** Shows a start button inside the card. */
  onStart?: () => void
}) {
  const style = TYPE_STYLES[plan.type]
  return (
    <details open={defaultOpen} className="group mb-2 rounded-[22px] bg-surface">
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-3.5 py-3">
        <Badge className={done ? `${style.soft} ${style.text}` : undefined}>
          {done ? <IconCheck size={18} strokeWidth={2.6} /> : index + 1}
        </Badge>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{day.name}</div>
          <div className="truncate text-sm font-medium text-muted">
            {done ? 'Erledigt · ' : ''}
            {dayMeta(plan, day)}
          </div>
        </div>
        <IconChevron size={18} className="text-muted transition group-open:rotate-90" />
      </summary>
      {onStart && (
        <div className="px-3.5 pb-1">
          <Button size="sm" variant="secondary" onClick={onStart}>
            <IconPlay size={14} /> {done ? 'Nochmal trainieren' : 'Diesen Tag starten'}
          </Button>
        </div>
      )}
      <DayDetails plan={plan} day={day} nameFor={nameFor} />
    </details>
  )
}

export function WeekPicker({
  plan,
  value,
  current,
  onChange,
}: {
  plan: PlanData
  value: number
  current?: number
  onChange: (w: number) => void
}) {
  const weeks = [...plan.weeks].sort((a, b) => a.week - b.week)
  const style = TYPE_STYLES[plan.type]
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {weeks.map((w) => {
        const selected = w.week === value
        return (
          <button
            key={w.week}
            onClick={() => onChange(w.week)}
            aria-pressed={selected}
            className={cx(
              'flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition',
              selected ? 'bg-fg text-bg' : 'bg-surface text-fg',
            )}
          >
            W{w.week}
            {w.deload && <span className={cx('text-xs', selected ? 'opacity-70' : 'text-warn')}>Deload</span>}
            {current === w.week && !selected && <span className={cx('size-1.5 rounded-full bg-current', style.stroke)} aria-label="aktuelle Woche" />}
          </button>
        )
      })}
    </div>
  )
}
