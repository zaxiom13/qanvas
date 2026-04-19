import fs from 'node:fs/promises';
import path from 'node:path';

const workspaceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const sourcePagesPath = path.join(workspaceRoot, 'test', 'fixtures', 'reference-card', 'source-pages.json');
const outputDir = path.join(workspaceRoot, 'test', 'fixtures', 'reference-card', 'raw');

const pages = JSON.parse(await fs.readFile(sourcePagesPath, 'utf8'));
await fs.mkdir(outputDir, { recursive: true });

for (const page of pages) {
  const response = await fetch(page.url, {
    headers: {
      'user-agent': 'Qanvas5 reference-card harvester',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${page.url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const title = extractTitle(html) ?? page.title ?? page.id;
  const blocks = extractQCodeBlocks(html).map((code, index) => ({
    id: `${page.id}-block-${String(index + 1).padStart(3, '0')}`,
    code,
  }));

  const payload = {
    id: page.id,
    title,
    sourceUrl: page.url,
    harvestedAt: new Date().toISOString(),
    blockCount: blocks.length,
    blocks,
  };

  const outputPath = path.join(outputDir, `${page.id}.json`);
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  process.stdout.write(`wrote ${path.relative(workspaceRoot, outputPath)} (${blocks.length} q blocks)\n`);
}

function extractTitle(html) {
  const match = html.match(/<title>(.*?)<\/title>/is);
  return match ? decodeHtml(match[1]).trim() : null;
}

function extractQCodeBlocks(html) {
  return [...html.matchAll(/<pre class="highlight"><code class="language-q">([\s\S]*?)<\/code><\/pre>/g)]
    .map((match) => decodeHtml(match[1]).trim())
    .filter(Boolean);
}
function decodeHtml(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
