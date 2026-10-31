import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import { useLocation } from 'wouter'
import { EQUIPMENT, EQUIPMENT_LABELS, MUSCLE_LABELS, MUSCLES, type Muscle } from '../catalog/muscles.ts'
import { db } from '../db/db.ts'
import { alive } from '../db/mutate.ts'
import type { Exercise } from '../db/types.ts'
import { commitImport } from '../plan/importPlan.ts'
import { buildIndex, collectRefs, refKey, resolveRef, type Decision, type ExerciseRef, type Resolution } from '../plan/match.ts'
import { PLAN_TYPE_LABELS } from '../plan/prompt.ts'
import type { ExerciseDefinitionData, ExercisePlanData, PlanData } from '../plan/schema.ts'
import { validatePlanText, type PlanMessage } from '../plan/validate.ts'
import { IconCheck } from '../ui/icons.tsx'
import { DayCard, WeekHeader, WeekPicker } from '../ui/PlanView.tsx'
import { cx, TYPE_STYLES } from '../ui/style.ts'
import { Button, Card, Notice, Page, Pill, SectionTitle, Segmented } from '../ui/ui.tsx'

interface Question {
  ref: ExerciseRef
  resolution: Extract<Resolution, { status: 'ask' }>
}

/** Per-question UI state; turned into a Decision on confirm. */
interface Answer {
  choice: 'existing' | 'create' | null
  exercise_id?: string
  definition: ExerciseDefinitionData
}

interface Analysis {
  plan: PlanData
  warnings: PlanMessage[]
  refs: ExerciseRef[]
  resolved: Map<string, string>
  questions: Question[]
}

const AUTO_SELECT_SCORE = 0.6

function initialAnswer(q: Question): Answer {
  const [top, second] = q.resolution.candidates
  const definition: ExerciseDefinitionData = q.resolution.definition ?? {
    name: q.ref.label,
    primary_muscles: [],
    secondary_muscles: [],
    equipment: 'machine',
    mechanic: 'isolation',
  }
  // Preselect only a clear winner; the user still sees and confirms it.
  if (top && top.score >= AUTO_SELECT_SCORE && (!second || top.score - second.score >= 0.05)) return { choice: 'existing', exercise_id: top.id, definition }
  if (q.resolution.definition) return { choice: 'create', definition }
  return { choice: null, definition }
}

const answerComplete = (a: Answer) =>
  (a.choice === 'existing' && !!a.exercise_id) ||
  (a.choice === 'create' && a.definition.name.trim().length > 0 && a.definition.primary_muscles.length > 0)

