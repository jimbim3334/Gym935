# Plan-Format, Version 1

Mit diesem JSON-Format kommen Trainingspläne in die App. Es ist so gebaut, dass eine KI es zuverlässig
erzeugen kann und du es als Mensch noch lesen kannst.

- **Maschinenlesbar:** [`plan-schema.json`](plan-schema.json) (JSON Schema, Draft 2020-12, generiert aus `src/plan/schema.ts`)
- **Prompt-Vorlagen:** [`PLAN_PROMPT.md`](PLAN_PROMPT.md), oder in der App unter **Mehr → KI-Prompt kopieren**
- **Vollständige Beispiele:** [`examples/strength.json`](examples/strength.json), [`examples/cardio.json`](examples/cardio.json), [`examples/rehab.json`](examples/rehab.json)

## Grundprinzipien

1. **Ein Plan hat einen Typ:** `strength` (Kraft), `cardio` oder `rehab` (Reha/Mobility). In der App hat jeder
   Typ seinen eigenen Tab und seinen eigenen aktiven Plan.
2. **Alles ist ausgeschrieben:** Wochen → Tage → Einträge → Satzgruppen. Jede Woche steht vollständig im Plan,
   auch wenn sie der Vorwoche ähnelt. So bleibt die wochenweise Periodisierung explizit.
3. **Plan und Historie sind getrennt:** Ein Import legt eine neue Planversion an. Bereits geloggte Einheiten
   behalten ihre damaligen Zielwerte als Snapshot und ändern sich nie.
4. **Kurzform für gleiche Sätze:** `{ "count": 3, "reps": "8-10", "rir": 2 }` statt dreimal dasselbe Objekt.

## Oberste Ebene

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `format_version` | ja | Immer `1` |
| `type` | ja | `"strength"`, `"cardio"` oder `"rehab"` |
| `name` | ja | Planname, max. 80 Zeichen. Gleicher Name und Typ beim erneuten Import ergeben die nächste Version |
| `duration_weeks` | ja | Anzahl Wochen, muss der Länge von `weeks` entsprechen |
| `days_per_week` | ja | Trainingstage pro Woche (1–7) |
| `goal`, `description`, `notes`, `created_by` | nein | Freitext |
| `exercise_definitions` | nein | Nur `strength`/`rehab`: Übungen, die noch nicht im Katalog stehen (siehe unten) |
| `weeks` | ja | Liste der Wochen |

## Woche

```json
{ "week": 3, "label": "Deload", "notes": "Gewichte etwa 10 % runter", "deload": true, "days": [ ... ] }
```

- `week`: lückenlos nummeriert ab 1
- `label`, `notes`: z. B. „Intensität hoch“, „Technikwoche“
- `deload`: markiert Entlastungswochen. Dort wird nicht gewarnt, wenn weniger Tage als `days_per_week` geplant sind

## Tag

```json
{ "key": "upper-a", "name": "Oberkörper A", "notes": "optional", "items": [ ... ] }
```

- `key` ist der **stabile Schlüssel** eines Trainingstags und in jeder Woche gleich. Darüber erkennt die App,
  welcher Tag erledigt ist, und vergleicht „Oberkörper A“ von Woche 1 mit Woche 2.
- Die Reihenfolge in `days` ist die Trainingsreihenfolge. Die App schlägt immer den nächsten offenen Tag
  der aktuellen Woche vor. An feste Wochentage ist ein Tag nicht gebunden.

## Übung (`strength` und `rehab`)

```json
{
  "exercise": "Barbell Bench Press",
  "exercise_id": "barbell-bench-press",
  "superset": "A",
  "per_side": false,
  "rest_seconds": 180,
  "tempo": "3-1-1-0",
  "notes": "Kurze Pause auf der Brust",
  "sets": [ ... ]
}
```

| Feld | Bedeutung |
|---|---|
| `exercise` | Übungsname. Beim Import wird er mit dem Katalog abgeglichen |
| `exercise_id` | Optional, Katalog-ID. Mindestens eines von `exercise` / `exercise_id` ist Pflicht |
| `superset` | Gleiches Label bei **direkt aufeinanderfolgenden** Übungen ergibt einen Supersatz |
| `per_side` | Links und rechts werden getrennt geloggt (einseitige Übungen, Reha) |
| `rest_seconds` | Standardpause nach jedem Satz dieser Übung |
| `tempo`, `notes` | Freitext |
| `sets` | Satzgruppen, in Ausführungsreihenfolge |

