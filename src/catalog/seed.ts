import type { Equipment, Mechanic, Muscle } from './muscles.ts'

export type ExerciseKind = 'strength' | 'rehab'

export interface SeedExercise {
  id: string
  name: string
  equipment: Equipment
  mechanic: Mechanic
  primary_muscles: Muscle[]
  secondary_muscles: Muscle[]
  aliases: string[]
  kind: ExerciseKind
  /** Load means assistance (lower is harder), e.g. machine-assisted pull-ups. */
  assisted?: boolean
}

/** Bump when entries are added or changed, so existing installs pick them up. */
export const SEED_VERSION = 1

type Row = [
  name: string,
  equipment: Equipment,
  mechanic: 'c' | 'i',
  primary: Muscle[],
  secondary: Muscle[],
  aliases?: string[],
  extra?: { assisted?: boolean },
]

export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/°/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const STRENGTH: Row[] = [
  // Chest
  ['Barbell Bench Press', 'barbell', 'c', ['chest'], ['front_delts', 'triceps'], ['Bankdrücken', 'Langhantel Bankdrücken', 'Bench Press', 'Flat Bench Press']],
  ['Incline Barbell Bench Press', 'barbell', 'c', ['chest'], ['front_delts', 'triceps'], ['Schrägbankdrücken', 'Langhantel Schrägbankdrücken', 'Incline Bench Press']],
  ['Close Grip Bench Press', 'barbell', 'c', ['triceps', 'chest'], ['front_delts'], ['Enges Bankdrücken', 'Close-Grip Bench Press']],
  ['Dumbbell Bench Press', 'dumbbell', 'c', ['chest'], ['front_delts', 'triceps'], ['Kurzhantel Bankdrücken', 'DB Bench Press']],
  ['Incline Dumbbell Bench Press', 'dumbbell', 'c', ['chest'], ['front_delts', 'triceps'], ['Kurzhantel Schrägbankdrücken', 'Incline DB Press', 'Incline Dumbbell Press']],
  ['Smith Machine Bench Press', 'smith_machine', 'c', ['chest'], ['front_delts', 'triceps'], ['Multipresse Bankdrücken']],
  ['Smith Machine Incline Bench Press', 'smith_machine', 'c', ['chest'], ['front_delts', 'triceps'], ['Multipresse Schrägbankdrücken']],
  ['Machine Chest Press', 'machine', 'c', ['chest'], ['front_delts', 'triceps'], ['Brustpresse', 'Chest Press']],
  ['Plate-Loaded Chest Press', 'plate_machine', 'c', ['chest'], ['front_delts', 'triceps'], ['Brustpresse Scheiben']],
  ['Cable Fly', 'cable', 'i', ['chest'], ['front_delts'], ['Kabel Fliegende', 'Cable Crossover', 'Kabelzug Fliegende']],
  ['Pec Deck', 'machine', 'i', ['chest'], ['front_delts'], ['Butterfly', 'Butterfly Maschine', 'Machine Fly']],
  ['Dumbbell Fly', 'dumbbell', 'i', ['chest'], ['front_delts'], ['Kurzhantel Fliegende']],
  ['Push-Up', 'bodyweight', 'c', ['chest'], ['front_delts', 'triceps'], ['Liegestütz', 'Liegestütze', 'Push Up']],
  ['Dip', 'bodyweight', 'c', ['chest', 'triceps'], ['front_delts'], ['Dips', 'Barrenstütz']],
  ['Machine-Assisted Dip', 'machine', 'c', ['chest', 'triceps'], ['front_delts'], ['Assistierte Dips'], { assisted: true }],

  // Shoulders
  ['Barbell Overhead Press', 'barbell', 'c', ['front_delts'], ['side_delts', 'triceps'], ['Schulterdrücken', 'Military Press', 'Overhead Press', 'OHP']],
  ['Seated Dumbbell Overhead Press', 'dumbbell', 'c', ['front_delts'], ['side_delts', 'triceps'], ['Kurzhantel Schulterdrücken', 'Seated DB Shoulder Press', 'Dumbbell Shoulder Press']],
  ['Machine Shoulder Press', 'machine', 'c', ['front_delts'], ['side_delts', 'triceps'], ['Schulterpresse', 'Shoulder Press Machine']],
  ['Smith Machine Overhead Press', 'smith_machine', 'c', ['front_delts'], ['side_delts', 'triceps'], ['Multipresse Schulterdrücken']],
  ['Dumbbell Lateral Raise', 'dumbbell', 'i', ['side_delts'], [], ['Seitheben', 'Kurzhantel Seitheben', 'Lateral Raise']],
  ['Cable Lateral Raise', 'cable', 'i', ['side_delts'], [], ['Kabel Seitheben']],
  ['Machine Lateral Raise', 'machine', 'i', ['side_delts'], [], ['Seitheben Maschine']],
  ['Reverse Pec Deck', 'machine', 'i', ['rear_delts'], ['upper_back'], ['Reverse Butterfly', 'Rear Delt Fly Machine']],
  ['Dumbbell Rear Delt Fly', 'dumbbell', 'i', ['rear_delts'], ['upper_back'], ['Vorgebeugtes Seitheben', 'Reverse Fly']],
  ['Face Pull', 'cable', 'i', ['rear_delts'], ['upper_back', 'rotator_cuff'], ['Face Pulls']],
  ['Cable Y-Raise', 'cable', 'i', ['side_delts'], ['traps'], ['Y-Raise']],

  // Back
  ['Pull-Up', 'bodyweight', 'c', ['lats'], ['biceps', 'upper_back'], ['Klimmzug', 'Klimmzüge', 'Pull Up']],
  ['Chin-Up', 'bodyweight', 'c', ['lats', 'biceps'], ['upper_back'], ['Untergriff Klimmzug', 'Chin Up']],
  ['Neutral Grip Machine-Assisted Pull-Up', 'machine', 'c', ['lats'], ['biceps', 'upper_back'], ['Assistierte Klimmzüge', 'Assisted Pull-Up'], { assisted: true }],
  ['Lat Pulldown', 'cable', 'c', ['lats'], ['biceps', 'upper_back'], ['Latziehen', 'Lat Pull Down']],
  ['Close Neutral Grip Lat Pulldown', 'cable', 'c', ['lats'], ['biceps', 'upper_back'], ['Latziehen eng', 'Enges Latziehen']],
  ['Overhand Grip Pin-Loaded Machine Lat Pulldown', 'machine', 'c', ['lats'], ['biceps', 'upper_back', 'rear_delts'], ['Latziehen Maschine', 'Machine Lat Pulldown']],
  ['Single Arm Cable Lat Pull-In', 'cable', 'i', ['lats'], [], ['Einarmiges Latziehen', 'Single Arm Lat Pulldown']],
  ['Straight Arm Cable Pulldown', 'cable', 'i', ['lats'], [], ['Überzüge am Kabel', 'Straight Arm Pulldown', 'Lat Prayer']],
  ['Barbell Row', 'barbell', 'c', ['upper_back', 'lats'], ['rear_delts', 'biceps', 'lower_back'], ['Langhantelrudern', 'Bent Over Row', 'Rudern vorgebeugt']],
  ['Pendlay Row', 'barbell', 'c', ['upper_back', 'lats'], ['rear_delts', 'biceps', 'lower_back'], []],
  ['Single Arm Dumbbell Row', 'dumbbell', 'c', ['lats', 'upper_back'], ['rear_delts', 'biceps'], ['Kurzhantelrudern', 'Einarmiges Rudern', 'Dumbbell Row', 'One Arm Dumbbell Row']],
  ['Chest-Supported Dumbbell Row', 'dumbbell', 'c', ['upper_back', 'lats'], ['rear_delts', 'biceps'], ['Brustgestütztes Rudern', 'Incline Dumbbell Row']],
  ['Seated Cable Row', 'cable', 'c', ['upper_back', 'lats'], ['rear_delts', 'biceps'], ['Rudern am Kabel', 'Kabelrudern', 'Cable Row']],
  ['Neutral Grip Pin-Loaded Machine Row', 'machine', 'c', ['upper_back', 'lats'], ['rear_delts', 'biceps'], ['Rudermaschine', 'Machine Row']],
  ['Chest-Supported T-Bar Row', 'plate_machine', 'c', ['upper_back', 'lats'], ['rear_delts', 'biceps'], ['T-Bar Rudern', 'T-Bar Row']],
  ['Barbell Shrug', 'barbell', 'i', ['traps'], [], ['Shrugs', 'Schulterheben']],
  ['Dumbbell Shrug', 'dumbbell', 'i', ['traps'], [], ['Kurzhantel Shrugs']],
  ['Deadlift', 'barbell', 'c', ['hamstrings', 'glutes', 'lower_back'], ['upper_back', 'traps', 'forearms', 'quads'], ['Kreuzheben', 'Conventional Deadlift']],
  ['Machine Back Extension', 'machine', 'i', ['lower_back'], ['glutes', 'hamstrings'], ['Rückenstrecker Maschine']],
  ['45 Degree Back Extension', 'bodyweight', 'i', ['lower_back', 'glutes'], ['hamstrings'], ['Hyperextension', 'Rückenstrecken', 'Back Extension']],

  // Arms
  ['Barbell Curl', 'barbell', 'i', ['biceps'], ['forearms'], ['Langhantel Curls', 'Bizepscurls Langhantel']],
  ['EZ-Bar Curl', 'ez_bar', 'i', ['biceps'], ['forearms'], ['SZ Curls', 'SZ-Stange Curls', 'EZ Bar Curl']],
  ['Dumbbell Curl', 'dumbbell', 'i', ['biceps'], ['forearms'], ['Kurzhantel Curls', 'Bizepscurls', 'DB Curl']],
  ['Incline Dumbbell Curl', 'dumbbell', 'i', ['biceps'], [], ['Schrägbank Curls']],
  ['Standing Dumbbell Hammer Curl', 'dumbbell', 'i', ['biceps', 'forearms'], [], ['Hammer Curls', 'Hammercurls', 'Hammer Curl']],
  ['Cable Curl', 'cable', 'i', ['biceps'], ['forearms'], ['Kabel Curls']],
  ['Bayesian Cable Curl', 'cable', 'i', ['biceps'], [], ['Bayesian Curl']],
  ['Pin-Loaded Machine Preacher Curl', 'machine', 'i', ['biceps'], [], ['Scottcurls Maschine', 'Machine Preacher Curl', 'Bizepsmaschine']],
  ['EZ-Bar Preacher Curl', 'ez_bar', 'i', ['biceps'], [], ['Scottcurls', 'Preacher Curl']],
  ['Cable Triceps Pushdown', 'cable', 'i', ['triceps'], [], ['Trizepsdrücken am Kabel', 'Triceps Pushdown', 'Rope Pushdown', 'Pushdown']],
  ['Overhead Cable Triceps Extension', 'cable', 'i', ['triceps'], [], ['Trizeps Überkopf Kabel', 'Overhead Triceps Extension']],
  ['EZ-Bar Skull Crusher', 'ez_bar', 'i', ['triceps'], [], ['French Press', 'Stirndrücken', 'Skull Crusher', 'Skullcrusher']],
  ['Dumbbell Overhead Triceps Extension', 'dumbbell', 'i', ['triceps'], [], ['Kurzhantel Trizeps Überkopf']],
  ['Machine Triceps Extension', 'machine', 'i', ['triceps'], [], ['Trizepsmaschine']],
  ['Dumbbell Wrist Curl', 'dumbbell', 'i', ['forearms'], [], ['Handgelenkcurls', 'Wrist Curl']],

  // Legs
  ['Barbell Back Squat', 'barbell', 'c', ['quads', 'glutes'], ['adductors', 'lower_back'], ['Kniebeuge', 'Kniebeugen', 'Back Squat', 'Squat']],
  ['Barbell Front Squat', 'barbell', 'c', ['quads'], ['glutes', 'upper_back'], ['Frontkniebeuge', 'Front Squat']],
  ['Smith Machine Back Squat', 'smith_machine', 'c', ['quads', 'glutes'], ['adductors'], ['Multipresse Kniebeuge', 'Smith Squat']],
  ['Hack Squat', 'plate_machine', 'c', ['quads'], ['glutes', 'adductors'], ['Hackenschmidt', 'Hackenschmidt Kniebeuge']],
  ['Pendulum Squat', 'plate_machine', 'c', ['quads'], ['glutes'], ['Pendel Kniebeuge']],
  ['Leg Press', 'plate_machine', 'c', ['quads', 'glutes'], ['adductors'], ['Beinpresse', '45 Grad Beinpresse', '45 Degree Leg Press']],
  ['Pin-Loaded Leg Press', 'machine', 'c', ['quads', 'glutes'], ['adductors'], ['Beinpresse Maschine', 'Seated Leg Press']],
  ['Bulgarian Split Squat', 'dumbbell', 'c', ['quads', 'glutes'], ['adductors'], ['Bulgarische Kniebeuge', 'Bulgarian Split Squats', 'Split Squat']],
  ['Dumbbell Walking Lunge', 'dumbbell', 'c', ['quads', 'glutes'], ['adductors'], ['Ausfallschritte', 'Walking Lunges', 'Lunges']],
  ['Goblet Squat', 'dumbbell', 'c', ['quads'], ['glutes', 'adductors'], ['Goblet Kniebeuge']],
  ['Romanian Deadlift', 'barbell', 'c', ['hamstrings', 'glutes'], ['lower_back', 'adductors'], ['Rumänisches Kreuzheben', 'RDL', 'Barbell RDL']],
  ['Dumbbell Romanian Deadlift', 'dumbbell', 'c', ['hamstrings', 'glutes'], ['lower_back', 'adductors'], ['Kurzhantel Rumänisches Kreuzheben', 'DB RDL', 'Dumbbell RDL']],
  ['Trap Bar Deadlift', 'trap_bar', 'c', ['quads', 'glutes', 'hamstrings'], ['lower_back', 'traps'], ['Trap Bar Kreuzheben', 'Hex Bar Deadlift']],
  ['Barbell Hip Thrust', 'barbell', 'c', ['glutes'], ['hamstrings'], ['Hip Thrust', 'Hüftstoßen']],
  ['Smith Machine Hip Thrust', 'smith_machine', 'c', ['glutes'], ['hamstrings'], ['Multipresse Hip Thrust']],
  ['Machine Hip Thrust', 'plate_machine', 'c', ['glutes'], ['hamstrings'], ['Hip Thrust Maschine']],
  ['Glute Ham Raise', 'bodyweight', 'i', ['hamstrings'], ['glutes', 'calves'], ['GHR']],
  ['Nordic Hamstring Curl', 'bodyweight', 'i', ['hamstrings'], [], ['Nordic Curl', 'Nordics']],
  ['Seated Hamstring Curl', 'machine', 'i', ['hamstrings'], ['calves'], ['Beinbeuger sitzend', 'Sitzender Beinbeuger', 'Seated Leg Curl']],
  ['Lying Hamstring Curl', 'machine', 'i', ['hamstrings'], ['calves'], ['Beinbeuger liegend', 'Liegender Beinbeuger', 'Lying Leg Curl']],
  ['Leg Extension', 'machine', 'i', ['quads'], [], ['Beinstrecker', 'Leg Extensions']],
  ['Seated Machine Hip Abduction', 'machine', 'i', ['abductors'], ['glutes'], ['Abduktorenmaschine', 'Abduktoren', 'Hip Abduction']],
  ['Seated Machine Hip Adduction', 'machine', 'i', ['adductors'], [], ['Adduktorenmaschine', 'Adduktoren', 'Hip Adduction']],
  ['Cable Glute Kickback', 'cable', 'i', ['glutes'], ['hamstrings'], ['Kickbacks am Kabel', 'Glute Kickback']],
  ['Standing Calf Raise', 'machine', 'i', ['calves'], [], ['Wadenheben stehend', 'Calf Raise']],
  ['Seated Calf Raise', 'plate_machine', 'i', ['calves'], [], ['Wadenheben sitzend']],
  ['Leg Press Calf Raise', 'plate_machine', 'i', ['calves'], [], ['Wadenheben Beinpresse']],
  ['Smith Machine Calf Raise', 'smith_machine', 'i', ['calves'], [], ['Wadenheben Multipresse']],

  // Core
  ['Ab Wheel Rollout', 'other', 'i', ['abs'], ['lats'], ['Ab Wheel', 'Bauchroller', 'Ab Roller']],
  ['Cable Crunch', 'cable', 'i', ['abs'], [], ['Kabel Crunches', 'Kneeling Cable Crunch']],
  ['Machine Crunch', 'machine', 'i', ['abs'], [], ['Bauchmaschine', 'Crunch Maschine']],
  ['Hanging Leg Raise', 'bodyweight', 'i', ['abs'], ['hip_flexors'], ['Hängendes Beinheben', 'Beinheben hängend']],
  ['Plank', 'bodyweight', 'i', ['abs'], ['obliques'], ['Unterarmstütz', 'Planke']],
  ['Tall Plank Scapular Protraction', 'bodyweight', 'i', ['abs'], ['chest', 'front_delts'], ['Scapula Push-Up', 'Scapular Push-Up']],
]

