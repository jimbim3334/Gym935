// Regenerates docs that are derived from code: `npm run docs`.
import { writeFileSync } from 'node:fs'
import { z } from 'zod'
import { SEED_EXERCISES } from '../src/catalog/seed.ts'
import { buildPlanPrompt } from '../src/plan/prompt.ts'
import { planSchema } from '../src/plan/schema.ts'

const root = new URL('../docs/', import.meta.url)

const schema = {
  ...z.toJSONSchema(planSchema, { io: 'input', target: 'draft-2020-12' }),
  $id: 'https://training-app.local/plan-schema.json',
}
writeFileSync(new URL('plan-schema.json', root), JSON.stringify(schema, null, 2) + '\n')

const strength = SEED_EXERCISES.filter((e) => e.kind === 'strength')
const rehab = SEED_EXERCISES.filter((e) => e.kind === 'rehab')

const md = `# Prompt-Vorlagen für Trainingspläne

> Generiert aus \`src/plan/prompt.ts\` mit \`npm run docs\`. Nicht von Hand bearbeiten.
>
> In der App gibt es denselben Prompt unter **Mehr → KI-Prompt kopieren**. Dort enthält er immer deinen
> aktuellen Übungskatalog, inklusive selbst angelegter Übungen. Diese Datei enthält nur den Startkatalog.

So gehst du vor:

1. Passenden Prompt unten kopieren und den Abschnitt **Meine Wünsche** ausfüllen (Ziel, Erfahrung,
   Tage pro Woche, Dauer, Equipment, Einschränkungen, Lieblingsübungen).
2. In eine beliebige KI einfügen. Für noch strengere Ausgabe zusätzlich \`docs/plan-schema.json\` anhängen.
3. Die JSON-Antwort in der App unter **Plan importieren** einfügen.

## Strength

\`\`\`\`text
${buildPlanPrompt('strength', strength)}\`\`\`\`

## Cardio

\`\`\`\`text
${buildPlanPrompt('cardio', [])}\`\`\`\`

## Mobility (Reha)

\`\`\`\`text
${buildPlanPrompt('rehab', [...rehab, ...strength])}\`\`\`\`
`
writeFileSync(new URL('PLAN_PROMPT.md', root), md)

console.log('docs/plan-schema.json and docs/PLAN_PROMPT.md written')
