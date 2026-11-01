import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Redirect, useLocation } from 'wouter'
import { db } from '../db/db.ts'
import { alive } from '../db/mutate.ts'
import type { Exercise, SetLog } from '../db/types.ts'
import { num } from '../plan/format.ts'
import type { PlanType } from '../plan/schema.ts'
import type { Recommendation } from '../progress/progression.ts'
import { buildItemModel, pageOrder, pagesOf, type ItemModel, type RowModel } from '../session/model.ts'
import { formatClock, restTimer, useNow, useRestTimer } from '../session/restTimer.ts'
import { restFor, rowTarget } from '../session/rows.ts'
import { discardSession, finishSession, loadHistory, logSet, setExtraSets, swapExercise, unlogSet, type FinishResult } from '../session/session.ts'
import { IconCheck, IconChevronDown, IconMinus, IconPlus, IconSwap, IconTrend } from '../ui/icons.tsx'
import { cx, TYPE_STYLES } from '../ui/style.ts'
import { Button, fieldClass, Sheet } from '../ui/ui.tsx'
import { SwapSheet } from './SwapSheet.tsx'

interface Draft {
  weight?: string
  reps?: string
  rir?: string
}

const parseNum = (s: string | undefined) => {
  if (s === undefined || s.trim() === '') return null
  const n = Number(s.replace(',', '.').trim())
  return Number.isFinite(n) && n >= 0 ? n : null
}

const show = (n: number | null | undefined) => (n === null || n === undefined ? '' : num(n))

