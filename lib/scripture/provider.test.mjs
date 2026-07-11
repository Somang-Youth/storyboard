import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

async function loadProviderModule() {
  const dir = join(tmpdir(), `scripture-provider-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(dir, { recursive: true });
  await symlink(join(process.cwd(), 'node_modules'), join(dir, 'node_modules'), 'dir');
  for (const name of ['types.ts', 'provider.ts']) {
    const source = await readFile(new URL(`./${name}`, import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    });
    const output = compiled.outputText.replaceAll("from './types';", "from './types.mjs';");
    await writeFile(join(dir, name.replace('.ts', '.mjs')), output);
  }
  return import(`${pathToFileURL(join(dir, 'provider.mjs')).href}?v=${Date.now()}`);
}

const john = { order: 43, name: '요한복음', abbreviation: '요', bskoreaCode: 'jhn' };

function verse(chapter, verseNumber, text = `본문 ${verseNumber}`) {
  return { book: john, chapter, verse: verseNumber, text };
}

const fixture = `
  <html><body>
    <div class="leftCont">
      <span><span class="number">16&nbsp;&nbsp;&nbsp;</span>하나님이 세상을 이처럼 사랑하사 <font size="2">1)</font> 독생자를 주셨으니<div id="D_1" class="D2">또는 설명</div></span><br />
      <span><span class="number">17&nbsp;&nbsp;&nbsp;</span>하나님이 그 아들을 세상에 보내신 것은 세상을 심판하려 하심이 아니요</span>
    </div>
  </body></html>
`;

test('extracts verse text from bskorea html', async () => {
  const { parseBskoreaChapterHtml } = await loadProviderModule();
  const verses = parseBskoreaChapterHtml(fixture, john, 3);

  assert.equal(verses.length, 2);
  assert.deepEqual(verses[0], {
    book: john,
    chapter: 3,
    verse: 16,
    text: '하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니',
  });
});

test('removes Hangul and numeric annotation anchors with their note bodies', async () => {
  const { parseBskoreaChapterHtml } = await loadProviderModule();
  const verses = parseBskoreaChapterHtml(
    `
      <div class="leftCont">
        <span>
          <span class="number">8&nbsp;&nbsp;&nbsp;</span>
          성경에 기록된 대로 <font size="2"><a class="comment"><font size="2">ㄱ)</font></a></font>네 이웃을 사랑하라
          <font size="2"><a class="comment"><font size="2">1)</font></a></font> 하셨느니라
          <div id="D_8_1" class="D2">레 19:18</div>
          <div id="D_8_2" class="D3">또는 다른 번역</div>
        </span>
        <span>
          <span class="number">9&nbsp;&nbsp;&nbsp;</span>
          <font size="2"><a class="comment"><font size="2">ㅂ)</font></a></font>본문 시작 관주와
          문장 중간 <a class="comment"><font size="2">ㅌ)</font></a>관주
        </span>
      </div>
    `,
    john,
    2,
  );

  assert.deepEqual(verses.map((item) => item.text), [
    '성경에 기록된 대로 네 이웃을 사랑하라 하셨느니라',
    '본문 시작 관주와 문장 중간 관주',
  ]);
});

test('leaves annotation-free text and ordinary links intact', async () => {
  const { parseBskoreaChapterHtml } = await loadProviderModule();
  const verses = parseBskoreaChapterHtml(
    `
      <div class="leftCont">
        <span><span class="number">1&nbsp;&nbsp;&nbsp;</span>관주 없는 본문 그대로</span>
        <span><span class="number">2&nbsp;&nbsp;&nbsp;</span><a href="/bible">일반 링크 본문</a> 유지</span>
      </div>
    `,
    john,
    2,
  );

  assert.deepEqual(verses.map((item) => item.text), [
    '관주 없는 본문 그대로',
    '일반 링크 본문 유지',
  ]);
});

test('strips duplicated leading verse numbers from verse text', async () => {
  const { parseBskoreaChapterHtml } = await loadProviderModule();
  const verses = parseBskoreaChapterHtml(
    `
      <html><body>
        <div class="leftCont">
          <span><span class="number">17&nbsp;&nbsp;&nbsp;</span>17 유대인이라 불리는 네가 율법을 의지하며</span>
        </div>
      </body></html>
    `,
    john,
    3,
  );

  assert.equal(verses[0].verse, 17);
  assert.equal(verses[0].text, '유대인이라 불리는 네가 율법을 의지하며');
});

test('throws when no verses are found', async () => {
  const { parseBskoreaChapterHtml } = await loadProviderModule();
  assert.throws(() => parseBskoreaChapterHtml('<html></html>', john, 3), /본문을 찾지 못했습니다/);
});

test('throws when a middle verse is missing from the requested range', async () => {
  const { selectReferenceVerses } = await loadProviderModule();
  const reference = {
    book: john,
    start: { chapter: 3, verse: 16 },
    end: { chapter: 3, verse: 18 },
  };
  const versesByChapter = new Map([
    [
      3,
      [verse(3, 16), verse(3, 18)],
    ],
  ]);

  assert.throws(
    () => selectReferenceVerses(reference, versesByChapter),
    /요 3:17/,
  );
});

test('rejects references spanning more than five chapters before reading verses', async () => {
  const { selectReferenceVerses } = await loadProviderModule();
  const reference = {
    book: john,
    start: { chapter: 1, verse: 1 },
    end: { chapter: 6, verse: 1 },
  };

  assert.throws(
    () => selectReferenceVerses(reference, new Map()),
    /최대 5장/,
  );
});

test('throws when a cross-chapter source chapter has a verse gap', async () => {
  const { selectReferenceVerses } = await loadProviderModule();
  const reference = {
    book: john,
    start: { chapter: 3, verse: 35 },
    end: { chapter: 4, verse: 2 },
  };
  const versesByChapter = new Map([
    [3, [verse(3, 35), verse(3, 37)]],
    [4, [verse(4, 1), verse(4, 2)]],
  ]);

  assert.throws(
    () => selectReferenceVerses(reference, versesByChapter),
    /요 3:36/,
  );
});

test('validates parsed chapter gaps before applying range filters', async () => {
  const { selectReferenceVerses } = await loadProviderModule();
  const reference = {
    book: john,
    start: { chapter: 3, verse: 37 },
    end: { chapter: 4, verse: 2 },
  };
  const versesByChapter = new Map([
    [3, [verse(3, 35), verse(3, 37)]],
    [4, [verse(4, 1), verse(4, 2)]],
  ]);

  assert.throws(
    () => selectReferenceVerses(reference, versesByChapter),
    /요 3:36/,
  );
});