export function ImportScreen() {
  const [, navigate] = useLocation()
  const [text, setText] = useState('')
  const [errors, setErrors] = useState<PlanMessage[]>([])
  const [inputWarnings, setInputWarnings] = useState<PlanMessage[]>([])
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [step, setStep] = useState<'input' | 'match' | 'preview'>('input')
  const [activate, setActivate] = useState(true)
  const [busy, setBusy] = useState(false)
  const [commitError, setCommitError] = useState<string | null>(null)

  const exercises = useLiveQuery(async () => alive(await db.exercises.toArray()).sort((a, b) => a.name.localeCompare(b.name)), [])
  const exerciseById = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises])

  async function check(source = text) {
    setCommitError(null)
    const res = validatePlanText(source)
    setInputWarnings(res.warnings)
    if (!res.ok) {
      setErrors(res.errors)
      setAnalysis(null)
      return
    }
    setErrors([])
    const plan = res.plan
    const resolved = new Map<string, string>()
    const questions: Question[] = []
    let refs: ExerciseRef[] = []
    if (plan.type !== 'cardio') {
      const index = buildIndex(await db.exercises.toArray(), await db.exercise_aliases.toArray())
      refs = collectRefs(plan)
      for (const ref of refs) {
        const r = resolveRef(ref, index, plan.exercise_definitions)
        if (r.status === 'resolved') resolved.set(ref.key, r.exercise_id)
        else questions.push({ ref, resolution: r })
      }
    }
    setAnalysis({ plan, warnings: res.warnings, refs, resolved, questions })
    setAnswers(Object.fromEntries(questions.map((q) => [q.ref.key, initialAnswer(q)])))
    setStep(questions.length ? 'match' : 'preview')
    window.scrollTo({ top: 0 })
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const content = await file.text()
    setText(content)
    await check(content)
  }

  const nameFor = (item: { exercise?: string; exercise_id?: string }) => {
    if (!analysis) return item.exercise ?? '?'
    const key = refKey(item)
    const id = analysis.resolved.get(key)
    if (id) return exerciseById.get(id)?.name ?? item.exercise ?? id
    const a = answers[key]
    if (a?.choice === 'existing' && a.exercise_id) return exerciseById.get(a.exercise_id)?.name ?? a.exercise_id
    if (a?.choice === 'create') return a.definition.name
    return item.exercise ?? item.exercise_id ?? '?'
  }

  async function confirm() {
    if (!analysis) return
    setBusy(true)
    setCommitError(null)
    try {
      const decisions = new Map<string, Decision>()
      for (const q of analysis.questions) {
        const a = answers[q.ref.key]
        if (a.choice === 'existing') decisions.set(q.ref.key, { kind: 'existing', exercise_id: a.exercise_id! })
        else decisions.set(q.ref.key, { kind: 'create', definition: { ...a.definition, name: a.definition.name.trim() } })
      }
      const plan = await commitImport(db, {
        plan: analysis.plan,
        refs: analysis.refs,
        resolved: analysis.resolved,
        decisions,
        activate,
      })
      navigate(activate ? TYPE_STYLES[plan.type].path : '/mehr/plaene')
    } catch (e) {
      setCommitError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (step === 'match' && analysis) {
    const done = analysis.questions.every((q) => answerComplete(answers[q.ref.key]))
    return (
      <Page title="Übungen zuordnen" subtitle={`${analysis.questions.length} von ${analysis.refs.length} Übungen unklar`}
        actions={<Button size="sm" variant="ghost" onClick={() => setStep('input')}>Zurück</Button>}
      >
        <p className="mb-4 text-[15px] text-muted">
          Diese Namen kennt der Katalog noch nicht sicher. Deine Auswahl wird gemerkt, beim nächsten Import fragt die App
          nicht erneut.
        </p>
        {analysis.questions.map((q) => (
          <QuestionCard
            key={q.ref.key}
            question={q}
            answer={answers[q.ref.key]}
            exercises={exercises ?? []}
            exerciseById={exerciseById}
            onChange={(a) => setAnswers((prev) => ({ ...prev, [q.ref.key]: a }))}
          />
        ))}
        <div className="sticky bottom-24 mt-4 md:bottom-4">
          <Button variant="primary" size="lg" className="w-full shadow-lg" disabled={!done} onClick={() => setStep('preview')}>
            Weiter zur Vorschau
          </Button>
        </div>
      </Page>
    )
  }

  if (step === 'preview' && analysis) {
    return (
      <PreviewStep
        analysis={analysis}
        nameFor={nameFor}
        activate={activate}
        setActivate={setActivate}
        busy={busy}
        error={commitError}
        onBack={() => setStep(analysis.questions.length ? 'match' : 'input')}
        onConfirm={confirm}
      />
    )
  }

  return (
    <Page title="Plan importieren" back="/mehr">
      <p className="mb-3 text-[15px] text-muted">
        Füge das JSON aus der KI-Antwort ein oder wähle eine Datei. Codeblöcke und Text rund um das JSON werden ignoriert.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='{ "format_version": 1, "type": "strength", … }'
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className="h-64 w-full resize-y rounded-[22px] bg-surface p-4 font-mono text-sm outline-none ring-accent/60 placeholder:text-muted/70 focus:ring-2"
      />
      <div className="mt-3 flex gap-2">
        <label className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full bg-surface px-5 text-[15px] font-bold">
          Datei wählen
          <input type="file" accept=".json,application/json,text/plain" className="hidden" onChange={onFile} />
        </label>
        <Button variant="primary" className="flex-1" disabled={!text.trim()} onClick={() => check()}>
          Prüfen
        </Button>
      </div>
      {errors.length > 0 && (
        <div className="mt-5">
          <Notice tone="error" title={errors.length === 1 ? '1 Fehler' : `${errors.length} Fehler`}>
            <MessageList messages={errors} />
          </Notice>
        </div>
      )}
      {errors.length > 0 && inputWarnings.length > 0 && (
        <div className="mt-3">
          <Notice tone="warn" title="Hinweise">
            <MessageList messages={inputWarnings} />
          </Notice>
        </div>
      )}
    </Page>
  )
}

function MessageList({ messages }: { messages: PlanMessage[] }) {
  return (
    <ul className="space-y-2">
      {messages.slice(0, 30).map((m, i) => (
        <li key={i}>
          <div className="text-xs font-medium text-muted">{m.where}</div>
          <div>{m.message}</div>
        </li>
      ))}
      {messages.length > 30 && <li className="text-muted">… und {messages.length - 30} weitere</li>}
    </ul>
  )
}

function QuestionCard({
  question,
  answer,
  exercises,
  exerciseById,
  onChange,
}: {
  question: Question
  answer: Answer
  exercises: Exercise[]
  exerciseById: Map<string, Exercise>
  onChange: (a: Answer) => void
}) {
  const { ref, resolution } = question
  const candidateIds = new Set(resolution.candidates.map((c) => c.id))
  const otherSelected = answer.choice === 'existing' && answer.exercise_id && !candidateIds.has(answer.exercise_id)

  return (
    <Card className="mb-3 p-4">
      <div className="mb-3">
        <div className="text-xs font-medium text-muted uppercase">Im Plan{ref.occurrences > 1 ? ` · ${ref.occurrences}×` : ''}</div>
        <div className="text-lg font-semibold">„{ref.label}“</div>
      </div>
      <div className="space-y-2">
        {resolution.candidates.map((c) => {
          const ex = exerciseById.get(c.id)
          const selected = answer.choice === 'existing' && answer.exercise_id === c.id
          return (
            <OptionButton key={c.id} selected={selected} onClick={() => onChange({ ...answer, choice: 'existing', exercise_id: c.id })}>
              <span className="block font-bold">Ist „{c.name}“</span>
              {ex && (
                <span className="block text-sm text-muted">
                  {ex.primary_muscles.map((m) => MUSCLE_LABELS[m]).join(', ')} · {EQUIPMENT_LABELS[ex.equipment]}
                </span>
              )}
            </OptionButton>
          )
        })}
        <select
          value={otherSelected ? answer.exercise_id : ''}
          onChange={(e) => e.target.value && onChange({ ...answer, choice: 'existing', exercise_id: e.target.value })}
          className={cx(
            'min-h-12 w-full rounded-[16px] px-3 text-[15px] font-semibold',
            otherSelected ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface-2',
          )}
        >
          <option value="">Andere Übung aus dem Katalog …</option>
          {exercises.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <OptionButton selected={answer.choice === 'create'} onClick={() => onChange({ ...answer, choice: 'create' })}>
          <span className="block font-bold">Neue Übung anlegen</span>
          <span className="block text-sm text-muted">
            {resolution.definition ? 'Muskeln und Equipment kommen aus dem Plan' : 'Muskeln und Equipment selbst wählen'}
          </span>
        </OptionButton>
        {answer.choice === 'create' && (
          <DefinitionForm value={answer.definition} onChange={(definition) => onChange({ ...answer, definition })} />
        )}
      </div>
    </Card>
  )
}

function OptionButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left transition',
        selected ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface-2',
      )}
    >
      <span
        className={cx(
          'grid size-6 shrink-0 place-items-center rounded-full',
          selected ? 'bg-accent text-accent-fg' : 'bg-surface ring-1 ring-track',
        )}
      >
        {selected && <IconCheck size={14} strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  )
}

