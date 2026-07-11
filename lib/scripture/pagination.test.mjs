import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

async function loadPaginationModule() {
  const dir = join(tmpdir(), `scripture-pagination-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(dir, { recursive: true });
  for (const name of ['types.ts', 'pagination.ts']) {
    const source = await readFile(new URL(`./${name}`, import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
      },
    });
    const output = compiled.outputText.replaceAll("from './types';", "from './types.mjs';");
    await writeFile(join(dir, name.replace('.ts', '.mjs')), output);
  }
  return import(`${pathToFileURL(join(dir, 'pagination.mjs')).href}?v=${Date.now()}`);
}

const john = { order: 43, name: '요한복음', abbreviation: '요', bskoreaCode: 'jhn' };

function verse(chapter, verseStart, text = `본문 ${verseStart}`, verseEnd = verseStart) {
  return { book: john, chapter, verseStart, verseEnd, text };
}

test('paginates two verses per slide by default', async () => {
  const { paginateScriptureVerses } = await loadPaginationModule();
  const pages = paginateScriptureVerses([verse(3, 16), verse(3, 17), verse(3, 18)]);

  assert.equal(pages.length, 2);
  assert.equal(pages[0].title, '요 3:16-17');
  assert.equal(pages[0].text, '16\t본문 16\n17\t본문 17');
  assert.equal(pages[0].verseStart, '3:16');
  assert.equal(pages[0].verseEnd, '3:17');
  assert.equal(pages[1].title, '요 3:18');
});

test('formats verse text with a custom template', async () => {
  const { paginateScriptureVerses } = await loadPaginationModule();
  const pages = paginateScriptureVerses(
    [verse(3, 16), verse(3, 17)],
    2,
    { verseTextFormat: '{절번호}. {절}' },
  );

  assert.equal(pages[0].text, '16. 본문 16\n17. 본문 17');
});

test('supports escaped tabs in custom verse text templates', async () => {
  const { paginateScriptureVerses } = await loadPaginationModule();
  const pages = paginateScriptureVerses(
    [verse(3, 16)],
    1,
    { verseTextFormat: 'v{절번호}\\t{절}' },
  );

  assert.equal(pages[0].text, 'v16\t본문 16');
});

test('supports one verse per slide', async () => {
  const { paginateScriptureVerses } = await loadPaginationModule();
  const pages = paginateScriptureVerses([verse(3, 16), verse(3, 17)], 1);

  assert.deepEqual(pages.map((page) => page.title), ['요 3:16', '요 3:17']);
});

test('formats cross-chapter page labels', async () => {
  const { paginateScriptureVerses } = await loadPaginationModule();
  const pages = paginateScriptureVerses([verse(3, 35), verse(3, 36), verse(4, 1), verse(4, 2)], 3);

  assert.equal(pages[0].title, '요 3:35-4:1');
  assert.equal(pages[1].title, '요 4:2');
});

test('rejects invalid verses per slide values', async () => {
  const { paginateScriptureVerses } = await loadPaginationModule();
  assert.throws(() => paginateScriptureVerses([verse(3, 16)], 0), /1에서 5 사이/);
  assert.throws(() => paginateScriptureVerses([verse(3, 16)], 6), /1에서 5 사이/);
});

test('rejects scripture ranges with too many verses', async () => {
  const { paginateScriptureVerses } = await loadPaginationModule();
  const verses = Array.from({ length: 81 }, (_, index) => verse(119, index + 1));

  assert.throws(() => paginateScriptureVerses(verses, 2), /최대 80절/);
});

test('renders and bounds a combined verse block without splitting it', async () => {
  const { paginateScriptureVerses } = await loadPaginationModule();
  const romans = { order: 45, name: '로마서', abbreviation: '롬', bskoreaCode: 'rom' };
  const combined = {
    book: romans,
    chapter: 9,
    verseStart: 1,
    verseEnd: 2,
    text: '합쳐진 본문',
  };

  const pages = paginateScriptureVerses([combined], 1);
  assert.deepEqual(pages, [
    {
      title: '롬 9:1-2',
      text: '1-2\t합쳐진 본문',
      verseStart: '9:1',
      verseEnd: '9:2',
    },
  ]);
});

test('weights combined blocks by covered verses for page capacity', async () => {
  const { paginateScriptureVerses } = await loadPaginationModule();
  const blocks = [
    verse(9, 1, '합쳐진 본문', 2),
    verse(9, 3),
    verse(9, 4),
  ];

  assert.deepEqual(
    paginateScriptureVerses(blocks, 3).map((page) => page.title),
    ['요 9:1-3', '요 9:4'],
  );
  assert.deepEqual(
    paginateScriptureVerses(blocks, 1).map((page) => page.title),
    ['요 9:1-2', '요 9:3', '요 9:4'],
  );
});

test('counts covered verses rather than source blocks for the 80-verse limit', async () => {
  const { paginateScriptureVerses } = await loadPaginationModule();
  const blocks = Array.from({ length: 40 }, (_, index) =>
    verse(119, index * 2 + 1, `본문 ${index}`, index * 2 + 2),
  );

  assert.doesNotThrow(() => paginateScriptureVerses(blocks, 5));
  assert.throws(
    () => paginateScriptureVerses([...blocks, verse(119, 81)], 5),
    /최대 80절/,
  );
});
