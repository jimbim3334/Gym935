# Prompt-Vorlagen für Trainingspläne

> Generiert aus `src/plan/prompt.ts` mit `npm run docs`. Nicht von Hand bearbeiten.
>
> In der App gibt es denselben Prompt unter **Mehr → KI-Prompt kopieren**. Dort enthält er immer deinen
> aktuellen Übungskatalog, inklusive selbst angelegter Übungen. Diese Datei enthält nur den Startkatalog.

So gehst du vor:

1. Passenden Prompt unten kopieren und den Abschnitt **Meine Wünsche** ausfüllen (Ziel, Erfahrung,
   Tage pro Woche, Dauer, Equipment, Einschränkungen, Lieblingsübungen).
2. In eine beliebige KI einfügen. Für noch strengere Ausgabe zusätzlich `docs/plan-schema.json` anhängen.
3. Die JSON-Antwort in der App unter **Plan importieren** einfügen.

## Strength

````text
Erstelle mir einen Strength-Trainingsplan als JSON für meine Trainings-App.

## Meine Wünsche

[Hier deine Wünsche eintragen]

## Wichtig

- Plane die Progression über die Wochen bewusst (Wiederholungen, RIR, Volumen, ggf. Deload) und schreibe jede Woche vollständig aus.
- Halte dich exakt an das Format unten. Keine zusätzlichen Felder, keine Kommentare im JSON.
- Einheiten: kg, Sekunden, Minuten, Kilometer.

## Ausgabeformat (Version 1)

Antworte ausschließlich mit einem JSON-Objekt, ohne Erklärtext davor oder danach.

Oberste Ebene:
- "format_version": 1
- "type": "strength"
- "name": Planname (max. 80 Zeichen)
- "goal", "description", "notes", "created_by": optional, Text
- "duration_weeks": Anzahl Wochen (muss der Länge von "weeks" entsprechen)
- "days_per_week": Trainingstage pro Woche
- "weeks": Liste aller Wochen, lückenlos nummeriert ab 1. Jede Woche wird vollständig ausgeschrieben, auch wenn sie der Vorwoche ähnelt.

Woche: { "week": 1, "label": optional (z. B. "Deload", "Intensität hoch"), "notes": optional, "deload": optional true/false, "days": [...] }

Tag: { "key": stabiler Schlüssel, in jeder Woche gleich (z. B. "upper-a"), "name": Anzeigename (z. B. "Oberkörper A"), "notes": optional, "items": [...] }
Die Reihenfolge der Tage ist die Trainingsreihenfolge innerhalb der Woche.

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
Muskeln: chest, front_delts, side_delts, rear_delts, lats, upper_back, traps, lower_back, rotator_cuff, biceps, triceps, forearms, abs, obliques, hip_flexors, glutes, quads, hamstrings, adductors, abductors, calves, tibialis, neck
Equipment: barbell, dumbbell, machine, plate_machine, smith_machine, cable, bodyweight, kettlebell, band, ez_bar, trap_bar, other

## Minimalbeispiel

{
  "format_version": 1, "type": "strength", "name": "Beispiel", "duration_weeks": 1, "days_per_week": 1,
  "weeks": [{ "week": 1, "days": [{ "key": "upper", "name": "Oberkörper", "items": [
    { "exercise": "Barbell Bench Press", "rest_seconds": 180, "sets": [
      { "type": "warmup", "count": 2, "reps": 5, "load": { "type": "percent_1rm", "percent": 50 } },
      { "type": "top", "reps": "5-6", "rir": 2 },
      { "type": "backoff", "count": 2, "reps": "8-10", "rir": 2, "load": { "type": "percent_top_set", "percent": 85 } } ] },
    { "exercise": "Dumbbell Lateral Raise", "superset": "A", "rest_seconds": 60, "sets": [{ "count": 3, "reps": "12-15", "rir": 1 }] },
    { "exercise": "Cable Triceps Pushdown", "superset": "A", "rest_seconds": 90, "sets": [{ "count": 3, "reps": "10-15", "rir": 1 }] } ] }] }]
}

## Übungsliste

