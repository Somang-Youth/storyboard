import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

interface TestScriptureReference {
  book: {
    abbreviation: string;
  };
  start: {
    chapter: number;
    verse: number;
  };
  end: {
    verse: number;
  };
}

async function loadPreviewModule() {
  const sources = [
    ['types.ts', ''],
    ['books.ts', await readFile(new URL('./books.ts', import.meta.url), 'utf8')],
    ['notation.ts', await readFile(new URL('./notation.ts', import.meta.url), 'utf8')],
    ['reference.ts', await readFile(new URL('./reference.ts', import.meta.url), 'utf8')],
    [
      'provider.ts',
      "export async function fetchScriptureVerses() { throw new Error('Unexpected provider call'); }",
    ],
    ['preview.ts', await readFile(new URL('./preview.ts', import.meta.url), 'utf8')],
  ];
  const dir = join(tmpdir(), `scripture-preview-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(dir, { recursive: true });

  for (const [name, source] of sources) {
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
      },
    });
    const output = compiled.outputText
      .replaceAll("from './books';", "from './books.mjs';")
      .replaceAll("from './books.ts';", "from './books.mjs';")
      .replaceAll("from './notation';", "from './notation.mjs';")
      .replaceAll("from './provider';", "from './provider.mjs';")
      .replaceAll("from './provider.ts';", "from './provider.mjs';")
      .replaceAll("from './reference';", "from './reference.mjs';")
      .replaceAll("from './reference.ts';", "from './reference.mjs';")
      .replaceAll("from './types';", "from './types.mjs';")
      .replaceAll("from './types.ts';", "from './types.mjs';");
    await writeFile(join(dir, name.replace('.ts', '.mjs')), output);
  }

  return import(`${pathToFileURL(join(dir, 'preview.mjs')).href}?v=${Date.now()}`);
}

test('builds a serializable preview with normalized reference and verse labels', async () => {
  const { buildScripturePreview } = await loadPreviewModule();
  const seenReferences: TestScriptureReference[] = [];

  const result = await buildScripturePreview('로마서 6:1-2', async (reference: TestScriptureReference) => {
    seenReferences.push(reference);
    return [
      verse(reference, 1, '그런즉 우리가 무슨 말 하리요 은혜를 더하게 하려고 죄에 거하겠느냐'),
      verse(reference, 2, '그럴 수 없느니라 죄에 대하여 죽은 우리가 어찌 그 가운데 더 살리요'),
    ];
  });

  assert.equal(result.reference, '롬 6:1~2');
  assert.deepEqual(result.verses, [
    {
      label: '롬 6:1',
      text: '그런즉 우리가 무슨 말 하리요 은혜를 더하게 하려고 죄에 거하겠느냐',
    },
    {
      label: '롬 6:2',
      text: '그럴 수 없느니라 죄에 대하여 죽은 우리가 어찌 그 가운데 더 살리요',
    },
  ]);
  assert.equal(seenReferences.length, 1);
  assert.equal(seenReferences[0].book.abbreviation, '롬');
  assert.equal(seenReferences[0].start.chapter, 6);
  assert.equal(seenReferences[0].start.verse, 1);
  assert.equal(seenReferences[0].end.verse, 2);
});

test('rejects empty scripture references', async () => {
  const { buildScripturePreview } = await loadPreviewModule();

  await assert.rejects(
    () => buildScripturePreview('   '),
    /말씀 본문을 입력해 주세요/,
  );
});

test('rejects references with no fetched verses', async () => {
  const { buildScripturePreview } = await loadPreviewModule();

  await assert.rejects(
    () => buildScripturePreview('롬 6:1', async () => []),
    /요청한 범위에서 성경 본문을 찾지 못했습니다/,
  );
});

function verse(reference: TestScriptureReference, verseNumber: number, text: string) {
  return {
    book: reference.book,
    chapter: reference.start.chapter,
    verse: verseNumber,
    text,
  };
}