export function WorkoutScreen({ id }: { id: string }) {
  const [, navigate] = useLocation()
  const data = useLiveQuery(async () => {
    const session = await db.sessions.get(id)
    if (!session || session.deleted_at) return null
    const [items, logs] = await Promise.all([
      db.session_items.where('session_id').equals(id).toArray(),
      db.set_logs.where('session_id').equals(id).toArray(),
    ])
    const liveItems = alive(items).sort((a, b) => a.position - b.position)
    const ids = [...new Set(liveItems.map((i) => i.exercise_id).filter((x): x is string => !!x))]
    const exercises = new Map((await db.exercises.bulkGet(ids)).filter((e): e is Exercise => !!e).map((e) => [e.id, e]))
    const plan = session.plan_id ? await db.plans.get(session.plan_id) : undefined
    return { session, items: liveItems, logs: alive(logs), exercises, plan, ids }
  }, [id])

  const idsKey = data ? [...data.ids].sort().join(',') : ''
  const history = useLiveQuery(() => (data ? loadHistory(db, data.ids, id) : undefined), [idsKey, id])

  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [page, setPage] = useState<number | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [result, setResult] = useState<FinishResult | null>(null)
  const [swapFor, setSwapFor] = useState<ItemModel | null>(null)
  const rest = useRestTimer()
  const now = useNow(true, 1000)
  // Input elements by row and field, to focus a missing value. Stable across renders.
  const [inputs] = useState(() => new Map<string, HTMLInputElement>())

  const models = useMemo(() => {
    if (!data || !history) return null
    const week = data.plan?.data.weeks.find((w) => w.week === data.session.week)
    return data.items.map((item) =>
      buildItemModel({
        item,
        exercise: item.exercise_id ? (data.exercises.get(item.exercise_id) ?? null) : null,
        logs: data.logs,
        history: item.exercise_id ? (history.get(item.exercise_id) ?? []) : [],
        planId: data.session.plan_id,
        week: data.session.week,
        deload: week?.deload ?? false,
      }),
    )
  }, [data, history])

  if (data === null) return <Redirect to="/strength" replace />
  if (!data || !models) return null
  const { session } = data
  const style = TYPE_STYLES[session.plan_type]
  if (session.finished_at && !result) return <Redirect to={style.path} replace />

  const pages = pagesOf(models)
  const order = pages.map(pageOrder)
  const firstOpenPage = order.findIndex((rows) => rows.some((r) => !r.log))
  const current = Math.min(page ?? (firstOpenPage >= 0 ? firstOpenPage : 0), pages.length - 1)
  const pageModels = pages[current] ?? []
  // Next set: the first open one after the last logged set on this page (skipped warm-ups stay behind).
  const pageRows = order[current] ?? []
  const lastLogged = pageRows.findLastIndex((r) => r.log)
  const nextRow =
    pageRows.find((r, i) => i > lastLogged && !r.log) ?? pageRows.find((r) => !r.log) ?? order.flat().find((r) => !r.log) ?? null
  const totalDone = models.reduce((n, m) => n + m.done, 0)

  const setDraft = (key: string, patch: Draft) => setDrafts((d) => ({ ...d, [key]: { ...d[key], ...patch } }))
  const clearDraft = (key: string) =>
    setDrafts((d) => {
      const next = { ...d }
      delete next[key]
      return next
    })

  const modelOf = (rm: RowModel) => models.find((m) => m.rows.includes(rm))!

  async function toggle(rm: RowModel) {
    const m = modelOf(rm)
    if (rm.log) {
      setDraft(rm.key, { weight: show(rm.log.weight_kg), reps: show(rm.log.reps ?? rm.log.hold_seconds), rir: show(rm.log.rir) })
      await unlogSet(db, rm.log)
      return
    }
    const d = drafts[rm.key] ?? {}
    const weight = parseNum(d.weight) ?? rm.ghost.weight
    const reps = parseNum(d.reps) ?? rm.ghost.reps
    const rir = parseNum(d.rir) ?? rm.ghost.rir
    if (reps === null) {
      inputs.get(`${rm.key}:reps`)?.focus()
      return
    }
    await logSet(db, {
      item: m.item,
      row: rm.row,
      values: rm.hold ? { weight_kg: weight, reps: null, rir, hold_seconds: reps } : { weight_kg: weight, reps, rir },
    })
    clearDraft(rm.key)
    restTimer.start(session.id, restFor(rm.row, m.planned))
  }

  /** Edits to an already logged set are saved when the field loses focus. */
  async function commitEdit(rm: RowModel) {
    const log = rm.log
    const d = drafts[rm.key]
    if (!log || !d) return
    const m = modelOf(rm)
    const weight = d.weight !== undefined ? parseNum(d.weight) : (log.weight_kg ?? null)
    const reps = d.reps !== undefined ? parseNum(d.reps) : (log.reps ?? log.hold_seconds ?? null)
    const rir = d.rir !== undefined ? parseNum(d.rir) : (log.rir ?? null)
    clearDraft(rm.key)
    if (reps === null) return
    await logSet(db, {
      item: m.item,
      row: rm.row,
      existing: log,
      values: rm.hold ? { weight_kg: weight, reps: null, rir, hold_seconds: reps } : { weight_kg: weight, reps, rir },
    })
  }

  const elapsed = formatClock(now - new Date(session.started_at).getTime())
  const restActive = rest?.sessionId === session.id ? rest : null

  return (
    <div className="mx-auto w-full max-w-2xl pb-48">
      <header className="pt-safe sticky top-0 z-20 bg-bg/85 px-4 backdrop-blur-xl">
        <div className="flex items-center gap-2 pt-3 pb-2">
          <button
            onClick={() => navigate(style.path)}
            aria-label="Minimieren"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-surface"
          >
            <IconChevronDown size={20} />
          </button>
          <div className="no-scrollbar flex min-w-0 flex-1 items-center justify-center overflow-x-auto">
            {pages.map((p, i) => {
              const complete = order[i].every((r) => r.log)
              return (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  aria-label={`Übung ${i + 1}: ${p.map((m) => m.exercise?.name ?? m.planned.exercise).join(' + ')}`}
                  aria-current={i === current ? 'step' : undefined}
                  className="grid h-8 shrink-0 place-items-center px-[3px]"
                >
                  <span
                    className={cx(
                      'block h-1.5 rounded-full transition-all',
                      i === current ? 'w-6 bg-accent' : 'w-1.5',
                      i !== current && (complete ? 'bg-accent/45' : 'bg-track'),
                    )}
                  />
                </button>
              )
            })}
          </div>
          <Button size="md" variant="plain" className="shrink-0 bg-surface text-fg" onClick={() => setFinishing(true)}>
            Beenden
          </Button>
        </div>
      </header>

      <div className="px-5 pt-3">
        <p className={cx('text-[13px] font-bold tabular', style.text)}>
          Übung {current + 1} von {pages.length} · {elapsed}
        </p>
        {pageModels.length > 1 && (
          <h1 className="mt-0.5 text-[26px] leading-tight font-extrabold tracking-tight">Supersatz {pageModels[0].item.superset}</h1>
        )}
      </div>

      {pageModels.map((m) => (
        <ExerciseBlock
          key={m.item.id}
          model={m}
          type={session.plan_type}
          heading={pageModels.length > 1 ? 'h2' : 'h1'}
          nextKey={nextRow?.key ?? null}
          drafts={drafts}
          inputs={inputs}
          onDraft={setDraft}
          onToggle={toggle}
          onCommit={commitEdit}
          onSwap={() => setSwapFor(m)}
          onExtra={(n) => setExtraSets(db, m.item, n)}
        />
      ))}

      <div className="mt-6 flex gap-2 px-4">
        <Button variant="plain" className="flex-1 bg-surface text-fg" disabled={current === 0} onClick={() => setPage(current - 1)}>
          Zurück
        </Button>
        {current < pages.length - 1 ? (
          <Button variant="primary" className="flex-1" onClick={() => setPage(current + 1)}>
            Weiter
          </Button>
        ) : (
          <Button variant="primary" className="flex-1" onClick={() => setFinishing(true)}>
            Training beenden
          </Button>
        )}
      </div>

      {restActive && <RestSheet rest={restActive} type={session.plan_type} next={nextRow ? describeNext(models, nextRow) : null} />}

      {swapFor && (
        <SwapSheet
          current={swapFor.exercise}
          plannedId={swapFor.planned.exercise_id ?? null}
          onPick={async (exerciseId) => {
            await swapExercise(db, swapFor.item, exerciseId)
            setSwapFor(null)
          }}
          onClose={() => setSwapFor(null)}
        />
      )}

      {finishing && (
        <FinishSheet
          models={models}
          startedAt={session.started_at}
          now={now}
          totalDone={totalDone}
          result={result}
          onSave={async (notes) => {
            restTimer.stop()
            setResult(await finishSession(db, session.id, notes))
          }}
          onDiscard={async () => {
            restTimer.stop()
            await discardSession(db, session.id)
            navigate(style.path)
          }}
          onDone={() => navigate(style.path)}
          onClose={() => (result ? navigate(style.path) : setFinishing(false))}
        />
      )}
    </div>
  )
}