Bevorzuge diese Namen (ID in Klammern):
- Barbell Bench Press (barbell-bench-press)
- Incline Barbell Bench Press (incline-barbell-bench-press)
- Close Grip Bench Press (close-grip-bench-press)
- Dumbbell Bench Press (dumbbell-bench-press)
- Incline Dumbbell Bench Press (incline-dumbbell-bench-press)
- Smith Machine Bench Press (smith-machine-bench-press)
- Smith Machine Incline Bench Press (smith-machine-incline-bench-press)
- Machine Chest Press (machine-chest-press)
- Plate-Loaded Chest Press (plate-loaded-chest-press)
- Cable Fly (cable-fly)
- Pec Deck (pec-deck)
- Dumbbell Fly (dumbbell-fly)
- Push-Up (push-up)
- Dip (dip)
- Machine-Assisted Dip (machine-assisted-dip)
- Barbell Overhead Press (barbell-overhead-press)
- Seated Dumbbell Overhead Press (seated-dumbbell-overhead-press)
- Machine Shoulder Press (machine-shoulder-press)
- Smith Machine Overhead Press (smith-machine-overhead-press)
- Dumbbell Lateral Raise (dumbbell-lateral-raise)
- Cable Lateral Raise (cable-lateral-raise)
- Machine Lateral Raise (machine-lateral-raise)
- Reverse Pec Deck (reverse-pec-deck)
- Dumbbell Rear Delt Fly (dumbbell-rear-delt-fly)
- Face Pull (face-pull)
- Cable Y-Raise (cable-y-raise)
- Pull-Up (pull-up)
- Chin-Up (chin-up)
- Neutral Grip Machine-Assisted Pull-Up (neutral-grip-machine-assisted-pull-up)
- Lat Pulldown (lat-pulldown)
- Close Neutral Grip Lat Pulldown (close-neutral-grip-lat-pulldown)
- Overhand Grip Pin-Loaded Machine Lat Pulldown (overhand-grip-pin-loaded-machine-lat-pulldown)
- Single Arm Cable Lat Pull-In (single-arm-cable-lat-pull-in)
- Straight Arm Cable Pulldown (straight-arm-cable-pulldown)
- Barbell Row (barbell-row)
- Pendlay Row (pendlay-row)
- Single Arm Dumbbell Row (single-arm-dumbbell-row)
- Chest-Supported Dumbbell Row (chest-supported-dumbbell-row)
- Seated Cable Row (seated-cable-row)
- Neutral Grip Pin-Loaded Machine Row (neutral-grip-pin-loaded-machine-row)
- Chest-Supported T-Bar Row (chest-supported-t-bar-row)
- Barbell Shrug (barbell-shrug)
- Dumbbell Shrug (dumbbell-shrug)
- Deadlift (deadlift)
- Machine Back Extension (machine-back-extension)
- 45 Degree Back Extension (45-degree-back-extension)
- Barbell Curl (barbell-curl)
- EZ-Bar Curl (ez-bar-curl)
- Dumbbell Curl (dumbbell-curl)
- Incline Dumbbell Curl (incline-dumbbell-curl)
- Standing Dumbbell Hammer Curl (standing-dumbbell-hammer-curl)
- Cable Curl (cable-curl)
- Bayesian Cable Curl (bayesian-cable-curl)
- Pin-Loaded Machine Preacher Curl (pin-loaded-machine-preacher-curl)
- EZ-Bar Preacher Curl (ez-bar-preacher-curl)
- Cable Triceps Pushdown (cable-triceps-pushdown)
- Overhead Cable Triceps Extension (overhead-cable-triceps-extension)
- EZ-Bar Skull Crusher (ez-bar-skull-crusher)
- Dumbbell Overhead Triceps Extension (dumbbell-overhead-triceps-extension)
- Machine Triceps Extension (machine-triceps-extension)
- Dumbbell Wrist Curl (dumbbell-wrist-curl)
- Barbell Back Squat (barbell-back-squat)
- Barbell Front Squat (barbell-front-squat)
- Smith Machine Back Squat (smith-machine-back-squat)
- Hack Squat (hack-squat)
- Pendulum Squat (pendulum-squat)
- Leg Press (leg-press)
- Pin-Loaded Leg Press (pin-loaded-leg-press)
- Bulgarian Split Squat (bulgarian-split-squat)
- Dumbbell Walking Lunge (dumbbell-walking-lunge)
- Goblet Squat (goblet-squat)
- Romanian Deadlift (romanian-deadlift)
- Dumbbell Romanian Deadlift (dumbbell-romanian-deadlift)
- Trap Bar Deadlift (trap-bar-deadlift)
- Barbell Hip Thrust (barbell-hip-thrust)
- Smith Machine Hip Thrust (smith-machine-hip-thrust)
- Machine Hip Thrust (machine-hip-thrust)
- Glute Ham Raise (glute-ham-raise)
- Nordic Hamstring Curl (nordic-hamstring-curl)
- Seated Hamstring Curl (seated-hamstring-curl)
- Lying Hamstring Curl (lying-hamstring-curl)
- Leg Extension (leg-extension)
- Seated Machine Hip Abduction (seated-machine-hip-abduction)
- Seated Machine Hip Adduction (seated-machine-hip-adduction)
- Cable Glute Kickback (cable-glute-kickback)
- Standing Calf Raise (standing-calf-raise)
- Seated Calf Raise (seated-calf-raise)
- Leg Press Calf Raise (leg-press-calf-raise)
- Smith Machine Calf Raise (smith-machine-calf-raise)
- Ab Wheel Rollout (ab-wheel-rollout)
- Cable Crunch (cable-crunch)
- Machine Crunch (machine-crunch)
- Hanging Leg Raise (hanging-leg-raise)
- Plank (plank)
- Tall Plank Scapular Protraction (tall-plank-scapular-protraction)
````

