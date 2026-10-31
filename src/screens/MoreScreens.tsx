import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useSearch } from 'wouter'
import { backupFileName, exportBackup, importBackup, type BackupImportResult } from '../backup/backup.ts'
import { EQUIPMENT_LABELS, MECHANIC_LABELS, MUSCLE_LABELS } from '../catalog/muscles.ts'
import { db } from '../db/db.ts'
import { alive, softDelete } from '../db/mutate.ts'
import type { Plan, SyncTable } from '../db/types.ts'
import { copyText, saveTextFile } from '../lib/files.ts'
import { normalizeName } from '../lib/text.ts'
import { num } from '../plan/format.ts'
import { activatePlan } from '../plan/importPlan.ts'
import { buildPlanPrompt, PLAN_TYPE_LABELS } from '../plan/prompt.ts'
import { PLAN_TYPES, type PlanType } from '../plan/schema.ts'
import { IconBook, IconImport, IconList, IconSave, IconSparkle } from '../ui/icons.tsx'
import { formatDate, TYPE_STYLES } from '../ui/style.ts'
import { Button, Card, fieldClass, MenuLink, Notice, Page, Pill, SectionTitle, Segmented } from '../ui/ui.tsx'

export function MoreScreen() {
  const persisted = useLiveQuery(async () => (await db.meta.get('storage_persisted'))?.value as boolean | undefined, [])
  return (
    <Page title="Mehr">
      <div className="flex flex-col gap-2">
        <MenuLink href="/mehr/import" icon={<IconImport size={22} />} title="Plan importieren" subtitle="JSON einfügen oder Datei wählen" />
        <MenuLink href="/mehr/prompt" icon={<IconSparkle size={22} />} title="KI-Prompt kopieren" subtitle="Damit eine KI Pläne im richtigen Format schreibt" />
        <MenuLink href="/mehr/plaene" icon={<IconList size={22} />} title="Pläne verwalten" subtitle="Aktivieren, exportieren, löschen" />
        <MenuLink href="/mehr/katalog" icon={<IconBook size={22} />} title="Übungskatalog" subtitle="Übungen, Muskeln, Gewichtssprünge" />
        <MenuLink href="/mehr/backup" icon={<IconSave size={22} />} title="Backup" subtitle="Alles als JSON sichern oder einspielen" />
      </div>
      <p className="mt-6 px-1 text-sm text-muted">
        Daten liegen lokal auf diesem Gerät.{' '}
        {persisted === true && 'Der Browser hat dauerhaften Speicher zugesagt.'}
        {persisted === false && 'Tipp: Als App zum Home-Bildschirm hinzufügen, damit iOS die Daten nicht aufräumt.'}
      </p>
    </Page>
  )
}

export function PromptScreen() {
  const params = new URLSearchParams(useSearch())
  const initial = (PLAN_TYPES as readonly string[]).includes(params.get('type') ?? '') ? (params.get('type') as PlanType) : 'strength'
  const [type, setType] = useState<PlanType>(initial)
  const [wishes, setWishes] = useState(() => {
    try {
      return localStorage.getItem('prompt-wishes') ?? ''
    } catch {
      return ''
    }
  })
  const [copied, setCopied] = useState(false)
  const exercises = useLiveQuery(async () => alive(await db.exercises.toArray()), [])

  useEffect(() => {
    try {
      localStorage.setItem('prompt-wishes', wishes)
    } catch {
      // Private mode: the draft is just not remembered.
    }
  }, [wishes])

  const prompt = useMemo(() => {
    const list = (exercises ?? [])
      .filter((e) => (type === 'strength' ? e.kind === 'strength' : true))
      .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === type ? -1 : 1))
      .map((e) => ({ id: e.id, name: e.name }))
    return buildPlanPrompt(type, list, wishes.trim() || undefined)
  }, [exercises, type, wishes])

  async function copy() {
    if (await copyText(prompt)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Page title="KI-Prompt" back="/mehr">
      <Segmented
        value={type}
        onChange={setType}
        options={PLAN_TYPES.map((t) => ({ value: t, label: TYPE_STYLES[t].label }))}
      />
      <label className="mt-4 block">
        <span className="mb-1 block text-sm text-muted">Deine Wünsche (optional, kannst du auch später in der KI ergänzen)</span>
        <textarea
          value={wishes}
          onChange={(e) => setWishes(e.target.value)}
          rows={5}
          placeholder="z. B. 12 Wochen Hypertrophie, 4 Tage Upper/Lower, Fokus Rücken und Schultern, Gym mit Maschinen, Schulter links empfindlich, Deload in Woche 6 und 12"
          className={`${fieldClass} p-4`}
        />
      </label>
      <Button variant="primary" size="lg" className="mt-3 w-full" onClick={copy}>
        {copied ? 'Kopiert ✓' : `${PLAN_TYPE_LABELS[type]}-Prompt kopieren`}
      </Button>
      <p className="mt-2 text-sm text-muted">
        In ChatGPT, Claude o. Ä. einfügen. Die JSON-Antwort dann unter „Plan importieren“ einfügen. Der Prompt enthält
        deinen aktuellen Übungskatalog.
      </p>
      <SectionTitle>Vorschau</SectionTitle>
      <pre className="max-h-96 overflow-auto rounded-[22px] bg-surface p-4 text-xs whitespace-pre-wrap">{prompt}</pre>
    </Page>
  )
}