function describeNext(models: ItemModel[], rm: RowModel) {
  const m = models.find((x) => x.rows.includes(rm))!
  const name = m.exercise?.name ?? m.planned.exercise ?? ''
  const w = rm.ghost.weight ? `${num(rm.ghost.weight)} kg` : null
  const amount = rowTarget(rm.row).replace(/ · (RIR|RPE).*/, '')
  const label = rm.row.type === 'warmup' ? 'Aufwärmsatz' : `Satz ${rm.row.label}`
  return `${name} · ${label}${w ? ` · ${w}` : ''}${amount ? ` × ${amount.replace(/^(Top|Back-off|Aufwärmen) /, '')}` : ''}`
}

function RecommendationCard({ rec, type }: { rec: Recommendation; type: PlanType }) {
  const style = TYPE_STYLES[type]
  const title =
    rec.weight !== null && rec.weight > 0
      ? `Heute ${num(rec.weight)} kg${rec.reps ? ` · Ziel ${rec.reps} Wdh.` : ''}`
      : rec.reps
        ? `Heute: Ziel ${rec.reps} Wdh.`
        : rec.kind === 'new'
          ? 'Gewicht frei wählen'
          : 'Vorgabe'
  return (
    <div className={cx('mx-4 mt-3 flex items-center gap-3.5 rounded-[22px] px-4 py-3.5', style.soft)}>
      <div className={cx('grid size-11 shrink-0 place-items-center rounded-[15px]', style.hero)}>
        <IconTrend size={22} className={cx(rec.kind === 'decrease' && 'scale-y-[-1]', rec.kind === 'hold' && 'rotate-[30deg]')} />
      </div>
      <div className="min-w-0">
        <div className="text-[17px] font-extrabold tabular">{title}</div>
        <div className="text-[13px] font-medium text-muted tabular">{rec.reason}</div>
      </div>
    </div>
  )
}

