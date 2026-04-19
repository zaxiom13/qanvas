import fs from 'node:fs/promises';
import path from 'node:path';

const workspaceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const outputPath = path.join(workspaceRoot, 'test', 'fixtures', 'reference-card', 'source-pages.json');
const sourceUrl = 'https://code.kx.com/q/ref/';

const response = await fetch(sourceUrl, {
  headers: {
    'user-agent': 'Qanvas5 reference-card discovery',
  },
});

if (!response.ok) {
  throw new Error(`Failed to fetch ${sourceUrl}: ${response.status} ${response.statusText}`);
}

const html = await response.text();
const pages = discoverCanonicalReferencePages(html, sourceUrl);

await fs.writeFile(outputPath, `${JSON.stringify(pages, null, 2)}\n`);
process.stdout.write(`wrote ${path.relative(workspaceRoot, outputPath)} (${pages.length} pages)\n`);

function discoverCanonicalReferencePages(html, baseUrl) {
  const canonicalPages = new Map();

  canonicalPages.set('reference-card', {
    id: 'reference-card',
    title: 'Reference card',
    url: baseUrl,
  });

  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const resolved = new URL(match[1], baseUrl);

    if (resolved.origin !== 'https://code.kx.com') {
      continue;
    }

    if (!resolved.pathname.startsWith('/q/ref/')) {
      continue;
    }

    const pageMatch = resolved.pathname.match(/^\/q\/ref\/([^/]+)\/$/);
    if (!pageMatch) {
      continue;
    }

    const id = pageMatch[1];
    if (!canonicalPages.has(id)) {
      canonicalPages.set(id, {
        id,
        title: id,
        url: `https://code.kx.com/q/ref/${id}/`,
      });
    }
  }

  return [...canonicalPages.values()].sort((left, right) => {
    if (left.id === 'reference-card') {
      return -1;
    }

    if (right.id === 'reference-card') {
      return 1;
    }

    return left.id.localeCompare(right.id);
  });
}