function MuscleChips({ value, onChange }: { value: Muscle[]; onChange: (v: Muscle[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {MUSCLES.map((m) => {
        const on = value.includes(m)
        return (
          <button
            key={m}
            onClick={() => onChange(on ? value.filter((x) => x !== m) : [...value, m])}
            className={cx('min-h-9 rounded-full px-3.5 text-sm font-bold', on ? 'bg-accent text-accent-fg' : 'bg-surface text-fg')}
          >
            {MUSCLE_LABELS[m]}
          </button>
        )
      })}
    </div>
  )
}

function DefinitionForm({ value, onChange }: { value: ExerciseDefinitionData; onChange: (v: ExerciseDefinitionData) => void }) {
  return (
    <div className="space-y-4 rounded-[18px] bg-surface-2 p-3.5">
      <label className="block">
        <span className="mb-1 block text-sm text-muted">Name</span>
        <input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          className="min-h-11 w-full rounded-[14px] bg-surface px-3 font-medium"
        />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Equipment</span>
          <select
            value={value.equipment}
            onChange={(e) => onChange({ ...value, equipment: e.target.value as ExerciseDefinitionData['equipment'] })}
            className="min-h-11 w-full rounded-[14px] bg-surface px-3 font-medium"
          >
            {EQUIPMENT.map((e) => (
              <option key={e} value={e}>
                {EQUIPMENT_LABELS[e]}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="mb-1 block text-sm text-muted">Art</span>
          <Segmented
            value={value.mechanic}
            onChange={(mechanic) => onChange({ ...value, mechanic })}
            options={[
              { value: 'compound', label: 'Grundübung' },
              { value: 'isolation', label: 'Isolation' },
            ]}
          />
        </div>
      </div>
      <div>
        <span className="mb-1.5 block text-sm text-muted">Hauptmuskeln (mindestens einer)</span>
        <MuscleChips value={value.primary_muscles} onChange={(primary_muscles) => onChange({ ...value, primary_muscles })} />
      </div>
      <details>
        <summary className="cursor-pointer text-sm text-muted">Nebenmuskeln ({value.secondary_muscles.length})</summary>
        <div className="mt-2">
          <MuscleChips value={value.secondary_muscles} onChange={(secondary_muscles) => onChange({ ...value, secondary_muscles })} />
        </div>
      </details>
    </div>
  )
}

function PreviewStep({
  analysis,
  nameFor,
  activate,
  setActivate,
  busy,
  error,
  onBack,
  onConfirm,
}: {
  analysis: Analysis
  nameFor: (item: { exercise?: string; exercise_id?: string }) => string
  activate: boolean
  setActivate: (v: boolean) => void
  busy: boolean
  error: string | null
  onBack: () => void
  onConfirm: () => void
}) {
  const { plan, warnings } = analysis
  const [week, setWeek] = useState(plan.weeks[0].week)
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [])
  const style = TYPE_STYLES[plan.type]
  const existing = useLiveQuery(
    async () =>
      alive(await db.plans.where('type').equals(plan.type).toArray()).filter(
        (p) => p.name.trim().toLowerCase() === plan.name.trim().toLowerCase(),
      ),
    [plan.type, plan.name],
  )
  const nextVersion = (existing ?? []).reduce((v, p) => Math.max(v, p.version), 0) + 1
  const shown = plan.weeks.find((w) => w.week === week) ?? plan.weeks[0]
  const exerciseCount = plan.type === 'cardio' ? 0 : new Set(collectRefs(plan as ExercisePlanData).map((r) => r.key)).size

  return (
    <Page title="Vorschau" subtitle={plan.name} actions={<Button size="sm" variant="ghost" onClick={onBack}>Zurück</Button>}>
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Pill className={`${style.soft} ${style.text}`}>{PLAN_TYPE_LABELS[plan.type]}</Pill>
          {nextVersion > 1 && <Pill>Wird Version {nextVersion}</Pill>}
        </div>
        <h2 className="mt-2 text-xl font-semibold">{plan.name}</h2>
        {plan.goal && <p className="text-[15px] text-muted">{plan.goal}</p>}
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="Wochen" value={plan.duration_weeks} />
          <Stat label="Tage/Woche" value={plan.days_per_week} />
          <Stat label={plan.type === 'cardio' ? 'Einheiten' : 'Übungen'} value={plan.type === 'cardio' ? plan.weeks.reduce((n, w) => n + w.days.length, 0) : exerciseCount} />
        </dl>
        {plan.description && <p className="mt-3 text-[15px]">{plan.description}</p>}
        {plan.notes && <p className="mt-2 text-sm text-muted">{plan.notes}</p>}
      </Card>

      {warnings.length > 0 && (
        <details className="mt-3 rounded-[20px] bg-warn-soft p-4">
          <summary className="cursor-pointer font-semibold text-warn">
            {warnings.length} {warnings.length === 1 ? 'Hinweis' : 'Hinweise'} (Import trotzdem möglich)
          </summary>
          <div className="mt-3">
            <MessageList messages={warnings} />
          </div>
        </details>
      )}

      <SectionTitle>Wochen</SectionTitle>
      <WeekPicker plan={plan} value={shown.week} onChange={setWeek} />
      <div className="mt-3">
        <WeekHeader week={shown} />
        {shown.days.map((d, i) => (
          <DayCard key={`${shown.week}-${d.key}`} plan={plan} day={d} index={i} nameFor={nameFor} defaultOpen={i === 0} />
        ))}
      </div>

      <div className="shadow-soft sticky bottom-24 mt-4 space-y-2 rounded-[24px] bg-surface p-3 md:bottom-4">
        <label className="flex items-center gap-3 px-1 text-sm">
          <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} className="size-5 accent-[var(--accent)]" />
          Als aktiven {PLAN_TYPE_LABELS[plan.type]}-Plan übernehmen
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        <Button variant="primary" className="w-full" disabled={busy} onClick={onConfirm}>
          {busy ? 'Speichere …' : 'Importieren'}
        </Button>
      </div>
    </Page>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[16px] bg-surface-2 py-2">
      <dd className="text-xl font-semibold tabular">{value}</dd>
      <dt className="text-xs text-muted">{label}</dt>
    </div>
  )
}