## Cardio

````text
Erstelle mir einen Cardio-Trainingsplan als JSON für meine Trainings-App.

## Meine Wünsche

[Hier deine Wünsche eintragen]

## Wichtig

- Plane die Progression über die Wochen bewusst (Wiederholungen, RIR, Volumen, ggf. Deload) und schreibe jede Woche vollständig aus.
- Halte dich exakt an das Format unten. Keine zusätzlichen Felder, keine Kommentare im JSON.
- Einheiten: kg, Sekunden, Minuten, Kilometer.

## Ausgabeformat (Version 1)

Antworte ausschließlich mit einem JSON-Objekt, ohne Erklärtext davor oder danach.

Oberste Ebene:
- "format_version": 1
- "type": "cardio"
- "name": Planname (max. 80 Zeichen)
- "goal", "description", "notes", "created_by": optional, Text
- "duration_weeks": Anzahl Wochen (muss der Länge von "weeks" entsprechen)
- "days_per_week": Trainingstage pro Woche
- "weeks": Liste aller Wochen, lückenlos nummeriert ab 1. Jede Woche wird vollständig ausgeschrieben, auch wenn sie der Vorwoche ähnelt.

Woche: { "week": 1, "label": optional (z. B. "Deload", "Intensität hoch"), "notes": optional, "deload": optional true/false, "days": [...] }

Tag: { "key": stabiler Schlüssel, in jeder Woche gleich (z. B. "upper-a"), "name": Anzeigename (z. B. "Oberkörper A"), "notes": optional, "items": [...] }
Die Reihenfolge der Tage ist die Trainingsreihenfolge innerhalb der Woche.

Cardio-Einheit (Eintrag in "items"):
- "modality": "run" | "bike" | "row" | "elliptical" | "swim" | "walk" | "stairs" | "ski_erg" | "other"
- "name": optional, z. B. "Dauerlauf"
- "duration_min": Dauer in Minuten
- "distance_km": optional, Distanz
- "intensity": optional { "hr_zone": 1-5, "hr_min"/"hr_max": bpm, "rpe": 1-10, "pace_per_km": "5:30" oder "5:30-6:00", "watts": Zahl, "description": Text }
- "warmup_min", "cooldown_min": optional
- "intervals": optional, Liste von Blöcken { "repeats": 5, "work": { "duration_sec" oder "distance_m", "intensity" }, "recover": { "duration_sec" oder "distance_m", "intensity" } }
- "notes": optional
Mindestens eines von "duration_min", "distance_km" oder "intervals" ist Pflicht.

## Minimalbeispiel

{
  "format_version": 1, "type": "cardio", "name": "Beispiel", "duration_weeks": 1, "days_per_week": 2,
  "weeks": [{ "week": 1, "days": [
    { "key": "easy", "name": "Locker", "items": [{ "modality": "run", "duration_min": 35, "intensity": { "hr_zone": 2 } }] },
    { "key": "intervals", "name": "Intervalle", "items": [{ "modality": "bike", "warmup_min": 10, "cooldown_min": 5,
      "intervals": [{ "repeats": 5, "work": { "duration_sec": 180, "intensity": { "hr_zone": 4 } }, "recover": { "duration_sec": 120 } }] }] } ] }]
}
````

## Mobility (Reha)

````text
Erstelle mir einen Mobility-Trainingsplan als JSON für meine Trainings-App.

## Meine Wünsche

[Hier deine Wünsche eintragen]

## Wichtig

- Plane die Progression über die Wochen bewusst (Wiederholungen, RIR, Volumen, ggf. Deload) und schreibe jede Woche vollständig aus.
- Halte dich exakt an das Format unten. Keine zusätzlichen Felder, keine Kommentare im JSON.
- Einheiten: kg, Sekunden, Minuten, Kilometer.

## Ausgabeformat (Version 1)

Antworte ausschließlich mit einem JSON-Objekt, ohne Erklärtext davor oder danach.