### Satzgruppe

| Feld | Standard | Bedeutung |
|---|---|---|
| `count` | `1` | Anzahl gleicher Sätze |
| `type` | `"working"` | `"warmup"`, `"working"`, `"top"` oder `"backoff"` |
| `reps` | – | `8`, `"6-8"` oder `"AMRAP"` |
| `hold_seconds` | – | Haltezeit statt Wiederholungen. Eines von `reps` / `hold_seconds` ist Pflicht |
| `rir` | – | Reps in Reserve: `2` oder `"1-2"` |
| `rpe` | – | Alternativ oder zusätzlich: `8` oder `"7-8"`. Die App warnt, wenn RIR und RPE nicht zusammenpassen (RPE ≈ 10 − RIR) |
| `load` | – | Lastvorgabe (siehe unten) |
| `rest_seconds` | Wert der Übung | Pause für genau diese Sätze, z. B. kürzer bei Aufwärmsätzen |
| `notes` | – | z. B. „Rotes Band“ |

### Lastvorgaben (`load`)

Lastvorgaben sind optional. Ohne Angabe schlägt die App das Gewicht anhand deiner Historie vor
(Progressionsmodell ab Phase 2).

| Form | Beispiel | Bedeutung |
|---|---|---|
| Absolut | `{ "type": "kg", "kg": 100 }` | 100 kg |
| % vom 1RM | `{ "type": "percent_1rm", "percent": 75 }` | 75 % vom geschätzten 1RM aus deiner Historie |
| Relativ | `{ "type": "relative", "change_kg": 2.5 }` | Tatsächlich gehobene Last der Vorwoche + 2,5 kg |
| Relativ in % | `{ "type": "relative", "change_percent": -10 }` | Vorwoche − 10 % (z. B. Deload) |
| Relativ zur letzten Einheit | `{ "type": "relative", "change_kg": 2.5, "reference": "last_session" }` | Bezugspunkt ist die letzte Einheit statt der Vorwoche |
| Back-off | `{ "type": "percent_top_set", "percent": 85 }` | 85 % vom heutigen Top-Satz. Braucht vorher eine Satzgruppe mit `"type": "top"` |

„Relativ“ bezieht sich immer auf das, was du **tatsächlich gehoben** hast, nicht auf den Planwert. Gibt es noch
keine Historie, zeigt die App nur die Vorgabe an.

### Top-Satz mit Back-off-Sätzen und Aufwärmen

```json
"sets": [
  { "type": "warmup", "count": 2, "reps": 5, "load": { "type": "percent_1rm", "percent": 50 }, "rest_seconds": 60 },
  { "type": "top", "reps": "5-6", "rir": 1 },
  { "type": "backoff", "count": 2, "reps": "8-10", "rir": 2, "load": { "type": "percent_top_set", "percent": 85 } }
]
```

## Cardio-Einheit (`cardio`)

```json
{
  "modality": "bike",
  "name": "VO2max-Intervalle",
  "duration_min": 45,
  "distance_km": 20,
  "intensity": { "hr_zone": 2 },
  "warmup_min": 10,
  "intervals": [
    {
      "repeats": 5,
      "work": { "duration_sec": 180, "intensity": { "hr_zone": 4, "rpe": 8 } },
      "recover": { "duration_sec": 120, "intensity": { "hr_zone": 1 } }
    }
  ],
  "cooldown_min": 5,
  "notes": "Trittfrequenz > 90"
}
```

- `modality`: `run`, `bike`, `row`, `elliptical`, `swim`, `walk`, `stairs`, `ski_erg`, `other`
- Mindestens eines von `duration_min`, `distance_km` oder `intervals` ist Pflicht
- `intensity`: beliebige Kombination aus `hr_zone` (1–5), `hr_min`/`hr_max` (bpm), `rpe`, `pace_per_km`
  (`"5:30"` oder `"5:30-6:00"`), `watts` und `description`
- Intervallblöcke: `work` und optional `recover`, jeweils mit `duration_sec` oder `distance_m`. Jede
  Wiederholung lässt sich in der App einzeln abhaken

## Reha / Mobility (`rehab`)

Gleiches Format wie Kraft. Typisch sind:

- `per_side: true` für links und rechts getrennt
- `hold_seconds` für isometrische Übungen und Dehnungen
- `notes` an der Satzgruppe für die Bandstärke

