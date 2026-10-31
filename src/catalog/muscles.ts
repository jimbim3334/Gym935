export const MUSCLES = [
  'chest',
  'front_delts',
  'side_delts',
  'rear_delts',
  'lats',
  'upper_back',
  'traps',
  'lower_back',
  'rotator_cuff',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'hip_flexors',
  'glutes',
  'quads',
  'hamstrings',
  'adductors',
  'abductors',
  'calves',
  'tibialis',
  'neck',
] as const

export type Muscle = (typeof MUSCLES)[number]

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Brust',
  front_delts: 'Vordere Schulter',
  side_delts: 'Seitliche Schulter',
  rear_delts: 'Hintere Schulter',
  lats: 'Latissimus',
  upper_back: 'Oberer Rücken',
  traps: 'Trapez',
  lower_back: 'Unterer Rücken',
  rotator_cuff: 'Rotatorenmanschette',
  biceps: 'Bizeps',
  triceps: 'Trizeps',
  forearms: 'Unterarme',
  abs: 'Bauch',
  obliques: 'Seitliche Bauchmuskeln',
  hip_flexors: 'Hüftbeuger',
  glutes: 'Gesäß',
  quads: 'Quadrizeps',
  hamstrings: 'Beinbeuger',
  adductors: 'Adduktoren',
  abductors: 'Abduktoren',
  calves: 'Waden',
  tibialis: 'Schienbein',
  neck: 'Nacken',
}

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'machine',
  'plate_machine',
  'smith_machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'band',
  'ez_bar',
  'trap_bar',
  'other',
] as const

export type Equipment = (typeof EQUIPMENT)[number]

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Langhantel',
  dumbbell: 'Kurzhantel',
  machine: 'Maschine (Steckgewicht)',
  plate_machine: 'Maschine (Scheiben)',
  smith_machine: 'Multipresse',
  cable: 'Kabelzug',
  bodyweight: 'Körpergewicht',
  kettlebell: 'Kettlebell',
  band: 'Band',
  ez_bar: 'SZ-Stange',
  trap_bar: 'Trap Bar',
  other: 'Sonstiges',
}

/** Smallest practical load jump per equipment type, used by the progression logic. */
export const DEFAULT_INCREMENT_KG: Record<Equipment, number> = {
  barbell: 2.5,
  dumbbell: 2,
  machine: 5,
  plate_machine: 2.5,
  smith_machine: 2.5,
  cable: 2.5,
  bodyweight: 2.5,
  kettlebell: 4,
  band: 0,
  ez_bar: 2.5,
  trap_bar: 2.5,
  other: 2.5,
}

export const MECHANICS = ['compound', 'isolation'] as const
export type Mechanic = (typeof MECHANICS)[number]

export const MECHANIC_LABELS: Record<Mechanic, string> = {
  compound: 'Grundübung',
  isolation: 'Isolationsübung',
}