Oberste Ebene:
- "format_version": 1
- "type": "rehab"
- "name": Planname (max. 80 Zeichen)
- "goal", "description", "notes", "created_by": optional, Text
- "duration_weeks": Anzahl Wochen (muss der Länge von "weeks" entsprechen)
- "days_per_week": Trainingstage pro Woche
- "weeks": Liste aller Wochen, lückenlos nummeriert ab 1. Jede Woche wird vollständig ausgeschrieben, auch wenn sie der Vorwoche ähnelt.

Woche: { "week": 1, "label": optional (z. B. "Deload", "Intensität hoch"), "notes": optional, "deload": optional true/false, "days": [...] }

Tag: { "key": stabiler Schlüssel, in jeder Woche gleich (z. B. "upper-a"), "name": Anzeigename (z. B. "Oberkörper A"), "notes": optional, "items": [...] }
Die Reihenfolge der Tage ist die Trainingsreihenfolge innerhalb der Woche.

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
Muskeln: chest, front_delts, side_delts, rear_delts, lats, upper_back, traps, lower_back, rotator_cuff, biceps, triceps, forearms, abs, obliques, hip_flexors, glutes, quads, hamstrings, adductors, abductors, calves, tibialis, neck
Equipment: barbell, dumbbell, machine, plate_machine, smith_machine, cable, bodyweight, kettlebell, band, ez_bar, trap_bar, other

## Minimalbeispiel

{
  "format_version": 1, "type": "rehab", "name": "Beispiel", "duration_weeks": 1, "days_per_week": 1,
  "weeks": [{ "week": 1, "days": [{ "key": "knee", "name": "Knie", "items": [
    { "exercise": "Spanish Squat", "sets": [{ "count": 5, "hold_seconds": 45, "rest_seconds": 60 }] },
    { "exercise": "Step-Down", "per_side": true, "sets": [{ "count": 3, "reps": "8-10", "rir": 3 }] } ] }] }]
}

## Übungsliste