const REHAB: Row[] = [
  ['Clamshell', 'band', 'i', ['abductors', 'glutes'], [], ['Muschel', 'Clamshells']],
  ['Glute Bridge', 'bodyweight', 'i', ['glutes'], ['hamstrings'], ['Beckenheben', 'Brücke']],
  ['Single-Leg Glute Bridge', 'bodyweight', 'i', ['glutes'], ['hamstrings'], ['Einbeiniges Beckenheben']],
  ['Bird Dog', 'bodyweight', 'i', ['lower_back', 'abs'], ['glutes'], ['Vierfüßlerstand diagonal']],
  ['Dead Bug', 'bodyweight', 'i', ['abs'], ['hip_flexors'], ['Toter Käfer']],
  ['Side Plank', 'bodyweight', 'i', ['obliques'], ['abductors'], ['Seitstütz']],
  ['Copenhagen Plank', 'bodyweight', 'i', ['adductors'], ['obliques'], ['Copenhagen Adduction']],
  ['Pallof Press', 'cable', 'i', ['obliques', 'abs'], [], ['Anti-Rotation Press']],
  ['McGill Curl-Up', 'bodyweight', 'i', ['abs'], [], ['Curl-Up']],
  ['Terminal Knee Extension', 'band', 'i', ['quads'], [], ['TKE', 'Knie-Endstreckung']],
  ['Spanish Squat', 'band', 'i', ['quads'], [], ['Spanische Kniebeuge']],
  ['Wall Sit', 'bodyweight', 'i', ['quads'], ['glutes'], ['Wandsitzen']],
  ['Step-Down', 'bodyweight', 'i', ['quads'], ['glutes'], ['Lateral Step-Down', 'Step Down']],
  ['Tibialis Raise', 'bodyweight', 'i', ['tibialis'], [], ['Fußheben', 'Tib Raise']],
  ['Single-Leg Calf Raise', 'bodyweight', 'i', ['calves'], [], ['Einbeiniges Wadenheben']],
  ['Monster Walk', 'band', 'i', ['abductors', 'glutes'], [], ['Band Walk', 'Lateral Band Walk']],
  ['Band External Rotation', 'band', 'i', ['rotator_cuff'], ['rear_delts'], ['Außenrotation mit Band', 'External Rotation']],
  ['Band Pull-Apart', 'band', 'i', ['rear_delts', 'upper_back'], [], ['Band Pull Apart']],
  ['Wall Slide', 'bodyweight', 'i', ['upper_back'], ['front_delts', 'rotator_cuff'], ['Wall Slides']],
  ['Dead Hang', 'bodyweight', 'i', ['forearms', 'lats'], [], ['Passives Hängen']],
  ['Chin Tuck', 'bodyweight', 'i', ['neck'], [], ['Doppelkinn', 'Chin Tucks']],
  ['Sleeper Stretch', 'bodyweight', 'i', ['rotator_cuff'], [], ['Sleeper Dehnung']],
  ['Cat-Cow', 'bodyweight', 'i', ['lower_back'], ['upper_back'], ['Katze-Kuh', 'Cat Cow']],
  ['Thoracic Rotation', 'bodyweight', 'i', ['upper_back'], ['obliques'], ['BWS-Rotation', 'Open Book']],
  ["World's Greatest Stretch", 'bodyweight', 'i', ['hip_flexors'], ['hamstrings', 'upper_back'], ['Worlds Greatest Stretch']],
  ['Couch Stretch', 'bodyweight', 'i', ['hip_flexors', 'quads'], [], ['Hüftbeuger Dehnung', 'Hip Flexor Stretch']],
  ['90/90 Hip Switch', 'bodyweight', 'i', ['glutes'], ['hip_flexors', 'adductors'], ['90-90', '90/90']],
  ['Ankle Dorsiflexion Mobilization', 'bodyweight', 'i', ['calves'], [], ['Knee to Wall', 'Sprunggelenk Mobilisation']],
]

function build(rows: Row[], kind: ExerciseKind): SeedExercise[] {
  return rows.map(([name, equipment, mechanic, primary, secondary, aliases = [], extra = {}]) => ({
    id: slugify(name),
    name,
    equipment,
    mechanic: mechanic === 'c' ? 'compound' : 'isolation',
    primary_muscles: primary,
    secondary_muscles: secondary,
    aliases,
    kind,
    ...extra,
  }))
}

export const SEED_EXERCISES: SeedExercise[] = [...build(STRENGTH, 'strength'), ...build(REHAB, 'rehab')]
