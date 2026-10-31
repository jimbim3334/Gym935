import { EQUIPMENT, MUSCLES } from '../catalog/muscles.ts'
import { CARDIO_MODALITIES, type PlanType } from './schema.ts'

export const PLAN_TYPE_LABELS: Record<PlanType, string> = {
  strength: 'Strength',
  cardio: 'Cardio',
  rehab: 'Mobility',
}

const COMMON = `## Ausgabeformat (Version 1)

Antworte ausschließlich mit einem JSON-Objekt, ohne Erklärtext davor oder danach.

Oberste Ebene:
- "format_version": 1
- "type": "{TYPE}"
- "name": Planname (max. 80 Zeichen)
- "goal", "description", "notes", "created_by": optional, Text
- "duration_weeks": Anzahl Wochen (muss der Länge von "weeks" entsprechen)
- "days_per_week": Trainingstage pro Woche
- "weeks": Liste aller Wochen, lückenlos nummeriert ab 1. Jede Woche wird vollständig ausgeschrieben, auch wenn sie der Vorwoche ähnelt.

Woche: { "week": 1, "label": optional (z. B. "Deload", "Intensität hoch"), "notes": optional, "deload": optional true/false, "days": [...] }

Tag: { "key": stabiler Schlüssel, in jeder Woche gleich (z. B. "upper-a"), "name": Anzeigename (z. B. "Oberkörper A"), "notes": optional, "items": [...] }
Die Reihenfolge der Tage ist die Trainingsreihenfolge innerhalb der Woche.`

const EXERCISE_ITEMS = `
Übung (Eintrag in "items"):
- "exercise": Übungsname. Nutze exakt einen Namen aus der Übungsliste unten, wenn es passt.
- "exercise_id": optional, die ID aus der Liste (in Klammern), wenn bekannt
- "superset": optional, gleiches Label (z. B. "A") bei direkt aufeinanderfolgenden Übungen = Supersatz
- "per_side": optional true, wenn links und rechts getrennt ausgeführt werden
- "rest_seconds": Pause nach jedem Satz in Sekunden
- "tempo": optional, z. B. "3-1-1-0"
- "notes": optional, Technikhinweise
- "sets": Liste von Satzgruppen

Satzgruppe:
- "count": Anzahl gleicher Sätze (Standard 1)
- "type": "warmup" | "working" | "top" | "backoff" (Standard "working")
- "reps": Zahl (8), Bereich als Text ("6-8") oder "AMRAP"
- "hold_seconds": Haltezeit statt Wiederholungen (z. B. Plank, Dehnung)
- "rir": Reps in Reserve, Zahl oder Bereich ("1-2"); "rpe" alternativ oder zusätzlich (RPE ≈ 10 − RIR)
- "rest_seconds": optional, überschreibt die Pause der Übung für diese Sätze
- "notes": optional
- "load": optional, eine der Formen
  - { "type": "kg", "kg": 80 }  absolutes Gewicht
  - { "type": "percent_1rm", "percent": 75 }  % vom geschätzten 1RM
  - { "type": "relative", "change_kg": 2.5 }  bzw. { "type": "relative", "change_percent": -10 }  relativ zur tatsächlich gehobenen Last der Vorwoche
  - { "type": "percent_top_set", "percent": 85 }  für Back-off-Sätze nach einem Satz mit "type": "top"
  Ohne "load" schlägt die App das Gewicht anhand der Historie vor. Gib "load" nur an, wenn es für die Periodisierung wichtig ist.

Unterschiedliche Vorgaben pro Satz (z. B. Top-Satz + Back-off) sind mehrere Satzgruppen.
Aufwärmsätze sind Satzgruppen mit "type": "warmup".

Neue Übungen: Wenn eine Übung nicht in der Liste steht, definiere sie zusätzlich in "exercise_definitions" (oberste Ebene):
{ "name": "...", "primary_muscles": [...], "secondary_muscles": [...], "equipment": "...", "mechanic": "compound" | "isolation" }
Muskeln: ${MUSCLES.join(', ')}
Equipment: ${EQUIPMENT.join(', ')}`