Die Schmerz- bzw. Gefühlsskala (0–10) gehört nicht zum Plan. Du loggst sie pro Einheit in der App.

## Übungsabgleich beim Import

Beim Import wird jede Übung in dieser Reihenfolge aufgelöst:

1. `exercise_id` ist im Katalog → fertig
2. `exercise` entspricht exakt einem Katalognamen oder einem bekannten Alias (z. B. „Bankdrücken“, „DB RDL“).
   Groß-/Kleinschreibung, Umlaute, Bindestriche und gängige Abkürzungen (DB, BB, RDL, OHP …) spielen keine Rolle → fertig
3. Sonst **fragt die App nach**: „Ist ‚Incline DB Chest Press‘ = ‚Incline Dumbbell Bench Press‘?“. Sie zeigt die
   ähnlichsten Katalogeinträge an. Alternativ legst du eine neue Übung an. Steht die Übung in
   `exercise_definitions`, sind Muskeln und Equipment schon vorausgefüllt.

Deine Bestätigung speichert die App als Alias. Dieselbe Frage kommt beim nächsten Import nicht wieder.

### `exercise_definitions`

```json
"exercise_definitions": [
  {
    "name": "Landmine Press",
    "primary_muscles": ["front_delts", "chest"],
    "secondary_muscles": ["triceps"],
    "equipment": "barbell",
    "mechanic": "compound",
    "load_increment_kg": 2.5
  }
]
```

- Muskeln: `chest`, `front_delts`, `side_delts`, `rear_delts`, `lats`, `upper_back`, `traps`, `lower_back`,
  `rotator_cuff`, `biceps`, `triceps`, `forearms`, `abs`, `obliques`, `hip_flexors`, `glutes`, `quads`,
  `hamstrings`, `adductors`, `abductors`, `calves`, `tibialis`, `neck`
- Equipment: `barbell`, `dumbbell`, `machine` (Steckgewicht), `plate_machine` (Scheiben), `smith_machine`, `cable`,
  `bodyweight`, `kettlebell`, `band`, `ez_bar`, `trap_bar`, `other`
- `mechanic`: `compound` (Grundübung) oder `isolation`. Das Progressionsmodell behandelt beide unterschiedlich
- `load_increment_kg`: kleinster Gewichtssprung. Ohne Angabe gilt der Standard des Equipments
  (z. B. Langhantel 2,5 kg, Kurzhantel 2 kg, Steckgewicht-Maschine 5 kg)

## Validierung

Die App prüft in dieser Reihenfolge:

