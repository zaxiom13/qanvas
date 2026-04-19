import fs from 'node:fs/promises';
import path from 'node:path';
import { buildReferenceCardCases } from './reference-card-cases.mjs';

const workspaceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const rawDir = path.join(workspaceRoot, 'test', 'fixtures', 'reference-card', 'raw');
const casesDir = path.join(workspaceRoot, 'test', 'fixtures', 'reference-card', 'cases');

await fs.mkdir(casesDir, { recursive: true });

for (const fileName of (await fs.readdir(rawDir)).filter((name) => name.endsWith('.json')).sort()) {
  const page = JSON.parse(await fs.readFile(path.join(rawDir, fileName), 'utf8'));
  const cases = buildReferenceCardCases(page);

  const payload = {
    id: page.id,
    title: page.title,
    sourceUrl: page.sourceUrl,
    harvestedAt: page.harvestedAt,
    generatedFrom: path.relative(workspaceRoot, path.join(rawDir, fileName)),
    caseCount: cases.length,
    executableCount: cases.filter((scenario) => scenario.assertion.kind !== 'skip').length,
    skippedCount: cases.filter((scenario) => scenario.assertion.kind === 'skip').length,
    cases,
  };

  const outputPath = path.join(casesDir, `${page.id}-transcripts.json`);
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  process.stdout.write(`wrote ${path.relative(workspaceRoot, outputPath)} (${cases.length} transcript cases)\n`);
}