function ExerciseBlock({
  model,
  type,
  heading,
  nextKey,
  drafts,
  inputs,
  onDraft,
  onToggle,
  onCommit,
  onSwap,
  onExtra,
}: {
  model: ItemModel
  type: PlanType
  heading: 'h1' | 'h2'
  nextKey: string | null
  drafts: Record<string, Draft>
  inputs: Map<string, HTMLInputElement>
  onDraft: (key: string, patch: Draft) => void
  onToggle: (rm: RowModel) => void
  onCommit: (rm: RowModel) => void
  onSwap: () => void
  onExtra: (n: number) => void
}) {
  const { planned, exercise, item } = model
  const name = exercise?.name ?? planned.exercise ?? 'Übung'
  const Heading = heading
  const extra = item.extra_sets ?? 0
  const lastExtra = model.rows.at(-1)
  const canRemove = extra > 0 && lastExtra?.row.extra && !lastExtra.log
  const swapped = item.swapped_from_exercise_id && item.swapped_from_exercise_id !== item.exercise_id
  const notes = [planned.tempo && `Tempo ${planned.tempo}`, planned.notes].filter(Boolean).join(' · ')

  return (
    <section className="mt-3">
      <div className="flex items-start gap-2 px-5">
        <div className="min-w-0 flex-1">
          <Heading className={cx('font-extrabold tracking-tight', heading === 'h1' ? 'text-[26px] leading-tight' : 'mt-2 text-xl')}>
            {name}
          </Heading>
          {(notes || swapped) && (
            <p className="mt-0.5 text-[13px] font-medium text-muted">
              {swapped && <span className="font-bold">Getauscht für {planned.exercise}. </span>}
              {notes}
            </p>
          )}
        </div>
        <button onClick={onSwap} aria-label="Übung tauschen" className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-surface text-muted">
          <IconSwap size={18} />
        </button>
      </div>

      {model.rec && <RecommendationCard rec={model.rec} type={type} />}

      <div className="mx-4 mt-3 flex flex-col gap-1.5">
        <div className="grid grid-cols-[28px_minmax(0,1fr)_60px_46px_42px_44px] gap-[5px] px-2 text-[11px] font-bold text-muted">
          <span />
          <span>Vorgabe</span>
          <span className="text-center">kg</span>
          <span className="text-center">{model.rows.some((r) => r.hold) ? 'Wdh./s' : 'Wdh.'}</span>
          <span className="text-center">RIR</span>
          <span />
        </div>
        {model.rows.map((rm) => (
          <SetRowView
            key={rm.key}
            rm={rm}
            perSide={!!planned.per_side}
            isNext={rm.key === nextKey}
            draft={drafts[rm.key]}
            inputs={inputs}
            onDraft={(p) => onDraft(rm.key, p)}
            onToggle={() => onToggle(rm)}
            onCommit={() => onCommit(rm)}
          />
        ))}
        {model.advice && (
          <p className={cx('px-2.5 pt-1 text-xs font-bold tabular', TYPE_STYLES[type].text)}>{model.advice.message}</p>
        )}
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="ghost" onClick={() => onExtra(extra + 1)}>
            <IconPlus size={16} /> Satz
          </Button>
          {canRemove && (
            <Button size="sm" variant="ghost" onClick={() => onExtra(extra - 1)}>
              <IconMinus size={16} /> Satz
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}

function SetRowView({
  rm,
  perSide,
  isNext,
  draft,
  inputs,
  onDraft,
  onToggle,
  onCommit,
}: {
  rm: RowModel
  perSide: boolean
  isNext: boolean
  draft: Draft | undefined
  inputs: Map<string, HTMLInputElement>
  onDraft: (p: Draft) => void
  onToggle: () => void
  onCommit: () => void
}) {
  const { log, ghost, row } = rm
  const done = !!log
  const warmup = row.type === 'warmup'
  const value = (field: keyof Draft, fromLog: number | null | undefined) => draft?.[field] ?? (done ? show(fromLog) : '')

  const field = (f: keyof Draft, placeholder: number | null, logged: number | null | undefined, label: string, mode: 'decimal' | 'numeric') => (
    <input
      ref={(el) => {
        if (el) inputs.set(`${rm.key}:${f}`, el)
        else inputs.delete(`${rm.key}:${f}`)
      }}
      inputMode={mode}
      enterKeyHint="done"
      autoComplete="off"
      aria-label={`${label} Satz ${row.label}`}
      value={value(f, logged)}
      placeholder={placeholder === null ? (f === 'rir' && warmup ? '–' : '') : show(placeholder)}
      onChange={(e) => onDraft({ [f]: e.target.value })}
      onFocus={(e) => e.target.select()}
      onBlur={done ? onCommit : undefined}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className={cx(
        'set-input h-11 w-full min-w-0 rounded-[14px] bg-surface-2 text-center text-base font-extrabold tabular outline-none focus:ring-2 focus:ring-accent/60',
      )}
    />
  )

  return (
    <div
      className={cx(
        'grid grid-cols-[28px_minmax(0,1fr)_60px_46px_42px_44px] items-center gap-x-[5px] gap-y-1 rounded-[20px] bg-surface py-1.5 pr-1.5 pl-2 transition',
        isNext && 'ring-[1.5px] ring-accent',
      )}
    >
      <span
        className={cx(
          'grid size-7 place-items-center rounded-[10px] text-xs font-extrabold',
          done ? 'bg-accent-soft text-fg' : isNext ? 'bg-fg text-bg' : 'bg-surface-2 text-muted',
        )}
      >
        {row.label}
      </span>
      <div className="line-clamp-2 min-w-0 text-xs leading-tight font-semibold text-muted">{rowTarget(row, perSide)}</div>
      {field('weight', ghost.weight, log?.weight_kg, 'Gewicht', 'decimal')}
      {field('reps', ghost.reps, log?.reps ?? log?.hold_seconds, rm.hold ? 'Sekunden' : 'Wiederholungen', 'numeric')}
      {field('rir', ghost.rir, log?.rir, 'RIR', 'decimal')}
      <button
        onClick={onToggle}
        aria-label={done ? `Satz ${row.label} wieder öffnen` : `Satz ${row.label} abhaken`}
        aria-pressed={done}
        className={cx(
          'grid size-11 place-items-center rounded-full transition active:scale-95',
          done ? 'bg-accent text-accent-fg' : isNext ? 'bg-surface-2 text-fg' : 'bg-surface-2 text-muted',
        )}
      >
        <IconCheck size={20} strokeWidth={2.8} />
      </button>
      {rm.last && (
        <div className="col-span-5 col-start-2 -mt-0.5 pb-0.5 text-[11px] font-semibold text-muted tabular">Zuletzt {rm.last}</div>
      )}
    </div>
  )
}

function RestSheet({ rest, type, next }: { rest: { startedAt: number; endsAt: number }; type: PlanType; next: string | null }) {
  const now = useNow(true, 200)
  const style = TYPE_STYLES[type]
  const total = rest.endsAt - rest.startedAt
  const left = rest.endsAt - now
  const over = left <= 0
  const share = over ? 1 : Math.min(1, Math.max(0, left / total))
  const r = 27
  const c = 2 * Math.PI * r
  return (
    <div className="pb-safe fixed inset-x-0 bottom-0 z-30 flex justify-center px-3">
      <div
        role="timer"
        aria-live="off"
        className={cx(
          'mb-3 flex w-full max-w-md items-center gap-3.5 rounded-[28px] py-3.5 pr-3 pl-3.5 shadow-soft',
          style.hero,
          over && 'rest-done',
        )}
      >
        <div className="relative size-16 shrink-0">
          <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
            <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="6" />
            <circle
              cx="32"
              cy="32"
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${c * share} ${c}`}
              transform="rotate(-90 32 32)"
            />
          </svg>
          <span className="absolute inset-0 grid place-items-center text-[15px] font-extrabold tabular">
            {over ? `+${formatClock(-left)}` : formatClock(left)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-extrabold">{over ? 'Pause vorbei' : 'Pause'}</div>
          {next && <div className={cx('line-clamp-2 text-xs font-semibold', style.heroMuted)}>Danach: {next}</div>}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          {!over && (
            <button onClick={() => restTimer.extend(15)} className={cx('h-9 rounded-full px-3 text-[13px] font-bold', style.heroChip)}>
              +15 s
            </button>
          )}
          <button onClick={() => restTimer.stop()} className={cx('h-9 rounded-full px-3 text-[13px] font-bold', style.heroChip)}>
            {over ? 'OK' : 'Skip'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FinishSheet({
  models,
  startedAt,
  now,
  totalDone,
  result,
  onSave,
  onDiscard,
  onDone,
  onClose,
}: {
  models: ItemModel[]
  startedAt: string
  now: number
  totalDone: number
  result: FinishResult | null
  onSave: (notes: string) => Promise<void>
  onDiscard: () => Promise<void>
  onDone: () => void
  onClose: () => void
}) {
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const logs = models.flatMap((m) => m.rows.map((r) => r.log).filter((l): l is SetLog => !!l))
  const working = logs.filter((l) => l.set_type !== 'warmup')
  const volume = working.reduce((n, l) => n + (l.weight_kg ?? 0) * (l.reps ?? 0), 0)
  const planned = models.reduce((n, m) => n + m.rows.filter((r) => r.row.type !== 'warmup').length, 0)
  const minutes = Math.round((now - new Date(startedAt).getTime()) / 60000)

  if (result) {
    return (
      <Sheet title="Training gespeichert" onClose={onClose}>
        <div className="rounded-[22px] bg-surface p-5">
          <p className="text-2xl font-extrabold tracking-tight">Stark gemacht.</p>
          <p className="mt-1 text-[15px] font-medium text-muted">
            {result.planComplete
              ? 'Das war der letzte Tag des Plans. Zeit für den nächsten Block.'
              : result.advancedTo
                ? `Woche geschafft. Weiter geht es mit Woche ${result.advancedTo}.`
                : 'Der nächste Tag wartet schon im Plan.'}
          </p>
        </div>
        <Stats minutes={minutes} sets={working.length} volume={volume} />
        <Button variant="primary" size="lg" className="mt-4 w-full" onClick={onDone}>
          Fertig
        </Button>
      </Sheet>
    )
  }

  return (
    <Sheet title="Training beenden" onClose={onClose}>
      <Stats minutes={minutes} sets={working.length} volume={volume} planned={planned} />
      {totalDone === 0 ? (
        <p className="mt-4 px-1 text-[15px] font-medium text-muted">Noch kein Satz geloggt. Du kannst weitertrainieren oder das Training verwerfen.</p>
      ) : (
        <>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notiz zum Training (optional)"
            rows={3}
            className={`${fieldClass} mt-4 py-3`}
          />
          <Button
            variant="primary"
            size="lg"
            className="mt-3 w-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await onSave(notes)
              setBusy(false)
            }}
          >
            Training speichern
          </Button>
        </>
      )}
      <Button size="lg" variant="plain" className="mt-2 w-full bg-surface text-fg" onClick={onClose}>
        Weitertrainieren
      </Button>
      <Button
        variant="plain"
        className="mt-2 w-full text-danger"
        disabled={busy}
        onClick={async () => {
          if (totalDone > 0 && !window.confirm('Training mit allen geloggten Sätzen löschen?')) return
          setBusy(true)
          await onDiscard()
        }}
      >
        Training verwerfen
      </Button>
    </Sheet>
  )
}

function Stats({ minutes, sets, volume, planned }: { minutes: number; sets: number; volume: number; planned?: number }) {
  const cells = [
    { label: 'Dauer', value: `${minutes} min` },
    { label: 'Sätze', value: planned ? `${sets} / ${planned}` : String(sets) },
    { label: 'Volumen', value: `${num(Math.round(volume))} kg` },
  ]
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {cells.map((c) => (
        <div key={c.label} className="rounded-[20px] bg-surface px-3 py-3">
          <div className="text-xs font-bold text-muted">{c.label}</div>
          <div className="mt-0.5 text-lg font-extrabold tabular">{c.value}</div>
        </div>
      ))}
    </div>
  )
}