const CARDIO_ITEMS = `
Cardio-Einheit (Eintrag in "items"):
- "modality": ${CARDIO_MODALITIES.map((m) => `"${m}"`).join(' | ')}
- "name": optional, z. B. "Dauerlauf"
- "duration_min": Dauer in Minuten
- "distance_km": optional, Distanz
- "intensity": optional { "hr_zone": 1-5, "hr_min"/"hr_max": bpm, "rpe": 1-10, "pace_per_km": "5:30" oder "5:30-6:00", "watts": Zahl, "description": Text }
- "warmup_min", "cooldown_min": optional
- "intervals": optional, Liste von Blöcken { "repeats": 5, "work": { "duration_sec" oder "distance_m", "intensity" }, "recover": { "duration_sec" oder "distance_m", "intensity" } }
- "notes": optional
Mindestens eines von "duration_min", "distance_km" oder "intervals" ist Pflicht.`

const EXAMPLES: Record<PlanType, string> = {
  strength: `{
  "format_version": 1, "type": "strength", "name": "Beispiel", "duration_weeks": 1, "days_per_week": 1,
  "weeks": [{ "week": 1, "days": [{ "key": "upper", "name": "Oberkörper", "items": [
    { "exercise": "Barbell Bench Press", "rest_seconds": 180, "sets": [
      { "type": "warmup", "count": 2, "reps": 5, "load": { "type": "percent_1rm", "percent": 50 } },
      { "type": "top", "reps": "5-6", "rir": 2 },
      { "type": "backoff", "count": 2, "reps": "8-10", "rir": 2, "load": { "type": "percent_top_set", "percent": 85 } } ] },
    { "exercise": "Dumbbell Lateral Raise", "superset": "A", "rest_seconds": 60, "sets": [{ "count": 3, "reps": "12-15", "rir": 1 }] },
    { "exercise": "Cable Triceps Pushdown", "superset": "A", "rest_seconds": 90, "sets": [{ "count": 3, "reps": "10-15", "rir": 1 }] } ] }] }]
}`,
  rehab: `{
  "format_version": 1, "type": "rehab", "name": "Beispiel", "duration_weeks": 1, "days_per_week": 1,
  "weeks": [{ "week": 1, "days": [{ "key": "knee", "name": "Knie", "items": [
    { "exercise": "Spanish Squat", "sets": [{ "count": 5, "hold_seconds": 45, "rest_seconds": 60 }] },
    { "exercise": "Step-Down", "per_side": true, "sets": [{ "count": 3, "reps": "8-10", "rir": 3 }] } ] }] }]
}`,
  cardio: `{
  "format_version": 1, "type": "cardio", "name": "Beispiel", "duration_weeks": 1, "days_per_week": 2,
  "weeks": [{ "week": 1, "days": [
    { "key": "easy", "name": "Locker", "items": [{ "modality": "run", "duration_min": 35, "intensity": { "hr_zone": 2 } }] },
    { "key": "intervals", "name": "Intervalle", "items": [{ "modality": "bike", "warmup_min": 10, "cooldown_min": 5,
      "intervals": [{ "repeats": 5, "work": { "duration_sec": 180, "intensity": { "hr_zone": 4 } }, "recover": { "duration_sec": 120 } }] }] } ] }]
}`,
}

export interface PromptExercise {
  id: string
  name: string
}

/**
 * Self-contained prompt that makes any AI answer with a plan in our format.
 * `exercises` is the current catalog so the AI uses names that resolve without questions.
 */
export function buildPlanPrompt(type: PlanType, exercises: PromptExercise[], wishes = '[Hier deine Wünsche eintragen]') {
  const items = type === 'cardio' ? CARDIO_ITEMS : EXERCISE_ITEMS
  const catalog =
    type === 'cardio'
      ? ''
      : `\n\n## Übungsliste\n\nBevorzuge diese Namen (ID in Klammern):\n${exercises.map((e) => `- ${e.name} (${e.id})`).join('\n')}`
  return `Erstelle mir einen ${PLAN_TYPE_LABELS[type]}-Trainingsplan als JSON für meine Trainings-App.

## Meine Wünsche

${wishes}

## Wichtig

- Plane die Progression über die Wochen bewusst (Wiederholungen, RIR, Volumen, ggf. Deload) und schreibe jede Woche vollständig aus.
- Halte dich exakt an das Format unten. Keine zusätzlichen Felder, keine Kommentare im JSON.
- Einheiten: kg, Sekunden, Minuten, Kilometer.

${COMMON.replace('{TYPE}', type)}
${items}

## Minimalbeispiel

${EXAMPLES[type]}${catalog}
`
}