export function PlansScreen() {
  const plans = useLiveQuery(async () => alive(await db.plans.toArray()).sort((a, b) => b.imported_at.localeCompare(a.imported_at)), [])
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  async function exportPlan(p: Plan) {
    const name = `${p.name.replace(/[^\w\-äöüÄÖÜß ]+/g, '').trim().replace(/\s+/g, '-')}-v${p.version}.json`
    await saveTextFile(name, JSON.stringify(p.data, null, 2))
  }

  return (
    <Page title="Pläne" back="/mehr">
      {plans?.length === 0 && <Notice tone="info">Noch keine Pläne importiert.</Notice>}
      {PLAN_TYPES.map((type) => {
        const list = (plans ?? []).filter((p) => p.type === type)
        if (!list.length) return null
        return (
          <div key={type}>
            <SectionTitle>{PLAN_TYPE_LABELS[type]}</SectionTitle>
            <div className="space-y-2">
              {list.map((p) => (
                <Card key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-extrabold">{p.name}</div>
                      <div className="text-sm text-muted">
                        Version {p.version} · importiert {formatDate(p.imported_at)} · {p.data.duration_weeks} Wochen
                      </div>
                    </div>
                    {p.is_active && <Pill className={`${TYPE_STYLES[type].soft} ${TYPE_STYLES[type].text}`}>Aktiv</Pill>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!p.is_active && (
                      <Button size="sm" variant="primary" onClick={() => activatePlan(db, p)}>
                        Aktivieren
                      </Button>
                    )}
                    <Button size="sm" onClick={() => exportPlan(p)}>
                      Als JSON exportieren
                    </Button>
                    {confirmDelete === p.id ? (
                      <>
                        <Button size="sm" variant="danger" onClick={() => softDelete(db, 'plans', p.id)}>
                          Wirklich löschen
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                          Abbrechen
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(p.id)}>
                        Löschen
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )
      })}
      <p className="mt-6 px-1 text-sm text-muted">Löschen entfernt nur den Plan. Bereits geloggte Trainings bleiben erhalten.</p>
    </Page>
  )
}

export function CatalogScreen() {
  const [query, setQuery] = useState('')
  const data = useLiveQuery(async () => {
    const [exercises, aliases] = await Promise.all([db.exercises.toArray(), db.exercise_aliases.toArray()])
    const byExercise = new Map<string, string[]>()
    for (const a of alive(aliases)) byExercise.set(a.exercise_id, [...(byExercise.get(a.exercise_id) ?? []), a.alias])
    return alive(exercises)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => ({ e, aliases: byExercise.get(e.id) ?? [] }))
  }, [])

  const q = normalizeName(query)
  const list = (data ?? []).filter(
    ({ e, aliases }) =>
      !q ||
      normalizeName(e.name).includes(q) ||
      aliases.some((a) => normalizeName(a).includes(q)) ||
      e.primary_muscles.some((m) => normalizeName(MUSCLE_LABELS[m]).includes(q)),
  )

  return (
    <Page title="Übungskatalog" subtitle={data ? `${data.length} Übungen` : undefined} back="/mehr">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Suchen: Name, deutscher Name oder Muskel"
        className={`${fieldClass} mb-3 min-h-12`}
      />
      <Card className="divide-y divide-line overflow-hidden">
        {list.map(({ e, aliases }) => (
          <details key={e.id} className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-bold">
                  {e.name} {e.is_custom && <Pill>eigene</Pill>}
                </div>
                <div className="truncate text-sm text-muted">
                  {e.primary_muscles.map((m) => MUSCLE_LABELS[m]).join(', ')} · {EQUIPMENT_LABELS[e.equipment]}
                </div>
              </div>
            </summary>
            <div className="space-y-1 px-4 pb-3 text-sm text-muted">
              <div>{MECHANIC_LABELS[e.mechanic]} · Gewichtssprung {num(e.load_increment_kg)} kg{e.assisted ? ' · Gewicht = Unterstützung' : ''}</div>
              {e.secondary_muscles.length > 0 && <div>Neben: {e.secondary_muscles.map((m) => MUSCLE_LABELS[m]).join(', ')}</div>}
              {aliases.length > 0 && <div>Auch: {aliases.join(', ')}</div>}
              <div className="font-mono text-xs opacity-70">{e.id}</div>
            </div>
          </details>
        ))}
        {list.length === 0 && <div className="px-4 py-6 text-center text-muted">Keine Treffer</div>}
      </Card>
    </Page>
  )
}

const TABLE_LABELS: Record<SyncTable, string> = {
  exercises: 'Übungen',
  exercise_aliases: 'Übungsnamen',
  plans: 'Pläne',
  sessions: 'Trainings',
  session_items: 'Trainings-Übungen',
  set_logs: 'Sätze',
}

export function BackupScreen() {
  const lastExport = useLiveQuery(async () => (await db.meta.get('last_backup_export'))?.value as string | undefined, [])
  const counts = useLiveQuery(async () => ({
    plans: alive(await db.plans.toArray()).length,
    sessions: alive(await db.sessions.toArray()).length,
    sets: alive(await db.set_logs.toArray()).length,
  }))
  const [result, setResult] = useState<BackupImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function doExport() {
    setBusy(true)
    try {
      const backup = await exportBackup(db)
      await saveTextFile(backupFileName(), JSON.stringify(backup))
      await db.meta.put({ key: 'last_backup_export', value: backup.exported_at })
    } finally {
      setBusy(false)
    }
  }

  async function doImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setResult(null)
    setBusy(true)
    try {
      setResult(await importBackup(db, JSON.parse(await file.text())))
    } catch (err) {
      setError(err instanceof SyntaxError ? 'Die Datei ist kein gültiges JSON.' : err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title="Backup" back="/mehr">
      <Card className="p-4">
        <h2 className="text-lg font-extrabold">Exportieren</h2>
        <p className="mt-1 text-[15px] text-muted">
          Sichert alle Pläne, Übungen und Trainings als JSON-Datei. Funktioniert unabhängig vom Sync.
          {counts && ` Aktuell: ${counts.plans} Pläne, ${counts.sessions} Trainings, ${counts.sets} Sätze.`}
        </p>
        {lastExport && <p className="mt-1 text-sm text-muted">Letzter Export: {formatDate(lastExport)}</p>}
        <Button variant="primary" className="mt-3 w-full" disabled={busy} onClick={doExport}>
          Backup speichern
        </Button>
      </Card>
      <Card className="mt-3 p-4">
        <h2 className="text-lg font-extrabold">Einspielen</h2>
        <p className="mt-1 text-[15px] text-muted">
          Führt ein Backup mit den Daten auf diesem Gerät zusammen. Bei gleichen Einträgen gewinnt der neuere Stand, es
          wird nichts gelöscht.
        </p>
        <label className="mt-3 inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full bg-surface-2 px-5 text-[15px] font-bold">
          Backup-Datei wählen
          <input type="file" accept=".json,application/json" className="hidden" onChange={doImport} disabled={busy} />
        </label>
        {error && (
          <div className="mt-3">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        {result && (
          <div className="mt-3">
            <Notice tone="info" title="Eingespielt">
              <ul className="text-sm">
                {(Object.keys(result) as SyncTable[]).map((t) => (
                  <li key={t}>
                    {TABLE_LABELS[t]}: {result[t].applied} von {result[t].total} übernommen
                  </li>
                ))}
              </ul>
            </Notice>
          </div>
        )}
      </Card>
    </Page>
  )
}

export function HistoryScreen() {
  return (
    <Page title="Verlauf">
      <Notice tone="info" title="Kommt in Phase 4">
        Hier erscheinen später deine Trainings: Kalender mit Heatmap, Volumen-Chart pro Training und pro Muskelgruppe,
        Übungsverlauf und Rekorde.
      </Notice>
    </Page>
  )
}
