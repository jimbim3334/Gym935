# Training

Persönliche Workout-App als PWA: Pläne werden von einer KI als JSON erzeugt und importiert. Geloggt wird auf dem
iPhone, ausgewertet am Mac. Die Daten liegen lokal (IndexedDB), ab Phase 5 kommt ein Sync über Supabase dazu.

## Entwicklung

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # Unit-Tests (Plan-Format, Abgleich, Import, Backup)
npm run build    # Typecheck + Produktions-Build inkl. Service Worker
npm run docs     # docs/plan-schema.json und docs/PLAN_PROMPT.md neu erzeugen
npm run icons    # PWA-Icons aus public/favicon.svg erzeugen
```

## Plan-Format

- [docs/PLAN_FORMAT.md](docs/PLAN_FORMAT.md): Beschreibung mit vollständigem Beispiel
- [docs/plan-schema.json](docs/plan-schema.json): JSON Schema (generiert aus `src/plan/schema.ts`)
- [docs/PLAN_PROMPT.md](docs/PLAN_PROMPT.md): Prompt-Vorlagen für Kraft, Cardio und Reha
- [docs/examples/](docs/examples): Beispielpläne, die auch in den Tests geprüft werden

## Aufbau

| Ordner | Inhalt |
|---|---|
| `src/plan/` | Format (zod), Validierung mit deutschen Fehlermeldungen, Übungsabgleich, Import, Prompt |
| `src/db/` | Dexie-Schema, Seed, Schreibzugriffe mit `updated_at` und Sync-Queue |
| `src/catalog/` | Muskeln, Equipment, Startkatalog (~125 Übungen, englisch mit deutschen Aliasen) |
| `src/backup/` | Export/Import als JSON, Zusammenführen nach Last-Write-Wins |
| `src/screens/`, `src/ui/` | Oberfläche |

## Datenmodell

Alle synchronisierten Tabellen haben `id` (UUID bzw. stabile Slugs für Katalogübungen), `created_at`, `updated_at`,
`deleted_at` (Soft Delete) und später `user_id`. Plan und Historie sind getrennt: Trainings speichern Planversion
und Zielwerte als Snapshot.

- `exercises`, `exercise_aliases`: Katalog und gemerkte Namenszuordnungen
- `plans`: importierte Pläne (`type` = strength/cardio/rehab, `version`, `is_active`, `current_week`, `data`)
- `sessions`, `session_items`, `set_logs`: geloggte Trainings (ab Phase 2)
- `sync_queue`: lokale Änderungen, die noch hochgeladen werden müssen (ab Phase 5)

## Deployment (Vercel)

1. GitHub-Repo anlegen und diesen Ordner pushen.
2. Auf vercel.com „Add New → Project“ wählen, das Repo importieren. Framework „Vite“ wird erkannt, `vercel.json` ist dabei.
3. Die App auf dem iPhone in Safari öffnen → Teilen → „Zum Home-Bildschirm“.

Bleib bei einer festen Domain (z. B. `dein-projekt.vercel.app`). Die Daten hängen am Origin, und Preview-URLs haben
jeweils eigenen, leeren Speicher.