1. **JSON-Syntax:** Fehler mit Zeile und Spalte. Markdown-Codeblöcke (```` ```json ````) und typografische
   Anführungszeichen aus Chat-Apps werden vorher automatisch entfernt bzw. ersetzt.
2. **Struktur:** Fehler mit Fundort, z. B. `Woche 2 › Tag „Oberkörper“ › Übung 2 „Single Arm Dumbbell Row“ › Satzgruppe 1 › reps`.
   **Unbekannte Felder** (z. B. eine Begründung der KI) sind kein Fehler. Sie werden entfernt und als Warnung angezeigt.
3. **Logik:**
   - **Fehler:** Wochenzahl ≠ `duration_weeks`, Lücken in der Wochennummerierung, doppelte Tages-`key`s,
     Bereiche mit Minimum > Maximum, `percent_top_set` ohne vorherigen Top-Satz
   - **Warnungen:** abweichende Anzahl Trainingstage, Tag aus Woche 1 fehlt in einer späteren Woche,
     Supersatz nicht zusammenhängend, RIR/RPE widersprüchlich, relative Last in Woche 1

## Versionierung

- `format_version` ist die Version **des Formats**. Änderungen, die alte Pläne unlesbar machen, erhöhen sie.
  Die App lehnt unbekannte Versionen mit einer klaren Meldung ab.
- Die **Planversion** vergibt die App selbst. Importierst du einen Plan mit gleichem `name` und `type` erneut,
  wird er als nächste Version gespeichert und aktiv. Die alte Version und alle damit geloggten Einheiten bleiben erhalten.

## Vollständiges Beispiel (Kraft)

Drei Wochen mit zwei Tagen: Aufwärmsätze, Top-Satz mit Back-offs, Supersatz, einseitige Übung, Haltezeit,
alle Lastvorgaben und eine Deload-Woche. Weitere Beispiele liegen im Ordner `examples/`.

```json
{
  "format_version": 1,
  "type": "strength",
  "name": "Upper/Lower Beispielblock",
  "goal": "Hypertrophie mit Kraftfokus bei den Grundübungen",
  "duration_weeks": 3,
  "days_per_week": 2,
  "exercise_definitions": [
    { "name": "Landmine Press", "primary_muscles": ["front_delts", "chest"], "secondary_muscles": ["triceps"], "equipment": "barbell", "mechanic": "compound" }
  ],
  "weeks": [
    {
      "week": 1,
      "label": "Einstieg",
      "notes": "Technik sauber, RIR eher konservativ.",
      "days": [
        {
          "key": "upper",
          "name": "Oberkörper",
          "items": [
            {
              "exercise": "Barbell Bench Press",
              "rest_seconds": 180,
              "sets": [
                { "type": "warmup", "count": 2, "reps": 5, "load": { "type": "percent_1rm", "percent": 50 }, "rest_seconds": 60 },
                { "type": "top", "reps": "5-6", "rir": 2, "load": { "type": "kg", "kg": 90 } },
                { "type": "backoff", "count": 2, "reps": "8-10", "rir": 2, "load": { "type": "percent_top_set", "percent": 85 } }
              ]
            },
            { "exercise": "Single Arm Dumbbell Row", "per_side": true, "rest_seconds": 120, "sets": [{ "count": 3, "reps": "8-12", "rir": 2 }] },
            { "exercise": "Dumbbell Lateral Raise", "superset": "A", "rest_seconds": 60, "sets": [{ "count": 3, "reps": "12-15", "rir": 1 }] },
            { "exercise": "Cable Triceps Pushdown", "superset": "A", "rest_seconds": 90, "sets": [{ "count": 3, "reps": "10-15", "rir": 1 }] }
          ]
        },
        {
          "key": "lower",
          "name": "Unterkörper",
          "items": [
            { "exercise": "Barbell Back Squat", "rest_seconds": 180, "sets": [{ "type": "warmup", "count": 2, "reps": 5 }, { "count": 3, "reps": "6-8", "rir": 2 }] },
            { "exercise": "Romanian Deadlift", "rest_seconds": 150, "sets": [{ "count": 3, "reps": "8-10", "rir": 2 }] },
            { "exercise": "Plank", "sets": [{ "count": 2, "hold_seconds": 45 }] }
          ]
        }
      ]
    },
    {
      "week": 2,
      "label": "Intensität hoch",
      "days": [
        {
          "key": "upper",
          "name": "Oberkörper",
          "items": [
            {
              "exercise": "Barbell Bench Press",
              "rest_seconds": 180,
              "sets": [
                { "type": "top", "reps": "5-6", "rir": 1, "load": { "type": "relative", "change_kg": 2.5 } },
                { "type": "backoff", "count": 2, "reps": "8-10", "rir": 1, "load": { "type": "percent_top_set", "percent": 85 } }
              ]
            },
            { "exercise": "Single Arm Dumbbell Row", "per_side": true, "rest_seconds": 120, "sets": [{ "count": 3, "reps": "8-12", "rir": 1 }] },
            { "exercise": "Landmine Press", "rest_seconds": 120, "sets": [{ "count": 2, "reps": "8-12", "rir": 2 }] }
          ]
        },
        {
          "key": "lower",
          "name": "Unterkörper",
          "items": [
            { "exercise": "Barbell Back Squat", "rest_seconds": 180, "sets": [{ "count": 3, "reps": "6-8", "rir": 1 }] },
            { "exercise": "Romanian Deadlift", "rest_seconds": 150, "sets": [{ "count": 3, "reps": "8-10", "rir": 1 }] },
            { "exercise": "Plank", "sets": [{ "count": 2, "hold_seconds": 60 }] }
          ]
        }
      ]
    },
    {
      "week": 3,
      "label": "Deload",
      "deload": true,
      "days": [
        {
          "key": "upper",
          "name": "Oberkörper",
          "items": [
            { "exercise": "Barbell Bench Press", "sets": [{ "count": 2, "reps": 6, "rir": 4, "load": { "type": "relative", "change_percent": -10 } }] }
          ]
        },
        {
          "key": "lower",
          "name": "Unterkörper",
          "items": [
            { "exercise": "Barbell Back Squat", "sets": [{ "count": 2, "reps": 6, "rir": 4, "load": { "type": "relative", "change_percent": -10 } }] }
          ]
        }
      ]
    }
  ]
}
```
