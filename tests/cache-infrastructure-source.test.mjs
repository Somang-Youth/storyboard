import { readFile } from 'node:fs/promises';
import { test } from 'vitest';
import assert from 'node:assert/strict';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function getFunctionBody(source, name) {
  const match = source.match(
    new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*(?::[^\\n]+)?\\s*\\{([\\s\\S]*?)\\n\\}`)
  );
  assert.ok(match, `${name} should be exported`);
  return match[1];
}

test('next config enables cache components', async () => {
  const source = await read('next.config.ts');
  assert.match(source, /cacheComponents:\s*true/);
});

test('authenticated layout does not force every page dynamic', async () => {
  const source = await read('app/(authenticated)/layout.tsx');
  assert.doesNotMatch(source, /dynamic\s*=\s*["']force-dynamic["']/);
});

test('cache components routes do not export incompatible segment config', async () => {
  for (const path of [
    'app/(authenticated)/worship-prep/page.tsx',
    'app/(authenticated)/worship-prep/[date]/page.tsx',
    'app/api/assets/sheet-music/[id]/route.ts',
  ]) {
    const source = await read(path);
    assert.doesNotMatch(source, /dynamic\s*=\s*["']force-dynamic["']/);
  }

  const assetRouteSource = await read('app/api/assets/sheet-music/[id]/route.ts');
  assert.doesNotMatch(assetRouteSource, /export\s+const\s+runtime\s*=\s*["']nodejs["']/);
});

test('cache tag helpers define stable storyboard tags', async () => {
  const source = await read('lib/cache/tags.ts');
  for (const expected of [
    'songs',
    'song:',
    'song-presets:',
    'contis',
    'conti:',
    'conti-by-date:',
    'conti-pdf-export:',
    'worship-prep:',
    'worship-prep-list',
  ]) {
    assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(source, /contiPdfExport:\s*\(contiId: string\)\s*=>\s*`conti-pdf-export:\$\{contiId\}`/);
});

test('invalidation helpers use immediate action and route invalidation APIs', async () => {
  const source = await read('lib/cache/invalidation.ts');
  assert.match(source, /from ['"]next\/cache['"]/);
  assert.match(source, /\bupdateTag\b/);
  assert.match(source, /\brevalidateTag\b/);
  assert.match(source, /expire:\s*0/);
  assert.match(source, /invalidateSong/);
  assert.match(source, /invalidateConti/);
  assert.match(source, /invalidateWorshipPrepDate/);

  const pdfExportBody = getFunctionBody(source, 'invalidateContiPdfExport');
  assert.match(pdfExportBody, /cacheTags\.contiPdfExport\(contiId\)/);
  assert.doesNotMatch(pdfExportBody, /cacheTags\.contis\(\)/);
  assert.doesNotMatch(pdfExportBody, /cacheTags\.conti\(contiId\)/);
  assert.doesNotMatch(pdfExportBody, /\binvalidateConti\(/);

  // Conti PDF layout autosave must purge the tag for future reads WITHOUT a
  // read-your-writes refresh. updateTag re-sends the currently-open export
  // route's RSC to the client, which hands the editor new conti/existingExport
  // prop references and forces a full rebuild mid-edit (the "keeps refreshing"
  // bug). Use the non-refreshing expire path instead.
  assert.match(pdfExportBody, /expireCacheTags\(/);
  assert.doesNotMatch(pdfExportBody, /updateCacheTags\(/);
});