Bevorzuge diese Namen (ID in Klammern):
- Clamshell (clamshell)
- Glute Bridge (glute-bridge)
- Single-Leg Glute Bridge (single-leg-glute-bridge)
- Bird Dog (bird-dog)
- Dead Bug (dead-bug)
- Side Plank (side-plank)
- Copenhagen Plank (copenhagen-plank)
- Pallof Press (pallof-press)
- McGill Curl-Up (mcgill-curl-up)
- Terminal Knee Extension (terminal-knee-extension)
- Spanish Squat (spanish-squat)
- Wall Sit (wall-sit)
- Step-Down (step-down)
- Tibialis Raise (tibialis-raise)
- Single-Leg Calf Raise (single-leg-calf-raise)
- Monster Walk (monster-walk)
- Band External Rotation (band-external-rotation)
- Band Pull-Apart (band-pull-apart)
- Wall Slide (wall-slide)
- Dead Hang (dead-hang)
- Chin Tuck (chin-tuck)
- Sleeper Stretch (sleeper-stretch)
- Cat-Cow (cat-cow)
- Thoracic Rotation (thoracic-rotation)
- World's Greatest Stretch (world-s-greatest-stretch)
- Couch Stretch (couch-stretch)
- 90/90 Hip Switch (90-90-hip-switch)
- Ankle Dorsiflexion Mobilization (ankle-dorsiflexion-mobilization)
- Barbell Bench Press (barbell-bench-press)
- Incline Barbell Bench Press (incline-barbell-bench-press)
- Close Grip Bench Press (close-grip-bench-press)
- Dumbbell Bench Press (dumbbell-bench-press)
- Incline Dumbbell Bench Press (incline-dumbbell-bench-press)
- Smith Machine Bench Press (smith-machine-bench-press)
- Smith Machine Incline Bench Press (smith-machine-incline-bench-press)
- Machine Chest Press (machine-chest-press)
- Plate-Loaded Chest Press (plate-loaded-chest-press)
- Cable Fly (cable-fly)
- Pec Deck (pec-deck)
- Dumbbell Fly (dumbbell-fly)
- Push-Up (push-up)
- Dip (dip)
- Machine-Assisted Dip (machine-assisted-dip)
- Barbell Overhead Press (barbell-overhead-press)
- Seated Dumbbell Overhead Press (seated-dumbbell-overhead-press)
- Machine Shoulder Press (machine-shoulder-press)
- Smith Machine Overhead Press (smith-machine-overhead-press)
- Dumbbell Lateral Raise (dumbbell-lateral-raise)
- Cable Lateral Raise (cable-lateral-raise)
- Machine Lateral Raise (machine-lateral-raise)
- Reverse Pec Deck (reverse-pec-deck)
- Dumbbell Rear Delt Fly (dumbbell-rear-delt-fly)
- Face Pull (face-pull)
- Cable Y-Raise (cable-y-raise)
- Pull-Up (pull-up)
- Chin-Up (chin-up)
- Neutral Grip Machine-Assisted Pull-Up (neutral-grip-machine-assisted-pull-up)
- Lat Pulldown (lat-pulldown)
- Close Neutral Grip Lat Pulldown (close-neutral-grip-lat-pulldown)
- Overhand Grip Pin-Loaded Machine Lat Pulldown (overhand-grip-pin-loaded-machine-lat-pulldown)
- Single Arm Cable Lat Pull-In (single-arm-cable-lat-pull-in)
- Straight Arm Cable Pulldown (straight-arm-cable-pulldown)
- Barbell Row (barbell-row)
- Pendlay Row (pendlay-row)
- Single Arm Dumbbell Row (single-arm-dumbbell-row)
- Chest-Supported Dumbbell Row (chest-supported-dumbbell-row)
- Seated Cable Row (seated-cable-row)
- Neutral Grip Pin-Loaded Machine Row (neutral-grip-pin-loaded-machine-row)
- Chest-Supported T-Bar Row (chest-supported-t-bar-row)
- Barbell Shrug (barbell-shrug)
- Dumbbell Shrug (dumbbell-shrug)
- Deadlift (deadlift)
- Machine Back Extension (machine-back-extension)
- 45 Degree Back Extension (45-degree-back-extension)
- Barbell Curl (barbell-curl)
- EZ-Bar Curl (ez-bar-curl)
- Dumbbell Curl (dumbbell-curl)
- Incline Dumbbell Curl (incline-dumbbell-curl)
- Standing Dumbbell Hammer Curl (standing-dumbbell-hammer-curl)
- Cable Curl (cable-curl)
- Bayesian Cable Curl (bayesian-cable-curl)
- Pin-Loaded Machine Preacher Curl (pin-loaded-machine-preacher-curl)
- EZ-Bar Preacher Curl (ez-bar-preacher-curl)
- Cable Triceps Pushdown (cable-triceps-pushdown)
- Overhead Cable Triceps Extension (overhead-cable-triceps-extension)
- EZ-Bar Skull Crusher (ez-bar-skull-crusher)
- Dumbbell Overhead Triceps Extension (dumbbell-overhead-triceps-extension)
- Machine Triceps Extension (machine-triceps-extension)
- Dumbbell Wrist Curl (dumbbell-wrist-curl)
- Barbell Back Squat (barbell-back-squat)
- Barbell Front Squat (barbell-front-squat)
- Smith Machine Back Squat (smith-machine-back-squat)
- Hack Squat (hack-squat)
- Pendulum Squat (pendulum-squat)
- Leg Press (leg-press)
- Pin-Loaded Leg Press (pin-loaded-leg-press)
- Bulgarian Split Squat (bulgarian-split-squat)
- Dumbbell Walking Lunge (dumbbell-walking-lunge)
- Goblet Squat (goblet-squat)
- Romanian Deadlift (romanian-deadlift)
- Dumbbell Romanian Deadlift (dumbbell-romanian-deadlift)
- Trap Bar Deadlift (trap-bar-deadlift)
- Barbell Hip Thrust (barbell-hip-thrust)
- Smith Machine Hip Thrust (smith-machine-hip-thrust)
- Machine Hip Thrust (machine-hip-thrust)
- Glute Ham Raise (glute-ham-raise)
- Nordic Hamstring Curl (nordic-hamstring-curl)
- Seated Hamstring Curl (seated-hamstring-curl)
- Lying Hamstring Curl (lying-hamstring-curl)
- Leg Extension (leg-extension)
- Seated Machine Hip Abduction (seated-machine-hip-abduction)
- Seated Machine Hip Adduction (seated-machine-hip-adduction)
- Cable Glute Kickback (cable-glute-kickback)
- Standing Calf Raise (standing-calf-raise)
- Seated Calf Raise (seated-calf-raise)
- Leg Press Calf Raise (leg-press-calf-raise)
- Smith Machine Calf Raise (smith-machine-calf-raise)
- Ab Wheel Rollout (ab-wheel-rollout)
- Cable Crunch (cable-crunch)
- Machine Crunch (machine-crunch)
- Hanging Leg Raise (hanging-leg-raise)
- Plank (plank)
- Tall Plank Scapular Protraction (tall-plank-scapular-protraction)
````
