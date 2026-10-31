/** Abbreviations that commonly show up in AI-written or hand-typed exercise names. */
const ABBREVIATIONS: Record<string, string> = {
  db: 'dumbbell',
  dbs: 'dumbbell',
  kh: 'kurzhantel',
  bb: 'barbell',
  lh: 'langhantel',
  kb: 'kettlebell',
  ohp: 'overhead press',
  rdl: 'romanian deadlift',
  sldl: 'stiff leg deadlift',
  ghr: 'glute ham raise',
  bss: 'bulgarian split squat',
  ez: 'ez bar',
  sz: 'sz stange',
  ext: 'extension',
  pulldowns: 'pulldown',
  'pull-downs': 'pulldown',
}

/**
 * Canonical form for name comparisons: lowercase, no diacritics, ß -> ss,
 * punctuation to spaces, abbreviations expanded, simple plural "s" dropped.
 */
export function normalizeName(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[°'’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  return base
    .split(' ')
    .filter(Boolean)
    .map((t) => ABBREVIATIONS[t] ?? t)
    .join(' ')
    .split(' ')
    .map((t) => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t))
    .join(' ')
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>()
  const t = s.replace(/ /g, '')
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2)
    m.set(g, (m.get(g) ?? 0) + 1)
  }
  return m
}

/** Sørensen–Dice similarity on character bigrams, 0..1. */
export function diceSimilarity(a: string, b: string): number {
  if (a === b) return 1
  const A = bigrams(a)
  const B = bigrams(b)
  let total = 0
  let overlap = 0
  for (const n of A.values()) total += n
  for (const n of B.values()) total += n
  for (const [g, n] of A) overlap += Math.min(n, B.get(g) ?? 0)
  return total === 0 ? 0 : (2 * overlap) / total
}

/** Words that say little about which exercise is meant; they count less when comparing names. */
const GENERIC_TOKENS = new Set([
  'machine', 'maschine', 'cable', 'kabel', 'dumbbell', 'kurzhantel', 'barbell', 'langhantel', 'smith', 'seated',
  'sitzend', 'standing', 'stehend', 'lying', 'liegend', 'grip', 'neutral', 'overhand', 'underhand', 'pin', 'loaded',
  'plate', 'single', 'arm', 'leg', 'one', 'two', 'the', 'with', 'mit', 'am', 'an', 'der', 'die', 'das', 'and',
])

const tokenWeight = (t: string) => (GENERIC_TOKENS.has(t) ? 0.35 : 1)

/** Weighted share of tokens of the shorter name that also appear in the longer one, 0..1. */
export function tokenContainment(a: string, b: string): number {
  const ta = new Set(a.split(' '))
  const tb = new Set(b.split(' '))
  const [small, large] = ta.size <= tb.size ? [ta, tb] : [tb, ta]
  let total = 0
  let hit = 0
  for (const t of small) {
    total += tokenWeight(t)
    if (large.has(t)) hit += tokenWeight(t)
  }
  return total === 0 ? 0 : hit / total
}

/** Combined similarity of two already normalized names. */
export function nameSimilarity(a: string, b: string): number {
  // Bigram similarity on the distinctive words only, so "machine … extension" doesn't make
  // "Quad Extension Machine" look like "Machine Back Extension".
  const strip = (s: string) => s.split(' ').filter((t) => !GENERIC_TOKENS.has(t)).join(' ')
  const sa = strip(a)
  const sb = strip(b)
  const dice = sa && sb ? 0.85 * diceSimilarity(sa, sb) + 0.15 * diceSimilarity(a, b) : diceSimilarity(a, b)
  // Containment alone over-rewards very short names ("press"), so it is damped by length ratio.
  const lenRatio = Math.min(a.length, b.length) / Math.max(a.length, b.length)
  const contain = tokenContainment(a, b) * (0.6 + 0.35 * lenRatio)
  return Math.max(dice, contain)
}
